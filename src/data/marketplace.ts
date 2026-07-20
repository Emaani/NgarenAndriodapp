/**
 * Marketplace (all roles) — reads the SAME `marketplace_listings` table as the
 * web MarketplacePage. Farmers list animals for sale (pending admin approval),
 * everyone browses approved listings, admins moderate.
 *
 * Degrades gracefully to mock data when Supabase isn't configured or a query
 * errors, so the screen works in Demo Mode.
 */
import { supabase } from '../services/supabase';
import { isSupabaseConfigured } from '../config';

export type ListingStatus = 'pending' | 'approved' | 'rejected' | 'sold';

export interface MarketplaceListing {
  id: string;
  title: string;
  breed: string;
  animalCount: number;
  pricePerHead: number;
  currency: string;
  location: string | null;
  status: ListingStatus;
  createdAt: string;
}

export interface NewListing {
  title: string;
  breed: string;
  animalCount: number;
  pricePerHead: number;
  location?: string;
  currency?: string;
}

const MOCK: MarketplaceListing[] = [
  { id: 'm1', title: 'Boran heifers, in-calf', breed: 'Boran', animalCount: 6, pricePerHead: 620000, currency: 'UGX', location: 'Nakuru', status: 'approved', createdAt: '2026-07-14' },
  { id: 'm2', title: 'Ankole bull, 3 yrs', breed: 'Ankole', animalCount: 1, pricePerHead: 1450000, currency: 'UGX', location: 'Mbarara', status: 'approved', createdAt: '2026-07-12' },
  { id: 'm3', title: 'Friesian dairy cows', breed: 'Holstein', animalCount: 4, pricePerHead: 980000, currency: 'UGX', location: 'Kiambu', status: 'approved', createdAt: '2026-07-10' },
  { id: 'm4', title: 'Zebu steers for fattening', breed: 'Zebu', animalCount: 12, pricePerHead: 410000, currency: 'UGX', location: 'Laikipia', status: 'pending', createdAt: '2026-07-18' },
];

function mapRow(r: Record<string, unknown>): MarketplaceListing {
  return {
    id: String(r.id),
    title: (r.title as string) ?? 'Untitled',
    breed: (r.breed as string) ?? '—',
    animalCount: Number(r.animal_count ?? 1),
    pricePerHead: Number(r.price_per_head ?? 0),
    currency: (r.currency as string) ?? 'UGX',
    location: (r.location as string) ?? null,
    status: ((r.status as string) ?? 'pending') as ListingStatus,
    createdAt: (r.created_at as string) ?? '',
  };
}

export async function getMarketplaceListings(): Promise<MarketplaceListing[]> {
  if (!isSupabaseConfigured()) return MOCK;
  try {
    const { data, error } = await supabase
      .from('marketplace_listings')
      .select('*')
      .order('created_at', { ascending: false });
    if (error || !data) return MOCK;
    return data.map(mapRow);
  } catch {
    return MOCK;
  }
}

/** Submit a new listing (pending approval). No-ops safely in mock mode. */
export async function submitListing(listing: NewListing, farmerId?: string): Promise<boolean> {
  if (!isSupabaseConfigured() || !farmerId) return false;
  try {
    const { error } = await supabase.from('marketplace_listings').insert({
      farmer_id: farmerId,
      title: listing.title,
      breed: listing.breed,
      animal_count: listing.animalCount,
      price_per_head: listing.pricePerHead,
      currency: listing.currency ?? 'UGX',
      location: listing.location ?? null,
      status: 'pending',
    });
    return !error;
  } catch {
    return false;
  }
}

/** Admin moderation. No-ops safely in mock mode. */
export async function setListingStatus(id: string, status: ListingStatus): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  try {
    const { error } = await supabase.from('marketplace_listings').update({ status }).eq('id', id);
    return !error;
  } catch {
    return false;
  }
}

export function formatPrice(currency: string, amount: number): string {
  return `${currency} ${amount.toLocaleString()}`;
}
