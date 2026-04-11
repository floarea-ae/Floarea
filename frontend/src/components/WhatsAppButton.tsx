import React from 'react';
import { TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, WHATSAPP_URL } from '../../src/constants';

export default function WhatsAppButton() {
  return (
    <TouchableOpacity
      testID="whatsapp-contact"
      style={styles.fab}
      onPress={() => Linking.openURL(WHATSAPP_URL)}
      activeOpacity={0.8}
    >
      <Ionicons name="logo-whatsapp" size={28} color={COLORS.white} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.whatsapp,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    zIndex: 100,
  },
});
