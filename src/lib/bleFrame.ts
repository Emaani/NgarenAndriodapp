/**
 * Ngaren BLE custom frame codec (ELA Innovation BAF firmware) — spec
 * NGR-BLE-001 v1.1 (Oct 27 2026).
 *
 * ELA confirmed that Blue COIN / Blue PUCK tags have a STATIC identity (fixed
 * MAC + advertising name, the name changeable only over NFC) and that BAF can
 * carry a custom payload. v1.1 follows ELA's further constraints:
 *  - a tag is EITHER a MOV (motion) OR a T (temperature) variant, never both,
 *    so the sensor field's meaning depends on the variant;
 *  - battery is NOT in our payload — ELA tags report it in millivolts in the
 *    SCAN RESPONSE (when "Battery voltage presence" is enabled), or only as a
 *    ≤15% alert when it isn't. The scanner layer reads it (see bleResolve).
 * This module is the single source of truth: the spec sent to ELA R&D
 * describes exactly what is implemented and tested here.
 *
 * The payload sits in Manufacturer Specific Data (AD type 0xFF), after ELA's
 * 2-byte company identifier. 13 bytes, big-endian:
 *
 *   0      Frame marker 0x4E ('N')
 *   1      Version (high nibble, = 1) | tag variant (low nibble: 0 ID, 1 MOV, 2 T)
 *   2–8    AAN, bit-packed (country 8b, month 4b, year 7b, sequence 30b = 49b,
 *          zero-padded to 56b)
 *   9–10   Rolling frame counter, uint16; 0xFFFF = not supported
 *   11–12  Sensor value, by variant; 0x8000 = none (ID tags):
 *            MOV → movement events since the previous frame, uint16
 *            T   → temperature in 0.01 °C, int16 (two's complement)
 *
 * Identity can be resolved three ways, in order of preference: the custom
 * frame's AAN, an AAN written into the advertising name, or the static MAC
 * mapped to an AAN (registration, or ELA's factory MAC↔AAN list).
 */
import { AAN_ALPHABET } from './ngaren';

export const NGAREN_FRAME_MARKER = 0x4e;
export const NGAREN_FRAME_VERSION = 1;
export const NGAREN_FRAME_LENGTH = 13;
export const AAN_PACKED_LENGTH = 7;

/** ELA tag variants — a tag carries motion OR temperature, never both. */
export type TagVariant = 'id' | 'mov' | 't';
export const TAG_VARIANT_CODES: Record<TagVariant, number> = { id: 0, mov: 1, t: 2 };
const VARIANT_BY_CODE: Record<number, TagVariant> = { 0: 'id', 1: 'mov', 2: 't' };

export const COUNTER_UNSUPPORTED = 0xffff;
export const SENSOR_NONE = 0x8000;

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
  variant: TagVariant;
  aan: string;
  /** Rolling counter, or null when the firmware doesn't provide one. */
  counter: number | null;
  /** MOV tags: movement events since the previous frame. */
  motionCount: number | null;
  /** T tags: temperature, °C (0.01 resolution). */
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

/**
 * Encode a payload. A motion count is only valid on a MOV tag and a
 * temperature only on a T tag (ELA: one tag can't carry both) — passing a
 * reading the variant can't produce throws.
 */
export function encodeNgarenFrame(input: {
  aan: string;
  variant?: TagVariant;
  counter?: number | null;
  motionCount?: number | null;
  temperature?: number | null;
}): Uint8Array {
  const variant = input.variant ?? 'id';
  if (input.motionCount != null && variant !== 'mov') throw new Error('Motion count needs a MOV tag');
  if (input.temperature != null && variant !== 't') throw new Error('Temperature needs a T tag');

  const out = new Uint8Array(NGAREN_FRAME_LENGTH);
  out[0] = NGAREN_FRAME_MARKER;
  out[1] = (NGAREN_FRAME_VERSION << 4) | TAG_VARIANT_CODES[variant];
  out.set(packAan(input.aan), 2);

  const counter = input.counter == null ? COUNTER_UNSUPPORTED : Math.max(0, Math.min(0xfffe, Math.round(input.counter)));
  out[9] = counter >> 8;
  out[10] = counter & 0xff;

  let sensor = SENSOR_NONE;
  if (variant === 'mov' && input.motionCount != null) {
    sensor = Math.max(0, Math.min(0x7fff, Math.round(input.motionCount)));
  } else if (variant === 't' && input.temperature != null) {
    sensor = Math.max(-0x7fff, Math.min(0x7fff, Math.round(input.temperature * 100))) & 0xffff;
  }
  out[11] = sensor >> 8;
  out[12] = sensor & 0xff;
  return out;
}

/** Decode a 13-byte payload starting at the marker; null if it isn't ours. */
export function decodeNgarenFrame(payload: Uint8Array): NgarenFrame | null {
  if (payload.length < NGAREN_FRAME_LENGTH || payload[0] !== NGAREN_FRAME_MARKER) return null;
  const version = payload[1] >> 4;
  const variant = VARIANT_BY_CODE[payload[1] & 0x0f];
  if (version !== NGAREN_FRAME_VERSION || !variant) return null;
  const aan = unpackAan(payload.subarray(2, 2 + AAN_PACKED_LENGTH));
  if (!aan) return null;

  const counter = (payload[9] << 8) | payload[10];
  const sensorRaw = (payload[11] << 8) | payload[12];
  const hasSensor = sensorRaw !== SENSOR_NONE;
  const signed = sensorRaw > 0x7fff ? sensorRaw - 0x10000 : sensorRaw;
  return {
    version,
    variant,
    aan,
    counter: counter === COUNTER_UNSUPPORTED ? null : counter,
    motionCount: variant === 'mov' && hasSensor ? sensorRaw : null,
    temperature: variant === 't' && hasSensor ? signed / 100 : null,
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
