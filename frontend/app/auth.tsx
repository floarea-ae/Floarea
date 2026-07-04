import React, { useState } from 'react';
import { Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { COLORS, FONTS } from '../src/constants';

export default function AuthScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');


  async function handleSubmit() {
    setError('');
    setLoading(true);
    try {
      await login();
      router.back();
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity testID="close-auth" style={styles.closeBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={COLORS.text} />
        </TouchableOpacity>

        <Text style={styles.brand}>FLOAREA</Text>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in with your Floarea account</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity testID="submit-auth-btn" style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.submitBtnText}>SIGN IN</Text>
          )}
        </TouchableOpacity>

        
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  closeBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.surface, justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-end' },
  brand: { fontFamily: FONTS.headingSemiBold, fontSize: 18, color: COLORS.primary, letterSpacing: 6, textAlign: 'center', marginTop: 24 },
  title: { fontFamily: FONTS.headingLight, fontSize: 32, color: COLORS.text, textAlign: 'center', marginTop: 16 },
  subtitle: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textMuted, textAlign: 'center', marginTop: 8, marginBottom: 32 },
  errorText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.accent, textAlign: 'center', marginBottom: 16, backgroundColor: 'rgba(139,35,50,0.08)', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 2 },
  submitBtn: { backgroundColor: COLORS.primary, paddingVertical: 18, alignItems: 'center', marginTop: 8, borderRadius: 2 },
  submitBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 14, color: COLORS.white, letterSpacing: 3 },

});
