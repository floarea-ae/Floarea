import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import WebView from 'react-native-webview';
import { useAuth } from '../src/context/AuthContext';
import { useCart } from '../src/context/CartContext';
import { COLORS, FONTS } from '../src/constants';

export default function CheckoutScreen() {
  const { url } = useLocalSearchParams<{ url: string }>();
  const router = useRouter();
  const { shopifyToken } = useAuth();
  const { clearCart } = useCart();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shopifyToken) {
      router.replace('/auth');
    }
  }, [router, shopifyToken]);

  function handleNavigationChange(navState: any) {
    const currentUrl = navState.url || '';
    // Detect successful order completion on Shopify
    if (currentUrl.includes('/thank_you') || currentUrl.includes('/orders/')) {
      clearCart();
    }
  }

  if (!shopifyToken) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!url) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorState}>
          <Text style={styles.errorText}>No checkout URL provided</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>GO BACK</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity testID="checkout-back-btn" style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={styles.headerBtn}>
          <Ionicons name="lock-closed" size={16} color={COLORS.primary} />
          <Text style={styles.secureText}>Secure</Text>
        </View>
      </View>

      {/* Shopify Checkout WebView */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading secure checkout...</Text>
        </View>
      )}
      <WebView
        testID="checkout-webview"
        source={{ uri: url }}
        style={styles.webview}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onNavigationStateChange={handleNavigationChange}
        javaScriptEnabled
        startInLoadingState={false}
        sharedCookiesEnabled
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 60 },
  headerTitle: { fontFamily: FONTS.bodyMedium, fontSize: 16, color: COLORS.text },
  secureText: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.primary },
  webview: { flex: 1 },
  loadingOverlay: { position: 'absolute', top: 60, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.white, zIndex: 10 },
  loadingText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textMuted, marginTop: 16 },
  errorState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  errorText: { fontFamily: FONTS.body, fontSize: 16, color: COLORS.textMuted },
  backBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 14, marginTop: 20 },
  backBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 13, color: COLORS.white, letterSpacing: 3 },
});
