import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { COLORS, FONTS, WHATSAPP_URL } from '../../src/constants';
import ProductCard from '../../src/components/ProductCard';
import WhatsAppButton from '../../src/components/WhatsAppButton';
import HeroSlider from '../../src/components/HeroSlider';
import PromoBanner from '../../src/components/PromoBanner';

export default function HomeScreen() {
  const router = useRouter();
  const [collections, setCollections] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [promoBanner, setPromoBanner] = useState<any>(null);
  const [eventsBanner, setEventsBanner] = useState<any>(null);
  const [customGiftBanner, setCustomGiftBanner] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [colData, prodData, promoData, eventsData, giftData] = await Promise.all([
        api.get('/collections?featured_only=true'),
        api.get('/products?first=8'),
        api.get('/promo-banner').catch(() => null),
        api.get('/events-banner').catch(() => null),
        api.get('/custom-gift-banner').catch(() => null),
      ]);
      setCollections(colData.collections || []);
      setProducts(prodData.products || []);
      if (promoData && Object.keys(promoData).length > 0) {
        setPromoBanner(promoData);
      }
      if (eventsData && Object.keys(eventsData).length > 0) {
        setEventsBanner(eventsData);
      }
      if (giftData && Object.keys(giftData).length > 0) {
        setCustomGiftBanner(giftData);
      }
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Image 
            source={{ uri: 'https://floarea.ae/cdn/shop/files/Floarea-logo-upd.png' }} 
            style={styles.logoImage} 
            contentFit="contain" 
          />
          <View style={styles.headerActions}>
            <TouchableOpacity testID="wishlist-header-btn" onPress={() => router.push('/(tabs)/wishlist')}>
              <Ionicons name="heart-outline" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <TouchableOpacity testID="search-btn" onPress={() => router.push('/shop')}>
              <Ionicons name="search-outline" size={24} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero Slider */}
        <HeroSlider />

        {/* Occasions */}
        {collections.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Perfect Gift For Every Occasion</Text>
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

        {/* Promo Banner */}
        <PromoBanner
          title={promoBanner?.title || 'Preserved to\nLast Forever'}
          subtitle={promoBanner?.overline || 'FOREVER ROSES'}
          ctaText={promoBanner?.cta_text || 'EXPLORE'}
          image={promoBanner?.mobile_image || promoBanner?.desktop_image || products[2]?.image || ''}
          onPress={() => router.push((promoBanner?.cta_url || '/shop?collection=forever-special-occasion-roses') as any)}
        />



        {/* Products */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Luxury Flowers, Exclusively for You</Text>
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

        {/* Events Banner */}
        <PromoBanner
          title={eventsBanner?.title || 'Floarea Events'}
          subtitle={eventsBanner?.subtitle || 'Bespoke Floral Design'}
          ctaText={eventsBanner?.cta_text || 'INQUIRE NOW'}
          image={eventsBanner?.mobile_image || eventsBanner?.desktop_image || 'https://floarea.ae/cdn/shop/files/floarea_mobile_banner_v2.png'}
          onPress={() => router.push('/events')}
        />

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

        {/* Custom Gift Banner */}
        <PromoBanner
          title={customGiftBanner?.title || 'Customized Gifts'}
          subtitle={customGiftBanner?.subtitle || 'Tailored to Perfection'}
          ctaText={customGiftBanner?.cta_text || 'CHAT ON WHATSAPP'}
          image={customGiftBanner?.mobile_image || customGiftBanner?.desktop_image || 'https://floarea.ae/cdn/shop/files/banner_mobile_normal.jpg'}
          onPress={() => Linking.openURL(WHATSAPP_URL)}
        />

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerBrand}>FLOAREA</Text>
          <Text style={styles.footerTagline}>Floral Art for Life&apos;s{'\n'}Most Beautiful Moments</Text>
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  logoImage: { width: 160, height: 40 },
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
