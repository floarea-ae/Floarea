import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../src/constants';

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.body}>
          Floarea respects your privacy. We collect only the information needed to process orders, provide customer support, manage delivery, and improve your shopping experience.
        </Text>
        <Text style={styles.sectionTitle}>Information We Use</Text>
        <Text style={styles.body}>
          Your account, order, delivery, and contact details are used to fulfill purchases, communicate order updates, and provide support.
        </Text>
        <Text style={styles.sectionTitle}>Payments</Text>
        <Text style={styles.body}>
          Payments are processed securely through Shopify checkout. Floarea does not store your full payment card details in the mobile app.
        </Text>
        <Text style={styles.sectionTitle}>Contact</Text>
        <Text style={styles.body}>
          For privacy questions, contact Floarea at +971 50 131 1930.
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
