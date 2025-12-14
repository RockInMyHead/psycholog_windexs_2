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
    // Check if user is logged in on app start
    const checkAuth = async () => {
      try {
        const savedUser = localStorage.getItem('auth_user');
        console.log('[AuthContext] Checking saved user:', savedUser ? 'exists' : 'not found');
        
        if (savedUser) {
          const userData = JSON.parse(savedUser);
          console.log('[AuthContext] Restored user from localStorage:', userData.email);
          
          try {
          // Verify user still exists in database
          let dbUser = await userApi.getUser(userData.id);
          if (dbUser) {
              console.log('[AuthContext] User verified in database:', dbUser.email);
            setUser(dbUser);

            // Load user subscription
              try {
            const userSubscription = await subscriptionApi.getUserSubscription(dbUser.id);
            setSubscription(userSubscription);
                console.log('[AuthContext] User subscription loaded');
              } catch (subError) {
                console.error('[AuthContext] Error loading subscription:', subError);
                // Don't remove user if only subscription loading failed
              }
          } else {
              // Try to find user by email if ID not found
              console.warn('[AuthContext] User not found by ID, trying to find by email:', userData.email);
              try {
                const userByEmail = await userApi.getUserByEmail(userData.email);
                if (userByEmail) {
                  console.log('[AuthContext] Found user by email, updating localStorage:', userByEmail.email);
                  setUser(userByEmail);
                  localStorage.setItem('auth_user', JSON.stringify(userByEmail));

                  // Load user subscription
                  try {
                    const userSubscription = await subscriptionApi.getUserSubscription(userByEmail.id);
                    setSubscription(userSubscription);
                    console.log('[AuthContext] User subscription loaded');
                  } catch (subError) {
                    console.error('[AuthContext] Error loading subscription:', subError);
                  }
                } else {
                  console.warn('[AuthContext] User not found by email either, clearing localStorage');
                  localStorage.removeItem('auth_user');
                }
              } catch (emailError) {
                console.error('[AuthContext] Error finding user by email:', emailError);
                localStorage.removeItem('auth_user');
              }
            }
          } catch (apiError: unknown) {
            // Don't clear localStorage if it's just a network error
            if ((apiError as any)?.status === 404) {
              console.warn('[AuthContext] User not found (404), clearing localStorage');
            localStorage.removeItem('auth_user');
            } else {
              console.error('[AuthContext] API error, keeping user in localStorage:', apiError);
              // Keep user logged in even if API is temporarily unavailable
              setUser(userData);
            }
          }
        }
      } catch (error) {
        console.error('[AuthContext] Auth check error:', error);
        // Only remove if there's a parsing error or critical issue
        if (error instanceof SyntaxError) {
          console.warn('[AuthContext] Invalid localStorage data, clearing');
        localStorage.removeItem('auth_user');
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
        console.log('[AuthContext] User authenticated:', authenticatedUser.email);
        setUser(authenticatedUser);
        localStorage.setItem('auth_user', JSON.stringify(authenticatedUser));
        console.log('[AuthContext] User saved to localStorage');
        
        // Load user subscription
        try {
          const userSubscription = await subscriptionApi.getUserSubscription(authenticatedUser.id);
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
      console.log('[AuthContext] User created successfully:', newUser.email);
      
      setUser(newUser);
      localStorage.setItem('auth_user', JSON.stringify(newUser));
      console.log('[AuthContext] User saved to localStorage');
      
      // Load user subscription (new users start with free plan)
      try {
        const userSubscription = await subscriptionApi.getUserSubscription(newUser.id);
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

  const logout = () => {
    console.log('[AuthContext] Logging out user');
    setUser(null);
    setSubscription(null);
    localStorage.removeItem('auth_user');
    console.log('[AuthContext] User logged out, localStorage cleared');
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
