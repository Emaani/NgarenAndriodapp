/**
 * Locally-scheduled farm calendar events.
 *
 * The calendar previously only *derived* events from health/vet data (read
 * only). Horizon One asks farmers to actively schedule activities (vet visits,
 * routine stock takes). Those go here and merge into the calendar view. Stored
 * on-device for the prototype; matches the CalendarEvent shape so the calendar
 * renders them with no special-casing.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CalendarEvent } from './clinical';

const KEY = 'ngaren.local.events.v1';

export async function getLocalEvents(): Promise<CalendarEvent[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CalendarEvent[]) : [];
  } catch {
    return [];
  }
}

export async function addLocalEvent(event: Omit<CalendarEvent, 'id'>): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const all: CalendarEvent[] = raw ? (JSON.parse(raw) as CalendarEvent[]) : [];
    const full: CalendarEvent = { ...event, id: `evt-${Date.now()}` };
    await AsyncStorage.setItem(KEY, JSON.stringify([full, ...all]));
  } catch {
    // best-effort
  }
}
