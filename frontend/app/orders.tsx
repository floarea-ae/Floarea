import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../src/constants';

export default function OrdersScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity testID="orders-back-btn" style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Orders</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.emptyIcon}>
          <Ionicons name="receipt-outline" size={48} color={COLORS.border} />
        </View>
        <Text style={styles.emptyTitle}>Orders managed by Shopify</Text>
        <Text style={styles.emptySubtitle}>
          Your orders are processed through our secure Shopify checkout.
          You'll receive order confirmation and tracking details via email.
        </Text>
        <TouchableOpacity
          testID="track-order-btn"
          style={styles.trackBtn}
          onPress={() => router.push({ pathname: '/checkout', params: { url: 'https://floarea.ae/account' } })}
        >
          <Text style={styles.trackBtnText}>TRACK ORDERS ON FLOAREA.AE</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="continue-shopping-btn" style={styles.shopBtn} onPress={() => router.push('/shop')}>
          <Text style={styles.shopBtnText}>CONTINUE SHOPPING</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontFamily: FONTS.bodyMedium, fontSize: 18, color: COLORS.text },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontFamily: FONTS.heading, fontSize: 22, color: COLORS.text, textAlign: 'center' },
  emptySubtitle: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted, marginTop: 12, textAlign: 'center', lineHeight: 20 },
  trackBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 28, paddingVertical: 16, marginTop: 28, width: '100%', alignItems: 'center' },
  trackBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 12, color: COLORS.white, letterSpacing: 3 },
  shopBtn: { borderWidth: 1, borderColor: COLORS.primary, paddingHorizontal: 28, paddingVertical: 16, marginTop: 12, width: '100%', alignItems: 'center' },
  shopBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 12, color: COLORS.primary, letterSpacing: 3 },
});
