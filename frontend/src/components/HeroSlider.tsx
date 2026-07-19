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

type HeroSlide = {
  id: string;
  image: string;
  url: string;
  overline: string;
  title: string;
  cta: string;
  alignment?: string;
};

type HeroSliderProps = {
  slides?: HeroSlide[];
};

export default function HeroSlider({ slides: providedSlides }: HeroSliderProps) {
  const router = useRouter();
  const hasProvidedSlides = providedSlides !== undefined;
  const [slides, setSlides] = useState(SLIDES);
  const displaySlides = hasProvidedSlides ? providedSlides : slides;
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (hasProvidedSlides) return;

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
  }, [hasProvidedSlides]);

  // Auto-scroll logic
  useEffect(() => {
    if (displaySlides.length === 0) return;
    const interval = setInterval(() => {
      let nextIndex = activeIndex + 1;
      if (nextIndex >= displaySlides.length) {
        nextIndex = 0;
      }
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setActiveIndex(nextIndex);
    }, 4000); // 4 seconds per slide

    return () => clearInterval(interval);
  }, [activeIndex, displaySlides.length]);

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
        data={displaySlides}
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
        {displaySlides.map((_, index) => (
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
    height: 500,
    borderRadius: 6,
    marginHorizontal: 16,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  slideContainer: {
    width: width - 32,
    height: 500,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingBottom: 58,
  },
  heroOverline: { fontFamily: FONTS.bodySemiBold, fontSize: 11, color: 'rgba(255,255,255,0.86)', letterSpacing: 3, textAlign: 'center', textTransform: 'uppercase' },
  heroTitle: { fontFamily: FONTS.headingLight, fontSize: 38, color: COLORS.white, marginTop: 10, lineHeight: 43, textAlign: 'center' },
  heroBtn: { backgroundColor: COLORS.white, paddingHorizontal: 26, paddingVertical: 14, alignSelf: 'center', marginTop: 22 },
  heroBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 12, color: COLORS.primary, letterSpacing: 3 },
  pagination: {
    position: 'absolute',
    bottom: 20,
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 7,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeDot: {
    backgroundColor: COLORS.white,
    width: 22,
  },
  inactiveDot: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
});
