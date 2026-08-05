/**
 * Runtime configuration sourced from Expo public env vars (EXPO_PUBLIC_*).
 *
 * The app is built to run in two modes:
 *  - Mock mode (default): no backend configured, screens use src/data/mock.ts.
 *  - Live mode: set the env vars below and the API client (src/data/api.ts)
 *    talks to the Ngaren BFF / platform-api, exactly like the Nuxt web app.
 *
 * Nothing is hardcoded — credentials and base URLs only ever come from env.
 * Set these in a local `.env` file or your EAS build secrets, e.g.:
 *   EXPO_PUBLIC_CERES_PLATFORM_URL=https://api.ngaren.example.com
 *   EXPO_PUBLIC_NGAREN_CONSUMER_ID=<oidc userid claim>
 */
export const config = {
  /** Base URL of the Ngaren BFF / platform-api. Empty string => mock mode. */
  platformUrl: process.env.EXPO_PUBLIC_CERES_PLATFORM_URL ?? '',
  /** Value sent as the `X-Ngaren-Consumer-Id` header (OIDC userid claim). */
  consumerId: process.env.EXPO_PUBLIC_NGAREN_CONSUMER_ID ?? '',
  /** Supabase project URL — same project as the web app. Empty => auth disabled. */
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  /** Supabase publishable (anon) key — public, RLS-gated, safe to ship. */
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  /** Sentry DSN — empty => crash reporting disabled (no-op). Safe to ship. */
  sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
};

/** True when a real backend base URL is present and the client should hit it. */
export function isBackendConfigured(): boolean {
  return config.platformUrl.trim().length > 0;
}

/** True when Supabase credentials are present and real auth should be used. */
export function isSupabaseConfigured(): boolean {
  return config.supabaseUrl.trim().length > 0 && config.supabaseAnonKey.trim().length > 0;
}

/** True when a Sentry DSN is present and crash reporting should initialise. */
export function isSentryConfigured(): boolean {
  return config.sentryDsn.trim().length > 0;
}
