/**
 * Lightweight i18n provider + hook. Keeps the current locale in React state
 * (persisted to AsyncStorage) and exposes a `t(key, vars?)` translator with
 * simple `{var}` interpolation. Missing keys fall back to English, then to the
 * raw key, so the app never shows a blank string.
 */
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DICTS, Locale, LOCALES } from './strings';

const KEY = 'ngaren.locale.v1';

type Translate = (key: string, vars?: Record<string, string | number>) => string;

interface I18nValue {
  locale: Locale;
  t: Translate;
  /** Translate a data-derived status (e.g. 'ongoing'); unknown values are just
   *  capitalized rather than shown as a raw key. */
  tStatus: (status: string) => string;
  setLocale: (l: Locale) => void;
}

const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

const I18nContext = createContext<I18nValue>({
  locale: 'en',
  t: (k) => k,
  tStatus: capitalize,
  setLocale: () => undefined,
});

function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v && DICTS[v as Locale]) setLocaleState(v as Locale);
      })
      .catch(() => undefined);
  }, []);

  const value = useMemo<I18nValue>(() => {
    const dict = DICTS[locale] ?? DICTS.en;
    const t: Translate = (key, vars) => interpolate(dict[key] ?? DICTS.en[key] ?? key, vars);
    const tStatus = (status: string) => {
      const key = `status.${status.toLowerCase()}`;
      const hit = dict[key] ?? DICTS.en[key];
      return hit ?? capitalize(status);
    };
    const setLocale = (l: Locale) => {
      setLocaleState(l);
      void AsyncStorage.setItem(KEY, l);
    };
    return { locale, t, tStatus, setLocale };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

/** Shorthand for components that only need the translator. */
export function useT(): Translate {
  return useContext(I18nContext).t;
}

/** Shorthand for translating a data-derived status chip. */
export function useTStatus(): (status: string) => string {
  return useContext(I18nContext).tStatus;
}

export { LOCALES };
export type { Locale };
