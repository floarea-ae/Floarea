import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { COLORS, FONTS } from '../../src/constants';
import ProductCard from '../../src/components/ProductCard';
import WhatsAppButton from '../../src/components/WhatsAppButton';

export default function ShopScreen() {
  const params = useLocalSearchParams<{ category?: string }>();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(params.category || '');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/categories').then(d => setCategories(d.categories)).catch(console.error);
  }, []);

  useEffect(() => {
    loadProducts();
  }, [selectedCategory]);

  async function loadProducts() {
    setLoading(true);
    try {
      let path = '/products';
      const queryParams: string[] = [];
      if (selectedCategory) queryParams.push(`category=${selectedCategory}`);
      if (search) queryParams.push(`search=${encodeURIComponent(search)}`);
      if (queryParams.length) path += '?' + queryParams.join('&');
      const data = await api.get(path);
      setProducts(data.products);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = useCallback(() => {
    loadProducts();
  }, [search, selectedCategory]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Shop</Text>
        <Text style={styles.subtitle}>Luxury flowers & gifts</Text>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={COLORS.textMuted} />
          <TextInput
            testID="search-input"
            style={styles.searchInput}
            placeholder="Search flowers..."
            placeholderTextColor={COLORS.textMuted}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => { setSearch(''); setTimeout(loadProducts, 100); }}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Chips */}
      <View style={styles.chipScroll}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: '', name: 'All', slug: '' }, ...categories]}
          keyExtractor={(item) => item.id || 'all'}
          contentContainerStyle={styles.chipContainer}
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={`filter-${item.slug || 'all'}`}
              style={[styles.chip, selectedCategory === item.slug && styles.chipActive]}
              onPress={() => setSelectedCategory(item.slug)}
            >
              <Text style={[styles.chipText, selectedCategory === item.slug && styles.chipTextActive]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Products Grid */}
      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="flower-outline" size={48} color={COLORS.border} />
              <Text style={styles.emptyText}>No products found</Text>
            </View>
          }
          renderItem={({ item }) => <ProductCard product={item} />}
        />
      )}
      <WhatsAppButton />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  title: { fontFamily: FONTS.headingLight, fontSize: 32, color: COLORS.text },
  subtitle: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted, marginTop: 2 },

  searchRow: { paddingHorizontal: 16, marginTop: 16 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: 2, paddingHorizontal: 14, height: 48, gap: 10,
  },
  searchInput: { flex: 1, fontFamily: FONTS.body, fontSize: 14, color: COLORS.text },

  chipScroll: { marginTop: 16 },
  chipContainer: { paddingHorizontal: 16, gap: 8 },
  chip: {
    paddingHorizontal: 18, paddingVertical: 10,
    backgroundColor: COLORS.surface, borderRadius: 2,
  },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { fontFamily: FONTS.bodyMedium, fontSize: 12, color: COLORS.text, letterSpacing: 1, textTransform: 'uppercase' },
  chipTextActive: { color: COLORS.white },

  grid: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 100 },
  gridRow: { justifyContent: 'space-between' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textMuted, marginTop: 12 },
});
