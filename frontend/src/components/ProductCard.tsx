import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCart } from '../../src/context/CartContext';
import { useWishlist } from '../../src/context/WishlistContext';
import { COLORS, FONTS } from '../../src/constants';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

type ProductCardProps = {
  product: {
    id: string;
    name: string;
    price: number;
    image: string;
    category_name?: string;
  };
};

export default function ProductCard({ product }: ProductCardProps) {
  const router = useRouter();
  const { addItem } = useCart();
  const { toggleItem, isInWishlist } = useWishlist();
  const liked = isInWishlist(product.id);

  return (
    <TouchableOpacity
      testID={`product-card-${product.id}`}
      style={styles.card}
      onPress={() => router.push(`/product/${product.id}`)}
      activeOpacity={0.8}
    >
      <View style={styles.imageWrapper}>
        <Image source={{ uri: product.image }} style={styles.image} contentFit="cover" />
        <TouchableOpacity
          testID={`wishlist-toggle-${product.id}`}
          style={styles.heartBtn}
          onPress={(e) => {
            e.stopPropagation();
            toggleItem({ product_id: product.id, name: product.name, price: product.price, image: product.image });
          }}
        >
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? COLORS.accent : COLORS.textMuted} />
        </TouchableOpacity>
      </View>
      <View style={styles.info}>
        {product.category_name && (
          <Text style={styles.category}>{product.category_name}</Text>
        )}
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>Dhs. {product.price.toLocaleString()}</Text>
          <TouchableOpacity
            testID={`add-to-cart-${product.id}`}
            style={styles.addBtn}
            onPress={(e) => {
              e.stopPropagation();
              addItem({ product_id: product.id, name: product.name, price: product.price, image: product.image });
            }}
          >
            <Ionicons name="add" size={18} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    marginBottom: 20,
  },
  imageWrapper: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: COLORS.surface,
    borderRadius: 2,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  heartBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    paddingTop: 10,
  },
  category: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 9,
    color: COLORS.primary,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  name: {
    fontFamily: FONTS.heading,
    fontSize: 16,
    color: COLORS.text,
    lineHeight: 20,
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  price: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
    color: COLORS.text,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
