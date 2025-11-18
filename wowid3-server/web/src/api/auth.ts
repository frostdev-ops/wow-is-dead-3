// Typed API endpoints for authentication operations

import api from './client';
import type { LoginRequest, LoginResponse } from './types';

/**
 * Login with admin password
 */
export async function login(password: string): Promise<string> {
  const request: LoginRequest = { password };
  const response = await api.post<LoginResponse>('/admin/login', request);
  return response.data.token;
}
