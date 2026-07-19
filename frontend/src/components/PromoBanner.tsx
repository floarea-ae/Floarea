import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { COLORS, FONTS } from '../constants';

interface PromoBannerProps {
  title: string;
  subtitle?: string;
  ctaText: string;
  image: string;
  onPress: () => void;
}

export default function PromoBanner({
  title,
  subtitle,
  ctaText,
  image,
  onPress,
}: PromoBannerProps) {
  return (
    <TouchableOpacity
      style={styles.promoBanner}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <Image
        source={{ uri: image }}
        style={styles.promoImage}
        contentFit="cover"
      />
      <View style={styles.promoOverlay}>
        <Text style={styles.promoTitle}>{title}</Text>
        {subtitle ? <Text style={styles.promoOverline}>{subtitle}</Text> : null}
        <View style={styles.promoBtn}>
          <Text style={styles.promoBtnText}>{ctaText}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  promoBanner: {
    height: 360,
    marginHorizontal: 16,
    marginTop: 40,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
  promoImage: {
    width: '100%',
    height: '100%',
  },
  promoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26,46,32,0.38)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  promoOverline: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 10,
  },
  promoTitle: {
    fontFamily: FONTS.headingLight,
    fontSize: 34,
    color: COLORS.white,
    lineHeight: 40,
    textAlign: 'center',
  },
  promoBtn: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.white,
    paddingHorizontal: 24,
    paddingVertical: 13,
    alignSelf: 'center',
    marginTop: 22,
  },
  promoBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    color: COLORS.primary,
    letterSpacing: 3,
  },
});
