import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './supabase';
import { unregisterBackgroundSyncAsync } from './backgroundSync';
import { AppRole, resolveAppRole } from '@/lib/roles';

/**
 * Supabase-backed auth, sharing one identity with the Ngaren web app
 * (livestock-command-center). Sign-in uses email + password against the same
 * Supabase project; the session is persisted in AsyncStorage and auto-refreshed
 * (see src/services/supabase.ts), so it survives app restarts.
 *
 * The app routes by persona using a simplified `Role`. The web DB role enum is
 * `admin | farmer | veterinary | viewer`; here we collapse it to:
 *   - 'vet'    when the user has the `veterinary` (or `admin`) role
 *   - 'farmer' otherwise
 * so the existing farmer/vet route guards keep working unchanged.
 */
export type Role = 'farmer' | 'vet';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
  roles: string[];
}

interface AuthState {
  user: AuthUser | null;
  role: Role | null;
  /**
   * Full role vocabulary (admin | farmer | veterinary) matching the Command
   * Center. Drives role-differentiated dashboards, accents and titles.
   */
  appRole: AppRole;
  /** True when the user may open the vet call-out queue (veterinary or admin). */
  canVet: boolean;
  /** True for platform administrators — unlocks Team/User management. */
  isAdmin: boolean;
  /** Human-readable role for display (e.g. "Administrator", "Farmer", "Veterinarian"). */
  displayRole: string;
  isAuthenticated: boolean;
  /** True while the initial session is being restored. Guards should wait. */
  loading: boolean;
  /** Email/password sign-in. Resolves with the persona role on success. */
  signIn: (email: string, password: string) => Promise<{ error?: string; role?: Role }>;
  /**
   * Self-registration. New users get no role row (the DB trigger only seeds
   * profiles), so they default to the farmer experience. `needsConfirmation`
   * is true when the Supabase project requires email confirmation before a
   * session is issued.
   */
  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ error?: string; needsConfirmation?: boolean }>;
  /** Persist editable profile fields (currently full_name) to public.profiles. */
  updateProfile: (fields: { fullName: string }) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

/**
 * Default landing persona. Only veterinary users land in the vet call-out
 * queue; everyone else — including admins — lands in the full farmer app
 * (Dashboard + tabs). Admins are superusers, not vets, so they must not be
 * trapped on the vet screen.
 */
function roleFor(roles: string[]): Role {
  return roles.includes('veterinary') ? 'vet' : 'farmer';
}

/**
 * Who may open the vet call-out queue. Vets reach it as their home; admins can
 * open it from the dashboard while still having full farmer-app access.
 */
function canAccessVet(roles: string[]): boolean {
  return roles.includes('veterinary') || roles.includes('admin');
}

function isAdminRole(roles: string[]): boolean {
  return roles.includes('admin');
}

/**
 * Human-readable role label matching the Command Center's role vocabulary
 * (admin | farmer | veterinary | viewer). Admin takes precedence when a user
 * carries multiple roles.
 */
function displayRoleFor(roles: string[]): string {
  if (roles.includes('admin')) return 'Administrator';
  if (roles.includes('veterinary')) return 'Veterinarian';
  if (roles.includes('viewer')) return 'Viewer';
  return 'Farmer';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch the profile + roles for a signed-in Supabase user, mirroring the web
  // app's useAuth: profiles.full_name + user_roles.role keyed on user_id.
  const fetchUserProfile = useCallback(async (authUser: User): Promise<AuthUser> => {
    try {
      const [{ data: profile }, { data: roleRows }] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('user_id', authUser.id).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', authUser.id),
      ]);
      return {
        id: authUser.id,
        email: authUser.email ?? '',
        fullName:
          (profile as { full_name?: string | null } | null)?.full_name ??
          (authUser.user_metadata?.full_name as string | undefined) ??
          null,
        roles: (roleRows ?? []).map((r) => (r as { role: string }).role),
      };
    } catch {
      // Network/RLS hiccup: keep the user signed in with no extra roles so they
      // still land in the (default) farmer area rather than getting bounced out.
      return {
        id: authUser.id,
        email: authUser.email ?? '',
        fullName: (authUser.user_metadata?.full_name as string | undefined) ?? null,
        roles: [],
      };
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      // No backend configured — behave as signed-out without hanging on a spinner.
      setLoading(false);
      return;
    }

    // Set up the listener BEFORE getSession (web-app ordering) to avoid races.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        // Defer the async profile fetch so we never block the auth callback.
        setTimeout(() => {
          fetchUserProfile(newSession.user).then(setUser);
        }, 0);
      } else {
        setUser(null);
      }
    });

    supabase.auth
      .getSession()
      .then(async ({ data: { session: existing } }) => {
        setSession(existing);
        if (existing?.user) setUser(await fetchUserProfile(existing.user));
      })
      .finally(() => setLoading(false));

    return () => subscription.unsubscribe();
  }, [fetchUserProfile]);

  const signIn = useCallback<AuthState['signIn']>(async (email, password) => {
    if (!isSupabaseConfigured()) {
      return { error: 'Authentication is not configured. Set the Supabase env vars.' };
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) return { error: error.message };
    if (!data.user) return { error: 'Sign in failed' };
    const profile = await fetchUserProfile(data.user);
    setUser(profile);
    return { role: roleFor(profile.roles) };
  }, [fetchUserProfile]);

  const signUp = useCallback<AuthState['signUp']>(async (email, password, fullName) => {
    if (!isSupabaseConfigured()) {
      return { error: 'Authentication is not configured. Set the Supabase env vars.' };
    }
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      // full_name flows into raw_user_meta_data; the handle_new_user trigger
      // copies it into public.profiles, matching the web app.
      options: { data: { full_name: fullName.trim() } },
    });
    if (error) return { error: error.message };
    if (data.user) {
      const profile = await fetchUserProfile(data.user);
      setUser(profile);
    }
    // No session means the project requires email confirmation first.
    return { needsConfirmation: !data.session };
  }, [fetchUserProfile]);

  const updateProfile = useCallback<AuthState['updateProfile']>(
    async ({ fullName }) => {
      if (!user) return { error: 'You are not signed in.' };
      if (!isSupabaseConfigured()) {
        return { error: 'Authentication is not configured. Set the Supabase env vars.' };
      }
      const name = fullName.trim();
      // public.profiles is keyed on user_id and exposes full_name (see the web
      // app schema + fetchUserProfile above). RLS lets a user update their row.
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: name })
        .eq('user_id', user.id);
      if (error) return { error: error.message };
      setUser({ ...user, fullName: name });
      return {};
    },
    [user],
  );

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore network errors on sign-out; we clear local state regardless
    }
    await unregisterBackgroundSyncAsync();
    setUser(null);
    setSession(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      role: user ? roleFor(user.roles) : null,
      appRole: user ? resolveAppRole(user.roles) : 'farmer',
      canVet: user ? canAccessVet(user.roles) : false,
      isAdmin: user ? isAdminRole(user.roles) : false,
      displayRole: user ? displayRoleFor(user.roles) : '',
      isAuthenticated: !!session && !!user,
      loading,
      signIn,
      signUp,
      updateProfile,
      signOut,
    }),
    [user, session, loading, signIn, signUp, updateProfile, signOut],
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
