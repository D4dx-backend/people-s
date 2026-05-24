import { useState, useEffect, useContext, createContext, ReactNode } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  isVerified: boolean;
  isActive: boolean;
  isSuperAdmin?: boolean;
}

export interface FranchiseOption {
  id: string;
  slug: string;
  displayName: string;
  logoUrl?: string;
}

export interface RoleOption {
  role: string;
  displayName: string;
}

export interface LoginResult {
  /** Direct login succeeded — user and tokens stored */
  success: true;
  requiresFranchiseSelection?: false;
  requiresRoleSelection?: false;
}

export interface FranchiseSelectionRequired {
  requiresFranchiseSelection: true;
  franchises: FranchiseOption[];
  selectionToken: string;
  message: string;
}

export interface RoleSelectionRequired {
  requiresRoleSelection: true;
  franchiseId: string;
  roles: RoleOption[];
  selectionToken: string;
  message: string;
}

export type LoginResponse = LoginResult | FranchiseSelectionRequired | RoleSelectionRequired;

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (phone: string, otp: string) => Promise<LoginResponse>;
  selectRole: (selectionToken: string, franchiseId: string, role: string) => Promise<void>;
  /** Persist a user+tokens pair into both localStorage and React state. */
  storeSession: (user: User, tokens: { accessToken: string; refreshToken?: string }) => void;
  logout: () => void;
  refreshToken: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing token on mount
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    
    setIsLoading(false);
  }, []);

  const login = async (phone: string, otp: string): Promise<LoginResponse> => {
    try {
      setIsLoading(true);
      
      const API_BASE_URL = import.meta.env.VITE_API_URL;
      if (!API_BASE_URL) {
        throw new Error('VITE_API_URL environment variable is required');
      }
      const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone, otp, purpose: 'login' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login failed');
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Login failed');
      }

      const payload = data.data;

      // Multi-franchise selection required
      if (payload.requiresFranchiseSelection) {
        return {
          requiresFranchiseSelection: true,
          franchises: payload.franchises,
          selectionToken: payload.selectionToken,
          message: payload.message,
        };
      }

      // Multi-role selection required
      if (payload.requiresRoleSelection) {
        return {
          requiresRoleSelection: true,
          franchiseId: payload.franchiseId,
          roles: payload.roles,
          selectionToken: payload.selectionToken,
          message: payload.message,
        };
      }

      // Direct login — store user and tokens
      if (payload.user && payload.tokens) {
        _storeSession(payload.user, payload.tokens);
        return { success: true };
      }

      throw new Error('Invalid response format');
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const selectRole = async (selectionToken: string, franchiseId: string, role: string): Promise<void> => {
    try {
      setIsLoading(true);

      const API_BASE_URL = import.meta.env.VITE_API_URL;
      if (!API_BASE_URL) {
        throw new Error('VITE_API_URL environment variable is required');
      }
      const response = await fetch(`${API_BASE_URL}/auth/select-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectionToken, franchiseId, role }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Role selection failed');
      }

      const data = await response.json();
      if (!data.success || !data.data?.user || !data.data?.tokens) {
        throw new Error(data.message || 'Invalid response format');
      }

      _storeSession(data.data.user, data.data.tokens);
    } catch (error) {
      console.error('selectRole error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const _storeSession = (userData: User, tokens: { accessToken: string; refreshToken?: string }) => {
    setUser(userData);
    setToken(tokens.accessToken);

    localStorage.removeItem('beneficiary_token');
    localStorage.removeItem('beneficiary_user');
    localStorage.removeItem('user_role');

    localStorage.setItem('token', tokens.accessToken);
    localStorage.setItem('user', JSON.stringify(userData));

    if (tokens.refreshToken) {
      localStorage.setItem('refreshToken', tokens.refreshToken);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    // Clear admin tokens
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('refreshToken');
    // Clear active franchise (cross-franchise users)
    localStorage.removeItem('activeFranchiseSlug');
    // Also clear any beneficiary data that might be lingering
    localStorage.removeItem('beneficiary_token');
    localStorage.removeItem('beneficiary_user');
    localStorage.removeItem('user_role');
  };

  const refreshToken = async () => {
    try {
      const storedRefreshToken = localStorage.getItem('refreshToken');
      
      if (!storedRefreshToken) {
        throw new Error('No refresh token available');
      }

      const API_BASE_URL = import.meta.env.VITE_API_URL;
      if (!API_BASE_URL) {
        throw new Error('VITE_API_URL environment variable is required');
      }
      const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: storedRefreshToken }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      
      if (data.success && data.data.tokens) {
        const { tokens } = data.data;
        
        setToken(tokens.accessToken);
        localStorage.setItem('token', tokens.accessToken);
        
        if (tokens.refreshToken) {
          localStorage.setItem('refreshToken', tokens.refreshToken);
        }
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      logout(); // Force logout on refresh failure
      throw error;
    }
  };

  const updateUser = (userData: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...userData };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  };

  const contextValue: AuthContextType = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    storeSession: _storeSession,
    isLoading,
    login,
    selectRole,
    logout,
    refreshToken,
    updateUser,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Auth guard component
interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export const AuthGuard = ({ children, fallback }: AuthGuardProps) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return fallback || (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
          <p className="text-muted-foreground">Please log in to access this page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};