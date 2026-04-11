import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { COLORS, FONTS } from '../src/constants';

export default function AuthScreen() {
  const router = useRouter();
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    setError('');
    if (!email || !password) { setError('Please fill in all required fields'); return; }
    if (!isLogin && !name) { setError('Please enter your name'); return; }
    setLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(name, email, password, phone);
      }
      router.back();
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <TouchableOpacity testID="close-auth" style={styles.closeBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>

          <Text style={styles.brand}>FLOAREA</Text>
          <Text style={styles.title}>{isLogin ? 'Welcome Back' : 'Create Account'}</Text>
          <Text style={styles.subtitle}>{isLogin ? 'Sign in to track orders' : 'Join Floarea for exclusive offers'}</Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {!isLogin && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>FULL NAME</Text>
              <TextInput testID="name-input" style={styles.input} value={name} onChangeText={setName} placeholder="Enter your name" placeholderTextColor={COLORS.textMuted} autoCapitalize="words" />
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>EMAIL</Text>
            <TextInput testID="email-input" style={styles.input} value={email} onChangeText={setEmail} placeholder="Enter your email" placeholderTextColor={COLORS.textMuted} keyboardType="email-address" autoCapitalize="none" />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>PASSWORD</Text>
            <TextInput testID="password-input" style={styles.input} value={password} onChangeText={setPassword} placeholder="Enter your password" placeholderTextColor={COLORS.textMuted} secureTextEntry />
          </View>

          {!isLogin && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>PHONE (OPTIONAL)</Text>
              <TextInput testID="phone-input" style={styles.input} value={phone} onChangeText={setPhone} placeholder="+971 50 000 0000" placeholderTextColor={COLORS.textMuted} keyboardType="phone-pad" />
            </View>
          )}

          <TouchableOpacity testID="submit-auth-btn" style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.submitBtnText}>{isLogin ? 'SIGN IN' : 'CREATE ACCOUNT'}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity testID="toggle-auth-mode" style={styles.toggleBtn} onPress={() => { setIsLogin(!isLogin); setError(''); }}>
            <Text style={styles.toggleText}>
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <Text style={styles.toggleLink}>{isLogin ? 'Sign Up' : 'Sign In'}</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  inputGroup: { marginBottom: 20 },
  label: { fontFamily: FONTS.bodySemiBold, fontSize: 11, color: COLORS.textMuted, letterSpacing: 2, marginBottom: 8 },
  input: { fontFamily: FONTS.body, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.white, paddingHorizontal: 16, paddingVertical: 16, borderRadius: 2, borderWidth: 1, borderColor: COLORS.border },
  submitBtn: { backgroundColor: COLORS.primary, paddingVertical: 18, alignItems: 'center', marginTop: 8, borderRadius: 2 },
  submitBtnText: { fontFamily: FONTS.bodySemiBold, fontSize: 14, color: COLORS.white, letterSpacing: 3 },
  toggleBtn: { marginTop: 24, alignItems: 'center' },
  toggleText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textMuted },
  toggleLink: { fontFamily: FONTS.bodyMedium, color: COLORS.primary },
});
