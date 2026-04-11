import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type WishlistItem = {
  product_id: string;
  name: string;
  price: number;
  image: string;
};

type WishlistContextType = {
  items: WishlistItem[];
  toggleItem: (product: WishlistItem) => void;
  isInWishlist: (productId: string) => boolean;
  count: number;
};

const WishlistContext = createContext<WishlistContextType>({} as WishlistContextType);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<WishlistItem[]>([]);

  useEffect(() => {
    AsyncStorage.getItem('wishlist').then(saved => {
      if (saved) setItems(JSON.parse(saved));
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem('wishlist', JSON.stringify(items));
  }, [items]);

  const toggleItem = useCallback((product: WishlistItem) => {
    setItems(prev => {
      const exists = prev.find(i => i.product_id === product.product_id);
      if (exists) return prev.filter(i => i.product_id !== product.product_id);
      return [...prev, product];
    });
  }, []);

  const isInWishlist = useCallback((productId: string) => {
    return items.some(i => i.product_id === productId);
  }, [items]);

  return (
    <WishlistContext.Provider value={{ items, toggleItem, isInWishlist, count: items.length }}>
      {children}
    </WishlistContext.Provider>
  );
}

export const useWishlist = () => useContext(WishlistContext);
