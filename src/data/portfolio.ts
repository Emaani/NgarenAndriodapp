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

/** The farmer portfolio (admin). Falls back to mock offline / on error. */
export async function getFarmerPortfolio(): Promise<FarmerPortfolioItem[]> {
  if (!isSupabaseConfigured()) return MOCK_PORTFOLIO;
  try {
    // Farmers are profiles carrying the "farmer" role. RLS lets admins read all.
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, full_name, farm_name, location');
    if (error || !data || data.length === 0) {
      reportDataFailure('portfolio', error);
      return MOCK_PORTFOLIO;
    }
    reportDataSuccess();
    return data.map((p: Record<string, unknown>, i: number) => ({
      id: String(p.user_id ?? i),
      farmerName: (p.full_name as string) ?? 'Farmer',
      farmName: (p.farm_name as string) ?? '—',
      location: (p.location as string) ?? '—',
      animals: 0,
      devices: 0,
      activeTags: 0,
      healthScore: 0,
      status: 'active' as const,
    }));
  } catch (e) {
    reportDataFailure('portfolio', e);
    return MOCK_PORTFOLIO;
  }
}
