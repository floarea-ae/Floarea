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
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from bson import ObjectId

# Database
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'floarea_db')]

JWT_SECRET = os.environ.get('JWT_SECRET')
JWT_ALGORITHM = "HS256"

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


# ─── Models ───
class RegisterReq(BaseModel):
    name: str
    email: str
    password: str
    phone: str = ""

class LoginReq(BaseModel):
    email: str
    password: str

class OrderItemModel(BaseModel):
    product_id: str
    name: str
    price: float
    image: str
    quantity: int

class CreateOrderReq(BaseModel):
    items: List[OrderItemModel]
    delivery_name: str
    delivery_phone: str
    delivery_address: str
    delivery_area: str
    delivery_city: str = "Dubai"
    delivery_notes: str = ""
    delivery_date: str = ""
    subtotal: float
    delivery_fee: float = 0
    total: float


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


# ─── Products ───
@api_router.get("/products")
async def get_products(category: Optional[str] = None, search: Optional[str] = None, featured: Optional[bool] = None):
    query = {}
    if category:
        query["category_slug"] = category
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    if featured is True:
        query["featured"] = True
    products = await db.products.find(query, {"_id": 0}).to_list(100)
    return {"products": products}

@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


# ─── Categories ───
@api_router.get("/categories")
async def get_categories():
    return {"categories": await db.categories.find({}, {"_id": 0}).to_list(20)}


# ─── Orders ───
@api_router.post("/orders/create")
async def create_order(req: CreateOrderReq, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    order_id = "FL-" + str(uuid.uuid4())[:8].upper()
    order = {
        "id": order_id, "user_id": user["id"],
        "items": [item.dict() for item in req.items],
        "delivery": {
            "name": req.delivery_name, "phone": req.delivery_phone,
            "address": req.delivery_address, "area": req.delivery_area,
            "city": req.delivery_city, "notes": req.delivery_notes, "date": req.delivery_date
        },
        "subtotal": req.subtotal, "delivery_fee": req.delivery_fee, "total": req.total,
        "payment_status": "paid", "payment_method": "paymob",
        "order_status": "confirmed",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.orders.insert_one(order)
    return {"order": {k: v for k, v in order.items() if k != "_id"}}

@api_router.get("/orders")
async def get_orders(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    orders = await db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"orders": orders}

@api_router.get("/orders/{order_id}")
async def get_order(order_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    order = await db.orders.find_one({"id": order_id, "user_id": user["id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


# ─── Health ───
@api_router.get("/health")
async def health():
    return {"status": "ok", "service": "Floarea API"}

app.include_router(api_router)


# ─── Seed Data ───
@app.on_event("startup")
async def seed_data():
    # Categories
    if await db.categories.count_documents({}) == 0:
        await db.categories.insert_many([
            {"id": "best-sellers", "name": "Best Sellers", "slug": "best-sellers",
             "description": "Our most loved arrangements",
             "image": "https://images.unsplash.com/photo-1548094967-e25a127d1f6d?w=800"},
            {"id": "forever-roses", "name": "Forever Roses", "slug": "forever-roses",
             "description": "Luxury preserved roses designed to last for years",
             "image": "https://images.unsplash.com/photo-1642991946115-9afea1d7d3d3?w=800"},
            {"id": "fresh-flowers", "name": "Fresh Flowers", "slug": "fresh-flowers",
             "description": "Handpicked daily for the freshest blooms",
             "image": "https://images.unsplash.com/photo-1581264692636-3cf6f29655c2?w=800"},
            {"id": "special-occasions", "name": "Special Occasions", "slug": "special-occasions",
             "description": "Perfect for weddings, birthdays & celebrations",
             "image": "https://images.unsplash.com/photo-1602927846637-c3270a127413?w=800"},
        ])
        logger.info("Seeded categories")

    # Products
    if await db.products.count_documents({}) == 0:
        products = [
            {
                "id": "rose-jardin-royal", "name": "Rosé Jardin Royal", "price": 1999,
                "description": "A blooming expression of elegance and natural beauty, the Rosé Jardin Royal is inspired by the timeless charm of a lush garden in full bloom. Featuring an exquisite arrangement of premium roses in soft hues.",
                "category_slug": "best-sellers", "category_name": "Best Sellers",
                "image": "https://images.unsplash.com/photo-1548094967-e25a127d1f6d?w=800",
                "images": ["https://images.unsplash.com/photo-1548094967-e25a127d1f6d?w=800"],
                "featured": True, "in_stock": True,
                "care": "Keep in a cool, dry place away from direct sunlight. No water needed for preserved roses.",
                "delivery_info": "Same-day delivery available across Dubai. Free delivery on orders above Dhs. 500."
            },
            {
                "id": "blush-tulip-bouquet", "name": "Blush Tulip Bouquet", "price": 545,
                "description": "Soft, graceful, and effortlessly elegant — the Blush Tulip Bouquet is a timeless expression of love and beauty. Perfect for birthdays, anniversaries, or simply brightening someone's day.",
                "category_slug": "fresh-flowers", "category_name": "Fresh Flowers",
                "image": "https://images.unsplash.com/photo-1581264692636-3cf6f29655c2?w=800",
                "images": ["https://images.unsplash.com/photo-1581264692636-3cf6f29655c2?w=800"],
                "featured": True, "in_stock": True,
                "care": "Change water every 2 days. Trim stems at an angle for better absorption.",
                "delivery_info": "Same-day delivery available across Dubai."
            },
            {
                "id": "blush-eclat-basket", "name": "Blush Éclat Basket", "price": 2300,
                "description": "A refined statement of elegance, the Blush Éclat Basket captures the beauty of soft pink roses arranged in a luxurious handwoven basket.",
                "category_slug": "best-sellers", "category_name": "Best Sellers",
                "image": "https://images.unsplash.com/photo-1602927846637-c3270a127413?w=800",
                "images": ["https://images.unsplash.com/photo-1602927846637-c3270a127413?w=800"],
                "featured": True, "in_stock": True,
                "care": "Keep away from direct sunlight and heat sources.",
                "delivery_info": "Free delivery across Dubai & Abu Dhabi."
            },
            {
                "id": "111-royal-white-rose", "name": "111 Royal White Rose", "price": 1100,
                "description": "A timeless expression of luxury and purity, the 111 White Rose Doom is designed to make a grand statement with its stunning dome of pure white preserved roses.",
                "category_slug": "forever-roses", "category_name": "Forever Roses",
                "image": "https://images.unsplash.com/photo-1642991946115-9afea1d7d3d3?w=800",
                "images": ["https://images.unsplash.com/photo-1642991946115-9afea1d7d3d3?w=800"],
                "featured": True, "in_stock": True,
                "care": "Preserved roses require no water. Keep in a cool, dry environment.",
                "delivery_info": "Same-day delivery across UAE."
            },
            {
                "id": "royal-amethyste-bloom", "name": "Royal Améthyste Bloom", "price": 1245,
                "description": "A bold expression of refined luxury, the Royal Améthyste Bloom captivates with deep purple and magenta preserved roses in an elegant dome arrangement.",
                "category_slug": "forever-roses", "category_name": "Forever Roses",
                "image": "https://static.prod-images.emergentagent.com/jobs/a06552a2-c265-40ba-8f47-09377686258f/images/7a38dfc4f58944083838abb9587b764e9809560d2e9979a74da00d8440727956.png",
                "images": ["https://static.prod-images.emergentagent.com/jobs/a06552a2-c265-40ba-8f47-09377686258f/images/7a38dfc4f58944083838abb9587b764e9809560d2e9979a74da00d8440727956.png"],
                "featured": False, "in_stock": True,
                "care": "Preserved roses last 1-3 years. Avoid moisture and direct sunlight.",
                "delivery_info": "Delivery within 24 hours across UAE."
            },
            {
                "id": "ivory-tulip-bouquet", "name": "Ivory Tulip Bouquet", "price": 545,
                "description": "Elegant in its simplicity, the Ivory Tulip Bouquet is a refined expression of purity and grace with pristine white tulips.",
                "category_slug": "fresh-flowers", "category_name": "Fresh Flowers",
                "image": "https://static.prod-images.emergentagent.com/jobs/a06552a2-c265-40ba-8f47-09377686258f/images/bb43e32f1de35ccdae4ff274e261cafb9eec619a1fdfd82effeb85a816e39db2.png",
                "images": ["https://static.prod-images.emergentagent.com/jobs/a06552a2-c265-40ba-8f47-09377686258f/images/bb43e32f1de35ccdae4ff274e261cafb9eec619a1fdfd82effeb85a816e39db2.png"],
                "featured": False, "in_stock": True,
                "care": "Trim stems and change water every 2 days.",
                "delivery_info": "Same-day delivery in Dubai."
            },
            {
                "id": "blush-romance-bouquet", "name": "Blush Romance Bouquet", "price": 630,
                "description": "Delicate, charming, and full of warmth — the Blush Romance Bouquet celebrates love with soft pink and cream roses in an artful arrangement.",
                "category_slug": "fresh-flowers", "category_name": "Fresh Flowers",
                "image": "https://images.unsplash.com/photo-1760373071711-960143464e34?w=800",
                "images": ["https://images.unsplash.com/photo-1760373071711-960143464e34?w=800"],
                "featured": True, "in_stock": True,
                "care": "Keep in a cool spot. Refresh water daily.",
                "delivery_info": "Same-day delivery across Dubai."
            },
            {
                "id": "111-royal-pink-rose", "name": "111 Royal Pink Rose", "price": 1100,
                "description": "A bold expression of love and elegance, the 111 Royal Pink Rose dome is designed to make every moment unforgettable with stunning preserved pink roses.",
                "category_slug": "forever-roses", "category_name": "Forever Roses",
                "image": "https://images.unsplash.com/photo-1771164802337-3c980073df4f?w=800",
                "images": ["https://images.unsplash.com/photo-1771164802337-3c980073df4f?w=800"],
                "featured": False, "in_stock": True,
                "care": "Preserved roses need no maintenance. Keep dry.",
                "delivery_info": "Free delivery on orders above Dhs. 500."
            },
            {
                "id": "blush-ivory-harmony", "name": "Blush Ivory Harmony Bouquet", "price": 380,
                "description": "A perfect balance of romance and elegance, bringing together the softest shades of blush and ivory roses in a hand-tied bouquet.",
                "category_slug": "fresh-flowers", "category_name": "Fresh Flowers",
                "image": "https://images.unsplash.com/photo-1487530811176-3780de880c2d?w=800",
                "images": ["https://images.unsplash.com/photo-1487530811176-3780de880c2d?w=800"],
                "featured": True, "in_stock": True,
                "care": "Trim stems, change water every 2 days.",
                "delivery_info": "Same-day delivery in Dubai."
            },
            {
                "id": "midnight-red-dome", "name": "Midnight Red Rose Dome", "price": 1650,
                "description": "A stunning dome of deep red preserved roses, perfect for making a lasting impression on special occasions like anniversaries and proposals.",
                "category_slug": "special-occasions", "category_name": "Special Occasions",
                "image": "https://images.unsplash.com/photo-1548094967-e25a127d1f6d?w=800",
                "images": ["https://images.unsplash.com/photo-1548094967-e25a127d1f6d?w=800"],
                "featured": True, "in_stock": True,
                "care": "No water needed. Keep away from moisture.",
                "delivery_info": "Delivery across UAE within 24 hours."
            },
            {
                "id": "celebration-mixed-bouquet", "name": "Celebration Mixed Bouquet", "price": 750,
                "description": "A vibrant mix of seasonal flowers designed to brighten any celebration with color, joy, and the freshest blooms of the season.",
                "category_slug": "special-occasions", "category_name": "Special Occasions",
                "image": "https://images.unsplash.com/photo-1581264692636-3cf6f29655c2?w=800",
                "images": ["https://images.unsplash.com/photo-1581264692636-3cf6f29655c2?w=800"],
                "featured": False, "in_stock": True,
                "care": "Keep fresh. Trim stems and refresh water daily.",
                "delivery_info": "Same-day delivery across Dubai."
            },
            {
                "id": "white-orchid-elegance", "name": "White Orchid Elegance", "price": 890,
                "description": "Pristine white orchids arranged with masterful precision, evoking sophistication and pure elegance for any refined occasion.",
                "category_slug": "special-occasions", "category_name": "Special Occasions",
                "image": "https://static.prod-images.emergentagent.com/jobs/a06552a2-c265-40ba-8f47-09377686258f/images/bb43e32f1de35ccdae4ff274e261cafb9eec619a1fdfd82effeb85a816e39db2.png",
                "images": ["https://static.prod-images.emergentagent.com/jobs/a06552a2-c265-40ba-8f47-09377686258f/images/bb43e32f1de35ccdae4ff274e261cafb9eec619a1fdfd82effeb85a816e39db2.png"],
                "featured": False, "in_stock": True,
                "care": "Water orchids sparingly. Indirect light preferred.",
                "delivery_info": "Same-day delivery in Dubai & Sharjah."
            },
        ]
        await db.products.insert_many(products)
        logger.info(f"Seeded {len(products)} products")

    # Indexes
    await db.users.create_index("email", unique=True)
    await db.products.create_index("category_slug")
    await db.products.create_index("id", unique=True)
    await db.orders.create_index("user_id")

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
        f.write(f"# Test Credentials\n\n## Admin\n- Email: {admin_email}\n- Password: {admin_password}\n- Role: admin\n\n## Auth Endpoints\n- POST /api/auth/register\n- POST /api/auth/login\n- GET /api/auth/me\n\n## Other Endpoints\n- GET /api/products\n- GET /api/products/:id\n- GET /api/categories\n- POST /api/orders/create\n- GET /api/orders\n- GET /api/health\n")
    logger.info("Startup complete")


@app.on_event("shutdown")
async def shutdown():
    client.close()
