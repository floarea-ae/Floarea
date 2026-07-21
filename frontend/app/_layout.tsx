import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, CormorantGaramond_300Light, CormorantGaramond_400Regular, CormorantGaramond_600SemiBold } from '@expo-google-fonts/cormorant-garamond';
import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold } from '@expo-google-fonts/outfit';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { CartProvider } from '../src/context/CartContext';
import { WishlistProvider } from '../src/context/WishlistContext';
import { registerForPushNotifications, registerTokenWithBackend, useNotificationListeners } from '../src/notifications';
import { prefetchHomepageLayout } from '../src/services/homepage';

SplashScreen.preventAutoHideAsync();

// Fired at module load, in parallel with font loading and auth initialization,
// so the homepage request isn't serialized behind either of them.
prefetchHomepageLayout().catch(() => {});

function PushNotificationHandler() {
  const { shopifyToken } = useAuth();

  useEffect(() => {
    if (shopifyToken) {
      registerForPushNotifications().then(token => {
        if (token) registerTokenWithBackend(token);
      });
    }
  }, [shopifyToken]);

  useNotificationListeners();
  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    CormorantGaramond_300Light,
    CormorantGaramond_400Regular,
    CormorantGaramond_600SemiBold,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    // Cart/Wishlist wrap AuthProvider (rather than nesting inside it) so their
    // storage reads start immediately in parallel with the auth check, instead
    // of waiting for AuthProvider's internal readiness gate to lift first.
    // AuthProvider's own gating behavior below is unchanged.
    <CartProvider>
      <WishlistProvider>
        <AuthProvider>
          <PushNotificationHandler />
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="product/[id]" options={{ presentation: 'card' }} />
            <Stack.Screen name="auth" options={{ presentation: 'modal' }} />
            <Stack.Screen name="checkout" options={{ presentation: 'card' }} />
            <Stack.Screen name="orders" options={{ presentation: 'card' }} />
            <Stack.Screen name="privacy-policy" options={{ presentation: 'card' }} />
            <Stack.Screen name="terms-conditions" options={{ presentation: 'card' }} />
            <Stack.Screen name="contact-us" options={{ presentation: 'card' }} />
          </Stack>
        </AuthProvider>
      </WishlistProvider>
    </CartProvider>
  );
}
