import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../src/constants';

export default function TermsConditionsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms & Conditions</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Terms & Conditions</Text>
        <Text style={styles.body}>
          By using the Floarea mobile app, you agree to use the app for lawful purchases and inquiries related to Floarea products and services.
        </Text>
        <Text style={styles.sectionTitle}>Orders</Text>
        <Text style={styles.body}>
          Product availability, delivery timing, and final totals are confirmed during Shopify checkout. Delivery details should be reviewed carefully before payment.
        </Text>
        <Text style={styles.sectionTitle}>Delivery</Text>
        <Text style={styles.body}>
          Delivery windows are requested in the app and may be subject to operational availability, address accuracy, and order confirmation.
        </Text>
        <Text style={styles.sectionTitle}>Support</Text>
        <Text style={styles.body}>
          For questions about an order, contact Floarea at +971 50 131 1930.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontFamily: FONTS.bodyMedium, fontSize: 18, color: COLORS.text },
  content: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 48 },
  title: { fontFamily: FONTS.headingLight, fontSize: 34, color: COLORS.text, marginBottom: 18 },
  sectionTitle: { fontFamily: FONTS.bodySemiBold, fontSize: 14, color: COLORS.primary, marginTop: 22, marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase' },
  body: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textMuted, lineHeight: 22 },
});
