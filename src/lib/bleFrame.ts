/**
 * Ngaren BLE custom frame codec (ELA Innovation BAF firmware) — spec
 * NGR-BLE-001 v1.2 (Nov 17 2026), following ELA R&D's review of v1.1.
 *
 * ELA confirmed that Blue COIN / Blue PUCK tags have a STATIC identity (fixed
 * MAC + advertising name, the name changeable only over NFC) and that BAF can
 * carry a custom payload — as three custom frames, one per tag variant (ID,
 * MOV, T), all with this 13-byte layout. Constraints:
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
 *          → the whole byte is 0x10 (ID), 0x11 (MOV) or 0x12 (T)
 *   2–8    AAN, bit-packed (country 8b, month 4b, year 7b, sequence 30b = 49b,
 *          zero-padded to 56b)
 *   9–10   Rolling frame counter, uint16, full range: after 0xFFFF it wraps to
 *          0x0000 (ELA BAF behaviour). Readers work modulo 65 536.
 *   11–12  Sensor value, by variant:
 *            ID  → 0x8000 (no sensor; ignored)
 *            MOV → cumulative movement events since the tag's last startup,
 *                  uint16, wrapping after 0xFFFF; readers subtract the previous
 *                  frame's value (modulo 65 536) to get events in between
 *            T   → temperature in 0.01 °C, int16 (two's complement); 0x8000 = no reading
 *
 * v1.1 → v1.2: 0xFFFF is now a normal counter value (no "unsupported"
 * sentinel), and MOV carries ELA's cumulative count instead of a per-frame count.
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

/** No sensor (ID) / no temperature reading (T). Never used for MOV, whose count uses the full uint16 range. */
export const SENSOR_NONE = 0x8000;
/** Counters are uint16 and wrap from 0xFFFF to 0x0000. */
export const U16_RANGE = 0x10000;

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
  /** Rolling frame counter, 0–65535 (wraps). */
  counter: number;
  /** MOV tags: cumulative movement events since the tag's last startup (wraps at 65536). */
  movementTotal: number | null;
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

/** A value reduced to the uint16 range, the way the tag's counters wrap. */
const toU16 = (n: number) => ((Math.round(n) % U16_RANGE) + U16_RANGE) % U16_RANGE;

/**
 * Encode a payload. A movement count is only valid on a MOV tag and a
 * temperature only on a T tag (ELA: one tag can't carry both) — passing a
 * reading the variant can't produce throws. Counters wrap like the tag's.
 */
export function encodeNgarenFrame(input: {
  aan: string;
  variant?: TagVariant;
  counter?: number;
  movementTotal?: number | null;
  temperature?: number | null;
}): Uint8Array {
  const variant = input.variant ?? 'id';
  if (input.movementTotal != null && variant !== 'mov') throw new Error('Movement count needs a MOV tag');
  if (input.temperature != null && variant !== 't') throw new Error('Temperature needs a T tag');

  const out = new Uint8Array(NGAREN_FRAME_LENGTH);
  out[0] = NGAREN_FRAME_MARKER;
  out[1] = (NGAREN_FRAME_VERSION << 4) | TAG_VARIANT_CODES[variant];
  out.set(packAan(input.aan), 2);

  const counter = toU16(input.counter ?? 0);
  out[9] = counter >> 8;
  out[10] = counter & 0xff;

  let sensor = SENSOR_NONE;
  if (variant === 'mov') {
    sensor = toU16(input.movementTotal ?? 0);
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
  const signed = sensorRaw > 0x7fff ? sensorRaw - U16_RANGE : sensorRaw;
  return {
    version,
    variant,
    aan,
    counter,
    // MOV uses the full uint16 range, so 0x8000 is a real count there.
    movementTotal: variant === 'mov' ? sensorRaw : null,
    temperature: variant === 't' && sensorRaw !== SENSOR_NONE ? signed / 100 : null,
  };
}

/* --------------------------- counter arithmetic -------------------------- */

/** Steps from `prev` to `cur` on a uint16 counter that wraps after 0xFFFF. */
export function u16Delta(prev: number, cur: number): number {
  return toU16(cur - prev);
}

/**
 * Movement events between two frames from the same MOV tag (ELA: the count is
 * cumulative since the tag's last startup). Subtracts modulo 65 536.
 *
 * When the time between the frames and the advertising period are known, the
 * frame counter is checked against the elapsed time: a counter that didn't
 * advance by about elapsed/period means the tag restarted in between, and the
 * current total is then the events since that restart (a lower bound).
 * Assumes both counters restart from 0 at startup — to be confirmed by ELA.
 */
export function movementEventsBetween(
  prev: Pick<NgarenFrame, 'counter' | 'movementTotal'>,
  cur: Pick<NgarenFrame, 'counter' | 'movementTotal'>,
  timing?: { elapsedSec: number; periodSec: number },
): { events: number; restarted: boolean } | null {
  if (prev.movementTotal == null || cur.movementTotal == null) return null;
  if (timing && timing.periodSec > 0 && timing.elapsedSec >= 0) {
    const expected = timing.elapsedSec / timing.periodSec;
    // Beyond one wrap the counter can't be checked against the clock.
    if (expected < U16_RANGE - 1) {
      const frames = u16Delta(prev.counter, cur.counter);
      const slack = Math.max(3, expected * 0.2);
      if (Math.abs(frames - expected) > slack) return { events: cur.movementTotal, restarted: true };
    }
  }
  return { events: u16Delta(prev.movementTotal, cur.movementTotal), restarted: false };
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
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Decode base64 (how BLE stacks hand over Manufacturer Specific Data). */
export function bytesFromBase64(input: string | null | undefined): Uint8Array | null {
  const clean = (input ?? '').replace(/=+$/, '');
  if (!clean || clean.length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let written = 0;
  for (const ch of clean) {
    const value = BASE64_ALPHABET.indexOf(ch);
    if (value < 0) return null;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[written++] = (buffer >> bits) & 0xff;
      buffer &= (1 << bits) - 1;
    }
  }
  return out;
}

export function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}
