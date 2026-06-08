import { api } from './client';
import { useAuthStore } from '../stores/auth-store';
import type { User } from '../types';

interface AuthResponse {
  token: string;
  user: User;
}

interface GoogleAuthUrlResponse {
  url: string;
}

export const authApi = {
  getGoogleAuthUrl: (redirectUri?: string) =>
    api.post<GoogleAuthUrlResponse>('/auth/google/url', { redirectUri }),

  handleGoogleCallback: (code: string, redirectUri?: string) =>
    api.post<AuthResponse>('/auth/google/callback', { code, redirectUri }),

  getMe: () => api.get<User>('/auth/me'),
};

export async function handleGoogleSignIn() {
  try {
    const { url } = await authApi.getGoogleAuthUrl();

    const result = await import('expo-web-browser').then(m =>
      m.openAuthSessionAsync(url, 'miapp://callback')
    );

    if (result.type === 'success') {
      const urlObj = new URL(result.url);
      const token = urlObj.searchParams.get('token');
      const userId = urlObj.searchParams.get('userId');
      const email = urlObj.searchParams.get('email');
      const name = urlObj.searchParams.get('name');
      const avatar = urlObj.searchParams.get('avatar');
      if (token && userId) {
        const user: User = {
          id: userId,
          email: email || '',
          name: name || email || null,
          avatar: avatar || null,
          timezone: '',
          preferredStartHour: 9,
          preferredEndHour: 18,
          bufferMinutes: 0,
          defaultDurationMinutes: 60,
          unavailableDays: [],
          sleepStartHour: null,
          sleepEndHour: null,
        };
        useAuthStore.getState().setAuth(token, user);
        return user;
      }
    }
    return null;
  } catch (error) {
    console.error('Google sign-in error:', error);
    return null;
  }
}

export async function loadUser() {
  try {
    const user = await authApi.getMe();
    useAuthStore.getState().setUser(user);
    return user;
  } catch {
    useAuthStore.getState().logout();
    return null;
  }
}
