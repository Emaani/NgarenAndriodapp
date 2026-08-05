/**
 * Crash & error reporting (Sentry).
 *
 * Initialises only when EXPO_PUBLIC_SENTRY_DSN is set, so builds without a DSN
 * (local dev, forks) are a complete no-op — nothing is sent anywhere. The DSN
 * is a public, write-only ingestion key and is safe to ship, exactly like the
 * Supabase anon key.
 *
 * Native symbolication of stack traces (source maps) is a build-time concern
 * handled by the Sentry Metro/Gradle plugin, which needs SENTRY_ORG /
 * SENTRY_PROJECT / SENTRY_AUTH_TOKEN. Until those are provisioned we still get
 * fully-functional crash capture here — just with minified frames.
 */
import * as Sentry from '@sentry/react-native';
import { config, isSentryConfigured } from '../config';

export const sentryNavigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

export function initSentry(): void {
  if (!isSentryConfigured()) return;
  Sentry.init({
    dsn: config.sentryDsn,
    // Keep PII out of reports; we only want technical crash data.
    sendDefaultPii: false,
    // Sample a fraction of transactions for performance without heavy overhead.
    tracesSampleRate: 0.2,
    integrations: [sentryNavigationIntegration],
  });
}

/** Report a handled error with context, when Sentry is configured. */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!isSentryConfigured()) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

/** Wrap the root component so uncaught render/runtime errors are captured. */
export const wrapWithSentry = Sentry.wrap;
