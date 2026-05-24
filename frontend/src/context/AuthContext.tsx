import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import * as Storage from '../utils/storage';
import { api } from '../api';
import { COLORS } from '../constants';
import { unregisterTokenWithBackend } from '../notifications';

type User = { id: string; name: string; email: string; phone: string; role: string } | null;

type AuthContextType = {
  user: User;
  isAuthReady: boolean;
  shopifyToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (firstName: string, email: string, password: string, phone: string) => Promise<void>;
  logout: () => Promise<void>;
  handleUnauthorized: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [shopifyToken, setShopifyToken] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const logoutPromiseRef = useRef<Promise<void> | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { checkAuth(); }, []);

  async function checkAuth() {
    try {
      const legacyToken = await Storage.getSecureItem('auth_token');
      const sToken = await Storage.getSecureItem('shopify_customer_token');
      const authUserStr = await Storage.getSecureItem('auth_user');
      
      if (sToken && authUserStr) {
        setUser(JSON.parse(authUserStr));
      }
      if (sToken) setShopifyToken(sToken);
      api.setAuth({ legacyAuthToken: legacyToken, shopifyToken: sToken });
    } catch (e) {
      console.error('Auth storage boot error:', e);
    } finally {
      setIsAuthReady(true);
      validateShopifySession(); // Fire network validation dynamically without blocking
    }
  }

  async function validateShopifySession() {
    const sToken = await Storage.getSecureItem('shopify_customer_token');
    if (!sToken) return;

    try {
      await api.get('/shopify-auth/orders', { requireAuth: true, suppressUnauthorizedHandler: true });
    } catch (e: any) {
      if (e.status === 401) {
        console.warn('Shopify session validation failed with 401.');
      } else {
        console.log('Network unavailable or server error. Retaining offline cached Shopify session state.');
      }
    }
  }

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post('/shopify-auth/login', { email, password });
    if (!data.shopify_customer_token) {
      throw new Error('Shopify customer token missing from login response');
    }
    if (data.token) {
      await Storage.setSecureItem('auth_token', data.token);
    }
    await Storage.setSecureItem('auth_user', JSON.stringify(data.user));
    if (data.shopify_customer_token) {
      await Storage.setSecureItem('shopify_customer_token', data.shopify_customer_token);
      setShopifyToken(data.shopify_customer_token);
    }
    api.setAuth({ legacyAuthToken: data.token || null, shopifyToken: data.shopify_customer_token || null });
    setUser(data.user);
  }, []);

  const register = useCallback(async (firstName: string, email: string, password: string, phone: string) => {
    const data = await api.post('/shopify-auth/register', {
      email, password, first_name: firstName, phone,
    });
    if (!data.shopify_customer_token) {
      throw new Error('Shopify customer token missing from registration response');
    }
    if (data.token) {
      await Storage.setSecureItem('auth_token', data.token);
    }
    await Storage.setSecureItem('auth_user', JSON.stringify(data.user));
    if (data.shopify_customer_token) {
      await Storage.setSecureItem('shopify_customer_token', data.shopify_customer_token);
      setShopifyToken(data.shopify_customer_token);
    }
    api.setAuth({ legacyAuthToken: data.token || null, shopifyToken: data.shopify_customer_token || null });
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    if (logoutPromiseRef.current) {
      return logoutPromiseRef.current;
    }

    logoutPromiseRef.current = (async () => {
      await unregisterTokenWithBackend();
      await Storage.multiRemoveSecure(['auth_token', 'shopify_customer_token', 'push_token', 'auth_user']);
      api.setAuth({ legacyAuthToken: null, shopifyToken: null });
      setUser(null);
      setShopifyToken(null);
    })().finally(() => {
      logoutPromiseRef.current = null;
    });

    return logoutPromiseRef.current;
  }, []);

  const handleUnauthorized = useCallback(async () => {
    await logout();
  }, [logout]);

  useEffect(() => {
    api.setUnauthorizedHandler(handleUnauthorized);
    return () => api.setUnauthorizedHandler(null);
  }, [handleUnauthorized]);

  return (
    <AuthContext.Provider value={{ user, isAuthReady, shopifyToken, login, register, logout, handleUnauthorized }}>
      {!isAuthReady ? (
        <View style={styles.splashContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export const useAuth = () => useContext(AuthContext);
