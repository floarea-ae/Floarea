import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../src/context/AuthContext';
import { COLORS, FONTS } from '../src/constants';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function OrdersScreen() {
  const router = useRouter();
  const { user, shopifyToken } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { if (shopifyToken) loadOrders(); else setLoading(false); }, [shopifyToken]);

  async function loadOrders() {
    try {
      const authToken = await AsyncStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/api/shopify-auth/orders`, {
        headers: {
          'x-shopify-customer-token': shopifyToken || '',
          'Authorization': `Bearer ${authToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (e) { console.error('Orders error:', e); }
    finally { setLoading(false); setRefreshing(false); }
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-AE', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function statusColor(status: string) {
    const s = (status || '').toLowerCase();
    if (s === 'paid' || s === 'fulfilled') return COLORS.success;
    if (s === 'pending' || s === 'unfulfilled') return '#E6A817';
    if (s === 'refunded' || s === 'voided') return COLORS.accent;
    return COLORS.textMuted;
  }

  if (!user || !shopifyToken) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity testID="orders-back-btn" style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Orders</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}><Ionicons name="receipt-outline" size={48} color={COLORS.border} /></View>
          <Text style={styles.emptyTitle}>Sign in to view orders</Text>
          <Text style={styles.emptySubtitle}>Login with your Floarea account to see your order history</Text>
          <TouchableOpacity testID="login-for-orders" style={styles.actionBtn} onPress={() => router.push('/auth')}>
            <Text style={styles.actionBtnText}>SIGN IN</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity testID="orders-back-btn" style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Orders</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ flex: 1 }} />
      ) : orders.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}><Ionicons name="receipt-outline" size={48} color={COLORS.border} /></View>
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptySubtitle}>Your order history will appear here after your first purchase</Text>
          <TouchableOpacity testID="shop-now-orders" style={styles.actionBtn} onPress={() => router.push('/shop')}>
            <Text style={styles.actionBtnText}>SHOP NOW</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadOrders(); }} tintColor={COLORS.primary} />}
          renderItem={({ item }) => (
            <View testID={`order-${item.name}`} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <View>
                  <Text style={styles.orderName}>{item.name}</Text>
                  <Text style={styles.orderDate}>{formatDate(item.processed_at)}</Text>
                </View>
                <View style={styles.orderTotal}>
                  <Text style={styles.orderPrice}>Dhs. {item.total.toLocaleString()}</Text>
                </View>
              </View>

              <View style={styles.statusRow}>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(item.financial_status) + '18' }]}>
                  <View style={[styles.statusDot, { backgroundColor: statusColor(item.financial_status) }]} />
                  <Text style={[styles.statusText, { color: statusColor(item.financial_status) }]}>
                    {(item.financial_status || 'Pending').toUpperCase()}
                  </Text>
                </View>
                {item.fulfillment_status && (
                  <View style={[styles.statusBadge, { backgroundColor: statusColor(item.fulfillment_status) + '18' }]}>
                    <View style={[styles.statusDot, { backgroundColor: statusColor(item.fulfillment_status) }]} />
                    <Text style={[styles.statusText, { color: statusColor(item.fulfillment_status) }]}>
                      {item.fulfillment_status.toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>

              {item.items && item.items.length > 0 && (
                <View style={styles.itemsRow}>
                  {item.items.slice(0, 3).map((li: any, i: number) => (
                    <View key={i} style={styles.lineItem}>
                      {li.image ? (
                        <Image source={{ uri: li.image }} style={styles.lineImage} contentFit="cover" />
                      ) : (
                        <View style={[styles.lineImage, { backgroundColor: COLORS.surface }]} />
                      )}
                      <View style={styles.lineInfo}>
                        <Text style={styles.lineTitle} numberOfLines={1}>{li.title}</Text>
                        <Text style={styles.lineQty}>Qty: {li.quantity}</Text>
                      </View>
                    </View>
                  ))}
                  {item.items.length > 3 && (
                    <Text style={styles.moreItems}>+{item.items.length - 3} more items</Text>
                  )}
                </View>
              )}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontFamily: FONTS.bodyMedium, fontSize: 18, color: COLORS.text },
  list: { paddingHorizontal: 16, paddingBottom: 40 },

  orderCard: { backgroundColor: COLORS.white, borderRadius: 2, padding: 16, marginBottom: 12 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderName: { fontFamily: FONTS.bodyMedium, fontSize: 16, color: COLORS.text },
  orderDate: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  orderTotal: { alignItems: 'flex-end' },
  orderPrice: { fontFamily: FONTS.bodySemiBold, fontSize: 16, color: COLORS.text },

  statusRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 2, gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: FONTS.bodySemiBold, fontSize: 10, letterSpacing: 1 },

  itemsRow: { marginTop: 14, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12 },
  lineItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  lineImage: { width: 40, height: 40, borderRadius: 2 },
  lineInfo: { marginLeft: 10, flex: 1 },
  lineTitle: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.text },
  lineQty: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textMuted },
  moreItems: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted, marginTop: 4 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontFamily: FONTS.heading, fontSize: 22, color: COLORS.text, textAlign: 'center' },
  emptySubtitle: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted, marginTop: 12, textAlign: 'center', lineHeight: 20 },
  actionBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 28, paddingVertical: 16, marginTop: 28 },
  actionBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 12, color: COLORS.white, letterSpacing: 3 },
});
