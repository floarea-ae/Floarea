import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
};

const CartContext = createContext<CartContextType>({} as CartContextType);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    AsyncStorage.getItem('cart').then(saved => {
      if (saved) setItems(JSON.parse(saved));
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem('cart', JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((product: Omit<CartItem, 'quantity'>, quantity = 1) => {
    setItems(prev => {
      const existing = prev.find(i => i.variant_id === product.variant_id);
      if (existing) {
        return prev.map(i =>
          i.variant_id === product.variant_id ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [...prev, { ...product, quantity }];
    });
  }, []);

  const removeItem = useCallback((variantId: string) => {
    setItems(prev => prev.filter(i => i.variant_id !== variantId));
  }, []);

  const updateQuantity = useCallback((variantId: string, qty: number) => {
    if (qty <= 0) {
      setItems(prev => prev.filter(i => i.variant_id !== variantId));
      return;
    }
    setItems(prev => prev.map(i => i.variant_id === variantId ? { ...i, quantity: qty } : i));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, total, itemCount }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
