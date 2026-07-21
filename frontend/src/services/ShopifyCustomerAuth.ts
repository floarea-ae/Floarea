import * as AuthSession from 'expo-auth-session';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as Storage from '../utils/storage';

WebBrowser.maybeCompleteAuthSession();

const TOKEN_KEY = 'shopify_customer_token';
const REFRESH_TOKEN_KEY = 'shopify_customer_refresh_token';
const ID_TOKEN_KEY = 'shopify_customer_id_token';
const EXPIRES_AT_KEY = 'shopify_customer_token_expires_at';
const USER_KEY = 'auth_user';
const EXPIRY_BUFFER_MS = 60 * 1000;

export type ShopifyCustomerUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
} | null;

type StoredSession = {
  accessToken: string | null;
  user: ShopifyCustomerUser;
};

type CustomerTokenResponse = {
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  expiresIn?: number;
  issuedAt?: number;
};


const config = {
  clientId: process.env.EXPO_PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID,
  authorizationEndpoint: process.env.EXPO_PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_AUTHORIZATION_ENDPOINT,
  tokenEndpoint: process.env.EXPO_PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_TOKEN_ENDPOINT,
  logoutEndpoint: process.env.EXPO_PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_LOGOUT_ENDPOINT,
  redirectUri: process.env.EXPO_PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_REDIRECT_URI,
  scopes: process.env.EXPO_PUBLIC_SHOPIFY_CUSTOMER_ACCOUNT_SCOPES,
};

const discovery = {
  authorizationEndpoint: config.authorizationEndpoint || '',
  tokenEndpoint: config.tokenEndpoint || '',
};

function assertConfig() {
  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Missing Shopify Customer Account auth config: ${missing.join(", ")}`
    );
  }
}

function getScopes(): string[] {
  return config.scopes!.split(/\s+/).map((scope) => scope.trim()).filter(Boolean);
}

function parseQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function base64UrlDecode(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=');
  return globalThis.atob(padded);
}

function parseUser(idToken?: string): ShopifyCustomerUser {
  if (!idToken) return null;

  try {
    const [, payload] = idToken.split('.');
    if (!payload) return null;
    const claims = JSON.parse(base64UrlDecode(payload));
    const name = claims.name || [claims.given_name, claims.family_name].filter(Boolean).join(' ');

    return {
      id: claims.sub || '',
      name: name || claims.email || 'Customer',
      email: claims.email || '',
      phone: claims.phone_number || '',
      role: 'customer',
    };
  } catch {
    return null;
  }
}

function getExpiresAt(tokens: CustomerTokenResponse): string {
  if (!tokens.expiresIn) return '';

  const issuedAtMs = tokens.issuedAt ? tokens.issuedAt * 1000 : Date.now();
  return String(issuedAtMs + tokens.expiresIn * 1000);
}

function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;

  const expiresAtMs = Number(expiresAt);
  if (!Number.isFinite(expiresAtMs)) return true;

  return Date.now() + EXPIRY_BUFFER_MS >= expiresAtMs;
}

async function persistSession(tokens: CustomerTokenResponse): Promise<StoredSession> {
  if (!tokens.accessToken) {
    throw new Error('Shopify Customer Account token missing from response.');
  }

  const user = parseUser(tokens.idToken);
  const expiresAt = getExpiresAt(tokens);

  await Storage.setSecureItem(TOKEN_KEY, tokens.accessToken);
  if (tokens.refreshToken) await Storage.setSecureItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  if (tokens.idToken) await Storage.setSecureItem(ID_TOKEN_KEY, tokens.idToken);
  if (expiresAt) await Storage.setSecureItem(EXPIRES_AT_KEY, expiresAt);
  if (user) await Storage.setSecureItem(USER_KEY, JSON.stringify(user));

  return { accessToken: tokens.accessToken, user };
}

async function getStoredUser(): Promise<ShopifyCustomerUser> {
  const userStr = await Storage.getSecureItem(USER_KEY);
  if (!userStr) return null;

  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

async function refreshSession(refreshToken: string): Promise<StoredSession> {
  assertConfig();

  const response = await AuthSession.refreshAsync(
    {
      clientId: config.clientId!,
      refreshToken,
    },
    discovery
  );

  return persistSession(response as CustomerTokenResponse);
}

async function removeStoredSession(): Promise<void> {
  await Storage.multiRemoveSecure([TOKEN_KEY, REFRESH_TOKEN_KEY, ID_TOKEN_KEY, EXPIRES_AT_KEY, USER_KEY, 'auth_token', 'push_token']);
}

async function endShopifySession(): Promise<void> {
  if (!config.logoutEndpoint || !config.redirectUri) return;

  const idToken = await Storage.getSecureItem(ID_TOKEN_KEY);
  if (!idToken) return;

  const logoutUrl =
    `${config.logoutEndpoint}?id_token_hint=${encodeURIComponent(idToken)}` +
    `&post_logout_redirect_uri=${encodeURIComponent(config.redirectUri)}`;

  try {
    await WebBrowser.openAuthSessionAsync(logoutUrl, config.redirectUri);
  } catch {
    try {
      await fetch(logoutUrl);
    } catch {
      // Local logout should still complete if Shopify session invalidation fails.
    }
  }
}

export const ShopifyCustomerAuth = {
  async signIn(): Promise<StoredSession> {
    assertConfig();

    const request = new AuthSession.AuthRequest({
      clientId: config.clientId!,
      redirectUri: config.redirectUri!,
      responseType: AuthSession.ResponseType.Code,
      scopes: getScopes(),
      usePKCE: true,
    });
    const result = await request.promptAsync(discovery);

    if (result.type !== 'success') {
      throw new Error('Shopify sign in was cancelled.');
    }

    const parsed = Linking.parse(result.url);
    const code = parseQueryValue(parsed.queryParams?.code);
    const error = parseQueryValue(parsed.queryParams?.error);

    if (error) {
      throw new Error(error);
    }
    if (!code || !request.codeVerifier) {
      throw new Error('Invalid Shopify sign in response.');
    }

    const response = await AuthSession.exchangeCodeAsync(
      {
        clientId: config.clientId!,
        code,
        redirectUri: config.redirectUri!,
        extraParams: {
          code_verifier: request.codeVerifier,
        },
      },
      discovery
    );

    return persistSession(response as CustomerTokenResponse);
  },

  async getStoredSession(): Promise<StoredSession> {
    const [accessToken, refreshToken, expiresAt] = await Promise.all([
      Storage.getSecureItem(TOKEN_KEY),
      Storage.getSecureItem(REFRESH_TOKEN_KEY),
      Storage.getSecureItem(EXPIRES_AT_KEY),
    ]);

    if (accessToken && !isExpired(expiresAt)) {
      return { accessToken, user: await getStoredUser() };
    }

    if (refreshToken) {
      try {
        return await refreshSession(refreshToken);
      } catch {
        await removeStoredSession();
      }
    }

    return { accessToken: null, user: null };
  },

  async clearSession(): Promise<void> {
    await endShopifySession();
    await removeStoredSession();
  },
};
