

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface CustomRequestInit extends RequestInit {
  requireAuth?: boolean;
  useShopifyToken?: boolean;
  useLegacyAuthToken?: boolean;
  suppressUnauthorizedHandler?: boolean;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

class ApiClient {
  private legacyAuthToken: string | null = null;
  private shopifyToken: string | null = null;
  private unauthorizedHandler: (() => Promise<void> | void) | null = null;
  private unauthorizedPromise: Promise<void> | null = null;

  setAuth({ legacyAuthToken, shopifyToken }: { legacyAuthToken?: string | null; shopifyToken: string | null }) {
    this.legacyAuthToken = legacyAuthToken ?? null;
    this.shopifyToken = shopifyToken;
  }

  setUnauthorizedHandler(handler: (() => Promise<void> | void) | null) {
    this.unauthorizedHandler = handler;
  }

  private async triggerUnauthorized() {
    if (!this.unauthorizedHandler) return;

    if (!this.unauthorizedPromise) {
      this.unauthorizedPromise = Promise.resolve(this.unauthorizedHandler()).finally(() => {
        this.unauthorizedPromise = null;
      });
    }

    await this.unauthorizedPromise;
  }

  async request(path: string, options: CustomRequestInit = {}): Promise<any> {
    if (options.requireAuth && !this.shopifyToken) {
      return Promise.reject(new ApiError(`Unauthorized: Endpoint ${path} requires authentication.`, 401));
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if ((options.requireAuth || options.useShopifyToken) && this.shopifyToken) {
      headers['x-shopify-customer-token'] = this.shopifyToken;
    }

    if (options.useLegacyAuthToken && this.legacyAuthToken) {
      headers['Authorization'] = `Bearer ${this.legacyAuthToken}`;
    }

    try {
      const response = await fetch(`${API_URL}/api${path}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Request failed' }));
        const detail = error.detail;
        let errMsg = typeof detail === 'string' ? detail : (Array.isArray(detail) ? detail.map((e: any) => e.msg || JSON.stringify(e)).join(' ') : JSON.stringify(detail));
        if (response.status === 401 && !options.suppressUnauthorizedHandler) {
          await this.triggerUnauthorized();
        }
        return Promise.reject(new ApiError(errMsg, response.status));
      }
      return response.json();
    } catch (e: any) {
      if (e instanceof ApiError) return Promise.reject(e);
      return Promise.reject(new ApiError(e.message || 'Network error or server unavailable', 503));
    }
  }

  get(path: string, options?: CustomRequestInit) {
    return this.request(path, options);
  }

  post(path: string, body: any, options?: CustomRequestInit) {
    return this.request(path, { ...options, method: 'POST', body: JSON.stringify(body) });
  }

  put(path: string, body: any, options?: CustomRequestInit) {
    return this.request(path, { ...options, method: 'PUT', body: JSON.stringify(body) });
  }

  del(path: string, options?: CustomRequestInit) {
    return this.request(path, { ...options, method: 'DELETE' });
  }
}

export const api = new ApiClient();
