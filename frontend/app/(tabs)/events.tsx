import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import { COLORS, FONTS } from '../../src/constants';

const EVENTS_URL = 'https://floarea.ae/pages/events-app';

const INJECTED_JS = `
(function() {
  const style = document.createElement('style');
  style.innerHTML = \`
    .shopify-section-group-header-group,
    .shopify-section-group-footer-group,
    .header-wrapper,
    .announcement-bar,
    #shopify-section-announcement-bar,
    footer,
    .site-footer {
      display: none !important;
    }

    body {
      margin-top: 0 !important;
      padding-top: 0 !important;
    }
  \`;

  document.head.appendChild(style);
})();
true;
`;

export default function EventsScreen() {
  const [loading, setLoading] = useState(true);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Events</Text>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading Floarea Events...</Text>
        </View>
      )}

      <WebView
        testID="events-webview"
        source={{ uri: EVENTS_URL }}
        style={styles.webview}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        injectedJavaScript={INJECTED_JS}
        javaScriptEnabled
        sharedCookiesEnabled
        startInLoadingState={false}
        onShouldStartLoadWithRequest={(request) => {
          const allowedUrls = [
            'https://floarea.ae/pages/events-app',
            'https://www.floarea.ae/pages/events-app',
          ];

          return allowedUrls.some((url) => request.url.startsWith(url));
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontFamily: FONTS.headingLight,
    fontSize: 32,
    color: COLORS.text,
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 64,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    zIndex: 10,
  },
  loadingText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: 16,
  },
});