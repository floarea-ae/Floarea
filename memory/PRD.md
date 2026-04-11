# Floarea - Luxury Flower Shop Mobile App

## Product Requirements Document

### Overview
Native Android & iOS mobile application for Floarea, a luxury flower and gifting business based in Dubai, UAE (floarea.ae). The app connects directly to the Shopify store via Storefront API for real-time product data synchronization, with Shopify customer account sync and push notifications.

### Tech Stack
- **Frontend**: Expo React Native (SDK 54) with Expo Router
- **Backend**: FastAPI (Python) - Proxy for Shopify Storefront API + JWT Auth
- **Database**: MongoDB (user auth, push tokens)
- **E-Commerce**: Shopify Storefront API (GraphQL) for products, collections, checkout, and customer accounts
- **Checkout**: Shopify native checkout via WebView
- **Notifications**: Expo Push Notifications
- **Design**: Luxury/editorial theme with Cormorant Garamond + Outfit fonts

### Core Features
1. **Real-time Shopify Sync** - Products, collections, prices, images from live Shopify store
2. **Shopify Customer Accounts** - Register/login creates Shopify customer, syncs across web + app
3. **Cross-platform Order History** - View Shopify orders with status, items, tracking via Storefront API
4. **Push Notifications** - Expo Push for order updates, abandoned cart, promotions
5. **Product Catalog** - Browse by collections, search, filter
6. **Shopping Cart** - Local cart with Shopify checkout (linked to customer account)
7. **Shopify Native Checkout** - WebView-based checkout with buyer identity
8. **Wishlist** - Save favorite products locally
9. **WhatsApp Integration** - Floating action button (+971501311930)
10. **Product Detail** - Image gallery, AED pricing, description, tags

### API Endpoints
#### Shopify Customer Auth
- POST /api/shopify-auth/register - Creates Shopify customer + local JWT
- POST /api/shopify-auth/login - Shopify customer login + JWT
- GET /api/shopify-auth/orders - Customer order history (x-shopify-customer-token header)

#### Push Notifications
- POST /api/push/register - Register Expo push token
- POST /api/push/send - Send notification (admin or self)
- DELETE /api/push/unregister - Remove push token

#### Products & Cart
- GET /api/products, GET /api/products/{handle}
- GET /api/collections, GET /api/collections/{handle}
- POST /api/cart/create - Anonymous checkout
- POST /api/cart/create-with-customer - Checkout linked to Shopify customer

### Shopify Integration
- **Store**: floarea-website.myshopify.com
- **Storefront API**: v2024-10 (GraphQL) - products, collections, customer auth, cart/checkout
- **Admin API**: Customer management (shpat_...)
- **Customer Flow**: Register → Shopify customerCreate → auto-login → customerAccessToken → order history
