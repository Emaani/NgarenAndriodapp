/**
 * Admin portfolio data — the macro view ACROSS farmers.
 *
 * The admin console is an oversight tool for the whole portfolio of farmers, not
 * a single commercial herd. This aggregates each farmer/farm with its herd size,
 * device fleet, tag health and location so an admin gets a book-of-business view.
 *
 * Reads the shared Supabase project when configured (profiles + user_roles +
 * animals/devices counts), otherwise returns mock so Demo Mode stays usable.
 */
import { supabase } from '../services/supabase';
import { isSupabaseConfigured } from '../config';
import { reportDataFailure, reportDataSuccess } from '../services/dataHealth';

export interface FarmerPortfolioItem {
  id: string;
  farmerName: string;
  farmName: string;
  location: string;
  animals: number;
  devices: number;
  activeTags: number;
  healthScore: number; // 0-100
  status: 'active' | 'attention' | 'inactive';
}

const MOCK_PORTFOLIO: FarmerPortfolioItem[] = [
  { id: 'f1', farmerName: 'Patrick Etyang', farmName: 'Nakasero Farm', location: 'Kampala', animals: 48, devices: 32, activeTags: 28, healthScore: 91, status: 'active' },
  { id: 'f2', farmerName: 'Grace Wanjiru', farmName: 'Rift Valley Ranch', location: 'Nakuru', animals: 120, devices: 96, activeTags: 88, healthScore: 84, status: 'active' },
  { id: 'f3', farmerName: 'Daniel Mwangi', farmName: 'Laikipia Holdings', location: 'Laikipia', animals: 210, devices: 180, activeTags: 142, healthScore: 72, status: 'attention' },
  { id: 'f4', farmerName: 'Esther Achieng', farmName: 'Meru Hills Dairy', location: 'Meru', animals: 64, devices: 40, activeTags: 6, healthScore: 65, status: 'attention' },
  { id: 'f5', farmerName: 'Kabwohe SACCO', farmName: 'Kabwohe Cooperative', location: 'Sheema', animals: 340, devices: 300, activeTags: 291, healthScore: 88, status: 'active' },
  { id: 'f6', farmerName: 'James Otieno', farmName: 'Arusha Ranch', location: 'Arusha', animals: 30, devices: 0, activeTags: 0, healthScore: 0, status: 'inactive' },
];

export interface PortfolioTotals {
  farmers: number;
  animals: number;
  devices: number;
  activeTags: number;
  needAttention: number;
}

export function portfolioTotals(items: FarmerPortfolioItem[]): PortfolioTotals {
  return {
    farmers: items.length,
    animals: items.reduce((s, f) => s + f.animals, 0),
    devices: items.reduce((s, f) => s + f.devices, 0),
    activeTags: items.reduce((s, f) => s + f.activeTags, 0),
    needAttention: items.filter((f) => f.status !== 'active').length,
  };
}

/**
 * The farmer portfolio (admin). Prefers the server-side aggregation RPC
 * (get_farmer_portfolio) which scales to large herds; falls back to the
 * client-side bulk aggregation if the RPC isn't present, then to mock.
 */
export async function getFarmerPortfolio(): Promise<FarmerPortfolioItem[]> {
  if (!isSupabaseConfigured()) return MOCK_PORTFOLIO;

  // Fast path: aggregate in Postgres (one round-trip, no full-table pulls).
  try {
    const { data, error } = await supabase.rpc('get_farmer_portfolio');
    if (!error && Array.isArray(data)) {
      reportDataSuccess();
      if (data.length === 0) return [];
      return (data as Record<string, unknown>[]).map((p) => {
        const nAnimals = Number(p.animals ?? 0);
        const nDevices = Number(p.devices ?? 0);
        const nTags = Number(p.active_tags ?? 0);
        const healthScore = nAnimals > 0 ? Math.round((nTags / nAnimals) * 100) : 0;
        const status: FarmerPortfolioItem['status'] =
          nAnimals === 0 ? 'inactive' : healthScore >= 80 ? 'active' : 'attention';
        return {
          id: String(p.user_id),
          farmerName: (p.full_name as string) ?? 'Farmer',
          farmName: (p.farm_id as string) ?? '',
          location: (p.email as string) ?? '',
          animals: nAnimals,
          devices: nDevices,
          activeTags: nTags,
          healthScore,
          status,
        };
      });
    }
    // error (e.g. function not yet migrated) → fall through to client-side path.
  } catch {
    // fall through
  }

  return clientSidePortfolio();
}

/** Legacy client-side aggregation — used until the RPC migration is applied. */
async function clientSidePortfolio(): Promise<FarmerPortfolioItem[]> {
  try {
    // Farmers are profiles carrying the "farmer" role. RLS lets admins read all.
    // `profiles` is thin (user_id, full_name, email, farm_id) — no farm_name /
    // location columns, so we must NOT select those (the old query did, which
    // errored on every call and silently served mock farmers whose ids the
    // Support-mirror couldn't resolve — the "Farmer not found" bug).
    const [profilesRes, rolesRes, animalsRes, devicesRes] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name, email, farm_id'),
      supabase.from('user_roles').select('user_id, role'),
      supabase.from('animal_lineage').select('assigned_farmer_id, created_by_user, animal_tag_id, tag_status'),
      supabase.from('devices').select('assigned_to, status'),
    ]);

    const profiles = (profilesRes.data ?? []) as Record<string, unknown>[];
    if (profilesRes.error || profiles.length === 0) {
      reportDataFailure('portfolio', profilesRes.error);
      return MOCK_PORTFOLIO;
    }
    reportDataSuccess();

    // Keep only farmer-role profiles when we can read roles; otherwise show all.
    const roles = (rolesRes.data ?? []) as { user_id: string; role: string }[];
    const farmerIds = new Set(roles.filter((r) => r.role === 'farmer').map((r) => r.user_id));
    const farmers = farmerIds.size > 0 ? profiles.filter((p) => farmerIds.has(String(p.user_id))) : profiles;

    // Per-farmer counts, aggregated client-side from two bulk reads.
    const animals = (animalsRes.data ?? []) as Record<string, unknown>[];
    const devices = (devicesRes.data ?? []) as Record<string, unknown>[];
    const animalCount = new Map<string, number>();
    const tagCount = new Map<string, number>();
    for (const a of animals) {
      const owner = String(a.assigned_farmer_id ?? a.created_by_user ?? '');
      if (!owner) continue;
      animalCount.set(owner, (animalCount.get(owner) ?? 0) + 1);
      const tagged = a.animal_tag_id != null && String(a.animal_tag_id).length > 0 && a.tag_status !== 'unlinked';
      if (tagged) tagCount.set(owner, (tagCount.get(owner) ?? 0) + 1);
    }
    const deviceCount = new Map<string, number>();
    for (const d of devices) {
      const owner = String(d.assigned_to ?? '');
      if (!owner) continue;
      deviceCount.set(owner, (deviceCount.get(owner) ?? 0) + 1);
    }

    return farmers.map((p) => {
      const id = String(p.user_id);
      const nAnimals = animalCount.get(id) ?? 0;
      const nDevices = deviceCount.get(id) ?? 0;
      const nTags = tagCount.get(id) ?? 0;
      const healthScore = nAnimals > 0 ? Math.round((nTags / nAnimals) * 100) : 0;
      const status: FarmerPortfolioItem['status'] =
        nAnimals === 0 ? 'inactive' : healthScore >= 80 ? 'active' : 'attention';
      return {
        id,
        farmerName: (p.full_name as string) ?? 'Farmer',
        // profiles has no farm_name/region — surface what it does have: the
        // farm_id (if set) and the email, both useful for admin identification.
        farmName: (p.farm_id as string) ?? '',
        location: (p.email as string) ?? '',
        animals: nAnimals,
        devices: nDevices,
        activeTags: nTags,
        healthScore,
        status,
      };
    });
  } catch (e) {
    reportDataFailure('portfolio', e);
    return MOCK_PORTFOLIO;
  }
}
