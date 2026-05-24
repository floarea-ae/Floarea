from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Header, Body
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import bcrypt
import jwt
import httpx
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from bson import ObjectId

# Database (for auth only)
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'floarea_db')]

JWT_SECRET = os.environ.get('JWT_SECRET')
JWT_ALGORITHM = "HS256"

# Shopify config
SHOPIFY_STORE = os.environ.get('SHOPIFY_STORE_DOMAIN')
SHOPIFY_TOKEN = os.environ.get('SHOPIFY_STOREFRONT_TOKEN')
SHOPIFY_API_VERSION = "2024-10"
SHOPIFY_GRAPHQL_URL = f"https://{SHOPIFY_STORE}/api/{SHOPIFY_API_VERSION}/graphql.json"

# Supabase config
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY', '')

app = FastAPI(title="Floarea API")
api_router = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Hidden collections to exclude from display
HIDDEN_COLLECTIONS = {"frontpage", "box", "box-preserved-flower"}

# Featured collections for home page
FEATURED_COLLECTIONS = [
    "forever-special-occasion-roses", "fresh-special-occasion-flowers",
    "birthday-flowers", "luxurious", "special-occasions", "wedding-florist",
    "love-collection", "congratulations"
]


# ─── Shopify GraphQL Helper ───
async def shopify_graphql(query: str, variables: dict = None) -> dict:
    headers = {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": SHOPIFY_TOKEN,
    }
    payload = {"query": query}
    if variables:
        payload["variables"] = variables

    async with httpx.AsyncClient(timeout=15) as client_http:
        response = await client_http.post(SHOPIFY_GRAPHQL_URL, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()
        if "errors" in data:
            logger.error(f"Shopify GraphQL errors: {data['errors']}")
            raise HTTPException(status_code=502, detail="Shopify API error")
        return data.get("data", {})


# ─── Supabase Helper ───
async def _supabase_request(
    method: str,
    path: str,
    json_data: Optional[dict] = None,
    params: Optional[dict] = None,
    headers: Optional[dict] = None
) -> httpx.Response:
    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.error("Supabase URL or Key not configured")
        raise HTTPException(status_code=500, detail="Supabase configuration missing")
    
    req_headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    if headers:
        req_headers.update(headers)
        
    url = f"{SUPABASE_URL.rstrip('/')}{path}"
    
    async with httpx.AsyncClient(timeout=10) as client_http:
        response = await client_http.request(
            method=method,
            url=url,
            json=json_data,
            params=params,
            headers=req_headers
        )
        if response.status_code >= 400:
            logger.error(f"Supabase request failed: {response.status_code} - {response.text}")
        return response


# ─── Shopify Data Transformers ───
def transform_product(node: dict) -> dict:
    images = [edge["node"]["url"] for edge in node.get("images", {}).get("edges", [])]
    variants = []
    for v_edge in node.get("variants", {}).get("edges", []):
        v = v_edge["node"]
        variants.append({
            "id": v["id"],
            "title": v.get("title", "Default"),
            "price": float(v.get("priceV2", v.get("price", {})).get("amount", 0)),
            "currency": v.get("priceV2", v.get("price", {})).get("currencyCode", "AED"),
            "available": v.get("availableForSale", False),
        })
    price_range = node.get("priceRange", {}).get("minVariantPrice", {})
    collections = [e["node"]["title"] for e in node.get("collections", {}).get("edges", [])]

    return {
        "id": node["id"],
        "handle": node["handle"],
        "title": node["title"],
        "description": node.get("description", ""),
        "price": float(price_range.get("amount", 0)),
        "currency": price_range.get("currencyCode", "AED"),
        "image": images[0] if images else "",
        "images": images,
        "variants": variants,
        "available": node.get("availableForSale", False),
        "tags": node.get("tags", []),
        "collections": collections,
        "variant_id": variants[0]["id"] if variants else "",
    }

def transform_collection(node: dict) -> dict:
    return {
        "id": node["id"],
        "handle": node["handle"],
        "title": node["title"],
        "description": node.get("description", ""),
        "image": node.get("image", {}).get("url", "") if node.get("image") else "",
    }


# ─── Auth Helpers ───
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def create_token(user_id: str, email: str) -> str:
    return jwt.encode(
        {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(days=30), "type": "access"},
        JWT_SECRET, algorithm=JWT_ALGORITHM
    )

async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(authorization[7:], JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return {
            "id": str(user["_id"]), "name": user["name"], "email": user["email"],
            "phone": user.get("phone", ""), "role": user.get("role", "customer")
        }
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError) as e:
        raise HTTPException(status_code=401, detail=str(e))


# ─── Auth Models ───
class RegisterReq(BaseModel):
    name: str
    email: str
    password: str
    phone: str = ""

class LoginReq(BaseModel):
    email: str
    password: str

class CartLineInput(BaseModel):
    variantId: str
    quantity: int = 1

class CreateCartReq(BaseModel):
    lines: List[CartLineInput]


# ─── Auth Routes ───
@api_router.post("/auth/register")
async def register(req: RegisterReq):
    email = req.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    result = await db.users.insert_one({
        "name": req.name, "email": email,
        "password_hash": hash_password(req.password),
        "phone": req.phone, "role": "customer",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    uid = str(result.inserted_id)
    return {
        "token": create_token(uid, email),
        "user": {"id": uid, "name": req.name, "email": email, "phone": req.phone, "role": "customer"}
    }

@api_router.post("/auth/login")
async def login(req: LoginReq):
    email = req.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    uid = str(user["_id"])
    return {
        "token": create_token(uid, email),
        "user": {"id": uid, "name": user["name"], "email": email, "phone": user.get("phone", ""), "role": user.get("role", "customer")}
    }

@api_router.get("/auth/me")
async def get_me(authorization: Optional[str] = Header(None)):
    return {"user": await get_current_user(authorization)}


# ─── Shopify Collections ───
@api_router.get("/collections")
async def get_collections(featured_only: bool = False):
    query = """
    {
      collections(first: 30) {
        edges {
          node {
            id handle title description
            image { url }
          }
        }
      }
    }
    """
    data = await shopify_graphql(query)
    collections = [
        transform_collection(edge["node"])
        for edge in data.get("collections", {}).get("edges", [])
        if edge["node"]["handle"] not in HIDDEN_COLLECTIONS
    ]
    if featured_only:
        featured_set = set(FEATURED_COLLECTIONS)
        collections = [c for c in collections if c["handle"] in featured_set]
        collections.sort(key=lambda c: FEATURED_COLLECTIONS.index(c["handle"]) if c["handle"] in FEATURED_COLLECTIONS else 99)
    return {"collections": collections}


@api_router.get("/collections/{handle}")
async def get_collection(handle: str, first: int = 30):
    query = """
    query($handle: String!, $first: Int!) {
      collection(handle: $handle) {
        id handle title description
        image { url }
        products(first: $first) {
          edges {
            node {
              id handle title description availableForSale tags
              priceRange { minVariantPrice { amount currencyCode } }
              images(first: 5) { edges { node { url altText } } }
              variants(first: 5) { edges { node { id title priceV2: price { amount currencyCode } availableForSale } } }
              collections(first: 3) { edges { node { handle title } } }
            }
          }
        }
      }
    }
    """
    data = await shopify_graphql(query, {"handle": handle, "first": first})
    collection = data.get("collection")
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")

    products = [transform_product(edge["node"]) for edge in collection.get("products", {}).get("edges", [])]
    return {
        "collection": transform_collection(collection),
        "products": products,
    }


# ─── Shopify Products ───
@api_router.get("/products")
async def get_products(search: Optional[str] = None, first: int = 30, collection: Optional[str] = None):
    if collection:
        result = await get_collection(collection, first)
        return {"products": result["products"]}

    if search:
        query = """
        query($query: String!, $first: Int!) {
          products(first: $first, query: $query) {
            edges {
              node {
                id handle title description availableForSale tags
                priceRange { minVariantPrice { amount currencyCode } }
                images(first: 3) { edges { node { url altText } } }
                variants(first: 3) { edges { node { id title priceV2: price { amount currencyCode } availableForSale } } }
                collections(first: 3) { edges { node { handle title } } }
              }
            }
          }
        }
        """
        data = await shopify_graphql(query, {"query": search, "first": first})
    else:
        query = """
        query($first: Int!) {
          products(first: $first) {
            edges {
              node {
                id handle title description availableForSale tags
                priceRange { minVariantPrice { amount currencyCode } }
                images(first: 3) { edges { node { url altText } } }
                variants(first: 3) { edges { node { id title priceV2: price { amount currencyCode } availableForSale } } }
                collections(first: 3) { edges { node { handle title } } }
              }
            }
          }
        }
        """
        data = await shopify_graphql(query, {"first": first})

    products = [transform_product(edge["node"]) for edge in data.get("products", {}).get("edges", [])]
    return {"products": products}


@api_router.get("/products/{handle}")
async def get_product(handle: str):
    query = """
    query($handle: String!) {
      product(handle: $handle) {
        id handle title description availableForSale tags
        priceRange { minVariantPrice { amount currencyCode } }
        images(first: 10) { edges { node { url altText } } }
        variants(first: 10) { edges { node { id title priceV2: price { amount currencyCode } availableForSale } } }
        collections(first: 5) { edges { node { handle title } } }
      }
    }
    """
    data = await shopify_graphql(query, {"handle": handle})
    product = data.get("product")
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return transform_product(product)


# ─── Shopify Cart / Checkout ───
@api_router.post("/cart/create")
async def create_cart(req: CreateCartReq):
    lines = [{"merchandiseId": line.variantId, "quantity": line.quantity} for line in req.lines]
    mutation = """
    mutation($lines: [CartLineInput!]!) {
      cartCreate(input: { lines: $lines }) {
        cart {
          id
          checkoutUrl
          cost { totalAmount { amount currencyCode } }
        }
        userErrors { field message }
      }
    }
    """
    data = await shopify_graphql(mutation, {"lines": lines})
    cart_data = data.get("cartCreate", {})
    errors = cart_data.get("userErrors", [])
    if errors:
        raise HTTPException(status_code=400, detail=errors[0].get("message", "Cart creation failed"))

    cart = cart_data.get("cart", {})
    return {
        "cart_id": cart.get("id", ""),
        "checkout_url": cart.get("checkoutUrl", ""),
        "total": float(cart.get("cost", {}).get("totalAmount", {}).get("amount", 0)),
        "currency": cart.get("cost", {}).get("totalAmount", {}).get("currencyCode", "AED"),
    }


# ─── Shopify Customer Auth ───
class ShopifyLoginReq(BaseModel):
    email: str
    password: str

class ShopifyRegisterReq(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str = ""
    phone: str = ""

@api_router.post("/shopify-auth/register")
async def shopify_register(req: ShopifyRegisterReq):
    mutation = """
    mutation($input: CustomerCreateInput!) {
      customerCreate(input: $input) {
        customer { id firstName lastName email phone }
        customerUserErrors { code field message }
      }
    }
    """
    variables = {"input": {
        "email": req.email, "password": req.password,
        "firstName": req.first_name, "lastName": req.last_name or req.first_name,
    }}
    if req.phone:
        variables["input"]["phone"] = req.phone
    data = await shopify_graphql(mutation, variables)
    result = data.get("customerCreate", {})
    errors = result.get("customerUserErrors", [])
    if errors:
        raise HTTPException(status_code=400, detail=errors[0].get("message", "Registration failed"))
    # Auto-login after register
    return await shopify_login(ShopifyLoginReq(email=req.email, password=req.password))

@api_router.post("/shopify-auth/login")
async def shopify_login(req: ShopifyLoginReq):
    mutation = """
    mutation($input: CustomerAccessTokenCreateInput!) {
      customerAccessTokenCreate(input: $input) {
        customerAccessToken { accessToken expiresAt }
        customerUserErrors { code field message }
      }
    }
    """
    data = await shopify_graphql(mutation, {"input": {"email": req.email, "password": req.password}})
    result = data.get("customerAccessTokenCreate", {})
    errors = result.get("customerUserErrors", [])
    if errors:
        raise HTTPException(status_code=401, detail=errors[0].get("message", "Invalid credentials"))
    token_data = result.get("customerAccessToken", {})
    if not token_data:
        raise HTTPException(status_code=401, detail="Login failed")
    customer_token = token_data["accessToken"]
    # Fetch customer profile
    profile = await _get_shopify_customer(customer_token)
    # Also store/update in local DB for push tokens
    email = req.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if not existing:
        result_db = await db.users.insert_one({
            "name": profile.get("firstName", "") + " " + profile.get("lastName", ""),
            "email": email, "password_hash": hash_password(req.password),
            "phone": profile.get("phone", ""), "role": "customer",
            "shopify_customer_id": profile.get("id", ""),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        local_id = str(result_db.inserted_id)
    else:
        local_id = str(existing["_id"])
        await db.users.update_one({"_id": existing["_id"]}, {"$set": {"shopify_customer_id": profile.get("id", "")}})
    local_jwt = create_token(local_id, email)
    return {
        "token": local_jwt,
        "shopify_customer_token": customer_token,
        "user": {
            "id": local_id, "name": (profile.get("firstName", "") + " " + profile.get("lastName", "")).strip(),
            "email": email, "phone": profile.get("phone", ""), "role": "customer",
        }
    }

async def _get_shopify_customer(customer_token: str) -> dict:
    query = """
    query($token: String!) {
      customer(customerAccessToken: $token) {
        id firstName lastName email phone
        defaultAddress { address1 city province country zip }
      }
    }
    """
    data = await shopify_graphql(query, {"token": customer_token})
    return data.get("customer", {})

async def _authenticate_shopify_customer(shopify_token: Optional[str]) -> dict:
    if not shopify_token:
        raise HTTPException(status_code=401, detail="Shopify customer token required")
    profile = await _get_shopify_customer(shopify_token)
    if not profile or not profile.get("id"):
        raise HTTPException(status_code=401, detail="Invalid or expired customer token")
    return profile

@api_router.get("/shopify-auth/orders")
async def get_shopify_orders(shopify_token: str = Header(alias="x-shopify-customer-token")):
    if not shopify_token:
        raise HTTPException(status_code=401, detail="Shopify customer token required")
    query = """
    query($token: String!) {
      customer(customerAccessToken: $token) {
        orders(first: 20, sortKey: PROCESSED_AT, reverse: true) {
          edges {
            node {
              id name orderNumber processedAt
              financialStatus fulfillmentStatus
              totalPrice { amount currencyCode }
              lineItems(first: 10) {
                edges {
                  node {
                    title quantity
                    variant { image { url } price { amount currencyCode } }
                  }
                }
              }
              shippingAddress { address1 city province country }
            }
          }
        }
      }
    }
    """
    data = await shopify_graphql(query, {"token": shopify_token})
    customer = data.get("customer")
    if not customer:
        raise HTTPException(status_code=401, detail="Invalid or expired customer token")
    orders = []
    for edge in customer.get("orders", {}).get("edges", []):
        node = edge["node"]
        items = []
        for li_edge in node.get("lineItems", {}).get("edges", []):
            li = li_edge["node"]
            variant = li.get("variant") or {}
            items.append({
                "title": li["title"], "quantity": li["quantity"],
                "price": float(variant.get("price", {}).get("amount", 0)),
                "image": (variant.get("image") or {}).get("url", ""),
            })
        orders.append({
            "id": node["id"], "name": node["name"], "order_number": node.get("orderNumber"),
            "processed_at": node.get("processedAt", ""),
            "financial_status": node.get("financialStatus", ""),
            "fulfillment_status": node.get("fulfillmentStatus", ""),
            "total": float(node.get("totalPrice", {}).get("amount", 0)),
            "currency": node.get("totalPrice", {}).get("currencyCode", "AED"),
            "items": items,
            "shipping_address": node.get("shippingAddress"),
        })
    return {"orders": orders}


# ─── Push Notifications ───
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

class PushTokenReq(BaseModel):
    push_token: str
    platform: Optional[str] = None

class PushSendReq(BaseModel):
    customer_id: str
    title: str
    body: str
    data: Optional[dict] = None

@api_router.post("/push/register")
async def register_push_token(
    req: PushTokenReq,
    shopify_token: str = Header(alias="x-shopify-customer-token")
):
    profile = await _authenticate_shopify_customer(shopify_token)
    customer_id = profile["id"]
    customer_email = profile.get("email", "")

    # Store token in Supabase
    headers = {
        "Prefer": "resolution=merge-duplicates"
    }
    params = {
        "on_conflict": "expo_token"
    }
    payload = {
        "customer_id": customer_id,
        "expo_token": req.push_token,
        "platform": req.platform or "unknown",
        "customer_email": customer_email,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    response = await _supabase_request(
        "POST",
        "/rest/v1/push_tokens",
        json_data=payload,
        params=params,
        headers=headers
    )
    if response.status_code >= 400:
        raise HTTPException(status_code=500, detail="Failed to register push token in storage")

    return {"status": "registered"}

@api_router.delete("/push/unregister")
async def unregister_push_token(
    expo_token: Optional[str] = None,
    shopify_token: str = Header(alias="x-shopify-customer-token")
):
    profile = await _authenticate_shopify_customer(shopify_token)
    customer_id = profile["id"]

    params = {
        "customer_id": f"eq.{customer_id}"
    }
    if expo_token:
        params["expo_token"] = f"eq.{expo_token}"

    response = await _supabase_request(
        "DELETE",
        "/rest/v1/push_tokens",
        params=params
    )
    if response.status_code >= 400:
        raise HTTPException(status_code=500, detail="Failed to unregister push token in storage")

    return {"status": "unregistered"}

@api_router.post("/push/send")
async def send_push_notification(req: PushSendReq):
    # Fetch tokens from Supabase for this customer_id
    params = {
        "customer_id": f"eq.{req.customer_id}"
    }
    response = await _supabase_request("GET", "/rest/v1/push_tokens", params=params)
    if response.status_code >= 400:
        raise HTTPException(status_code=500, detail="Failed to retrieve push tokens")

    tokens = response.json()
    if not tokens:
        return {"sent": 0}

    messages = [
        {"to": t["expo_token"], "title": req.title, "body": req.body, "data": req.data or {}, "sound": "default"}
        for t in tokens if t.get("expo_token", "").startswith("ExponentPushToken")
    ]
    if messages:
        async with httpx.AsyncClient(timeout=10) as http:
            await http.post(EXPO_PUSH_URL, json=messages, headers={"Content-Type": "application/json"})
    return {"sent": len(messages)}

# ─── Shopify Cart with Customer ───
@api_router.post("/cart/create-with-customer")
async def create_cart_with_customer(
    req: CreateCartReq,
    shopify_token: Optional[str] = Header(default=None, alias="x-shopify-customer-token"),
):
    lines = [{"merchandiseId": line.variantId, "quantity": line.quantity} for line in req.lines]
    if shopify_token:
        mutation = """
        mutation($lines: [CartLineInput!]!, $token: String!) {
          cartCreate(input: { lines: $lines, buyerIdentity: { customerAccessToken: $token } }) {
            cart { id checkoutUrl cost { totalAmount { amount currencyCode } } }
            userErrors { field message }
          }
        }
        """
        data = await shopify_graphql(mutation, {"lines": lines, "token": shopify_token})
    else:
        mutation = """
        mutation($lines: [CartLineInput!]!) {
          cartCreate(input: { lines: $lines }) {
            cart { id checkoutUrl cost { totalAmount { amount currencyCode } } }
            userErrors { field message }
          }
        }
        """
        data = await shopify_graphql(mutation, {"lines": lines})
    cart_data = data.get("cartCreate", {})
    errors = cart_data.get("userErrors", [])
    if errors:
        raise HTTPException(status_code=400, detail=errors[0].get("message", "Cart creation failed"))
    cart = cart_data.get("cart", {})
    return {
        "cart_id": cart.get("id", ""),
        "checkout_url": cart.get("checkoutUrl", ""),
        "total": float(cart.get("cost", {}).get("totalAmount", {}).get("amount", 0)),
        "currency": cart.get("cost", {}).get("totalAmount", {}).get("currencyCode", "AED"),
    }


# ─── Hero Banner ───
@api_router.get("/hero-banner")
async def get_hero_banner():
    """
    Returns hero banner data from the Shopify 'frontpage' collection.
    Update the frontpage collection image/description in Shopify admin to change the banner.
    Falls back to shop metafields if the collection has no image.
    """
    query = """
    {
      collection(handle: "frontpage") {
        title
        description
        image { url altText }
        metafield(namespace: "hero", key: "subtitle") { value }
        metafield2: metafield(namespace: "hero", key: "cta_text") { value }
        metafield3: metafield(namespace: "hero", key: "cta_url") { value }
      }
    }
    """
    data = await shopify_graphql(query)
    collection = data.get("collection") or {}
    image_url = (collection.get("image") or {}).get("url", "")
    image_alt = (collection.get("image") or {}).get("altText", "")

    return {
        "image": image_url,
        "image_alt": image_alt,
        "title": collection.get("title", ""),
        "description": collection.get("description", ""),
        "subtitle": (collection.get("metafield") or {}).get("value", ""),
        "cta_text": (collection.get("metafield2") or {}).get("value", ""),
        "cta_url": (collection.get("metafield3") or {}).get("value", ""),
    }


# ─── Health ───
@api_router.get("/health")
async def health():
    return {"status": "ok", "service": "Floarea API", "shopify_connected": bool(SHOPIFY_TOKEN)}

app.include_router(api_router)


# ─── Startup ───
@app.on_event("startup")
async def startup():
    admin_email = os.environ.get('ADMIN_EMAIL', 'admin@floarea.ae')
    admin_password = os.environ.get('ADMIN_PASSWORD', 'admin123')

    env = os.environ.get('ENV', 'development').lower()
    is_production = env == 'production' or os.environ.get('PRODUCTION', 'false').lower() == 'true'

    try:
        # DB operations
        await db.users.create_index("email", unique=True)

        is_default_admin = (admin_email == 'admin@floarea.ae' and admin_password == 'admin123')
        if is_production and is_default_admin:
            logger.warning("Skipping default admin user seed in production for security.")
        else:
            if not await db.users.find_one({"email": admin_email}):
                await db.users.insert_one({
                    "name": "Admin",
                    "email": admin_email,
                    "password_hash": hash_password(admin_password),
                    "phone": "+971501311930",
                    "role": "admin",
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
                logger.info("Seeded admin user")

    except Exception as e:
        print("DB not available, skipping ALL DB operations")

    if not is_production:
        try:
            # NON-DB operations (safe for dev only)
            os.makedirs("/app/memory", exist_ok=True)

            with open("/app/memory/test_credentials.md", "w") as f:
                f.write(
                    f"# Test Credentials\n\n"
                    f"## Admin\n- Email: {admin_email}\n- Password: {admin_password}\n- Role: admin\n\n"
                    f"## Shopify Customer Auth\n"
                    f"- POST /api/shopify-auth/register\n"
                    f"- POST /api/shopify-auth/login\n"
                    f"- GET /api/shopify-auth/orders (header: x-shopify-customer-token)\n\n"
                    f"## Push Notifications\n"
                    f"- POST /api/push/register\n"
                    f"- POST /api/push/send\n"
                    f"- DELETE /api/push/unregister\n"
                )
        except Exception as e:
            logger.error(f"Failed to write test credentials: {e}")
    else:
        logger.info("Skipping test credentials file write in production.")

    logger.info(f"Startup complete. Shopify store: {SHOPIFY_STORE}")


@app.on_event("shutdown")
async def shutdown():
    client.close()
