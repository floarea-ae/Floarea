import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, Platform, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth } from '../../src/context/AuthContext';
import { useCart } from '../../src/context/CartContext';
import { api } from '../../src/api';
import { COLORS, FONTS } from '../../src/constants';

export default function CartScreen() {
  const router = useRouter();
  const { shopifyToken } = useAuth();
  const { items, updateQuantity, removeItem, total, itemCount } = useCart();
  const [checkingOut, setCheckingOut] = useState(false);
  const deliveryFee = total >= 500 ? 0 : 35;
  const grandTotal = total + deliveryFee;

  // Dubai timezone helper (GMT+4)
  function getDubaiTime(): Date {
    const localDate = new Date();
    const utc = localDate.getTime() + (localDate.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * 4));
  }

  function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function displayDate(date: Date): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
  }

  // Delivery Slots Definition
  const DELIVERY_SLOTS = [
    { label: '9 AM to 12 PM', endHour: 12 },
    { label: '12 PM to 3 PM', endHour: 15 },
    { label: '3 PM to 6 PM', endHour: 18 },
    { label: '6 PM to 9 PM', endHour: 21 },
    { label: '9 PM to 12 AM', endHour: 24 },
  ];

  function getAvailableSlots(date: Date): typeof DELIVERY_SLOTS {
    const dubaiNow = getDubaiTime();
    const isToday = formatDate(date) === formatDate(dubaiNow);
    if (!isToday) {
      return DELIVERY_SLOTS;
    }
    const currentHour = dubaiNow.getHours();
    const currentMinute = dubaiNow.getMinutes();
    return DELIVERY_SLOTS.filter(slot => {
      if (currentHour > slot.endHour) return false;
      if (currentHour === slot.endHour && currentMinute > 0) return false;
      return true;
    });
  }

  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const dubaiTime = getDubaiTime();
    const localDate = new Date();
    localDate.setFullYear(dubaiTime.getFullYear());
    localDate.setMonth(dubaiTime.getMonth());
    localDate.setDate(dubaiTime.getDate());
    localDate.setHours(dubaiTime.getHours());
    localDate.setMinutes(dubaiTime.getMinutes());
    localDate.setSeconds(0);
    localDate.setMilliseconds(0);
    return localDate;
  });

  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [cardMessage, setCardMessage] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const availableSlots = getAvailableSlots(selectedDate);

  const handleDateChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (date) {
      setSelectedDate(date);
      setSelectedSlot(null); // Reset slot selection when date changes
    }
  };

  async function handleCheckout() {
    if (items.length === 0) return;

    if (!shopifyToken) {
      Alert.alert('Login Required', 'Please sign in before checkout.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push('/auth') },
      ]);
      return;
    }

    // Validate delivery slot selection
    const dubaiNow = getDubaiTime();
    if (formatDate(selectedDate) < formatDate(dubaiNow)) {
      Alert.alert('Invalid Date', 'Past dates are not allowed. Please select a valid delivery date.');
      return;
    }

    if (availableSlots.length === 0) {
      Alert.alert('Unavailable Date', 'No delivery slots are available for the selected date. Please select another date.');
      return;
    }

    if (!selectedSlot) {
      Alert.alert('Selection Required', 'Please select a delivery time slot before proceeding.');
      return;
    }

    setCheckingOut(true);
    try {
      const lines = items.map(item => ({
        variantId: item.variant_id,
        quantity: item.quantity,
      }));

      const attributes = [
        { key: 'Delivery Date', value: formatDate(selectedDate) },
        { key: 'Delivery Time', value: selectedSlot }
      ];
      if (cardMessage.trim()) {
        attributes.push({ key: 'Card Message', value: cardMessage.trim() });
      }

      const endpoint = shopifyToken ? '/cart/create-with-customer' : '/cart/create';
      const options = shopifyToken ? { useShopifyToken: true } : undefined;
      const data = await api.post(endpoint, { lines, attributes }, options);
      if (data.checkout_url) {
        router.push({ pathname: '/checkout', params: { url: data.checkout_url } });
      }
    } catch (e: any) {
      Alert.alert('Checkout Error', e.message || 'Failed to create checkout');
    } finally {
      setCheckingOut(false);
    }
  }

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}><Text style={styles.title}>Cart</Text></View>
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}><Ionicons name="bag-outline" size={48} color={COLORS.border} /></View>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>Explore our luxury collection</Text>
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
        keyExtractor={(item) => item.variant_id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View testID={`cart-item-${item.variant_id}`} style={styles.cartItem}>
            <Image source={{ uri: item.image }} style={styles.itemImage} contentFit="cover" />
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.itemPrice}>Dhs. {item.price.toLocaleString()}</Text>
              <View style={styles.qtyRow}>
                <TouchableOpacity testID={`qty-minus-${item.variant_id}`} style={styles.qtyBtn} onPress={() => updateQuantity(item.variant_id, item.quantity - 1)}>
                  <Ionicons name="remove" size={16} color={COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{item.quantity}</Text>
                <TouchableOpacity testID={`qty-plus-${item.variant_id}`} style={styles.qtyBtn} onPress={() => updateQuantity(item.variant_id, item.quantity + 1)}>
                  <Ionicons name="add" size={16} color={COLORS.text} />
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity testID={`remove-item-${item.variant_id}`} style={styles.removeBtn} onPress={() => removeItem(item.variant_id)}>
              <Ionicons name="trash-outline" size={18} color={COLORS.accent} />
            </TouchableOpacity>
          </View>
        )}
        ListFooterComponent={
          <>
            {/* Delivery Slots Selection */}
            <View style={styles.deliverySection}>
              <Text style={styles.sectionTitle}>Delivery Details</Text>
              
              {/* Date Selection */}
              <View style={styles.pickerRow}>
                <Text style={styles.pickerLabel}>Delivery Date</Text>
                {Platform.OS === 'android' ? (
                  <TouchableOpacity 
                    testID="date-picker-trigger"
                    style={styles.dateBtn} 
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Text style={styles.dateBtnText}>
                      {displayDate(selectedDate)}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <DateTimePicker
                    testID="ios-date-picker"
                    value={selectedDate}
                    mode="date"
                    display="default"
                    minimumDate={new Date()}
                    onChange={handleDateChange}
                    style={styles.iosDatePicker}
                  />
                )}
              </View>

              {Platform.OS === 'android' && showDatePicker && (
                <DateTimePicker
                  testID="android-date-picker"
                  value={selectedDate}
                  mode="date"
                  display="default"
                  minimumDate={new Date()}
                  onChange={handleDateChange}
                />
              )}

              {/* Time Slot Selection */}
              <Text style={styles.pickerLabel}>Delivery Time Slot</Text>
              {availableSlots.length === 0 ? (
                <View style={styles.noSlotsContainer}>
                  <Text style={styles.noSlotsText}>No delivery slots available for this date.</Text>
                  <Text style={styles.noSlotsSubText}>Please select another date.</Text>
                </View>
              ) : (
                <View style={styles.slotsGrid}>
                  {availableSlots.map(slot => {
                    const isSelected = selectedSlot === slot.label;
                    return (
                      <TouchableOpacity
                        testID={`slot-${slot.label}`}
                        key={slot.label}
                        style={[
                          styles.slotButton,
                          isSelected && styles.slotButtonSelected
                        ]}
                        onPress={() => setSelectedSlot(slot.label)}
                      >
                        <Text style={[
                          styles.slotButtonText,
                          isSelected && styles.slotButtonTextSelected
                        ]}>
                          {slot.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <Text style={styles.pickerLabel}>Card Message</Text>
              <TextInput
                testID="card-message-input"
                style={styles.cardMessageInput}
                placeholder="Write a short message for the recipient"
                placeholderTextColor={COLORS.textMuted}
                value={cardMessage}
                onChangeText={setCardMessage}
                multiline
                maxLength={250}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.summary}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>Dhs. {total.toLocaleString()}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery</Text>
                <Text style={styles.summaryValue}>{deliveryFee === 0 ? 'Free' : `Dhs. ${deliveryFee}`}</Text>
              </View>
              {deliveryFee === 0 && <Text style={styles.freeNote}>Free delivery on orders above Dhs. 500</Text>}
              <View style={styles.divider} />
              <View style={styles.summaryRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>Dhs. {grandTotal.toLocaleString()}</Text>
              </View>
            </View>
          </>
        }
      />
      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.bottomTotalLabel}>Total</Text>
          <Text style={styles.bottomTotalValue}>Dhs. {grandTotal.toLocaleString()}</Text>
        </View>
        <TouchableOpacity testID="checkout-btn" style={styles.checkoutBtn} onPress={handleCheckout} disabled={checkingOut}>
          {checkingOut ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <>
              <Text style={styles.checkoutBtnText}>CHECKOUT</Text>
              <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
            </>
          )}
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
  emptySubtitle: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted, marginTop: 8 },
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
  deliverySection: { backgroundColor: COLORS.white, borderRadius: 2, padding: 20, marginTop: 12, marginBottom: 4 },
  sectionTitle: { fontFamily: FONTS.heading, fontSize: 20, color: COLORS.text, marginBottom: 16 },
  pickerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  pickerLabel: { fontFamily: FONTS.bodyMedium, fontSize: 14, color: COLORS.text, marginBottom: 8 },
  dateBtn: { backgroundColor: COLORS.surface, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 2, borderWidth: 1, borderColor: COLORS.border },
  dateBtnText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.text },
  iosDatePicker: { alignSelf: 'flex-end' },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  slotButton: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.border, borderRadius: 2, paddingVertical: 12, paddingHorizontal: 14, width: '48%', marginBottom: 4, alignItems: 'center' },
  slotButtonSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  slotButtonText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.text },
  slotButtonTextSelected: { fontFamily: FONTS.bodyMedium, color: COLORS.white },
  noSlotsContainer: { paddingVertical: 16, alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 2, marginTop: 4 },
  noSlotsText: { fontFamily: FONTS.bodySemiBold, fontSize: 14, color: COLORS.accent },
  noSlotsSubText: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  cardMessageInput: { minHeight: 92, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 2, paddingHorizontal: 14, paddingVertical: 12, fontFamily: FONTS.body, fontSize: 14, color: COLORS.text, lineHeight: 20 },
  summary: { backgroundColor: COLORS.white, borderRadius: 2, padding: 20, marginTop: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textMuted },
  summaryValue: { fontFamily: FONTS.bodyMedium, fontSize: 14, color: COLORS.text },
  freeNote: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.success, marginBottom: 10 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  totalLabel: { fontFamily: FONTS.bodyMedium, fontSize: 16, color: COLORS.text },
  totalValue: { fontFamily: FONTS.bodySemiBold, fontSize: 18, color: COLORS.text },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.white, paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: COLORS.border, paddingBottom: 30 },
  bottomTotalLabel: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted },
  bottomTotalValue: { fontFamily: FONTS.bodySemiBold, fontSize: 18, color: COLORS.text },
  checkoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.primary, paddingHorizontal: 28, paddingVertical: 16 },
  checkoutBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 13, color: COLORS.white, letterSpacing: 3 },
});
