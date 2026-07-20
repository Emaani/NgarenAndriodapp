/**
 * Vet "Health Intelligence" metrics — the veterinary role's landing data,
 * mirroring the web VetDashboardPage / useVetDashboardMetrics.
 *
 * Derived from the same clinical + call-out pipelines the rest of the app uses
 * (health_records, vet_support_requests), so RLS scoping and the mock fallback
 * come for free — no separate query path to keep in sync.
 */
import { getCalloutRequests } from './api';
import { getHealthRecords, HealthRecord } from './clinical';

export type RiskBand = 'High risk' | 'Moderate' | 'Stable';

export interface VetMetrics {
  immediateAttention: number;
  pendingRequests: number;
  openCases: number;
  recentlyReviewed: number;
  distribution: { label: RiskBand; value: number }[];
  toReview: HealthRecord[];
}

/** Map a free-text severity onto a risk band. */
export function riskBand(severity: string | null): RiskBand {
  const s = (severity ?? '').toLowerCase();
  if (s === 'critical' || s === 'high' || s === 'severe') return 'High risk';
  if (s === 'moderate' || s === 'medium') return 'Moderate';
  return 'Stable';
}

const isOpen = (r: HealthRecord) => {
  const s = r.status.toLowerCase();
  return s !== 'resolved' && s !== 'completed' && s !== 'closed';
};

export async function getVetMetrics(): Promise<VetMetrics> {
  const [health, callouts] = await Promise.all([getHealthRecords(), getCalloutRequests()]);

  const open = health.filter(isOpen);
  const immediate = open.filter((r) => riskBand(r.severity) === 'High risk');

  const counts: Record<RiskBand, number> = { 'High risk': 0, Moderate: 0, Stable: 0 };
  for (const r of health) counts[riskBand(r.severity)] += 1;

  return {
    immediateAttention: immediate.length,
    pendingRequests: callouts.filter((c) => c.status === 'pending').length,
    openCases: open.length,
    recentlyReviewed: health.length - open.length,
    distribution: [
      { label: 'High risk', value: counts['High risk'] },
      { label: 'Moderate', value: counts.Moderate },
      { label: 'Stable', value: counts.Stable },
    ],
    // Highest-risk open cases first — the vet's actual worklist.
    toReview: [...open].sort((a, b) => {
      const rank = (r: HealthRecord) => (riskBand(r.severity) === 'High risk' ? 0 : riskBand(r.severity) === 'Moderate' ? 1 : 2);
      return rank(a) - rank(b);
    }),
  };
}

export const VET_METRICS_FALLBACK: VetMetrics = {
  immediateAttention: 0,
  pendingRequests: 0,
  openCases: 0,
  recentlyReviewed: 0,
  distribution: [
    { label: 'High risk', value: 0 },
    { label: 'Moderate', value: 0 },
    { label: 'Stable', value: 0 },
  ],
  toReview: [],
};
