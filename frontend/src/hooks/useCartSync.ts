import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

// Keeps the live Shopify cart's buyerIdentity in sync with the Customer
// Account API session: attaches on login, detaches on logout, and
// re-attaches on every silent token refresh (Shopify requires the cart to
// be re-synced whenever the underlying token actually changes, not just
// once at login).
//
// Must only be mounted where shopifyToken is already meaningful — i.e.
// inside AuthProvider's gated children, after its isAuthReady splash screen
// has already resolved (see CartSyncHandler in app/_layout.tsx). It doesn't
// re-check that itself, to avoid a second, redundant readiness state.
export function useCartSync() {
  const { shopifyToken } = useAuth();
  const { updateBuyerIdentity } = useCart();

  useEffect(() => {
    updateBuyerIdentity();
  }, [shopifyToken, updateBuyerIdentity]);
}
