import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

class ApiClient {
  async getToken(): Promise<string | null> {
    return await AsyncStorage.getItem('auth_token');
  }

  async request(path: string, options: RequestInit = {}): Promise<any> {
    const token = await this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${API_URL}/api${path}`, {
      ...options,
      headers,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      const detail = error.detail;
      if (typeof detail === 'string') throw new Error(detail);
      if (Array.isArray(detail)) throw new Error(detail.map((e: any) => e.msg || JSON.stringify(e)).join(' '));
      throw new Error(JSON.stringify(detail));
    }
    return response.json();
  }

  get(path: string) {
    return this.request(path);
  }

  post(path: string, body: any) {
    return this.request(path, { method: 'POST', body: JSON.stringify(body) });
  }

  put(path: string, body: any) {
    return this.request(path, { method: 'PUT', body: JSON.stringify(body) });
  }

  del(path: string) {
    return this.request(path, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
