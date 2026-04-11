import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { COLORS, FONTS } from '../../src/constants';
import ProductCard from '../../src/components/ProductCard';
import WhatsAppButton from '../../src/components/WhatsAppButton';

export default function HomeScreen() {
  const router = useRouter();
  const [collections, setCollections] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [colData, prodData] = await Promise.all([
        api.get('/collections?featured_only=true'),
        api.get('/products?first=8'),
      ]);
      setCollections(colData.collections || []);
      setProducts(prodData.products || []);
    } catch (e) {
      console.error('Load error:', e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  const heroImage = products[0]?.image || 'https://static.prod-images.emergentagent.com/jobs/a06552a2-c265-40ba-8f47-09377686258f/images/7a38dfc4f58944083838abb9587b764e9809560d2e9979a74da00d8440727956.png';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logoText}>FLOAREA</Text>
            <Text style={styles.logoSubText}>Luxury Blooms</Text>
          </View>
          <TouchableOpacity testID="search-btn" onPress={() => router.push('/shop')}>
            <Ionicons name="search-outline" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {/* Hero Banner */}
        <TouchableOpacity testID="hero-banner" style={styles.heroBanner} onPress={() => router.push('/shop')} activeOpacity={0.9}>
          <Image source={{ uri: heroImage }} style={styles.heroImage} contentFit="cover" />
          <View style={styles.heroOverlay}>
            <Text style={styles.heroOverline}>INSPIRED BY NATURE</Text>
            <Text style={styles.heroTitle}>Luxury Blooms,{'\n'}Delivered{'\n'}With Love</Text>
            <View style={styles.heroBtn}>
              <Text style={styles.heroBtnText}>SHOP NOW</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Categories */}
        {collections.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Shop by Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catScroll}>
              {collections.map((cat) => (
                <TouchableOpacity
                  testID={`category-${cat.handle}`}
                  key={cat.handle}
                  style={styles.catCard}
                  onPress={() => router.push({ pathname: '/shop', params: { collection: cat.handle } })}
                  activeOpacity={0.8}
                >
                  {cat.image ? (
                    <Image source={{ uri: cat.image }} style={styles.catImage} contentFit="cover" />
                  ) : (
                    <View style={[styles.catImage, { backgroundColor: COLORS.primary }]} />
                  )}
                  <View style={styles.catOverlay}>
                    <Text style={styles.catName}>{cat.title}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Services */}
        <View style={styles.servicesRow}>
          {[
            { icon: 'flash-outline', title: 'Fast Delivery', sub: 'Same-day across Dubai' },
            { icon: 'flower-outline', title: 'Fresh Flowers', sub: 'Handpicked daily' },
            { icon: 'color-palette-outline', title: 'Tailor Made', sub: 'Custom arrangements' },
          ].map((svc, i) => (
            <View key={i} style={styles.serviceItem}>
              <View style={styles.serviceIcon}>
                <Ionicons name={svc.icon as any} size={22} color={COLORS.primary} />
              </View>
              <Text style={styles.serviceTitle}>{svc.title}</Text>
              <Text style={styles.serviceSub}>{svc.sub}</Text>
            </View>
          ))}
        </View>

        {/* Products */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Our Collection</Text>
            <TouchableOpacity testID="view-all-btn" onPress={() => router.push('/shop')}>
              <Text style={styles.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.productGrid}>
            {products.slice(0, 6).map((product) => (
              <ProductCard key={product.handle} product={product} />
            ))}
          </View>
        </View>

        {/* Promo Banner */}
        <TouchableOpacity style={styles.promoBanner} onPress={() => router.push({ pathname: '/shop', params: { collection: 'forever-special-occasion-roses' } })} activeOpacity={0.9}>
          <Image
            source={{ uri: products[2]?.image || 'https://static.prod-images.emergentagent.com/jobs/a06552a2-c265-40ba-8f47-09377686258f/images/bb43e32f1de35ccdae4ff274e261cafb9eec619a1fdfd82effeb85a816e39db2.png' }}
            style={styles.promoImage}
            contentFit="cover"
          />
          <View style={styles.promoOverlay}>
            <Text style={styles.promoOverline}>FOREVER ROSES</Text>
            <Text style={styles.promoTitle}>Preserved to{'\n'}Last Forever</Text>
            <View style={styles.promoBtn}>
              <Text style={styles.promoBtnText}>EXPLORE</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerBrand}>FLOAREA</Text>
          <Text style={styles.footerTagline}>Floral Art for Life's{'\n'}Most Beautiful Moments</Text>
          <Text style={styles.footerInfo}>Five Palm Hotel | Five Luxe JBR Hotel</Text>
          <Text style={styles.footerInfo}>Dubai, UAE | +971 50 131 1930</Text>
        </View>
        <View style={{ height: 80 }} />
      </ScrollView>
      <WhatsAppButton />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
  logoText: { fontFamily: FONTS.headingSemiBold, fontSize: 24, color: COLORS.primary, letterSpacing: 4 },
  logoSubText: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.textMuted, letterSpacing: 2, marginTop: 2 },
  heroBanner: { height: 420, marginHorizontal: 16, borderRadius: 4, overflow: 'hidden' },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', padding: 24 },
  heroOverline: { fontFamily: FONTS.bodySemiBold, fontSize: 11, color: 'rgba(255,255,255,0.8)', letterSpacing: 3 },
  heroTitle: { fontFamily: FONTS.headingLight, fontSize: 36, color: COLORS.white, marginTop: 8, lineHeight: 42 },
  heroBtn: { backgroundColor: COLORS.white, paddingHorizontal: 24, paddingVertical: 14, alignSelf: 'flex-start', marginTop: 20 },
  heroBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 12, color: COLORS.primary, letterSpacing: 3 },
  section: { paddingHorizontal: 16, marginTop: 36 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontFamily: FONTS.headingLight, fontSize: 28, color: COLORS.text },
  viewAll: { fontFamily: FONTS.bodySemiBold, fontSize: 12, color: COLORS.primary, letterSpacing: 1, textTransform: 'uppercase' },
  catScroll: { paddingRight: 16 },
  catCard: { width: 160, height: 200, marginRight: 12, borderRadius: 2, overflow: 'hidden' },
  catImage: { width: '100%', height: '100%' },
  catOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end', padding: 14 },
  catName: { fontFamily: FONTS.heading, fontSize: 16, color: COLORS.white },
  servicesRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 32 },
  serviceItem: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  serviceIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  serviceTitle: { fontFamily: FONTS.bodyMedium, fontSize: 12, color: COLORS.text, textAlign: 'center' },
  serviceSub: { fontFamily: FONTS.body, fontSize: 10, color: COLORS.textMuted, textAlign: 'center', marginTop: 2 },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  promoBanner: { height: 320, marginHorizontal: 16, marginTop: 36, borderRadius: 4, overflow: 'hidden' },
  promoImage: { width: '100%', height: '100%' },
  promoOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(26,46,32,0.5)', justifyContent: 'flex-end', padding: 24 },
  promoOverline: { fontFamily: FONTS.bodySemiBold, fontSize: 11, color: 'rgba(255,255,255,0.8)', letterSpacing: 3 },
  promoTitle: { fontFamily: FONTS.headingLight, fontSize: 30, color: COLORS.white, marginTop: 8, lineHeight: 36 },
  promoBtn: { borderWidth: 1, borderColor: COLORS.white, paddingHorizontal: 20, paddingVertical: 12, alignSelf: 'flex-start', marginTop: 16 },
  promoBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 11, color: COLORS.white, letterSpacing: 3 },
  footer: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20, marginTop: 24 },
  footerBrand: { fontFamily: FONTS.headingSemiBold, fontSize: 20, color: COLORS.primary, letterSpacing: 6 },
  footerTagline: { fontFamily: FONTS.headingLight, fontSize: 18, color: COLORS.text, textAlign: 'center', marginTop: 12, lineHeight: 24 },
  footerInfo: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted, marginTop: 6 },
});
