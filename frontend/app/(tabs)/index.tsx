import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Dimensions } from 'react-native';
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

const { width } = Dimensions.get('window');
const INSTAGRAM_IMAGE_SIZE = (width - 40) / 2;

export default function HomeScreen() {
  const router = useRouter();
  const [homepageLayout, setHomepageLayout] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const homepageData = await api.get('/homepage-layout').catch((e) => {
        console.error('Homepage layout error:', e);
        return null;
      });
      if (homepageData && Object.keys(homepageData).length > 0) {
        setHomepageLayout(homepageData);
      }
    } catch (e) {
      console.error('Load error:', e);
    } finally {
      setLoading(false);
    }
  }

  function getCollectionHandle(value: string) {
    if (!value) return '';
    if (value === '/collections' || value === '/collections/all') return '';
    if (value.startsWith('/collections/')) return value.replace('/collections/', '').split('?')[0];
    return value;
  }

  function navigateToBackendLink(link?: string) {
    if (!link) return;
    if (link === '/collections' || link === '/collections/all') {
      router.push('/shop');
      return;
    }
    if (link.startsWith('/collections/')) {
      const collection = getCollectionHandle(link);
      router.push(collection ? { pathname: '/shop', params: { collection } } : '/shop');
      return;
    }
    if (link === '/pages/events') {
      router.push('/events');
      return;
    }
    if (link.startsWith('https://') || link.startsWith('http://')) {
      Linking.openURL(link);
      return;
    }
    if (link.startsWith('/shop') || link.startsWith('/events')) {
      router.push(link as any);
    }
  }

  const featuredProducts = homepageLayout?.featuredCollection?.products || [];
  const serviceCards = homepageLayout?.flowerServices?.cards || [];
  const customGiftBanner = homepageLayout?.customGiftBanner || {};
  const instagramHeader = homepageLayout?.instagramHeader || {};
  const instagramGallery = homepageLayout?.instagramGallery || [];

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
        <HeroSlider
          slides={homepageLayout?.hero?.map((slide: any, index: number) => ({
            id: `homepage-slide-${index}-${slide.buttonLink || slide.title || 'slide'}`,
            image: slide.mobileImage || slide.desktopImage || '',
            url: slide.buttonLink?.startsWith('/collections/')
              ? `/shop?collection=${getCollectionHandle(slide.buttonLink)}`
              : slide.buttonLink === '/collections' || slide.buttonLink === '/collections/all'
                ? '/shop'
                : slide.buttonLink === '/pages/events'
                  ? '/events'
                  : slide.buttonLink || '/shop',
            overline: slide.subheading || '',
            title: slide.title || '',
            cta: slide.buttonText || 'SHOP NOW',
          }))}
        />

        {/* Occasions */}
        {homepageLayout?.occasions?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Perfect Gift For Every Occasion</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catScroll}>
              {homepageLayout.occasions.map((cat: any) => (
                <TouchableOpacity
                  testID={`category-${getCollectionHandle(cat.collectionHandle)}`}
                  key={cat.collectionHandle || cat.title}
                  style={styles.catCard}
                  onPress={() => {
                    const collection = getCollectionHandle(cat.collectionHandle);
                    router.push(collection ? { pathname: '/shop', params: { collection } } : '/shop');
                  }}
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
          title={homepageLayout?.promoBanner?.title || 'Preserved to\nLast Forever'}
          subtitle={homepageLayout?.promoBanner?.description || 'FOREVER ROSES'}
          ctaText={homepageLayout?.promoBanner?.buttonText || 'EXPLORE'}
          image={homepageLayout?.promoBanner?.mobileImage || homepageLayout?.promoBanner?.desktopImage || featuredProducts[2]?.image || ''}
          onPress={() => navigateToBackendLink(homepageLayout?.promoBanner?.buttonLink || '/shop?collection=forever-special-occasion-roses')}
        />



        {/* Products */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{homepageLayout?.featuredCollection?.heading || 'Luxury Flowers, Exclusively for You'}</Text>
            <TouchableOpacity testID="view-all-btn" onPress={() => router.push('/shop')}>
              <Text style={styles.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.productGrid}>
            {featuredProducts.slice(0, 6).map((product: any) => (
              <ProductCard key={product.handle} product={product} />
            ))}
          </View>
        </View>

        {/* Events Banner */}
        <PromoBanner
          title={homepageLayout?.eventsBanner?.heading || 'Floarea Events'}
          subtitle={homepageLayout?.eventsBanner?.subheading || 'Bespoke Floral Design'}
          ctaText={homepageLayout?.eventsBanner?.buttonText || 'INQUIRE NOW'}
          image={homepageLayout?.eventsBanner?.rightImage || 'https://floarea.ae/cdn/shop/files/floarea_mobile_banner_v2.png'}
          onPress={() => navigateToBackendLink(homepageLayout?.eventsBanner?.buttonLink || '/pages/events')}
        />

        {/* Services */}
        <View style={styles.servicesRow}>
          {serviceCards.map((svc: any, i: number) => (
            <View key={i} style={styles.serviceItem}>
              <View style={styles.serviceIcon}>
                {svc.image ? (
                  <Image source={{ uri: svc.image }} style={styles.serviceImage} contentFit="contain" />
                ) : (
                  <Ionicons name="flower-outline" size={22} color={COLORS.primary} />
                )}
              </View>
              <Text style={styles.serviceTitle}>{svc.title}</Text>
              <Text style={styles.serviceSub}>{svc.description}</Text>
            </View>
          ))}
        </View>

        {/* Custom Gift Banner */}
        <PromoBanner
          title={customGiftBanner?.title || 'Customized Gifts'}
          subtitle={customGiftBanner?.description || 'Tailored to Perfection'}
          ctaText={customGiftBanner?.buttonText || 'CHAT ON WHATSAPP'}
          image={customGiftBanner?.mobileImage || customGiftBanner?.desktopImage || 'https://floarea.ae/cdn/shop/files/banner_mobile_normal.jpg'}
          onPress={() => navigateToBackendLink(customGiftBanner?.buttonLink || WHATSAPP_URL)}
        />

        {/* Instagram */}
        {(instagramHeader?.heading || instagramHeader?.text) && (
          <View style={styles.section}>
            {instagramHeader?.heading ? <Text style={styles.sectionTitle}>{instagramHeader.heading}</Text> : null}
            {instagramHeader?.text ? <Text style={styles.instagramText}>{instagramHeader.text}</Text> : null}
          </View>
        )}
        {instagramGallery.length > 0 && (
          <View style={styles.instagramGrid}>
            {instagramGallery.map((image: string, index: number) => (
              <Image
                key={`${image}-${index}`}
                source={{ uri: image }}
                style={styles.instagramImage}
                contentFit="cover"
              />
            ))}
          </View>
        )}

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
  serviceImage: { width: 30, height: 30 },
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
  instagramText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textMuted, marginTop: 8, lineHeight: 20 },
  instagramGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, marginTop: 16, gap: 8 },
  instagramImage: { width: INSTAGRAM_IMAGE_SIZE, height: INSTAGRAM_IMAGE_SIZE, borderRadius: 2 },
  footer: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20, marginTop: 24 },
  footerBrand: { fontFamily: FONTS.headingSemiBold, fontSize: 20, color: COLORS.primary, letterSpacing: 6 },
  footerTagline: { fontFamily: FONTS.headingLight, fontSize: 18, color: COLORS.text, textAlign: 'center', marginTop: 12, lineHeight: 24 },
  footerInfo: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted, marginTop: 6 },
});
