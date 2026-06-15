/**
 * Supabase client for the mobile app.
 *
 * Points at the SAME Supabase project as the Ngaren web app
 * (livestock-command-center), so a user signs in with one identity across web
 * and mobile and the shared Postgres DB stays 1:1.
 *
 * Differences from the web client (src/integrations/supabase/client.ts there):
 *   - Storage is AsyncStorage instead of localStorage (React Native has no
 *     localStorage), so the session survives app restarts.
 *   - detectSessionInUrl is false — there is no URL to parse on native.
 *
 * The URL + publishable (anon) key come from EXPO_PUBLIC_* env vars. The anon
 * key is a public, RLS-gated key designed to ship in clients; no service-role
 * key ever touches the device.
 */
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { config, isSupabaseConfigured } from '../config';

// A single shared instance. When Supabase isn't configured (no env vars) the
// client is still constructed with empty strings; auth calls simply fail and
// the AuthProvider treats the user as signed-out, keeping the UI usable.
export const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export { isSupabaseConfigured };
