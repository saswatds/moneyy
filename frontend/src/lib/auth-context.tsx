import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export interface User {
  id: string;
  email: string;
  name: string;
}

export type AuthMode = 'passkey' | 'clerk' | null;

interface AuthContextType {
  mode: AuthMode;
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  token: string | null;
  setToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AuthMode>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setTokenState] = useState<string | null>(() => {
    return localStorage.getItem(TOKEN_KEY);
  });
  const [user, setUserState] = useState<User | null>(() => {
    const userJson = localStorage.getItem(USER_KEY);
    return userJson ? JSON.parse(userJson) : null;
  });

  const setToken = (newToken: string | null) => {
    setTokenState(newToken);
    if (newToken) {
      localStorage.setItem(TOKEN_KEY, newToken);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  };

  const setUser = (newUser: User | null) => {
    setUserState(newUser);
    if (newUser) {
      localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  // Detect auth mode on mount
  useEffect(() => {
    const detectAuthMode = async () => {
      try {
        const response = await fetch('/api/auth/mode');
        const data = await response.json();
        setMode(data.mode as AuthMode);
      } catch (error) {
        console.error('Failed to detect auth mode:', error);
      } finally {
        setIsLoading(false);
      }
    };

    detectAuthMode();
  }, []);

  const value = {
    mode,
    isAuthenticated: !!token && !!user,
    isLoading,
    user,
    token,
    setToken,
    setUser,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
