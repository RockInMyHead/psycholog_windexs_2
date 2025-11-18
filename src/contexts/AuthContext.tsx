import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { userApi, subscriptionApi } from '@/services/api';

interface User {
  id: string;
  name: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  subscription: any | null;
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
  const [subscription, setSubscription] = useState<any | null>(null);
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
          const dbUser = await userApi.getUser(userData.id);
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
              console.warn('[AuthContext] User not found in database, clearing localStorage');
              localStorage.removeItem('auth_user');
            }
          } catch (apiError: any) {
            // Don't clear localStorage if it's just a network error
            if (apiError?.status === 404) {
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
      // In a real app, you'd validate password hash
      // For demo purposes, we'll just check if user exists
      const dbUser = await userApi.getUserByEmail(email);
      if (dbUser) {
        console.log('[AuthContext] User found, logging in:', dbUser.email);
        setUser(dbUser);
        localStorage.setItem('auth_user', JSON.stringify(dbUser));
        console.log('[AuthContext] User saved to localStorage');
        
        // Load user subscription
        try {
        const userSubscription = await subscriptionApi.getUserSubscription(dbUser.id);
        setSubscription(userSubscription);
          console.log('[AuthContext] User subscription loaded');
        } catch (subError) {
          console.error('[AuthContext] Error loading subscription during login:', subError);
          // Don't fail login if subscription loading fails
        }
        return true;
      }
      console.warn('[AuthContext] User not found for email:', email);
      return false;
    } catch (error) {
      console.error('[AuthContext] Login error:', error);
      return false;
    }
  };

  const register = async (email: string, password: string, name: string): Promise<boolean> => {
    try {
      console.log('[AuthContext] Registration attempt for:', email, name);
      
      // Check if user already exists
      // getUserByEmail returns null if user not found (404), or throws on other errors
      const existingUser = await userApi.getUserByEmail(email);

      if (existingUser) {
        console.log('[AuthContext] User already exists:', existingUser.email);
        return false;
      }

      console.log('[AuthContext] User does not exist, creating new user');

      // Create new user
      const newUser = await userApi.getOrCreateUser(email, name);
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
    } catch (error) {
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
