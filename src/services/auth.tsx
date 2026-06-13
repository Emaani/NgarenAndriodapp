import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

/**
 * Lightweight role-based session.
 *
 * This is a session-only (in-memory) auth context: it tracks who is signed in
 * and which persona they chose, and exposes guards the route layouts use to
 * keep farmers and vets in their own areas of the app.
 *
 * Production note: swap `signIn` for the real OIDC exchange used by the web app
 * and persist the token in expo-secure-store. The `role` would then come from
 * the backend's user claims rather than a login-screen toggle. Everything that
 * consumes `useAuth()` (route guards, the login screen) stays unchanged.
 */
export type Role = 'farmer' | 'vet';

interface AuthState {
  role: Role | null;
  isAuthenticated: boolean;
  signIn: (role: Role) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role | null>(null);

  const value = useMemo<AuthState>(
    () => ({
      role,
      isAuthenticated: role !== null,
      signIn: (r: Role) => setRole(r),
      signOut: () => setRole(null),
    }),
    [role],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
