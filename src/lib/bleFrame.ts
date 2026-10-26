/**
 * Ngaren BLE custom frame codec (ELA Innovation BAF firmware, Oct 2026).
 *
 * ELA confirmed (Oct 26 2026) that Blue COIN / Blue PUCK tags have a STATIC
 * identity (fixed MAC + advertising name; the name is only changeable over NFC)
 * and that the Bluetooth Advanced Features (BAF) firmware can carry a custom
 * payload. This module is the single source of truth for that payload — the
 * frame spec sent to ELA R&D describes exactly what is implemented here.
 *
 * The payload sits in Manufacturer Specific Data (AD type 0xFF), after ELA's
 * 2-byte company identifier. 14 bytes, big-endian:
 *
 *   0      Frame marker 0x4E ('N')
 *   1      Version (high nibble) | flags (low nibble: bit0 low battery,
 *          bit1 motion detected)
 *   2–8    AAN, bit-packed (country 8b, month 4b, year 7b, sequence 30b = 49b,
 *          zero-padded to 56b)
 *   9      Battery level, % (0–100); 0xFF = not reported
 *   10–11  Rolling frame counter, uint16
 *   12     Motion events since the previous frame; 0xFF = not supported
 *   13     Temperature, °C, int8; 0x80 (-128) = not supported
 *
 * Identity can therefore be resolved three ways, in order of preference:
 * the custom frame's AAN, an AAN written into the advertising name, or the
 * static MAC mapped to an AAN at registration (see lib/bleResolve).
 */
import { AAN_ALPHABET } from './ngaren';

export const NGAREN_FRAME_MARKER = 0x4e;
export const NGAREN_FRAME_VERSION = 1;
export const NGAREN_FRAME_LENGTH = 14;
export const AAN_PACKED_LENGTH = 7;

export const FLAG_LOW_BATTERY = 0x01;
export const FLAG_MOTION = 0x02;

export const BATTERY_UNKNOWN = 0xff;
export const MOTION_UNSUPPORTED = 0xff;
export const TEMPERATURE_UNSUPPORTED = -128;

/**
 * Stable 8-bit country codes for the packed AAN. Explicit (never derived from
 * object key order) so a code never changes once tags are in the field.
 * 0 is reserved/invalid.
 */
export const AAN_COUNTRY_CODES: Record<string, number> = { UG: 1, KE: 2, TZ: 3, ZA: 4, RW: 5 };
const COUNTRY_BY_CODE: Record<number, string> = Object.fromEntries(
  Object.entries(AAN_COUNTRY_CODES).map(([cc, n]) => [n, cc]),
);

const AAN_PATTERN = /^([A-Z]{2})-(\d{2})(\d{2})-([0-9A-Z]{6})$/;

export interface NgarenFrame {
  version: number;
  aan: string;
  lowBattery: boolean;
  motionDetected: boolean;
  /** 0–100, or null when the tag doesn't report it. */
  battery: number | null;
  counter: number;
  /** Motion events since the previous frame, or null when unsupported. */
  motionCount: number | null;
  /** °C, or null when unsupported. */
  temperature: number | null;
}

/* ----------------------------- bit helpers ------------------------------- */

function writeBits(out: Uint8Array, state: { pos: number }, value: number, bits: number): void {
  for (let i = bits - 1; i >= 0; i--) {
    const bit = Math.floor(value / 2 ** i) % 2;
    const byte = state.pos >> 3;
    if (bit) out[byte] |= 0x80 >> (state.pos & 7);
    state.pos += 1;
  }
}

function readBits(bytes: Uint8Array, state: { pos: number }, bits: number): number {
  let v = 0;
  for (let i = 0; i < bits; i++) {
    const byte = bytes[state.pos >> 3];
    const bit = (byte >> (7 - (state.pos & 7))) & 1;
    v = v * 2 + bit;
    state.pos += 1;
  }
  return v;
}

/* ------------------------------- AAN pack -------------------------------- */

/** True when `aan` is a well-formed AAN this codec can pack. */
export function isPackableAan(aan: string): boolean {
  const m = AAN_PATTERN.exec(aan.trim().toUpperCase());
  if (!m) return false;
  const month = Number(m[2]);
  return !!AAN_COUNTRY_CODES[m[1]] && month >= 1 && month <= 12 && [...m[4]].every((c) => AAN_ALPHABET.includes(c));
}

/** Pack an AAN (e.g. `UG-1026-K7Q2MX`) into 7 bytes. Throws if not packable. */
export function packAan(aan: string): Uint8Array {
  const norm = aan.trim().toUpperCase();
  const m = AAN_PATTERN.exec(norm);
  if (!m || !isPackableAan(norm)) throw new Error(`Not a packable AAN: ${aan}`);
  const out = new Uint8Array(AAN_PACKED_LENGTH);
  const s = { pos: 0 };
  writeBits(out, s, AAN_COUNTRY_CODES[m[1]], 8);
  writeBits(out, s, Number(m[2]), 4);
  writeBits(out, s, Number(m[3]), 7);
  for (const c of m[4]) writeBits(out, s, AAN_ALPHABET.indexOf(c), 5);
  return out; // trailing 7 bits stay zero
}

/** Unpack 7 bytes back to an AAN string, or null if the bytes are invalid. */
export function unpackAan(bytes: Uint8Array): string | null {
  if (bytes.length < AAN_PACKED_LENGTH) return null;
  const s = { pos: 0 };
  const cc = COUNTRY_BY_CODE[readBits(bytes, s, 8)];
  const month = readBits(bytes, s, 4);
  const year = readBits(bytes, s, 7);
  if (!cc || month < 1 || month > 12 || year > 99) return null;
  let seq = '';
  for (let i = 0; i < 6; i++) seq += AAN_ALPHABET[readBits(bytes, s, 5)];
  return `${cc}-${String(month).padStart(2, '0')}${String(year).padStart(2, '0')}-${seq}`;
}

/* ------------------------------ frame codec ------------------------------ */

export function encodeNgarenFrame(input: {
  aan: string;
  lowBattery?: boolean;
  motionDetected?: boolean;
  battery?: number | null;
  counter?: number;
  motionCount?: number | null;
  temperature?: number | null;
}): Uint8Array {
  const out = new Uint8Array(NGAREN_FRAME_LENGTH);
  out[0] = NGAREN_FRAME_MARKER;
  const flags = (input.lowBattery ? FLAG_LOW_BATTERY : 0) | (input.motionDetected ? FLAG_MOTION : 0);
  out[1] = (NGAREN_FRAME_VERSION << 4) | flags;
  out.set(packAan(input.aan), 2);
  out[9] = input.battery == null ? BATTERY_UNKNOWN : Math.max(0, Math.min(100, Math.round(input.battery)));
  const counter = (input.counter ?? 0) & 0xffff;
  out[10] = counter >> 8;
  out[11] = counter & 0xff;
  out[12] = input.motionCount == null ? MOTION_UNSUPPORTED : Math.max(0, Math.min(254, Math.round(input.motionCount)));
  const temp = input.temperature == null ? TEMPERATURE_UNSUPPORTED : Math.max(-127, Math.min(127, Math.round(input.temperature)));
  out[13] = temp & 0xff;
  return out;
}

/** Decode a 14-byte payload starting at the marker; null if it isn't ours. */
export function decodeNgarenFrame(payload: Uint8Array): NgarenFrame | null {
  if (payload.length < NGAREN_FRAME_LENGTH || payload[0] !== NGAREN_FRAME_MARKER) return null;
  const version = payload[1] >> 4;
  if (version !== NGAREN_FRAME_VERSION) return null;
  const aan = unpackAan(payload.subarray(2, 2 + AAN_PACKED_LENGTH));
  if (!aan) return null;
  const flags = payload[1] & 0x0f;
  const tempRaw = payload[13] > 127 ? payload[13] - 256 : payload[13];
  return {
    version,
    aan,
    lowBattery: (flags & FLAG_LOW_BATTERY) !== 0,
    motionDetected: (flags & FLAG_MOTION) !== 0,
    battery: payload[9] === BATTERY_UNKNOWN ? null : payload[9],
    counter: (payload[10] << 8) | payload[11],
    motionCount: payload[12] === MOTION_UNSUPPORTED ? null : payload[12],
    temperature: tempRaw === TEMPERATURE_UNSUPPORTED ? null : tempRaw,
  };
}

/**
 * Find our frame inside raw Manufacturer Specific Data. Accepts the data with
 * or without the leading 2-byte company identifier (scanners differ).
 */
export function findNgarenFrame(manufacturerData: Uint8Array): NgarenFrame | null {
  return decodeNgarenFrame(manufacturerData) ?? (manufacturerData.length >= 2 ? decodeNgarenFrame(manufacturerData.subarray(2)) : null);
}

/* ------------------------------ identity --------------------------------- */

/** The AAN carried in an advertising name (NFC-written fallback), or null. */
export function aanFromAdvName(name: string | null | undefined): string | null {
  const n = (name ?? '').trim().toUpperCase();
  return AAN_PATTERN.test(n) ? n : null;
}

/** Normalise a MAC to `AA:BB:CC:DD:EE:FF`, or null if it isn't one. */
export function normalizeBleMac(mac: string | null | undefined): string | null {
  const hex = (mac ?? '').replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  if (hex.length !== 12) return null;
  return hex.match(/.{2}/g)!.join(':');
}

export function isValidBleMac(mac: string | null | undefined): boolean {
  return normalizeBleMac(mac) != null;
}

/** Hex string (`4E 10 …`) for logs and the spec's worked example. */
export function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}
