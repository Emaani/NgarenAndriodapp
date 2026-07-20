/**
 * Role identity for the mobile app — ported 1:1 from the Livestock Command
 * Center's src/lib/roleColors.ts so the two platforms present the same accent,
 * label and console title per role.
 *
 *   Admin      — Olive-gold (brand primary), "Enterprise Control Center"
 *   Farmer     — Earth-green,                "Herd Operations Console"
 *   Veterinary — Slate-blue,                 "Health Intelligence System"
 *
 * The HSL values in the web app convert to the hex accents below.
 */
export type AppRole = 'admin' | 'farmer' | 'veterinary';

export interface RoleTheme {
  /** Primary accent (hex). */
  accent: string;
  /** Deeper shade of the accent — the far end of the header gradient. */
  accentDeep: string;
  /** Subtle tinted background for cards/badges. */
  tint: string;
  /** Short badge label. */
  label: string;
  /** Console title shown on the dashboard header. */
  consoleTitle: string;
  /** One-line console subtitle. */
  consoleSubtitle: string;
}

export const ROLE_THEME: Record<AppRole, RoleTheme> = {
  admin: {
    accent: '#6D874F', // hsl(88 26% 42%) — olive-gold, brand primary
    accentDeep: '#698A3B',
    tint: '#EAF0DD',
    label: 'Admin',
    consoleTitle: 'Enterprise Control Center',
    consoleSubtitle: 'Organisation-wide oversight & operations',
  },
  farmer: {
    accent: '#21C45D', // hsl(142 71% 45%) — earth-green
    accentDeep: '#0F9B48',
    tint: '#E4F7EC',
    label: 'Farmer',
    consoleTitle: 'Herd Operations Console',
    consoleSubtitle: 'Manage your herd, devices & farm',
  },
  veterinary: {
    accent: '#3D99F5', // hsl(210 90% 60%) — slate-blue
    accentDeep: '#1F6FD0',
    tint: '#E4F0FE',
    label: 'Vet Doctor',
    consoleTitle: 'Health Intelligence System',
    consoleSubtitle: 'Clinical intelligence & call-outs',
  },
};

/** Resolve the full role vocabulary from the raw Supabase user_roles list. */
export function resolveAppRole(roles: string[]): AppRole {
  if (roles.includes('admin')) return 'admin';
  if (roles.includes('veterinary')) return 'veterinary';
  return 'farmer';
}

export function roleTheme(role: AppRole): RoleTheme {
  return ROLE_THEME[role];
}
