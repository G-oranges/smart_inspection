import { request } from '../utils/api';

import type {
  AuthLoginResponse,
  AuthRefreshResponse,
  CheckUserEmailResponse,
  CurrentUserResponse,
} from '../types/service';

export const authService = {
  login: async (
    username: string,
    password: string,
  ): Promise<AuthLoginResponse> => {
    return request<AuthLoginResponse>('/api/auth/login', {
      method: 'POST',
      body: { username, password },
      auth: false,
      retry: false,
    });
  },

  getCurrentUser: async (): Promise<CurrentUserResponse> => {
    return request<CurrentUserResponse>('/api/auth/me');
  },

  refreshToken: async (
    refreshToken: string,
  ): Promise<AuthRefreshResponse> => {
    return request<AuthRefreshResponse>('/api/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
      auth: false,
      retry: false,
    });
  },

  verifyPassword: async (password: string): Promise<unknown> => {
    return request('/api/auth/verify-password', {
      method: 'POST',
      body: { password },
    });
  },

  logout: async (): Promise<void> => {
    try {
      await request('/api/auth/logout', {
        method: 'POST',
      });
    } catch {
      // Best-effort logout; local cleanup still happens on the client.
    }
  },

  changePassword: async (
    oldPassword: string,
    newPassword: string,
  ): Promise<unknown> => {
    return request('/api/auth/change-password', {
      method: 'PUT',
      body: { oldPassword, newPassword },
    });
  },

  checkUserEmail: async (
    username: string,
  ): Promise<CheckUserEmailResponse> => {
    return request<CheckUserEmailResponse>('/api/auth/check-email', {
      method: 'POST',
      body: { username },
      auth: false,
      retry: false,
    });
  },

  forgotPassword: async (
    username: string,
    email: string,
  ): Promise<unknown> => {
    return request('/api/auth/forgot-password', {
      method: 'POST',
      body: { username, email },
      auth: false,
      retry: false,
    });
  },

  resetPassword: async (
    email: string,
    code: string,
    newPassword: string,
  ): Promise<unknown> => {
    return request('/api/auth/reset-password', {
      method: 'POST',
      body: { email, code, newPassword },
      auth: false,
      retry: false,
    });
  },
};
