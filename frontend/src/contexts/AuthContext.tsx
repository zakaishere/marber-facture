/**
 * Authentication Context
 * Provides authentication state and methods throughout the app
 */
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { login as loginApi, verifyToken, logout as logoutApi, User } from '@/api/auth';
import { getAuthToken, setAuthToken } from '@/api/http';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Check if user is authenticated on mount
  useEffect(() => {
    checkAuth();
  }, []);

  /**
   * Check authentication status
   */
  const checkAuth = async () => {
    try {
      const storedToken = getAuthToken();
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      // Verify token with backend
      const response = await verifyToken();
      setUser(response.user);
      setTokenState(storedToken);
    } catch (error) {
      // Token invalid or expired
      setAuthToken(null);
      setUser(null);
      setTokenState(null);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Login user
   */
  const login = async (username: string, password: string) => {
    try {
      const response = await loginApi({ username, password });
      setAuthToken(response.token);
      setTokenState(response.token);
      setUser(response.user);
      
      // Redirect to home or previous location (from query param)
      const urlParams = new URLSearchParams(window.location.search);
      const from = response.user.role === 'ROLE_INVOICING' ? '/factures' : urlParams.get('from') || '/';
      navigate(from, { replace: true });
    } catch (error: any) {
      throw new Error(
        error.response?.data?.message || error.message || 'Connexion impossible. Vérifiez vos identifiants et le serveur.'
      );
    }
  };

  /**
   * Logout user
   */
  const logout = async () => {
    try {
      await logoutApi();
    } catch (error) {
      // Continue with logout even if API call fails
      console.error('Logout API error:', error);
    } finally {
      setAuthToken(null);
      setTokenState(null);
      setUser(null);
      navigate('/login');
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user && !!token,
    login,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to use auth context
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

