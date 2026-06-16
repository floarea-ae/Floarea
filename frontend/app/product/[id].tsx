import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, Alert } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { useAuth } from '../../src/context/AuthContext';
import { useCart } from '../../src/context/CartContext';
import { useWishlist } from '../../src/context/WishlistContext';
import { COLORS, FONTS } from '../../src/constants';
import WhatsAppButton from '../../src/components/WhatsAppButton';

const { width } = Dimensions.get('window');

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { shopifyToken } = useAuth();
  const { addItem } = useCart();
  const { toggleItem, isInWishlist } = useWishlist();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (id) {
      api.get(`/products/${id}`).then(setProduct).catch(console.error).finally(() => setLoading(false));
    }
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Product not found</Text>
      </SafeAreaView>
    );
  }

  const liked = isInWishlist(product.handle);
  const images = product.images || [product.image];

  function handleAddToCart() {
    if (!shopifyToken) {
      Alert.alert('Login Required', 'Please sign in to add items to your cart.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => router.push('/auth') },
      ]);
      return;
    }

    addItem({
      variant_id: product.variant_id,
      handle: product.handle,
      name: product.title,
      price: product.price,
      image: product.image,
    }, qty);
    Alert.alert('Added to Cart', `${product.title} added to your cart.`, [
      { text: 'Continue Shopping', style: 'cancel' },
      { text: 'View Cart', onPress: () => router.push('/(tabs)/cart') },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.topBar}>
          <TouchableOpacity testID="back-btn" style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity
            testID={`wishlist-detail-${product.handle}`}
            style={styles.backBtn}
            onPress={() => toggleItem({
              handle: product.handle, name: product.title,
              price: product.price, image: product.image, variant_id: product.variant_id,
            })}
          >
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? COLORS.accent : COLORS.text} />
          </TouchableOpacity>
        </View>

        {/* Image Gallery */}
        <View style={styles.imageContainer}>
          <Image source={{ uri: images[selectedImage] || product.image }} style={styles.mainImage} contentFit="cover" />
        </View>
        {images.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnailRow}>
            {images.map((img: string, i: number) => (
              <TouchableOpacity key={i} onPress={() => setSelectedImage(i)} style={[styles.thumbnail, selectedImage === i && styles.thumbActive]}>
                <Image source={{ uri: img }} style={styles.thumbImage} contentFit="cover" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Product Info */}
        <View style={styles.infoSection}>
          {product.collections && product.collections.length > 0 && (
            <Text style={styles.categoryLabel}>{product.collections[0]}</Text>
          )}
          <Text style={styles.productTitle}>{product.title}</Text>
          <Text style={styles.productPrice}>Dhs. {product.price.toLocaleString()}</Text>

          {!product.available && <Text style={styles.soldOut}>Sold Out</Text>}

          {product.description ? (
            <View style={styles.descSection}>
              <Text style={styles.descLabel}>Description</Text>
              <Text style={styles.descText}>{product.description}</Text>
            </View>
          ) : null}

          {/* Tags */}
          {product.tags && product.tags.length > 0 && (
            <View style={styles.tagsRow}>
              {product.tags.slice(0, 5).map((tag: string) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}>{tag.replace(/-/g, ' ')}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Delivery Info */}
          <View style={styles.infoRow}>
            <Ionicons name="car-outline" size={18} color={COLORS.primary} />
            <Text style={styles.infoText}>Same-day delivery across Dubai. Free delivery above Dhs. 500.</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.primary} />
            <Text style={styles.infoText}>Freshness guaranteed. Carefully handcrafted by our florists.</Text>
          </View>
        </View>
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom Bar */}
      {product.available && (
        <View style={styles.bottomBar}>
          <View style={styles.qtyControl}>
            <TouchableOpacity testID="qty-minus" style={styles.qtyBtn} onPress={() => setQty(Math.max(1, qty - 1))}>
              <Ionicons name="remove" size={18} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.qtyText}>{qty}</Text>
            <TouchableOpacity testID="qty-plus" style={styles.qtyBtn} onPress={() => setQty(qty + 1)}>
              <Ionicons name="add" size={18} color={COLORS.text} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity testID="add-to-cart-detail" style={styles.addToCartBtn} onPress={handleAddToCart}>
            <Ionicons name="bag-add-outline" size={20} color={COLORS.white} />
            <Text style={styles.addToCartText}>ADD TO CART</Text>
          </TouchableOpacity>
        </View>
      )}
      <WhatsAppButton />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  errorText: { fontFamily: FONTS.body, fontSize: 16, color: COLORS.textMuted, textAlign: 'center', marginTop: 40 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center' },
  imageContainer: { width, height: width * 1.25, backgroundColor: COLORS.surface },
  mainImage: { width: '100%', height: '100%' },
  thumbnailRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  thumbnail: { width: 60, height: 60, borderRadius: 2, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  thumbActive: { borderColor: COLORS.primary },
  thumbImage: { width: '100%', height: '100%' },
  infoSection: { paddingHorizontal: 20, paddingTop: 20 },
  categoryLabel: { fontFamily: FONTS.bodySemiBold, fontSize: 10, color: COLORS.primary, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8 },
  productTitle: { fontFamily: FONTS.headingLight, fontSize: 30, color: COLORS.text, lineHeight: 36 },
  productPrice: { fontFamily: FONTS.bodyMedium, fontSize: 20, color: COLORS.text, marginTop: 10 },
  soldOut: { fontFamily: FONTS.bodySemiBold, fontSize: 14, color: COLORS.accent, marginTop: 8 },
  descSection: { marginTop: 24 },
  descLabel: { fontFamily: FONTS.bodyMedium, fontSize: 14, color: COLORS.text, marginBottom: 8 },
  descText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textMuted, lineHeight: 22 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20 },
  tag: { backgroundColor: COLORS.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 2 },
  tagText: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textMuted, textTransform: 'capitalize' },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 20 },
  infoText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted, flex: 1, lineHeight: 18 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: COLORS.white, paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 30, borderTopWidth: 1, borderTopColor: COLORS.border },
  qtyControl: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyBtn: { width: 40, height: 40, borderRadius: 2, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center' },
  qtyText: { fontFamily: FONTS.bodyMedium, fontSize: 17, color: COLORS.text, minWidth: 24, textAlign: 'center' },
  addToCartBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 2 },
  addToCartText: { fontFamily: FONTS.bodySemiBold, fontSize: 13, color: COLORS.white, letterSpacing: 3 },
});
