import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { API_BASE_URL } from '../config';

interface User {
  id: string;
  email: string;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);
const AUTH_BOOTSTRAP_SOFT_TIMEOUT_MS = 1200;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const state = { cancelled: false };
    void checkAuth(state);

    return () => {
      state.cancelled = true;
    };
  }, []);

  async function checkAuth(state: { cancelled: boolean }) {
    let settled = false;
    const softTimeoutId = window.setTimeout(() => {
      if (!state.cancelled && !settled) {
        setLoading(false);
      }
    }, AUTH_BOOTSTRAP_SOFT_TIMEOUT_MS);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, { credentials: 'include' });
      if (!state.cancelled && res.ok) {
        const data = await res.json();
        setUser(data.data.user);
      }
    } catch {
    } finally {
      settled = true;
      window.clearTimeout(softTimeoutId);

      if (!state.cancelled) {
        setLoading(false);
      }
    }
  }

  async function login(email: string, password: string) {
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Login failed');
      }

      setUser(data.data.user);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      throw err;
    }
  }

  async function register(email: string, password: string) {
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      setUser(data.data.user);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      throw err;
    }
  }

  async function logout() {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
