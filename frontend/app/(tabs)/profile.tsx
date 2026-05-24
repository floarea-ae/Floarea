import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { useCart } from '../../src/context/CartContext';

import { COLORS, FONTS, WHATSAPP_URL } from '../../src/constants';
import * as Linking from 'expo-linking';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { clearCart } = useCart();

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>
        <View style={styles.guestState}>
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person-outline" size={40} color={COLORS.border} />
          </View>
          <Text style={styles.guestTitle}>Welcome to Floarea</Text>
          <Text style={styles.guestSub}>Sign in to track orders and save preferences</Text>
          <TouchableOpacity testID="login-btn" style={styles.loginBtn} onPress={() => router.push('/auth')}>
            <Text style={styles.loginBtnText}>SIGN IN</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="register-btn" style={styles.registerBtn} onPress={() => router.push('/auth')}>
            <Text style={styles.registerBtnText}>CREATE ACCOUNT</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  function handleLogout() {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => { await logout(); clearCart(); } },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>

        {/* User Info */}
        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user.name}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <TouchableOpacity testID="my-orders-btn" style={styles.menuItem} onPress={() => router.push('/orders')}>
            <Ionicons name="receipt-outline" size={22} color={COLORS.primary} />
            <Text style={styles.menuText}>My Orders</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity testID="wishlist-menu-btn" style={styles.menuItem} onPress={() => router.push('/(tabs)/wishlist')}>
            <Ionicons name="heart-outline" size={22} color={COLORS.primary} />
            <Text style={styles.menuText}>Wishlist</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity testID="contact-whatsapp-btn" style={styles.menuItem} onPress={() => Linking.openURL(WHATSAPP_URL)}>
            <Ionicons name="logo-whatsapp" size={22} color={COLORS.whatsapp} />
            <Text style={styles.menuText}>Contact via WhatsApp</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Store Info */}
        <View style={styles.storeInfo}>
          <Text style={styles.storeTitle}>Our Locations</Text>
          <View style={styles.locationItem}>
            <Ionicons name="location-outline" size={18} color={COLORS.primary} />
            <Text style={styles.locationText}>Five Palm Hotel, Palm Jumeirah, Dubai</Text>
          </View>
          <View style={styles.locationItem}>
            <Ionicons name="location-outline" size={18} color={COLORS.primary} />
            <Text style={styles.locationText}>Five Luxe JBR Hotel, JBR, Dubai</Text>
          </View>
          <View style={styles.locationItem}>
            <Ionicons name="call-outline" size={18} color={COLORS.primary} />
            <TouchableOpacity onPress={() => Linking.openURL('tel:+971501311930')}>
              <Text style={[styles.locationText, { color: COLORS.primary }]}>+971 50 131 1930</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity testID="logout-btn" style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.accent} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontFamily: FONTS.headingLight, fontSize: 32, color: COLORS.text },

  guestState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  guestTitle: { fontFamily: FONTS.heading, fontSize: 22, color: COLORS.text },
  guestSub: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted, marginTop: 8, textAlign: 'center' },
  loginBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 40, paddingVertical: 16, marginTop: 28, width: '100%', alignItems: 'center' },
  loginBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 13, color: COLORS.white, letterSpacing: 3 },
  registerBtn: { borderWidth: 1, borderColor: COLORS.primary, paddingHorizontal: 40, paddingVertical: 16, marginTop: 12, width: '100%', alignItems: 'center' },
  registerBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 13, color: COLORS.primary, letterSpacing: 3 },

  userCard: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, marginHorizontal: 16, backgroundColor: COLORS.white, borderRadius: 2 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontFamily: FONTS.headingSemiBold, fontSize: 22, color: COLORS.white },
  userInfo: { marginLeft: 16 },
  userName: { fontFamily: FONTS.bodyMedium, fontSize: 17, color: COLORS.text },
  userEmail: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted, marginTop: 2 },

  menuSection: { marginTop: 24, marginHorizontal: 16, backgroundColor: COLORS.white, borderRadius: 2 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  menuText: { flex: 1, fontFamily: FONTS.bodyMedium, fontSize: 15, color: COLORS.text, marginLeft: 14 },

  storeInfo: { marginTop: 24, marginHorizontal: 16, backgroundColor: COLORS.white, borderRadius: 2, padding: 20 },
  storeTitle: { fontFamily: FONTS.bodyMedium, fontSize: 15, color: COLORS.text, marginBottom: 14 },
  locationItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 10 },
  locationText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted, flex: 1 },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 28, gap: 8, paddingVertical: 14 },
  logoutText: { fontFamily: FONTS.bodyMedium, fontSize: 15, color: COLORS.accent },
});
