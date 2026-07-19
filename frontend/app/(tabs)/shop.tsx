import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { COLORS, FONTS } from '../../src/constants';
import ProductCard from '../../src/components/ProductCard';
import WhatsAppButton from '../../src/components/WhatsAppButton';

const SORT_OPTIONS = [
  { key: 'featured', label: 'Featured' },
  { key: 'price-asc', label: 'Price: Low to High' },
  { key: 'price-desc', label: 'Price: High to Low' },
  { key: 'title-asc', label: 'Name: A to Z' },
] as const;

type SortKey = typeof SORT_OPTIONS[number]['key'];

export default function ShopScreen() {
  const params = useLocalSearchParams<{ collection?: string }>();
  const chipListRef = useRef<FlatList<any>>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>(params.collection || '');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('featured');
  const [sortVisible, setSortVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const filterCollections = useMemo(() => [{ handle: '', title: 'All' }, ...collections], [collections]);

  useEffect(() => {
    api.get('/collections').then(d => setCollections(d.collections || [])).catch(console.error);
  }, []);

  useEffect(() => {
    setSelectedCollection(params.collection || '');
  }, [params.collection]);

  useEffect(() => {
    const selectedIndex = filterCollections.findIndex((item) => item.handle === selectedCollection);
    if (selectedIndex < 0) return;
    requestAnimationFrame(() => {
      chipListRef.current?.scrollToIndex({
        index: selectedIndex,
        animated: true,
        viewPosition: 0.5,
      });
    });
  }, [filterCollections, selectedCollection]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      let path = '/products?first=30';
      if (selectedCollection) path += `&collection=${selectedCollection}`;
      if (search) path += `&search=${encodeURIComponent(search)}`;
      const data = await api.get(path);
      setProducts(data.products || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [selectedCollection, search]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const handleSearch = useCallback(() => { loadProducts(); }, [loadProducts]);
  const selectedSortLabel = SORT_OPTIONS.find((option) => option.key === sortBy)?.label || 'Featured';

  const sortedProducts = useMemo(() => {
    const nextProducts = [...products];
    if (sortBy === 'price-asc') {
      return nextProducts.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    }
    if (sortBy === 'price-desc') {
      return nextProducts.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    }
    if (sortBy === 'title-asc') {
      return nextProducts.sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
    }
    return nextProducts;
  }, [products, sortBy]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Shop</Text>
        <Text style={styles.subtitle}>Real-time from Floarea.ae</Text>
      </View>

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

      <View style={styles.chipScroll}>
        <FlatList
          ref={chipListRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          data={filterCollections}
          keyExtractor={(item) => item.handle === '' ? 'filter-all' : item.handle}
          contentContainerStyle={styles.chipContainer}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              chipListRef.current?.scrollToOffset({
                offset: Math.max(0, info.averageItemLength * info.index - 80),
                animated: true,
              });
            }, 100);
          }}
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={`filter-${item.handle || 'all'}`}
              style={[styles.chip, selectedCollection === item.handle && styles.chipActive]}
              onPress={() => setSelectedCollection(item.handle)}
            >
              <Text style={[styles.chipText, selectedCollection === item.handle && styles.chipTextActive]}>
                {item.title}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <View style={styles.toolbar}>
        <Text style={styles.resultText}>
          {selectedCollection ? collections.find((item) => item.handle === selectedCollection)?.title || 'Selected Collection' : 'All Flowers'}
        </Text>
        <TouchableOpacity style={styles.sortButton} onPress={() => setSortVisible(true)} activeOpacity={0.85}>
          <Ionicons name="swap-vertical-outline" size={16} color={COLORS.primary} />
          <Text style={styles.sortButtonText}>{selectedSortLabel}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={sortedProducts}
          keyExtractor={(item) => item.handle}
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
      <Modal
        visible={sortVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSortVisible(false)}
      >
        <TouchableOpacity style={styles.sortBackdrop} activeOpacity={1} onPress={() => setSortVisible(false)}>
          <View style={styles.sortSheet}>
            <View style={styles.sortHandle} />
            <Text style={styles.sortTitle}>Sort Flowers</Text>
            {SORT_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.key}
                style={styles.sortOption}
                onPress={() => {
                  setSortBy(option.key);
                  setSortVisible(false);
                }}
                activeOpacity={0.85}
              >
                <Text style={[styles.sortOptionText, sortBy === option.key && styles.sortOptionTextActive]}>
                  {option.label}
                </Text>
                {sortBy === option.key ? <Ionicons name="checkmark" size={20} color={COLORS.primary} /> : null}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
      <WhatsAppButton />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6 },
  title: { fontFamily: FONTS.headingLight, fontSize: 36, color: COLORS.text },
  subtitle: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  searchRow: { paddingHorizontal: 16, marginTop: 18 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, height: 50, gap: 10 },
  searchInput: { flex: 1, fontFamily: FONTS.body, fontSize: 14, color: COLORS.text },
  chipScroll: { marginTop: 16 },
  chipContainer: { paddingHorizontal: 16, gap: 8 },
  chip: { paddingHorizontal: 18, paddingVertical: 11, backgroundColor: COLORS.white, borderRadius: 4, borderWidth: 1, borderColor: COLORS.border },
  chipActive: { backgroundColor: COLORS.primary },
  chipText: { fontFamily: FONTS.bodyMedium, fontSize: 12, color: COLORS.text, letterSpacing: 1, textTransform: 'uppercase' },
  chipTextActive: { color: COLORS.white },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginTop: 18, gap: 12 },
  resultText: { flex: 1, fontFamily: FONTS.heading, fontSize: 18, color: COLORS.text },
  sortButton: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 42, paddingHorizontal: 14, borderWidth: 1, borderColor: COLORS.border, borderRadius: 4, backgroundColor: COLORS.white },
  sortButtonText: { fontFamily: FONTS.bodyMedium, fontSize: 12, color: COLORS.primary },
  grid: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 100 },
  gridRow: { justifyContent: 'space-between' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textMuted, marginTop: 12 },
  sortBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.28)' },
  sortSheet: { backgroundColor: COLORS.background, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 34, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  sortHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 18 },
  sortTitle: { fontFamily: FONTS.headingLight, fontSize: 28, color: COLORS.text, marginBottom: 8, textAlign: 'center' },
  sortOption: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  sortOptionText: { fontFamily: FONTS.body, fontSize: 15, color: COLORS.text },
  sortOptionTextActive: { fontFamily: FONTS.bodySemiBold, color: COLORS.primary },
});
