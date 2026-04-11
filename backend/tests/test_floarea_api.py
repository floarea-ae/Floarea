import pytest
import requests
import os

# Backend API tests for Floarea luxury flower shop
# Tests: health, auth, collections, products, cart creation

# Read from frontend .env file
def get_backend_url():
    try:
        with open('/app/frontend/.env', 'r') as f:
            for line in f:
                if line.startswith('EXPO_PUBLIC_BACKEND_URL='):
                    return line.split('=', 1)[1].strip()
    except:
        pass
    return 'https://gifting-uae-app.preview.emergentagent.com'

BASE_URL = get_backend_url()

class TestHealth:
    """Health check endpoint"""

    def test_health_endpoint(self):
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["service"] == "Floarea API"
        assert data["shopify_connected"] == True, "Shopify should be connected"
        print(f"✓ Health check passed: {data}")


class TestAuth:
    """Authentication endpoints"""

    def test_login_admin(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@floarea.ae",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == "admin@floarea.ae"
        assert data["user"]["role"] == "admin"
        print(f"✓ Admin login successful: {data['user']['email']}")

    def test_register_new_user(self):
        import uuid
        test_email = f"test_{uuid.uuid4().hex[:8]}@floarea.ae"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "name": "Test User",
            "email": test_email,
            "password": "testpass123",
            "phone": "+971501234567"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["email"] == test_email
        print(f"✓ User registration successful: {test_email}")

    def test_login_invalid_credentials(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@floarea.ae",
            "password": "wrongpass"
        })
        assert response.status_code == 401
        print("✓ Invalid login rejected correctly")


class TestCollections:
    """Shopify collections endpoints"""

    def test_get_all_collections(self):
        response = requests.get(f"{BASE_URL}/api/collections")
        assert response.status_code == 200
        data = response.json()
        assert "collections" in data
        assert len(data["collections"]) > 0, "Should have collections from Shopify"
        
        # Verify collection structure
        first_col = data["collections"][0]
        assert "id" in first_col
        assert "handle" in first_col
        assert "title" in first_col
        print(f"✓ Collections loaded: {len(data['collections'])} collections")

    def test_get_featured_collections(self):
        response = requests.get(f"{BASE_URL}/api/collections?featured_only=true")
        assert response.status_code == 200
        data = response.json()
        assert "collections" in data
        assert len(data["collections"]) > 0, "Should have featured collections"
        print(f"✓ Featured collections loaded: {len(data['collections'])} collections")

    def test_get_single_collection(self):
        response = requests.get(f"{BASE_URL}/api/collections/forever-special-occasion-roses")
        assert response.status_code == 200
        data = response.json()
        assert "collection" in data
        assert "products" in data
        assert data["collection"]["handle"] == "forever-special-occasion-roses"
        print(f"✓ Collection detail loaded: {data['collection']['title']} with {len(data['products'])} products")


class TestProducts:
    """Shopify products endpoints"""

    def test_get_all_products(self):
        response = requests.get(f"{BASE_URL}/api/products")
        assert response.status_code == 200
        data = response.json()
        assert "products" in data
        assert len(data["products"]) > 0, "Should have products from Shopify"
        
        # Verify product structure
        first_product = data["products"][0]
        assert "id" in first_product
        assert "handle" in first_product
        assert "title" in first_product
        assert "price" in first_product
        assert "currency" in first_product
        assert first_product["currency"] == "AED", "Currency should be AED"
        assert "image" in first_product
        assert "images" in first_product
        assert "variants" in first_product
        assert "variant_id" in first_product
        assert len(first_product["variants"]) > 0, "Should have at least one variant"
        print(f"✓ Products loaded: {len(data['products'])} products, first: {first_product['title']}")

    def test_get_products_by_collection(self):
        response = requests.get(f"{BASE_URL}/api/products?collection=forever-special-occasion-roses")
        assert response.status_code == 200
        data = response.json()
        assert "products" in data
        assert len(data["products"]) > 0, "Should have products in this collection"
        print(f"✓ Filtered products loaded: {len(data['products'])} products")

    def test_get_single_product(self):
        # First get a product handle
        products_response = requests.get(f"{BASE_URL}/api/products?first=1")
        products_data = products_response.json()
        if len(products_data["products"]) == 0:
            pytest.skip("No products available to test")
        
        product_handle = products_data["products"][0]["handle"]
        
        # Now get the product detail
        response = requests.get(f"{BASE_URL}/api/products/{product_handle}")
        assert response.status_code == 200
        data = response.json()
        assert data["handle"] == product_handle
        assert "title" in data
        assert "price" in data
        assert "variants" in data
        assert "variant_id" in data
        print(f"✓ Product detail loaded: {data['title']}")


class TestCart:
    """Shopify cart creation endpoint"""

    def test_create_cart_with_valid_variant(self):
        # First get a product with variant_id
        products_response = requests.get(f"{BASE_URL}/api/products?first=1")
        products_data = products_response.json()
        if len(products_data["products"]) == 0:
            pytest.skip("No products available to test cart")
        
        variant_id = products_data["products"][0]["variant_id"]
        
        # Create cart
        response = requests.post(f"{BASE_URL}/api/cart/create", json={
            "lines": [
                {"variantId": variant_id, "quantity": 1}
            ]
        })
        assert response.status_code == 200
        data = response.json()
        assert "cart_id" in data
        assert "checkout_url" in data
        assert "total" in data
        assert "currency" in data
        assert data["currency"] == "AED"
        assert "floarea.ae" in data["checkout_url"], "Checkout URL should point to floarea.ae"
        print(f"✓ Cart created: {data['checkout_url']}")


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session
