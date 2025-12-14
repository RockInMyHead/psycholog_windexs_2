import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, userApi, subscriptionApi } from '@/services/api';

interface User {
  id: string;
  name: string;
  email: string;
}

interface SubscriptionInfo {
  plan: string;
  status: string;
  remaining?: number;
  limit?: number;
}

interface AuthContextType {
  user: User | null;
  subscription: SubscriptionInfo | null;
  isAuthenticated: boolean;
  isPremium: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export { useAuth };

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user has active session on app start
    const checkAuth = async () => {
      try {
        console.log('[AuthContext] Checking for active session...');
        
        // Try to get session from server (using HTTP-only cookie)
        const sessionResponse = await authApi.getSession();
        
        if (sessionResponse?.user) {
          console.log('[AuthContext] Active session found:', sessionResponse.user?.email);
          setUser(sessionResponse.user);

          // Load user subscription
          try {
            const userSubscription = await subscriptionApi.getUserSubscription(sessionResponse.user?.id);
            setSubscription(userSubscription);
            console.log('[AuthContext] User subscription loaded');
          } catch (subError) {
            console.error('[AuthContext] Error loading subscription:', subError);
          }
        } else {
          console.log('[AuthContext] No active session found');
        }
      } catch (error: any) {
        if (error?.status === 401) {
          console.log('[AuthContext] No valid session');
        } else {
          console.error('[AuthContext] Error checking session:', error);
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      console.log('[AuthContext] Login attempt for:', email);
      const response = await authApi.login(email, password);
      const authenticatedUser = response?.user || response;

      if (authenticatedUser) {
        console.log('[AuthContext] User authenticated:', authenticatedUser?.email);
        setUser(authenticatedUser);

        // Load user subscription
        try {
          const userSubscription = await subscriptionApi.getUserSubscription(authenticatedUser?.id);
          setSubscription(userSubscription);
          console.log('[AuthContext] User subscription loaded');
        } catch (subError) {
          console.error('[AuthContext] Error loading subscription during login:', subError);
          // Don't fail login if subscription loading fails
        }
        return true;
      }

      console.warn('[AuthContext] User not authenticated for email:', email);
      return false;
    } catch (error: any) {
      if (error?.status === 401 || error?.status === 400) {
        console.warn('[AuthContext] Invalid credentials or missing password for:', email);
        return false;
      }
      console.error('[AuthContext] Login error:', error);
      return false;
    }
  };

  const register = async (email: string, password: string, name: string): Promise<boolean> => {
    try {
      console.log('[AuthContext] Registration attempt for:', email, name);
      
      const response = await authApi.register(email, password, name);
      const newUser = response?.user || response;
      console.log('[AuthContext] User created successfully:', newUser?.email);

      setUser(newUser);

      // Load user subscription (new users start with free plan)
      try {
        const userSubscription = await subscriptionApi.getUserSubscription(newUser?.id);
        setSubscription(userSubscription);
        console.log('[AuthContext] User subscription loaded');
      } catch (subError) {
        console.error('[AuthContext] Error loading subscription during registration:', subError);
        // Don't fail registration if subscription loading fails
      }
      return true;
    } catch (error: any) {
      if (error?.status === 409) {
        console.warn('[AuthContext] User already exists:', email);
        return false;
      }
      console.error('[AuthContext] Registration error:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      console.log('[AuthContext] Logging out user');
      await authApi.logout();
      setUser(null);
      setSubscription(null);
      console.log('[AuthContext] User logged out');
    } catch (error) {
      console.error('[AuthContext] Logout error:', error);
      // Clear state even if API call fails
      setUser(null);
      setSubscription(null);
    }
  };

  const value: AuthContextType = {
    user,
    subscription,
    isAuthenticated: !!user,
    isPremium: subscription?.plan === 'premium' && subscription?.status === 'active',
    loading,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
