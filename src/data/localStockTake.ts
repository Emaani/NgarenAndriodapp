/**
 * Last physical/visual stock-take result, persisted on-device so the farmer
 * dashboard's "My Animals" summary can show the latest count at a glance
 * (Oct 2026 Q&A). The satellite stock-take figures come live from the device
 * list, so only the manual/visual result needs storing here.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'ngaren.local.stocktake.v1';
const ABSENCE_KEY = 'ngaren.local.stocktake.absences.v1';

export interface StockTakeResult {
  /** ISO date the stock take was submitted. */
  date: string;
  present: number;
  absent: number;
  total: number;
  method: 'manual_visual' | 'bluetooth' | 'qr';
}

/**
 * A follow-up record for an animal reported ABSENT during a stock-take
 * (Oct 20 2026 spec). Listed by AAN, the date of the reported absence, and the
 * stock-taking user so the farmer / Ngaren can follow it up.
 */
export interface StockTakeAbsence {
  id: string;
  aan: string;
  animalLabel: string;
  locationName?: string | null;
  /** ISO datetime the absence was reported. */
  date: string;
  reportedBy: string;
}

export async function getLastStockTake(): Promise<StockTakeResult | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StockTakeResult) : null;
  } catch {
    return null;
  }
}

export async function saveStockTakeResult(result: StockTakeResult): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(result));
  } catch {
    // best-effort
  }
}

export async function getAbsenceReports(): Promise<StockTakeAbsence[]> {
  try {
    const raw = await AsyncStorage.getItem(ABSENCE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as StockTakeAbsence[]).sort((a, b) => (a.date < b.date ? 1 : -1)) : [];
  } catch {
    return [];
  }
}

/** Append a batch of absence follow-up reports (newest first, capped). */
export async function addAbsenceReports(reports: StockTakeAbsence[]): Promise<void> {
  if (reports.length === 0) return;
  try {
    const existing = await getAbsenceReports();
    await AsyncStorage.setItem(ABSENCE_KEY, JSON.stringify([...reports, ...existing].slice(0, 300)));
  } catch {
    // best-effort
  }
}
