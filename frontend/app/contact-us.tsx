import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, WHATSAPP_URL } from '../src/constants';

export default function ContactUsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contact Us</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>We are here to help</Text>
        <Text style={styles.body}>
          Speak with Floarea for order support, event inquiries, custom gifts, and delivery questions.
        </Text>

        <TouchableOpacity style={styles.contactCard} onPress={() => Linking.openURL(WHATSAPP_URL)}>
          <Ionicons name="logo-whatsapp" size={24} color={COLORS.whatsapp} />
          <View style={styles.contactText}>
            <Text style={styles.contactTitle}>WhatsApp</Text>
            <Text style={styles.contactValue}>+971 50 131 1930</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.contactCard} onPress={() => Linking.openURL('tel:+971501311930')}>
          <Ionicons name="call-outline" size={24} color={COLORS.primary} />
          <View style={styles.contactText}>
            <Text style={styles.contactTitle}>Call Floarea</Text>
            <Text style={styles.contactValue}>+971 50 131 1930</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>

        <View style={styles.locationCard}>
          <Text style={styles.sectionTitle}>Locations</Text>
          <Text style={styles.body}>Five Palm Hotel, Palm Jumeirah, Dubai</Text>
          <Text style={[styles.body, styles.location]}>Five Luxe JBR Hotel, JBR, Dubai</Text>
        </View>
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
  title: { fontFamily: FONTS.headingLight, fontSize: 34, color: COLORS.text, marginBottom: 12 },
  body: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textMuted, lineHeight: 22 },
  contactCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: 6, padding: 18, marginTop: 16 },
  contactText: { flex: 1, marginLeft: 14 },
  contactTitle: { fontFamily: FONTS.bodySemiBold, fontSize: 14, color: COLORS.text },
  contactValue: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted, marginTop: 3 },
  locationCard: { backgroundColor: COLORS.white, borderRadius: 6, padding: 18, marginTop: 20 },
  sectionTitle: { fontFamily: FONTS.bodySemiBold, fontSize: 14, color: COLORS.primary, marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase' },
  location: { marginTop: 8 },
});
