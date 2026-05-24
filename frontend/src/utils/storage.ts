import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/**
 * Gets a secure item from the device.
 * Migrates existing data from AsyncStorage to SecureStore automatically.
 * @param key The key to fetch
 * @returns The stored string value or null
 */
const migrationLocks = new Map<string, Promise<string | null>>();

export async function getSecureItem(key: string): Promise<string | null> {
  if (migrationLocks.has(key)) {
    return migrationLocks.get(key)!;
  }

  const promise = (async () => {
    try {
      const secureVal = await SecureStore.getItemAsync(key);
      if (secureVal) return secureVal;

      const legacyVal = await AsyncStorage.getItem(key);
      if (legacyVal) {
        try {
          await SecureStore.setItemAsync(key, legacyVal);
          await AsyncStorage.removeItem(key);
        } catch (migrationError) {
          console.error(`Migration write failed for ${key}:`, migrationError);
        }
        return legacyVal; // Always return the token, even if migration write fails
      }
      return null;
    } catch (e) {
      console.error(`Error reading item ${key}:`, e);
      return null;
    } finally {
      migrationLocks.delete(key);
    }
  })();
  
  migrationLocks.set(key, promise);
  return promise;
}

/**
 * Stores a secure item securely on the device.
 * @param key The key to store
 * @param value The value to store
 */
export async function setSecureItem(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value); // Let caller handle strict failures
  try {
    await AsyncStorage.removeItem(key);
  } catch (e) {
    // Non-fatal leftover
  }
}

/**
 * Removes multiple items securely from the device.
 * @param keys Array of keys to remove
 */
export async function multiRemoveSecure(keys: string[]): Promise<void> {
  await Promise.all(
    keys.map(async (key) => {
      try {
        await SecureStore.deleteItemAsync(key);
      } catch (e) {
        console.error(`SecureStore deletion failed for ${key}:`, e);
      }
      try {
        await AsyncStorage.removeItem(key);
      } catch (e) {
        console.error(`AsyncStorage deletion failed for ${key}:`, e);
      }
    })
  );
}
