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
  getGoogleAuthUrl: () =>
    api.post<GoogleAuthUrlResponse>('/auth/google/url'),

  handleGoogleCallback: (code: string) =>
    api.post<AuthResponse>('/auth/google/callback', { code }),

  getMe: () => api.get<User>('/auth/me'),
};

export async function handleGoogleSignIn() {
  try {
    const { url } = await authApi.getGoogleAuthUrl();

    const result = await import('expo-web-browser').then(m =>
      m.openAuthSessionAsync(url, 'mi-app://auth/callback')
    );

    if (result.type === 'success') {
      const urlObj = new URL(result.url);
      const code = urlObj.searchParams.get('code');
      if (code) {
        const authResponse = await authApi.handleGoogleCallback(code);
        useAuthStore.getState().setAuth(authResponse.token, authResponse.user);
        return authResponse.user;
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
