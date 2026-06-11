/**
 * Ngaren mobile design system.
 * Tokens transcribed from the Figma file "Ngaren Mobile App"
 * (fileKey kFKtuHpIdVcnQ68BxbwFDZ). The data layer still targets the
 * platform-api so the app stays in parity with the Nuxt web app.
 */
import { TextStyle, ViewStyle } from 'react-native';

export const colors = {
  /** Olive brand green — primary buttons, headers, active states. */
  primary: '#6D874F',
  primaryDark: '#4A5F2E',
  primaryLight: '#A8C16A',
  /** Bright green accent — links ("Sign up", "Reset"), highlights, gradient start. */
  accent: '#21C45D',
  /** Header gradient stops (top-left → bottom-right). */
  gradient: ['#21C45D', '#698A3B'] as const,

  surface: '#FFFFFF',
  background: '#F7F7F7',
  onSurface: '#1F2223',
  onSurfaceVariant: '#828282',
  /** Input placeholder / muted body text. */
  placeholder: '#60686C',

  error: '#DC2626',
  warning: '#F59E0B',
  success: '#16A34A',
  divider: '#E6E6E6',
  scrim: 'rgba(0,0,0,0.5)',

  // Soft tints used for icon chips / badges
  primaryTint: '#EAF0DD',
  warningTint: '#FEF3C7',
  successTint: '#DCFCE7',
  errorTint: '#FEE2E2',
  infoTint: '#DBEAFE',
  info: '#2563EB',
} as const;

export type ColorToken = keyof typeof colors;

/** Inter — loaded in the root layout via @expo-google-fonts/inter. */
export const font = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/** Typography scale (Inter). */
export const type = {
  display: { fontFamily: font.bold, fontSize: 28, fontWeight: '700', lineHeight: 34 },
  headline: { fontFamily: font.semibold, fontSize: 22, fontWeight: '600', lineHeight: 28 },
  title: { fontFamily: font.semibold, fontSize: 20, fontWeight: '600', lineHeight: 28 },
  bodyLarge: { fontFamily: font.regular, fontSize: 16, fontWeight: '400', lineHeight: 24 },
  body: { fontFamily: font.regular, fontSize: 14, fontWeight: '400', lineHeight: 20 },
  caption: { fontFamily: font.regular, fontSize: 12, fontWeight: '400', lineHeight: 16 },
  label: { fontFamily: font.medium, fontSize: 11, fontWeight: '500', lineHeight: 14 },
  overline: {
    fontFamily: font.semibold,
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
} satisfies Record<string, TextStyle>;

export type TypeToken = keyof typeof type;

/** Spacing — 8pt grid. */
export const spacing = {
  xs: 4,
  sm: 8,
  mdMinus: 12,
  md: 16,
  mdPlus: 20,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/** Border radius. Inputs 12, cards 16, pill buttons via `full`. */
export const radius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  header: 34,
  full: 9999,
} as const;

/** Elevation / shadow — soft Figma card shadows. */
export const shadow: Record<1 | 2 | 3, ViewStyle> = {
  1: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 1,
  },
  2: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  3: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
};

export const layout = {
  topBarHeight: 56,
  bottomNavHeight: 80,
  fabSize: 56,
} as const;
