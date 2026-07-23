import { api } from '../api';
import type { Cart } from '../types/cart';

export type CartLineAddInput = { variantId: string; quantity: number };
export type CartLineUpdateInput = { lineId: string; quantity: number };
export type CartAttributeInput = { key: string; value: string };

function emptyCart(cartId: string, checkoutUrl: string): Cart {
  return {
    cart_id: cartId,
    checkout_url: checkoutUrl,
    note: '',
    attributes: [],
    buyer_identity: { customer_access_token_present: false, email: null, phone: null },
    lines: [],
    cost: { subtotal_amount: '0.0', total_amount: '0.0', total_tax: '0.0', currency_code: 'AED' },
    total_quantity: 0,
  };
}

export const CartService = {
  async getCart(cartId: string): Promise<Cart> {
    return api.get(`/cart?cart_id=${encodeURIComponent(cartId)}`);
  },

  // Always creates an anonymous, empty cart. Buyer-identity attachment is
  // Phase 3 scope (useCartSync) — not performed here.
  async createCart(): Promise<Cart> {
    const data = await api.post('/cart/create', { lines: [] });
    return emptyCart(data.cart_id, data.checkout_url);
  },

  async addLines(cartId: string, lines: CartLineAddInput[]): Promise<Cart> {
    return api.post('/cart/lines/add', { cart_id: cartId, lines });
  },

  async updateLines(cartId: string, lines: CartLineUpdateInput[]): Promise<Cart> {
    return api.post('/cart/lines/update', { cart_id: cartId, lines });
  },

  async removeLines(cartId: string, lineIds: string[]): Promise<Cart> {
    return api.post('/cart/lines/remove', { cart_id: cartId, lineIds });
  },

  // Attaches or detaches the cart's buyer identity using whatever customer
  // token api.ts currently holds (kept in sync by AuthContext on every
  // login/logout/refresh). No token param here on purpose: useShopifyToken
  // already refreshes-if-needed and omits the header entirely when logged
  // out, which the backend treats as an explicit detach.
  async updateBuyerIdentity(cartId: string): Promise<Cart> {
    return api.post('/cart/buyer-identity', { cart_id: cartId }, { useShopifyToken: true });
  },

  async updateAttributes(cartId: string, attributes: CartAttributeInput[]): Promise<Cart> {
    return api.post('/cart/attributes', { cart_id: cartId, attributes });
  },

  async updateNote(cartId: string, note: string): Promise<Cart> {
    return api.post('/cart/note', { cart_id: cartId, note });
  },
};
