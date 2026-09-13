/**
 * Service-linked vet ratings (Sep 12 2026 standup).
 *
 * A rating is tied to a specific completed service request (call-out), not the
 * vet's general profile — this prevents manipulation and makes feedback
 * verifiable. The farmer is prompted to rate recently-performed, unrated
 * services. Persisted on-device; maps onto a future `vet_ratings` table keyed
 * by service_request_id.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CalloutRequest } from './types';

const KEY = 'ngaren.vet.ratings.v1';

export interface VetRating {
  /** The completed service request this rating is for (one rating per service). */
  calloutId: number;
  vetId?: number;
  vetName?: string;
  animal?: string;
  rating: number;
  tags: string[];
  review?: string;
  ratedAt: string;
}

export async function getRatings(): Promise<VetRating[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const all = raw ? (JSON.parse(raw) as VetRating[]) : [];
    return Array.isArray(all) ? all : [];
  } catch {
    return [];
  }
}

export async function isServiceRated(calloutId: number): Promise<boolean> {
  return (await getRatings()).some((r) => r.calloutId === calloutId);
}

/** Record (or replace) the rating for one completed service request. */
export async function rateService(input: Omit<VetRating, 'ratedAt'>): Promise<void> {
  try {
    const all = await getRatings();
    const next = [{ ...input, ratedAt: new Date().toISOString() }, ...all.filter((r) => r.calloutId !== input.calloutId)];
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // best-effort
  }
}

/**
 * Completed call-outs that haven't been rated yet — the "rate your recent
 * visits" prompt list, newest first.
 */
export async function getUnratedCompleted(callouts: CalloutRequest[]): Promise<CalloutRequest[]> {
  const rated = new Set((await getRatings()).map((r) => r.calloutId));
  return callouts.filter((c) => c.status === 'completed' && !rated.has(c.id));
}
