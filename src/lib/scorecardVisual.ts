/**
 * Shared visual mapping for the scorecard status system (Sep 7 2026 design):
 * the same green / amber / red appears on the quick-entry form, the history
 * timeline and the drill-down record, so a helper keeps them in lockstep.
 */
import { colors } from '@/theme';
import type { IconName } from '@/ui';
import type { ScorecardStatus } from '@/data/scorecards';

export interface StatusVisual {
  color: string;
  tint: string;
  icon: IconName;
  label: string;
}

export function statusVisual(status: ScorecardStatus): StatusVisual {
  switch (status) {
    case 'urgent':
      return { color: colors.error, tint: colors.errorTint, icon: 'alert-circle', label: 'Urgent' };
    case 'monitor':
      return { color: colors.warning, tint: colors.warningTint, icon: 'alert', label: 'Monitor' };
    default:
      return { color: colors.success, tint: colors.successTint, icon: 'check-circle', label: 'Healthy' };
  }
}

/** Body-condition-score colour: ≤2 red, 2.5–3 amber, ≥3.5 green. */
export function bcsColor(bcs: number | null | undefined): string {
  if (typeof bcs !== 'number') return colors.onSurfaceVariant;
  if (bcs <= 2) return colors.error;
  if (bcs < 3.5) return colors.warning;
  return colors.success;
}
