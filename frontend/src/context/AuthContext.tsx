import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { api } from '../api';
import { COLORS } from '../constants';
import { ShopifyCustomerAuth } from '../services/ShopifyCustomerAuth';
import { unregisterTokenWithBackend } from '../notifications';

type User = { id: string; name: string; email: string; phone: string; role: string } | null;

type AuthContextType = {
  user: User;
  isAuthReady: boolean;
  shopifyToken: string | null;
  login: () => Promise<void>;
  register: () => Promise<void>;
  logout: () => Promise<void>;
  handleUnauthorized: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [shopifyToken, setShopifyToken] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const logoutPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => { checkAuth(); }, []);

  async function checkAuth() {
    try {
      const session = await ShopifyCustomerAuth.getStoredSession();
      setUser(session.user);
      setShopifyToken(session.accessToken);
      api.setAuth({ shopifyToken: session.accessToken });
    } catch (e) {
      console.error('Auth storage boot error:', e);
    } finally {
      setIsAuthReady(true);
    }
  }

  const login = useCallback(async () => {
    const session = await ShopifyCustomerAuth.signIn();
    setShopifyToken(session.accessToken);
    setUser(session.user);
    api.setAuth({ shopifyToken: session.accessToken });
  }, []);

  const register = login;

  const logout = useCallback(async () => {
    if (logoutPromiseRef.current) {
      return logoutPromiseRef.current;
    }

    logoutPromiseRef.current = (async () => {
      await unregisterTokenWithBackend();
      await ShopifyCustomerAuth.clearSession();
      api.setAuth({ shopifyToken: null });
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

  const refreshAuth = useCallback(async () => {
    const session = await ShopifyCustomerAuth.getStoredSession();
    setUser(session.user);
    setShopifyToken(session.accessToken);
    return session.accessToken;
  }, []);

  useEffect(() => {
    api.setUnauthorizedHandler(handleUnauthorized);
    api.setAuthRefreshHandler(refreshAuth);
    return () => {
      api.setUnauthorizedHandler(null);
      api.setAuthRefreshHandler(null);
    };
  }, [handleUnauthorized, refreshAuth]);

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
