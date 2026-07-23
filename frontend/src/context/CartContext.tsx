import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { CartService } from '../services/CartService';
import { getCartId, setCartId } from '../utils/cartPersistence';
import { CART_ATTRIBUTE_KEYS } from '../constants/cart';
import type { Cart, CartLine } from '../types/cart';

// The AsyncStorage key the old, purely-local cart used to read/write. Phase 2
// reads it exactly once (migration) and then never writes to it again.
const LEGACY_CART_KEY = 'cart';
const QUANTITY_DEBOUNCE_MS = 400;

export type CartItem = {
  variant_id: string;
  handle: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
};

type CartContextType = {
  items: CartItem[];
  addItem: (product: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, qty: number) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
  // Additive (Phase 2): not consumed by any screen yet, but real and usable —
  // exposed so a future per-row loading indicator / sync badge can wire into
  // it without another pass through CartContext's internals.
  cartStatus: 'idle' | 'hydrating' | 'ready' | 'error';
  isItemPending: (variantId: string) => boolean;
  // Cart-wide staleness guard for whole-cart mutations with no single
  // variant of their own — used by the three functions below (and available
  // for any future whole-cart mutation, e.g. Phase 6's gift note).
  nextCartSeq: () => number;
  applyCartIfNotStale: (seq: number, next: Cart) => boolean;
  // Phase 3/4/5: whole-cart mutations, each guarded by nextCartSeq/
  // applyCartIfNotStale above instead of calling updateCart directly.
  // updateBuyerIdentity is driven by useCartSync (src/hooks/useCartSync.ts),
  // reacting to shopifyToken; updateDeliveryAttributes/updateCardMessage
  // have no caller yet (cart.tsx's own delivery/note UI is unchanged this
  // phase), but are real, usable, and integration-tested via the guard.
  updateBuyerIdentity: () => void;
  updateDeliveryAttributes: (date: string, time: string) => void;
  updateCardMessage: (note: string) => void;
};

const CartContext = createContext<CartContextType>({} as CartContextType);

// ─── Pure helpers (no React state) ───

function findLineByVariant(cart: Cart | null, variantId: string): CartLine | null {
  if (!cart) return null;
  return cart.lines.find(l => l.merchandise_id === variantId) ?? null;
}

function replaceLine(cart: Cart, variantId: string, line: CartLine | null): Cart {
  const withoutLine = cart.lines.filter(l => l.merchandise_id !== variantId);
  return { ...cart, lines: line ? [...withoutLine, line] : withoutLine };
}

function isOptimisticLine(line: CartLine): boolean {
  return line.line_id.startsWith('optimistic:');
}

function unitPrice(line: CartLine): number {
  return parseFloat(line.price.amount) || 0;
}

function money(amount: number, currencyCode: string) {
  return { amount: amount.toFixed(2), currency_code: currencyCode };
}

function toCartItems(cart: Cart | null): CartItem[] {
  if (!cart) return [];
  return cart.lines.map(line => ({
    variant_id: line.merchandise_id,
    handle: '', // not part of the canonical Shopify cart line — unused by any screen today
    name: line.title,
    price: unitPrice(line),
    image: line.image || '',
    quantity: line.quantity,
  }));
}

function showError(e: unknown, fallback: string) {
  const message = e instanceof Error && e.message ? e.message : fallback;
  Alert.alert('Cart', message);
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [status, setStatus] = useState<'idle' | 'hydrating' | 'ready' | 'error'>('idle');
  const [pendingVariantIds, setPendingVariantIds] = useState<Set<string>>(new Set());

  // Mirrors `cart` synchronously so async mutation logic never reads a stale
  // closure value (React state itself only updates on the next render).
  const cartRef = useRef<Cart | null>(null);
  const cartReadyPromiseRef = useRef<Promise<string> | null>(null);

  // Per-variantId bookkeeping for the optimistic-update engine below.
  const versionRef = useRef<Map<string, number>>(new Map());
  const preMutationSnapshot = useRef<Map<string, CartLine | null>>(new Map());
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // A quantity change requested while the line's underlying `addItem` hasn't
  // been confirmed by Shopify yet (no real line id to update against). It is
  // replayed automatically once the add confirms — see addItem's success path.
  const pendingQuantityAfterAdd = useRef<Map<string, number>>(new Map());
  // Set when removeItem is called on a line that's still an unconfirmed
  // optimistic add — addItem's response handler uses this to immediately
  // remove the line Shopify just created, so nothing is orphaned server-side.
  const pendingRemovalIntent = useRef<Set<string>>(new Set());

  const updateCart = useCallback((next: Cart) => {
    cartRef.current = next;
    setCart(next);
  }, []);

  const markPending = useCallback((variantId: string, pending: boolean) => {
    setPendingVariantIds(prev => {
      const next = new Set(prev);
      if (pending) next.add(variantId); else next.delete(variantId);
      return next;
    });
  }, []);

  const bumpVersion = useCallback((variantId: string) => {
    const v = (versionRef.current.get(variantId) ?? 0) + 1;
    versionRef.current.set(variantId, v);
    return v;
  }, []);

  const isCurrentVersion = useCallback((variantId: string, v: number) => {
    return versionRef.current.get(variantId) === v;
  }, []);

  // Captures the "before this flurry of changes" state exactly once per
  // variant, so a failure at the end of a burst of taps rolls back to the
  // last server-confirmed truth, not to some intermediate optimistic guess.
  const acquireSnapshot = useCallback((variantId: string) => {
    if (!preMutationSnapshot.current.has(variantId)) {
      preMutationSnapshot.current.set(variantId, findLineByVariant(cartRef.current, variantId));
      markPending(variantId, true);
    }
  }, [markPending]);

  const releaseSnapshot = useCallback((variantId: string) => {
    preMutationSnapshot.current.delete(variantId);
    markPending(variantId, false);
  }, [markPending]);

  const rollbackToSnapshot = useCallback((variantId: string) => {
    if (!cartRef.current) return;
    const snap = preMutationSnapshot.current.get(variantId) ?? null;
    updateCart(replaceLine(cartRef.current, variantId, snap));
  }, [updateCart]);

  // ─── Cart-wide staleness guard ───
  // versionRef/bumpVersion/isCurrentVersion above guard a single *variant's*
  // mutations against each other. Nothing guards a *whole-cart* mutation with
  // no single variant of its own — buyerIdentity, attributes, note (below) —
  // against its response arriving after a newer whole-cart response has
  // already been applied. This pair exists so those three guard themselves
  // the same way add/update/remove already do, without touching any of the
  // per-variant logic above. Deliberately not threaded through
  // addItem/updateQuantity/removeItem/clearCart: those are already correctly
  // protected by the per-variant guard, and gating them on a cart-wide
  // sequence too would risk discarding a still-needed response (e.g. an
  // add's confirmation reconciling an optimistic line) just because an
  // unrelated line mutation happened to be applied in between.
  const cartSeqRef = useRef(0);
  const lastAppliedCartSeqRef = useRef(0);

  // Call once, right before dispatching a whole-cart network mutation.
  const nextCartSeq = useCallback(() => {
    cartSeqRef.current += 1;
    return cartSeqRef.current;
  }, []);

  // Applies `next` only if no later-dispatched whole-cart mutation's
  // response has already been applied; returns whether it was applied.
  const applyCartIfNotStale = useCallback((seq: number, next: Cart) => {
    if (seq <= lastAppliedCartSeqRef.current) return false;
    lastAppliedCartSeqRef.current = seq;
    updateCart(next);
    return true;
  }, [updateCart]);

  // ─── Buyer identity / delivery attributes / card message (Phases 3-5) ───
  // All three are whole-cart mutations: no optimistic local representation
  // (nothing in this file renders buyerIdentity/attributes/note today), so
  // there's nothing to roll back on failure — just guard against staleness
  // and, for the two user-triggered ones, surface the error the same way
  // add/update/remove already do.

  // No token parameter: api.ts's ambient shopifyToken (kept in sync by
  // AuthContext on every login/logout/refresh, before shopifyToken's React
  // state — which useCartSync reacts to — ever changes) is what
  // CartService.updateBuyerIdentity actually sends, via useShopifyToken.
  const updateBuyerIdentity = useCallback(() => {
    const seq = nextCartSeq();
    (async () => {
      try {
        const cartId = await cartReadyPromiseRef.current!;
        const updated = await CartService.updateBuyerIdentity(cartId);
        applyCartIfNotStale(seq, updated);
      } catch (e) {
        // Silent: this runs automatically on every auth change, not from a
        // user tap — an intrusive alert here would fire on background token
        // refreshes. Logged for diagnosis; naturally retried on the next
        // shopifyToken change (e.g. the next silent refresh).
        console.error('updateBuyerIdentity failed:', e);
      }
    })();
  }, [nextCartSeq, applyCartIfNotStale]);

  const updateDeliveryAttributes = useCallback((date: string, time: string) => {
    const seq = nextCartSeq();
    (async () => {
      try {
        const cartId = await cartReadyPromiseRef.current!;
        const attributes = [
          { key: CART_ATTRIBUTE_KEYS.DELIVERY_DATE, value: date },
          { key: CART_ATTRIBUTE_KEYS.DELIVERY_TIME, value: time },
        ];
        const updated = await CartService.updateAttributes(cartId, attributes);
        applyCartIfNotStale(seq, updated);
      } catch (e) {
        showError(e, 'Could not save delivery details.');
      }
    })();
  }, [nextCartSeq, applyCartIfNotStale]);

  const updateCardMessage = useCallback((note: string) => {
    const seq = nextCartSeq();
    (async () => {
      try {
        const cartId = await cartReadyPromiseRef.current!;
        const updated = await CartService.updateNote(cartId, note);
        applyCartIfNotStale(seq, updated);
      } catch (e) {
        showError(e, 'Could not save card message.');
      }
    })();
  }, [nextCartSeq, applyCartIfNotStale]);

  // ─── Boot: get-or-create the Shopify cart, then run the one-time legacy migration ───
  useEffect(() => {
    let cancelled = false;

    async function bootstrapCart(): Promise<string> {
      const existingId = await getCartId();
      let liveCart: Cart | null = null;

      if (existingId) {
        try {
          liveCart = await CartService.getCart(existingId);
        } catch {
          // Missing, invalid, or expired/spent cart (backend returns 404) —
          // fall through and provision a fresh one.
          liveCart = null;
        }
      }

      if (!liveCart) {
        liveCart = await CartService.createCart();
        await setCartId(liveCart.cart_id);
      }

      // One-time migration of the old purely-local cart into the live Shopify
      // cart. Only deletes the legacy key on success, so a failure (e.g. a
      // variant that no longer exists) safely retries on the next launch
      // instead of silently losing the user's items.
      try {
        const legacyRaw = await AsyncStorage.getItem(LEGACY_CART_KEY);
        if (legacyRaw) {
          const legacyItems: CartItem[] = JSON.parse(legacyRaw);
          if (Array.isArray(legacyItems) && legacyItems.length > 0) {
            const lines = legacyItems
              .filter(i => i.variant_id && i.quantity > 0)
              .map(i => ({ variantId: i.variant_id, quantity: i.quantity }));
            if (lines.length > 0) {
              liveCart = await CartService.addLines(liveCart.cart_id, lines);
            }
          }
          await AsyncStorage.removeItem(LEGACY_CART_KEY);
        }
      } catch (e) {
        console.error('Legacy cart migration failed, will retry next launch:', e);
      }

      if (!cancelled) {
        updateCart(liveCart);
        setStatus('ready');
      }
      return liveCart.cart_id;
    }

    setStatus('hydrating');
    cartReadyPromiseRef.current = bootstrapCart().catch(e => {
      console.error('Shopify cart bootstrap failed:', e);
      if (!cancelled) setStatus('error');
      throw e;
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Quantity commit (fires after the debounce window, or replayed after a pending add confirms) ───
  const commitQuantityUpdate = useCallback(async (variantId: string, qty: number) => {
    const line = findLineByVariant(cartRef.current, variantId);
    if (!line) {
      releaseSnapshot(variantId);
      return;
    }
    if (isOptimisticLine(line)) {
      // The add that created this line hasn't been confirmed yet — defer.
      pendingQuantityAfterAdd.current.set(variantId, qty);
      return;
    }

    const myVersion = bumpVersion(variantId);
    try {
      const cartId = await cartReadyPromiseRef.current!;
      const updated = await CartService.updateLines(cartId, [{ lineId: line.line_id, quantity: qty }]);
      if (isCurrentVersion(variantId, myVersion)) {
        updateCart(updated);
        releaseSnapshot(variantId);
      }
    } catch (e) {
      if (isCurrentVersion(variantId, myVersion)) {
        rollbackToSnapshot(variantId);
        releaseSnapshot(variantId);
        showError(e, 'Could not update quantity.');
      }
    }
  }, [bumpVersion, isCurrentVersion, releaseSnapshot, rollbackToSnapshot, updateCart]);

  const addItem = useCallback((product: Omit<CartItem, 'quantity'>, quantity = 1) => {
    const variantId = product.variant_id;
    acquireSnapshot(variantId);
    const myVersion = bumpVersion(variantId);

    const existingLine = findLineByVariant(cartRef.current, variantId);
    const currency = cartRef.current?.cost.currency_code ?? 'AED';
    const optimisticLine: CartLine = existingLine
      ? {
          ...existingLine,
          quantity: existingLine.quantity + quantity,
          line_total: money(unitPrice(existingLine) * (existingLine.quantity + quantity), existingLine.price.currency_code),
        }
      : {
          line_id: `optimistic:${variantId}:${Date.now()}`,
          merchandise_id: variantId,
          quantity,
          title: product.name,
          variant_title: null,
          image: product.image || null,
          price: money(product.price, currency),
          line_total: money(product.price * quantity, currency),
          attributes: [],
        };

    if (cartRef.current) {
      updateCart(replaceLine(cartRef.current, variantId, optimisticLine));
    }

    (async () => {
      try {
        const cartId = await cartReadyPromiseRef.current!;
        const updated = await CartService.addLines(cartId, [{ variantId, quantity }]);

        // A removeItem arrived while this add was in flight: the line it just
        // created must not survive, regardless of version bookkeeping.
        if (pendingRemovalIntent.current.has(variantId)) {
          pendingRemovalIntent.current.delete(variantId);
          const newLine = findLineByVariant(updated, variantId);
          if (newLine) {
            CartService.removeLines(cartId, [newLine.line_id]).catch(() => {});
          }
          if (isCurrentVersion(variantId, myVersion)) releaseSnapshot(variantId);
          return;
        }

        if (!isCurrentVersion(variantId, myVersion)) return; // superseded by a newer op; its own handler owns cleanup

        updateCart(updated);

        const desiredQty = pendingQuantityAfterAdd.current.get(variantId);
        const confirmedLine = findLineByVariant(updated, variantId);
        if (desiredQty != null && confirmedLine && confirmedLine.quantity !== desiredQty) {
          pendingQuantityAfterAdd.current.delete(variantId);
          commitQuantityUpdate(variantId, desiredQty); // keeps holding the snapshot/pending marker
        } else {
          pendingQuantityAfterAdd.current.delete(variantId);
          releaseSnapshot(variantId);
        }
      } catch (e) {
        if (isCurrentVersion(variantId, myVersion)) {
          rollbackToSnapshot(variantId);
          releaseSnapshot(variantId);
          showError(e, 'Could not add item to cart.');
        }
      }
    })();
  }, [acquireSnapshot, bumpVersion, commitQuantityUpdate, isCurrentVersion, releaseSnapshot, rollbackToSnapshot, updateCart]);

  const removeItem = useCallback((variantId: string) => {
    if (!cartRef.current) return;
    const line = findLineByVariant(cartRef.current, variantId);
    if (!line) return;

    const timer = debounceTimers.current.get(variantId);
    if (timer) { clearTimeout(timer); debounceTimers.current.delete(variantId); }
    pendingQuantityAfterAdd.current.delete(variantId); // a queued quantity replay is now moot

    acquireSnapshot(variantId);
    updateCart(replaceLine(cartRef.current, variantId, null));

    if (isOptimisticLine(line)) {
      // Nothing to remove server-side yet — addItem's own response handler
      // will remove the line it's about to create.
      pendingRemovalIntent.current.add(variantId);
      return;
    }

    (async () => {
      const myVersion = bumpVersion(variantId);
      try {
        const cartId = await cartReadyPromiseRef.current!;
        const updated = await CartService.removeLines(cartId, [line.line_id]);
        if (isCurrentVersion(variantId, myVersion)) {
          updateCart(updated);
          releaseSnapshot(variantId);
        }
      } catch (e) {
        if (isCurrentVersion(variantId, myVersion)) {
          rollbackToSnapshot(variantId);
          releaseSnapshot(variantId);
          showError(e, 'Could not remove item.');
        }
      }
    })();
  }, [acquireSnapshot, bumpVersion, isCurrentVersion, releaseSnapshot, rollbackToSnapshot, updateCart]);

  const updateQuantity = useCallback((variantId: string, qty: number) => {
    if (qty <= 0) {
      removeItem(variantId);
      return;
    }
    if (!cartRef.current) return;
    const current = findLineByVariant(cartRef.current, variantId);
    if (!current) return;

    acquireSnapshot(variantId);

    const optimisticLine: CartLine = {
      ...current,
      quantity: qty,
      line_total: money(unitPrice(current) * qty, current.price.currency_code),
    };
    updateCart(replaceLine(cartRef.current, variantId, optimisticLine));

    const existingTimer = debounceTimers.current.get(variantId);
    if (existingTimer) clearTimeout(existingTimer);
    debounceTimers.current.set(variantId, setTimeout(() => {
      debounceTimers.current.delete(variantId);
      commitQuantityUpdate(variantId, qty);
    }, QUANTITY_DEBOUNCE_MS));
  }, [acquireSnapshot, commitQuantityUpdate, removeItem, updateCart]);

  const clearCart = useCallback(() => {
    if (!cartRef.current || cartRef.current.lines.length === 0) return;

    debounceTimers.current.forEach(t => clearTimeout(t));
    debounceTimers.current.clear();
    preMutationSnapshot.current.clear();
    pendingQuantityAfterAdd.current.clear();
    pendingRemovalIntent.current.clear();
    setPendingVariantIds(new Set());

    const lineIds = cartRef.current.lines.filter(l => !isOptimisticLine(l)).map(l => l.line_id);
    updateCart({ ...cartRef.current, lines: [] });

    if (lineIds.length === 0) return; // only unconfirmed optimistic lines existed
    (async () => {
      try {
        const cartId = await cartReadyPromiseRef.current!;
        const updated = await CartService.removeLines(cartId, lineIds);
        updateCart(updated);
      } catch (e) {
        // Best-effort: the user already left expecting an empty cart (this is
        // called from checkout-complete and logout). Not rolled back — the
        // next boot's get-or-create will resync with whatever Shopify has.
        console.error('clearCart: failed to empty Shopify cart, will resync next launch:', e);
      }
    })();
  }, [updateCart]);

  const items = useMemo(() => toCartItems(cart), [cart]);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const isItemPending = useCallback((variantId: string) => pendingVariantIds.has(variantId), [pendingVariantIds]);

  const contextValue = useMemo(() => ({
    items, addItem, removeItem, updateQuantity, clearCart, total, itemCount,
    cartStatus: status, isItemPending, nextCartSeq, applyCartIfNotStale,
    updateBuyerIdentity, updateDeliveryAttributes, updateCardMessage,
  }), [
    items, addItem, removeItem, updateQuantity, clearCart, total, itemCount,
    status, isItemPending, nextCartSeq, applyCartIfNotStale,
    updateBuyerIdentity, updateDeliveryAttributes, updateCardMessage,
  ]);

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
