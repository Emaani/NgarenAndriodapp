import { useCallback, useEffect, useState } from 'react';

/**
 * Loads a resource from the API client and tracks loading/error state.
 *
 * The API client (src/data/api.ts) returns mock data when no backend is
 * configured and live platform-api data when the EXPO_PUBLIC_* env vars are set,
 * so screens use this hook identically in both modes. `initial` seeds the first
 * paint (typically the mock value) to avoid an empty flash.
 */
export function useResource<T>(loader: () => Promise<T>, initial: T) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loader()
      .then((d) => {
        if (active) {
          setData(d);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // loader is intentionally excluded — reloads are driven by `tick`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  return { data, loading, error, reload };
}
