# Floarea - Luxury Flower Shop Mobile App

## Product Requirements Document

### Overview
Native Android & iOS mobile application for Floarea, a luxury flower and gifting business based in Dubai, UAE (floarea.ae). The app connects directly to the Shopify store via Storefront API for real-time product data synchronization.

### Tech Stack
- **Frontend**: Expo React Native (SDK 54) with Expo Router
- **Backend**: FastAPI (Python) - Proxy for Shopify Storefront API + JWT Auth
- **Database**: MongoDB (user auth only)
- **E-Commerce**: Shopify Storefront API (GraphQL) for products, collections, and checkout
- **Checkout**: Shopify native checkout via WebView (supports all payment methods configured in Shopify)
- **Design**: Luxury/editorial theme with Cormorant Garamond + Outfit fonts

### Core Features
1. **Real-time Shopify Sync** - Products, collections, prices, images, and inventory from live Shopify store
2. **Product Catalog** - Browse by collections (Forever Roses, Fresh Flowers, Birthday, Wedding, etc.)
3. **Search & Filter** - Search products, filter by collection categories
4. **Shopping Cart** - Local cart with quantity management
5. **Shopify Native Checkout** - WebView-based checkout using Shopify's payment infrastructure (floarea.ae checkout)
6. **Wishlist** - Save favorite products locally
7. **User Authentication** - JWT-based register/login for user accounts
8. **WhatsApp Integration** - Floating action button to contact +971501311930
9. **Product Detail** - Image gallery, pricing in AED, description, tags, delivery info

### Shopify Integration Details
- **Store**: floarea-website.myshopify.com
- **API**: Storefront API v2024-10 (GraphQL)
- **Collections**: 20 collections including Forever Roses, Fresh Flowers, Birthday, Wedding, Luxurious, etc.
- **Checkout Flow**: Cart items → Shopify cartCreate mutation → checkoutUrl → WebView → Shopify checkout (floarea.ae)

### Navigation Structure
- **Home** - Hero banner, featured collections, product grid, services, footer
- **Shop** - All products with search, collection filter chips
- **Cart** - Cart items, quantity controls, delivery fee calculation, checkout button
- **Wishlist** - Saved products grid
- **Profile** - User info, orders, locations, WhatsApp contact, logout

### Business Info
- **Brand**: Floarea
- **Locations**: Five Palm Hotel, Five Luxe JBR Hotel (Dubai, UAE)
- **Phone**: +971 50 131 1930
- **Website**: floarea.ae
- **Currency**: AED (Dhs.)
