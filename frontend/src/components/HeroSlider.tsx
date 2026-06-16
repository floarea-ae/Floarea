import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions, FlatList, TouchableOpacity, Text } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { COLORS, FONTS } from '../constants';
import { api } from '../api';

const { width } = Dimensions.get('window');

// We use the exact banners found on floarea.ae
const SLIDES = [
  {
    id: 'slide-1',
    image: 'https://floarea.ae/cdn/shop/files/banner_mobile_normal.jpg',
    url: '/shop',
    overline: 'INSPIRED BY NATURE',
    title: 'Luxury Blooms,\nDelivered\nWith Love',
    cta: 'SHOP NOW',
  },
  {
    id: 'slide-2',
    image: 'https://floarea.ae/cdn/shop/files/floarea_mobile_banner_v2.png',
    url: '/shop?collection=forever-special-occasion-roses',
    overline: 'FOREVER ROSES',
    title: 'Preserved to\nLast Forever',
    cta: 'EXPLORE',
  },
  {
    id: 'slide-3',
    image: 'https://floarea.ae/cdn/shop/files/Floarea-Valentine-Banner.png',
    url: '/shop?collection=love-collection',
    overline: 'SPECIAL OCCASION',
    title: 'Impress Your\nLoved Ones',
    cta: 'DISCOVER',
    alignment: 'right',
    width: '10%',
  },
];

export default function HeroSlider() {
  const router = useRouter();
  const [slides, setSlides] = useState(SLIDES);
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    api.get('/hero-slides')
      .then((cmsSlides) => {
        if (!Array.isArray(cmsSlides) || cmsSlides.length === 0) {
          setSlides(SLIDES);
          return;
        }

        setSlides(cmsSlides.map((cmsSlide: any) => {
          const fallbackMatch = SLIDES.find((s) => s.id === cmsSlide.handle);
          return {
            id: cmsSlide.handle || cmsSlide.id || Math.random().toString(),
            image: cmsSlide.mobile_image || cmsSlide.desktop_image || (fallbackMatch ? fallbackMatch.image : SLIDES[0].image),
            url: cmsSlide.cta_url || (fallbackMatch ? fallbackMatch.url : '/shop'),
            overline: cmsSlide.overline ?? (fallbackMatch ? fallbackMatch.overline : ''),
            title: cmsSlide.title ?? (fallbackMatch ? fallbackMatch.title : ''),
            cta: cmsSlide.cta_text ?? (fallbackMatch ? fallbackMatch.cta : 'SHOP NOW'),
            alignment: cmsSlide.alignment || (fallbackMatch ? (fallbackMatch as any).alignment : undefined),
          };
        }));
      })
      .catch(() => {
        setSlides(SLIDES);
      });
  }, []);

  // Auto-scroll logic
  useEffect(() => {
    if (slides.length === 0) return;
    const interval = setInterval(() => {
      let nextIndex = activeIndex + 1;
      if (nextIndex >= slides.length) {
        nextIndex = 0;
      }
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setActiveIndex(nextIndex);
    }, 4000); // 4 seconds per slide

    return () => clearInterval(interval);
  }, [activeIndex, slides.length]);

  const handleScroll = (event: any) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = event.nativeEvent.contentOffset.x / slideSize;
    const roundIndex = Math.round(index);
    if (roundIndex !== activeIndex) {
      setActiveIndex(roundIndex);
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={slides}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        getItemLayout={(data, index) => ({
          length: width - 32,
          offset: (width - 32) * index,
          index,
        })}
        renderItem={({ item }) => (
          <TouchableOpacity 
            activeOpacity={0.9} 
            onPress={() => router.push(item.url as any)}
            style={styles.slideContainer}
          >
            <Image 
              source={{ uri: item.image }} 
              style={styles.image} 
              contentFit="cover" 
              contentPosition={(item as any).alignment || 'center'}
            />
            <View style={styles.overlay}>
              <Text style={styles.heroOverline}>{item.overline}</Text>
              <Text style={styles.heroTitle}>{item.title}</Text>
              <View style={styles.heroBtn}>
                <Text style={styles.heroBtnText}>{item.cta}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Pagination Dots */}
      <View style={styles.pagination}>
        {slides.map((_, index) => (
          <View
            key={`dot-${index}`}
            style={[
              styles.dot,
              activeIndex === index ? styles.activeDot : styles.inactiveDot,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 480, // slightly taller for mobile banners
    borderRadius: 4,
    marginHorizontal: 16,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  slideContainer: {
    width: width - 32, // screen width minus margins (16 on each side)
    height: 480,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    padding: 24,
    paddingBottom: 48, // leave space for pagination dots
  },
  heroOverline: { fontFamily: FONTS.bodySemiBold, fontSize: 11, color: 'rgba(255,255,255,0.8)', letterSpacing: 3 },
  heroTitle: { fontFamily: FONTS.headingLight, fontSize: 36, color: COLORS.white, marginTop: 8, lineHeight: 42 },
  heroBtn: { backgroundColor: COLORS.white, paddingHorizontal: 24, paddingVertical: 14, alignSelf: 'flex-start', marginTop: 20 },
  heroBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 12, color: COLORS.primary, letterSpacing: 3 },
  pagination: {
    position: 'absolute',
    bottom: 16,
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeDot: {
    backgroundColor: COLORS.white,
    width: 20,
  },
  inactiveDot: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
});
