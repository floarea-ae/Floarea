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


# ─── Health ───
@api_router.get("/health")
async def health():
    return {"status": "ok", "service": "Floarea API", "shopify_connected": bool(SHOPIFY_TOKEN)}

app.include_router(api_router)


# ─── Startup ───
@app.on_event("startup")
async def startup():
    # Create indexes
    await db.users.create_index("email", unique=True)

    # Admin user
    admin_email = os.environ.get('ADMIN_EMAIL', 'admin@floarea.ae')
    admin_password = os.environ.get('ADMIN_PASSWORD', 'admin123')
    if not await db.users.find_one({"email": admin_email}):
        await db.users.insert_one({
            "name": "Admin", "email": admin_email,
            "password_hash": hash_password(admin_password),
            "phone": "+971501311930", "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info("Seeded admin user")

    # Write test credentials
    os.makedirs("/app/memory", exist_ok=True)
    with open("/app/memory/test_credentials.md", "w") as f:
        f.write(f"# Test Credentials\n\n## Admin\n- Email: {admin_email}\n- Password: {admin_password}\n- Role: admin\n\n## Auth Endpoints\n- POST /api/auth/register\n- POST /api/auth/login\n- GET /api/auth/me\n\n## Shopify Endpoints\n- GET /api/collections\n- GET /api/collections/{{handle}}\n- GET /api/products\n- GET /api/products/{{handle}}\n- POST /api/cart/create\n- GET /api/health\n")

    logger.info(f"Startup complete. Shopify store: {SHOPIFY_STORE}")


@app.on_event("shutdown")
async def shutdown():
    client.close()
