/**
 * Authentication API Service
 */
import http from './http';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface User {
  id: string;
  username: string;
  role: string;
  company?: {
    name?: string;
    activity?: string;
    address?: string;
    phone_fix?: string;
    phone_mobile?: string;
    phone_whatsapp?: string;
    email?: string;
    rc?: string;
    if?: string;
    patente?: string;
    cnss?: string;
    ice?: string;
  };
}

export interface LoginResponse {
  message: string;
  token: string;
  user: User;
}

export interface VerifyResponse {
  message: string;
  user: User;
}

export interface UpdateProfileData {
  username?: string;
  password?: string;
  company_name?: string;
  company_activity?: string;
  company_address?: string;
  company_phone_fix?: string;
  company_phone_mobile?: string;
  company_phone_whatsapp?: string;
  company_email?: string;
  company_rc?: string;
  company_if?: string;
  company_patente?: string;
  company_cnss?: string;
  company_ice?: string;
}

export interface UpdateProfileResponse {
  message: string;
  user: User;
}

/**
 * Login with username and password
 */
export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  const response = await http.post<LoginResponse>('/auth/login', credentials);
  return response.data;
}

/**
 * Verify current token and get user info
 */
export async function verifyToken(): Promise<VerifyResponse> {
  const response = await http.get<VerifyResponse>('/auth/verify');
  return response.data;
}

/**
 * Logout (client-side token removal)
 */
export async function logout(): Promise<void> {
  await http.post('/auth/logout');
}

/**
 * Update user profile
 */
export async function updateProfile(data: UpdateProfileData): Promise<UpdateProfileResponse> {
  const response = await http.put<UpdateProfileResponse>('/auth/profile', data);
  return response.data;
}

