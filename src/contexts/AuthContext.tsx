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
        if (savedUser) {
          const userData = JSON.parse(savedUser);
          // Verify user still exists in database
          const dbUser = await userApi.getUser(userData.id);
          if (dbUser) {
            setUser(dbUser);
            // Load user subscription
            const userSubscription = await subscriptionApi.getUserSubscription(dbUser.id);
            setSubscription(userSubscription);
          } else {
            localStorage.removeItem('auth_user');
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
        localStorage.removeItem('auth_user');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      // In a real app, you'd validate password hash
      // For demo purposes, we'll just check if user exists
      const dbUser = await userApi.getUserByEmail(email);
      if (dbUser) {
        setUser(dbUser);
        localStorage.setItem('auth_user', JSON.stringify(dbUser));
        // Load user subscription
        const userSubscription = await subscriptionApi.getUserSubscription(dbUser.id);
        setSubscription(userSubscription);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const register = async (email: string, password: string, name: string): Promise<boolean> => {
    try {
      // Check if user already exists
      let existingUser = null;
      try {
        existingUser = await userApi.getUserByEmail(email);
      } catch (error) {
        console.error('Error checking existing user:', error);
        // If there's an error other than 404, stop registration
        return false;
      }

      if (existingUser) {
        console.log('User already exists:', existingUser);
        return false;
      }

      console.log('Creating new user:', { email, name });

      // Create new user
      const newUser = await userApi.getOrCreateUser(email, name);
      console.log('User created successfully:', newUser);
      
      setUser(newUser);
      localStorage.setItem('auth_user', JSON.stringify(newUser));
      // Load user subscription (new users start with free plan)
      const userSubscription = await subscriptionApi.getUserSubscription(newUser.id);
      setSubscription(userSubscription);
      return true;
    } catch (error) {
      console.error('Registration error:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setSubscription(null);
    localStorage.removeItem('auth_user');
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
