import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type WishlistItem = {
  handle: string;
  name: string;
  price: number;
  image: string;
  variant_id: string;
};

type WishlistContextType = {
  items: WishlistItem[];
  toggleItem: (product: WishlistItem) => void;
  isInWishlist: (handle: string) => boolean;
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
      const exists = prev.find(i => i.handle === product.handle);
      if (exists) return prev.filter(i => i.handle !== product.handle);
      return [...prev, product];
    });
  }, []);

  const isInWishlist = useCallback((handle: string) => {
    return items.some(i => i.handle === handle);
  }, [items]);

  return (
    <WishlistContext.Provider value={{ items, toggleItem, isInWishlist, count: items.length }}>
      {children}
    </WishlistContext.Provider>
  );
}

export const useWishlist = () => useContext(WishlistContext);
