import AsyncStorage from '@react-native-async-storage/async-storage';

const CART_ID_KEY = 'shopify_cart_id';

export async function getCartId(): Promise<string | null> {
  return AsyncStorage.getItem(CART_ID_KEY);
}

export async function setCartId(cartId: string): Promise<void> {
  await AsyncStorage.setItem(CART_ID_KEY, cartId);
}

export async function clearCartId(): Promise<void> {
  await AsyncStorage.removeItem(CART_ID_KEY);
}
