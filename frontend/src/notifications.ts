import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as Storage from './utils/storage';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  } as any),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission not granted');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Floarea',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1A2E20',
    });
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: undefined, // Uses default from app.json
  });

  return tokenData.data;
}

export async function registerTokenWithBackend(pushToken: string) {
  try {
    await api.post('/push/register', { expo_token: pushToken, platform: Platform.OS }, {
      useShopifyToken: true,
      suppressUnauthorizedHandler: true,
    });
    await Storage.setSecureItem('push_token', pushToken);
  } catch (e: any) {
    if (e.status !== 401) {
      console.log('Failed to register push token:', e.message);
    }
  }
}

export async function unregisterTokenWithBackend() {
  try {
    await api.del('/push/unregister', {
      useShopifyToken: true,
      suppressUnauthorizedHandler: true,
    });
  } catch (e: any) {
    if (e.status !== 401) {
      console.log('Failed to unregister push token:', e.message);
    }
  }
}

export function useNotificationListeners(onNotification?: (notification: Notifications.Notification) => void) {
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      if (onNotification) onNotification(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      console.log('Notification tapped:', data);
    });

    return () => {
      if (notificationListener.current) notificationListener.current.remove();
      if (responseListener.current) responseListener.current.remove();
    };
  }, [onNotification]);
}
