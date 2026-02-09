/**
 * Authentication context for managing user state across the application.
 * 
 * Provides user authentication state, login/logout functions, and role-based access.
 */
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { authApi, tokenManager } from '../lib/api';
import type { User, TeacherSignupData, StudentSignupData, LoginData, UserRole } from '../lib/types';

interface AuthContextType {
  // State
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  // Auth methods
  signupTeacher: (data: TeacherSignupData) => Promise<void>;
  signupStudent: (data: StudentSignupData) => Promise<void>;
  login: (data: LoginData) => Promise<void>;
  googleLogin: (idToken: string, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  
  // Role checks
  isTeacher: boolean;
  isStudent: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state from storage
  useEffect(() => {
    const storedUser = tokenManager.getUser();
    if (storedUser && tokenManager.isAuthenticated()) {
      setUser(storedUser);
    }
    setIsLoading(false);
  }, []);

  const signupTeacher = useCallback(async (data: TeacherSignupData) => {
    setIsLoading(true);
    try {
      const response = await authApi.signupTeacher(data);
      setUser(response.user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signupStudent = useCallback(async (data: StudentSignupData) => {
    setIsLoading(true);
    try {
      const response = await authApi.signupStudent(data);
      setUser(response.user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (data: LoginData) => {
    setIsLoading(true);
    try {
      const response = await authApi.login(data);
      setUser(response.user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const googleLogin = useCallback(async (idToken: string, role: UserRole) => {
    setIsLoading(true);
    try {
      const response = await authApi.googleLogin(idToken, role as 'teacher' | 'student');
      setUser(response.user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authApi.logout();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    signupTeacher,
    signupStudent,
    login,
    googleLogin,
    logout,
    isTeacher: user?.role === 'teacher',
    isStudent: user?.role === 'student',
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Protected route wrapper component
interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: UserRole;
  fallback?: ReactNode;
}

export function ProtectedRoute({ 
  children, 
  requiredRole, 
  fallback 
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (fallback) return <>{fallback}</>;
    // Redirect to login
    window.location.href = '/login';
    return null;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center p-8 bg-surface rounded-xl border border-border max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 bg-accent/10 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-text-primary mb-2">Access Restricted</h2>
          <p className="text-text-secondary mb-4">
            This page requires {requiredRole} access.
          </p>
          <a 
            href="/" 
            className="inline-block px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            Go Home
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
