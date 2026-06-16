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
    height: 320,
    marginHorizontal: 16,
    marginTop: 36,
    borderRadius: 4,
    overflow: 'hidden',
  },
  promoImage: {
    width: '100%',
    height: '100%',
  },
  promoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26,46,32,0.5)',
    justifyContent: 'flex-end',
    padding: 24,
  },
  promoOverline: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  promoTitle: {
    fontFamily: FONTS.headingLight,
    fontSize: 30,
    color: COLORS.white,
    marginTop: 8,
    lineHeight: 36,
  },
  promoBtn: {
    borderWidth: 1,
    borderColor: COLORS.white,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignSelf: 'flex-start',
    marginTop: 16,
  },
  promoBtnText: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 11,
    color: COLORS.white,
    letterSpacing: 3,
  },
});
