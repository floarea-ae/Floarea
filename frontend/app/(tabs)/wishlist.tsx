import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useWishlist } from '../../src/context/WishlistContext';
import { COLORS, FONTS } from '../../src/constants';
import ProductCard from '../../src/components/ProductCard';

export default function WishlistScreen() {
  const { items, count } = useWishlist();
  const router = useRouter();

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}><Text style={styles.title}>Wishlist</Text></View>
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}><Ionicons name="heart-outline" size={48} color={COLORS.border} /></View>
          <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
          <Text style={styles.emptySubtitle}>Save your favorite flowers</Text>
          <TouchableOpacity testID="browse-btn" style={styles.browseBtn} onPress={() => router.push('/shop')}>
            <Text style={styles.browseBtnText}>BROWSE FLOWERS</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const productData = items.map(i => ({
    handle: i.handle, title: i.name, price: i.price,
    image: i.image, variant_id: i.variant_id,
  }));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Wishlist</Text>
        <Text style={styles.countText}>{count} {count === 1 ? 'item' : 'items'}</Text>
      </View>
      <FlatList
        data={productData}
        keyExtractor={(item) => item.handle}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.gridRow}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <ProductCard product={item} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  title: { fontFamily: FONTS.headingLight, fontSize: 32, color: COLORS.text },
  countText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted, marginBottom: 6 },
  grid: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },
  gridRow: { justifyContent: 'space-between' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontFamily: FONTS.heading, fontSize: 22, color: COLORS.text },
  emptySubtitle: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted, marginTop: 8 },
  browseBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 32, paddingVertical: 16, marginTop: 28 },
  browseBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 13, color: COLORS.white, letterSpacing: 3 },
});
