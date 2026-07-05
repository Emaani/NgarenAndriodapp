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

// A single shared instance. createClient THROWS on an empty URL
// ("supabaseUrl is required.") and this module is evaluated from the root
// layout — so constructing it with missing env vars kills the whole app at
// startup before the first frame (exactly what happened in EAS builds, where
// the gitignored .env never reaches the build server). When Supabase isn't
// configured we construct the client against a syntactically valid
// placeholder instead; it is never contacted because every call-site guards
// with isSupabaseConfigured() first, and the AuthProvider treats the user as
// signed-out, keeping the UI usable in mock mode.
const PLACEHOLDER_URL = 'https://supabase-not-configured.invalid';
const PLACEHOLDER_KEY = 'anon-key-not-configured';

export const supabase = createClient(
  isSupabaseConfigured() ? config.supabaseUrl : PLACEHOLDER_URL,
  isSupabaseConfigured() ? config.supabaseAnonKey : PLACEHOLDER_KEY,
  {
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);

export { isSupabaseConfigured };
