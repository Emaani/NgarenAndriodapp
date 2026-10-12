/**
 * Last physical/visual stock-take result, persisted on-device so the farmer
 * dashboard's "My Animals" summary can show the latest count at a glance
 * (Oct 2026 Q&A). The satellite stock-take figures come live from the device
 * list, so only the manual/visual result needs storing here.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'ngaren.local.stocktake.v1';

export interface StockTakeResult {
  /** ISO date the stock take was submitted. */
  date: string;
  present: number;
  absent: number;
  total: number;
  method: 'manual_visual' | 'bluetooth' | 'qr';
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
