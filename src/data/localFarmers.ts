/**
 * Admin-added farmers, persisted on-device (Oct 2026 admin feedback). An admin
 * registers a farmer under the Farmer Portfolio; the record starts Inactive
 * (pending activation) and the admin activates it once validated — mirroring the
 * maker-checker activation used for animals. Becomes a write-through to the
 * farmer-registry backend when it lands.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FarmerPortfolioItem } from './portfolio';

const KEY = 'ngaren.local.farmers.v1';

export interface LocalFarmer extends FarmerPortfolioItem {
  phone?: string;
  email?: string;
  addedBy?: string;
  createdAt: string;
}

export async function getLocalFarmers(): Promise<LocalFarmer[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as LocalFarmer[]) : [];
  } catch {
    return [];
  }
}

export interface AddFarmerInput {
  farmerName: string;
  farmName: string;
  location: string;
  phone?: string;
  email?: string;
  addedBy?: string;
}

export async function addLocalFarmer(input: AddFarmerInput): Promise<LocalFarmer> {
  const record: LocalFarmer = {
    id: `lf-${Date.now()}`,
    farmerName: input.farmerName,
    farmName: input.farmName,
    location: input.location,
    phone: input.phone,
    email: input.email,
    addedBy: input.addedBy,
    animals: 0,
    devices: 0,
    activeTags: 0,
    healthScore: 0,
    // Inactive = pending activation by the admin (maker-checker parity).
    status: 'inactive',
    createdAt: new Date().toISOString(),
  };
  try {
    const all = await getLocalFarmers();
    await AsyncStorage.setItem(KEY, JSON.stringify([record, ...all]));
  } catch {
    // best-effort
  }
  return record;
}

/** Activate (or deactivate) a locally-added farmer. */
export async function setLocalFarmerActive(id: string, active: boolean): Promise<void> {
  try {
    const all = await getLocalFarmers();
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify(all.map((f) => (f.id === id ? { ...f, status: active ? 'active' : 'inactive' } : f))),
    );
  } catch {
    // best-effort
  }
}
