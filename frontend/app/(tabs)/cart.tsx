import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../../src/context/CartContext';
import { useAuth } from '../../src/context/AuthContext';
import { COLORS, FONTS } from '../../src/constants';

export default function CartScreen() {
  const router = useRouter();
  const { items, updateQuantity, removeItem, total, itemCount, clearCart } = useCart();
  const { user } = useAuth();
  const deliveryFee = total >= 500 ? 0 : 35;
  const grandTotal = total + deliveryFee;

  function handleCheckout() {
    if (!user) {
      Alert.alert('Login Required', 'Please login to proceed with checkout.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Login', onPress: () => router.push('/auth') },
      ]);
      return;
    }
    router.push('/checkout');
  }

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Cart</Text>
        </View>
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="bag-outline" size={48} color={COLORS.border} />
          </View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>Explore our luxury collection of flowers and gifts</Text>
          <TouchableOpacity testID="shop-now-btn" style={styles.shopBtn} onPress={() => router.push('/shop')}>
            <Text style={styles.shopBtnText}>SHOP NOW</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Cart</Text>
        <Text style={styles.itemCountText}>{itemCount} {itemCount === 1 ? 'item' : 'items'}</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.product_id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View testID={`cart-item-${item.product_id}`} style={styles.cartItem}>
            <Image source={{ uri: item.image }} style={styles.itemImage} contentFit="cover" />
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.itemPrice}>Dhs. {item.price.toLocaleString()}</Text>
              <View style={styles.qtyRow}>
                <TouchableOpacity
                  testID={`qty-minus-${item.product_id}`}
                  style={styles.qtyBtn}
                  onPress={() => updateQuantity(item.product_id, item.quantity - 1)}
                >
                  <Ionicons name="remove" size={16} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{item.quantity}</Text>
                <TouchableOpacity
                  testID={`qty-plus-${item.product_id}`}
                  style={styles.qtyBtn}
                  onPress={() => updateQuantity(item.product_id, item.quantity + 1)}
                >
                  <Ionicons name="add" size={16} color={COLORS.text} />
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity
              testID={`remove-item-${item.product_id}`}
              style={styles.removeBtn}
              onPress={() => removeItem(item.product_id)}
            >
              <Ionicons name="trash-outline" size={18} color={COLORS.accent} />
            </TouchableOpacity>
          </View>
        )}
        ListFooterComponent={
          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>Dhs. {total.toLocaleString()}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery</Text>
              <Text style={styles.summaryValue}>
                {deliveryFee === 0 ? 'Free' : `Dhs. ${deliveryFee}`}
              </Text>
            </View>
            {deliveryFee === 0 && (
              <Text style={styles.freeNote}>Free delivery on orders above Dhs. 500</Text>
            )}
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>Dhs. {grandTotal.toLocaleString()}</Text>
            </View>
          </View>
        }
      />

      <View style={styles.bottomBar}>
        <View style={styles.bottomTotal}>
          <Text style={styles.bottomTotalLabel}>Total</Text>
          <Text style={styles.bottomTotalValue}>Dhs. {grandTotal.toLocaleString()}</Text>
        </View>
        <TouchableOpacity testID="checkout-btn" style={styles.checkoutBtn} onPress={handleCheckout}>
          <Text style={styles.checkoutBtnText}>CHECKOUT</Text>
          <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  title: { fontFamily: FONTS.headingLight, fontSize: 32, color: COLORS.text },
  itemCountText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted, marginBottom: 6 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontFamily: FONTS.heading, fontSize: 22, color: COLORS.text },
  emptySubtitle: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted, marginTop: 8, textAlign: 'center' },
  shopBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 32, paddingVertical: 16, marginTop: 28 },
  shopBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 13, color: COLORS.white, letterSpacing: 3 },

  list: { paddingHorizontal: 16, paddingBottom: 200 },
  cartItem: { flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: 2, padding: 12, marginBottom: 12 },
  itemImage: { width: 80, height: 100, borderRadius: 2 },
  itemInfo: { flex: 1, marginLeft: 14, justifyContent: 'center' },
  itemName: { fontFamily: FONTS.heading, fontSize: 16, color: COLORS.text, lineHeight: 20 },
  itemPrice: { fontFamily: FONTS.bodyMedium, fontSize: 14, color: COLORS.text, marginTop: 4 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 12 },
  qtyBtn: { width: 32, height: 32, borderRadius: 2, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center' },
  qtyText: { fontFamily: FONTS.bodyMedium, fontSize: 15, color: COLORS.text, minWidth: 20, textAlign: 'center' },
  removeBtn: { justifyContent: 'center', paddingLeft: 8 },

  summary: { backgroundColor: COLORS.white, borderRadius: 2, padding: 20, marginTop: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textMuted },
  summaryValue: { fontFamily: FONTS.bodyMedium, fontSize: 14, color: COLORS.text },
  freeNote: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.success, marginBottom: 10 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  totalLabel: { fontFamily: FONTS.bodyMedium, fontSize: 16, color: COLORS.text },
  totalValue: { fontFamily: FONTS.bodySemiBold, fontSize: 18, color: COLORS.text },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.white, paddingHorizontal: 20, paddingVertical: 16,
    borderTopWidth: 1, borderTopColor: COLORS.border,
    paddingBottom: 30,
  },
  bottomTotal: {},
  bottomTotalLabel: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted },
  bottomTotalValue: { fontFamily: FONTS.bodySemiBold, fontSize: 18, color: COLORS.text },
  checkoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primary, paddingHorizontal: 28, paddingVertical: 16,
  },
  checkoutBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 13, color: COLORS.white, letterSpacing: 3 },
});
