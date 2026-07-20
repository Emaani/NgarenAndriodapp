/**
 * CERES Linkage Health (Admin) — calls the SAME `ceres-linkage` edge function
 * as the web useCeresIntegration hook (action "get-linkage-state"), so the
 * environment, farms and linkage records are identical to web. Falls back to
 * mock data when Supabase isn't configured or the function call fails.
 */
import { supabase } from '../services/supabase';
import { isSupabaseConfigured } from '../config';

export type LinkageStatus = 'pending' | 'connected' | 'disconnected' | 'error';
export type SyncState = 'ready' | 'pending' | 'syncing' | 'error';

export interface CeresLinkageRecord {
  id: string;
  grantId: string;
  propertyName: string;
  farmDisplayName: string | null;
  linkageStatus: LinkageStatus;
  syncState: SyncState;
  activeTags: number;
  alertsCount: number;
  lastError: string | null;
}

export interface CeresFarmOption {
  id: string;
  name: string;
  region: string;
  country: string;
  animalCount: number;
  activeTags: number;
  healthScore: number;
  status: string;
}

export interface LinkageState {
  environment: string;
  linkages: CeresLinkageRecord[];
  farms: CeresFarmOption[];
  connected: number;
  pending: number;
  disconnected: number;
  totalActiveTags: number;
  totalAlerts: number;
  /** Present when the edge function call itself failed (network/auth), not
   * when it succeeded with zero linkages. */
  error: string | null;
}

const MOCK_STATE: LinkageState = {
  environment: 'TEST',
  connected: 1,
  pending: 1,
  disconnected: 0,
  totalActiveTags: 142,
  totalAlerts: 3,
  error: null,
  farms: [
    { id: 'f1', name: 'Addis Station', region: 'Oromia', country: 'Ethiopia', animalCount: 1543, activeTags: 1402, healthScore: 82, status: 'active' },
    { id: 'f2', name: 'Nakasero Farm', region: 'Central', country: 'Uganda', animalCount: 48, activeTags: 28, healthScore: 91, status: 'active' },
  ],
  linkages: [
    { id: 'l1', grantId: 'g1', propertyName: 'Addis Station', farmDisplayName: 'Addis Station (NGR)', linkageStatus: 'connected', syncState: 'ready', activeTags: 142, alertsCount: 3, lastError: null },
    { id: 'l2', grantId: 'g2', propertyName: 'Rift Valley Ranch', farmDisplayName: null, linkageStatus: 'pending', syncState: 'pending', activeTags: 0, alertsCount: 0, lastError: null },
  ],
};

interface RawLinkage {
  id: string;
  grant_id: string;
  ceres_property_name: string;
  ngaren_farm_display_name?: string | null;
  linkage_status: LinkageStatus;
  sync_state: SyncState;
  active_tags: number;
  alerts_count: number;
  last_error?: string | null;
}

interface RawFarm {
  id: string;
  name: string;
  region: string;
  country: string;
  animal_count: number;
  active_tags: number;
  health_score: number;
  status: string;
}

function summarize(linkages: CeresLinkageRecord[]) {
  return {
    connected: linkages.filter((l) => l.linkageStatus === 'connected').length,
    pending: linkages.filter((l) => l.linkageStatus === 'pending').length,
    disconnected: linkages.filter((l) => l.linkageStatus === 'disconnected').length,
    totalActiveTags: linkages.reduce((s, l) => s + l.activeTags, 0),
    totalAlerts: linkages.reduce((s, l) => s + l.alertsCount, 0),
  };
}

export async function getLinkageState(): Promise<LinkageState> {
  if (!isSupabaseConfigured()) return MOCK_STATE;
  try {
    const { data, error } = await supabase.functions.invoke('ceres-linkage', {
      body: { action: 'get-linkage-state' },
    });
    if (error || !data) return { ...MOCK_STATE, error: error?.message ?? 'No response from ceres-linkage' };

    const linkages: CeresLinkageRecord[] = ((data.linkages ?? []) as RawLinkage[]).map((l) => ({
      id: l.id,
      grantId: l.grant_id,
      propertyName: l.ceres_property_name,
      farmDisplayName: l.ngaren_farm_display_name ?? null,
      linkageStatus: l.linkage_status,
      syncState: l.sync_state,
      activeTags: Number(l.active_tags ?? 0),
      alertsCount: Number(l.alerts_count ?? 0),
      lastError: l.last_error ?? null,
    }));
    const farms: CeresFarmOption[] = ((data.farms ?? []) as RawFarm[]).map((f) => ({
      id: f.id,
      name: f.name,
      region: f.region,
      country: f.country,
      animalCount: Number(f.animal_count ?? 0),
      activeTags: Number(f.active_tags ?? 0),
      healthScore: Number(f.health_score ?? 0),
      status: f.status,
    }));

    return {
      environment: (data.environment as string) ?? 'TEST',
      linkages,
      farms,
      error: null,
      ...summarize(linkages),
    };
  } catch (e) {
    return { ...MOCK_STATE, error: e instanceof Error ? e.message : 'Failed to load CERES integration' };
  }
}

/** Re-sync a single grant. Mirrors the web "Sync" button. */
export async function syncGrant(grantId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.functions.invoke('ceres-linkage', {
      body: { action: 'sync-grant-access', grantId },
    });
    return !error;
  } catch {
    return false;
  }
}
