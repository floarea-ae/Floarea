import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api';

type User = { id: string; name: string; email: string; phone: string; role: string } | null;

type AuthContextType = {
  user: User;
  loading: boolean;
  shopifyToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (firstName: string, email: string, password: string, phone: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [shopifyToken, setShopifyToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { checkAuth(); }, []);

  async function checkAuth() {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const sToken = await AsyncStorage.getItem('shopify_customer_token');
      if (token) {
        const data = await api.get('/auth/me');
        setUser(data.user);
      }
      if (sToken) setShopifyToken(sToken);
    } catch {
      await AsyncStorage.multiRemove(['auth_token', 'shopify_customer_token']);
    } finally {
      setLoading(false);
    }
  }

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post('/shopify-auth/login', { email, password });
    await AsyncStorage.setItem('auth_token', data.token);
    if (data.shopify_customer_token) {
      await AsyncStorage.setItem('shopify_customer_token', data.shopify_customer_token);
      setShopifyToken(data.shopify_customer_token);
    }
    setUser(data.user);
  }, []);

  const register = useCallback(async (firstName: string, email: string, password: string, phone: string) => {
    const data = await api.post('/shopify-auth/register', {
      email, password, first_name: firstName, phone,
    });
    await AsyncStorage.setItem('auth_token', data.token);
    if (data.shopify_customer_token) {
      await AsyncStorage.setItem('shopify_customer_token', data.shopify_customer_token);
      setShopifyToken(data.shopify_customer_token);
    }
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove(['auth_token', 'shopify_customer_token', 'push_token']);
    setUser(null);
    setShopifyToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, shopifyToken, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
