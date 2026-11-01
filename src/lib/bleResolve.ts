/**
 * Resolve a BLE detection to an animal (AAN) — the field-read pipeline for
 * ELA Blue COIN / Blue PUCK tags (stock-take presence, pairing, gateways).
 *
 * Because ELA tags have a STATIC MAC (confirmed by ELA, Oct 26 2026), the MAC
 * bound at registration is a durable identity. Resolution order:
 *   1. `frame` — the Ngaren BAF custom frame carries the AAN itself;
 *   2. `name`  — the AAN was written into the advertising name over NFC;
 *   3. `mac`   — the static MAC → AAN mapping captured at registration.
 * If the tag self-reports an AAN that disagrees with the MAC registered to a
 * different animal, the read is flagged `mismatch` (re-tagging or tampering).
 *
 * Pure logic — no radio access — so it's unit-tested and shared by whichever
 * scanner feeds it (Android phone scan or fixed gateway).
 */
import { RegisteredDevice } from '../data/types';
import { aanFromAdvName, findNgarenFrame, normalizeBleMac, TagVariant } from './bleFrame';

export interface BleDetection {
  mac: string;
  name?: string | null;
  /** Raw Manufacturer Specific Data (with or without company id). */
  manufacturerData?: Uint8Array | null;
  /**
   * Battery from ELA's SCAN RESPONSE, in mV — only present when the tag's
   * "Battery voltage presence" parameter is on and the reader scans actively.
   */
  batteryMv?: number | null;
  /** ELA's low-battery alert (≤15%), also carried in the scan response. */
  lowBatteryAlert?: boolean;
  rssi?: number | null;
  seenAt: string;
}

export type BleIdentityRoute = 'frame' | 'name' | 'mac';

export interface BleResolution {
  mac: string;
  aan: string | null;
  via: BleIdentityRoute | null;
  /** Self-reported AAN disagrees with the AAN registered to this MAC. */
  mismatch: boolean;
  variant: TagVariant | null;
  batteryMv: number | null;
  lowBattery: boolean;
  counter: number | null;
  motionCount: number | null;
  temperature: number | null;
  rssi: number | null;
  seenAt: string;
}

/** BLE device models (generic Bluetooth + ELA Blue COIN / PUCK). */
export function isBleDeviceType(type: string | null | undefined): boolean {
  return /bluetooth|blue\s*(coin|puck)|\bela\b/i.test(type ?? '');
}

/** Build the static MAC → AAN map from the herd's registered BLE devices. */
export function buildMacIndex(animals: { ngarenCode?: string | null; devices?: RegisteredDevice[] | null }[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const a of animals) {
    if (!a.ngarenCode) continue;
    for (const d of a.devices ?? []) {
      // Only BLE devices carry a MAC; a satellite serial must never be read as one.
      const mac = normalizeBleMac(d.bleMac ?? (isBleDeviceType(d.type) ? d.serial : null));
      if (mac) index.set(mac, a.ngarenCode);
    }
  }
  return index;
}

export function resolveDetection(d: BleDetection, macIndex: Map<string, string>): BleResolution {
  const mac = normalizeBleMac(d.mac) ?? d.mac.toUpperCase();
  const frame = d.manufacturerData ? findNgarenFrame(d.manufacturerData) : null;
  const nameAan = aanFromAdvName(d.name);
  const registered = macIndex.get(mac) ?? null;

  const selfReported = frame?.aan ?? nameAan;
  const via: BleIdentityRoute | null = frame ? 'frame' : nameAan ? 'name' : registered ? 'mac' : null;

  return {
    mac,
    // The registered binding wins on conflict — a self-reported AAN can be
    // rewritten over NFC, the bound MAC cannot.
    aan: registered ?? selfReported ?? null,
    via,
    mismatch: !!registered && !!selfReported && registered !== selfReported,
    variant: frame?.variant ?? null,
    batteryMv: d.batteryMv ?? null,
    lowBattery: !!d.lowBatteryAlert,
    counter: frame?.counter ?? null,
    motionCount: frame?.motionCount ?? null,
    temperature: frame?.temperature ?? null,
    rssi: d.rssi ?? null,
    seenAt: d.seenAt,
  };
}

export interface NearbyTag {
  mac: string;
  name: string | null;
  rssi: number;
}

/** Record a sighting, keeping each tag's strongest signal and any name it sent. */
export function noteNearbyTag(found: Map<string, NearbyTag>, d: BleDetection) {
  const mac = normalizeBleMac(d.mac);
  if (!mac) return;
  const previous = found.get(mac);
  found.set(mac, {
    mac,
    name: d.name ?? previous?.name ?? null,
    rssi: Math.max(d.rssi ?? -127, previous?.rssi ?? -127),
  });
}

/** Closest tags first, so a tag held to the reader tops the list. */
export function nearestTags(found: Map<string, NearbyTag>, taken: Set<string>, limit = 6): NearbyTag[] {
  return [...found.values()]
    .filter((tag) => !taken.has(tag.mac))
    .sort((a, b) => b.rssi - a.rssi)
    .slice(0, limit);
}

export type HerdMatch =
  | { kind: 'match'; animalId: number }
  /** The tag self-reports a different AAN than the one its MAC is bound to. */
  | { kind: 'mismatch' }
  /** A Ngaren-programmed tag that doesn't belong to this herd. */
  | { kind: 'foreign' }
  /** Any other Bluetooth device in range (phones, speakers...). */
  | { kind: 'ignored' };

/**
 * Decide what a resolved read means for the herd being counted. A mismatch is
 * never counted as present: the tag may have been moved to another animal.
 */
export function matchToHerd(r: BleResolution, animalIdByAan: Map<string, number>): HerdMatch {
  if (r.mismatch) return { kind: 'mismatch' };
  if (!r.aan) return { kind: 'ignored' };
  const animalId = animalIdByAan.get(r.aan);
  return animalId != null ? { kind: 'match', animalId } : { kind: 'foreign' };
}

/**
 * De-duplicate reads across phones/gateways. A frame is new when its
 * (mac, counter) pair hasn't been seen; reads without a counter (standard ELA
 * ID frame) are de-duplicated per MAC within `windowMs`.
 */
export function makeDeduper(windowMs = 30_000): (r: BleResolution) => boolean {
  const seenCounters = new Set<string>();
  const lastSeenAt = new Map<string, number>();
  return (r) => {
    if (r.counter != null) {
      const k = `${r.mac}#${r.counter}`;
      if (seenCounters.has(k)) return false;
      seenCounters.add(k);
      return true;
    }
    const t = Date.parse(r.seenAt);
    const prev = lastSeenAt.get(r.mac);
    if (prev != null && Number.isFinite(t) && t - prev < windowMs) return false;
    lastSeenAt.set(r.mac, Number.isFinite(t) ? t : Date.now());
    return true;
  };
}
