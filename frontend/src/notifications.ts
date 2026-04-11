import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
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
    const authToken = await AsyncStorage.getItem('auth_token');
    if (authToken) {
      await api.post('/push/register', { push_token: pushToken });
      await AsyncStorage.setItem('push_token', pushToken);
    }
  } catch (e) {
    console.log('Failed to register push token:', e);
  }
}

export function useNotificationListeners(onNotification?: (notification: Notifications.Notification) => void) {
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  useEffect(() => {
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      onNotification?.(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      console.log('Notification tapped:', data);
    });

    return () => {
      if (notificationListener.current) Notifications.removeNotificationSubscription(notificationListener.current);
      if (responseListener.current) Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);
}
