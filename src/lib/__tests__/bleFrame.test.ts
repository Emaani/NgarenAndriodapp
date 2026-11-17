import {
  aanFromAdvName,
  decodeNgarenFrame,
  encodeNgarenFrame,
  findNgarenFrame,
  isPackableAan,
  movementEventsBetween,
  normalizeBleMac,
  packAan,
  toHex,
  u16Delta,
  unpackAan,
} from '@/lib/bleFrame';
import { generateNgarenCode } from '@/lib/ngaren';

// Reference vectors (spec NGR-BLE-001 v1.2) — computed independently (Python)
// and quoted verbatim in the spec + payload examples sent to ELA R&D, so the
// app and the spec can't drift apart.
const REF_AAN = 'UG-1026-K7Q2MX';
const REF_PACKED = '01 A3 53 3D C5 4E 80';
const REF_ID = '4E 10 01 A3 53 3D C5 4E 80 04 D2 80 00';
const REF_MOV = '4E 11 01 A3 53 3D C5 4E 80 04 D2 00 03';
const REF_T = '4E 12 01 A3 53 3D C5 4E 80 04 D2 0E F1';
// v1.2: 0xFFFF is an ordinary counter value (65535), the step before the wrap.
const REF_T_NEG_COUNTER_MAX = '4E 12 01 A3 53 3D C5 4E 80 FF FF FD DA';
const REF_MOV_WRAPPED = '4E 11 01 A3 53 3D C5 4E 80 00 3B 00 07';

describe('AAN bit-packing', () => {
  it('packs the reference AAN into the documented 7 bytes', () => {
    expect(toHex(packAan(REF_AAN))).toBe(REF_PACKED);
  });

  it('round-trips generated AANs across countries', () => {
    for (const cc of ['UG', 'KE', 'TZ', 'ZA']) {
      for (let i = 0; i < 50; i++) {
        const aan = generateNgarenCode(cc);
        expect(unpackAan(packAan(aan))).toBe(aan);
      }
    }
  });

  it('rejects unpackable AANs', () => {
    expect(isPackableAan('XX-1026-K7Q2MX')).toBe(false); // unknown country
    expect(isPackableAan('UG-1326-K7Q2MX')).toBe(false); // month 13
    expect(isPackableAan('UG-1026-K7Q2MI')).toBe(false); // 'I' not in alphabet
    expect(() => packAan('not-an-aan')).toThrow();
  });
});

describe('Ngaren custom frame (v1.2)', () => {
  it('encodes the documented ID / MOV / T reference frames', () => {
    expect(toHex(encodeNgarenFrame({ aan: REF_AAN, variant: 'id', counter: 1234 }))).toBe(REF_ID);
    expect(toHex(encodeNgarenFrame({ aan: REF_AAN, variant: 'mov', counter: 1234, movementTotal: 3 }))).toBe(REF_MOV);
    expect(toHex(encodeNgarenFrame({ aan: REF_AAN, variant: 't', counter: 1234, temperature: 38.25 }))).toBe(REF_T);
    expect(toHex(encodeNgarenFrame({ aan: REF_AAN, variant: 't', counter: 0xffff, temperature: -5.5 }))).toBe(REF_T_NEG_COUNTER_MAX);
    expect(toHex(encodeNgarenFrame({ aan: REF_AAN, variant: 'mov', counter: 65_536 + 59, movementTotal: 7 }))).toBe(REF_MOV_WRAPPED);
  });

  it('puts version 1 in the high nibble of byte 1: 0x10 ID, 0x11 MOV, 0x12 T', () => {
    expect(encodeNgarenFrame({ aan: REF_AAN, variant: 'id' })[1]).toBe(0x10);
    expect(encodeNgarenFrame({ aan: REF_AAN, variant: 'mov' })[1]).toBe(0x11);
    expect(encodeNgarenFrame({ aan: REF_AAN, variant: 't' })[1]).toBe(0x12);
  });

  it('decodes each variant back to its reading', () => {
    const id = decodeNgarenFrame(encodeNgarenFrame({ aan: REF_AAN, counter: 1234 }));
    expect(id).toEqual({ version: 1, variant: 'id', aan: REF_AAN, counter: 1234, movementTotal: null, temperature: null });
    const mov = decodeNgarenFrame(encodeNgarenFrame({ aan: REF_AAN, variant: 'mov', counter: 7, movementTotal: 3 }))!;
    expect(mov).toMatchObject({ variant: 'mov', movementTotal: 3, temperature: null });
    const t = decodeNgarenFrame(encodeNgarenFrame({ aan: REF_AAN, variant: 't', counter: 0xffff, temperature: -5.5 }))!;
    expect(t).toMatchObject({ variant: 't', temperature: -5.5, movementTotal: null, counter: 65535 });
  });

  it('treats 0xFFFF as a normal counter value and 0x8000 as a real MOV count', () => {
    expect(decodeNgarenFrame(encodeNgarenFrame({ aan: REF_AAN, counter: 0xffff }))!.counter).toBe(65535);
    expect(decodeNgarenFrame(encodeNgarenFrame({ aan: REF_AAN, variant: 'mov', movementTotal: 0x8000 }))!.movementTotal).toBe(32768);
    expect(decodeNgarenFrame(encodeNgarenFrame({ aan: REF_AAN, variant: 't' }))!.temperature).toBeNull();
  });

  it('rejects a reading the tag variant cannot produce (no motion + temperature on one tag)', () => {
    expect(() => encodeNgarenFrame({ aan: REF_AAN, variant: 'mov', temperature: 30 })).toThrow();
    expect(() => encodeNgarenFrame({ aan: REF_AAN, variant: 't', movementTotal: 2 })).toThrow();
    expect(() => encodeNgarenFrame({ aan: REF_AAN, movementTotal: 2 })).toThrow();
  });

  it('finds the frame with or without the 2-byte company id prefix', () => {
    const frame = encodeNgarenFrame({ aan: REF_AAN, counter: 1234 });
    const withCompany = new Uint8Array([0x34, 0x12, ...frame]);
    expect(findNgarenFrame(frame)?.aan).toBe(REF_AAN);
    expect(findNgarenFrame(withCompany)?.aan).toBe(REF_AAN);
  });

  it('ignores foreign frames', () => {
    expect(decodeNgarenFrame(new Uint8Array(13))).toBeNull();
    expect(findNgarenFrame(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

describe('counter arithmetic (ELA BAF: uint16, wraps 0xFFFF → 0x0000)', () => {
  it('counts across the wrap', () => {
    expect(u16Delta(65535, 0)).toBe(1);
    expect(u16Delta(65500, 59)).toBe(95);
    expect(u16Delta(1234, 1294)).toBe(60);
  });

  it('gives movement events between two frames from the cumulative count', () => {
    // 60 frames at 5 s = 5 minutes; total went 3 → 7.
    expect(movementEventsBetween({ counter: 1234, movementTotal: 3 }, { counter: 1294, movementTotal: 7 }, { elapsedSec: 300, periodSec: 5 }))
      .toEqual({ events: 4, restarted: false });
    // Both counters wrapped in between.
    expect(movementEventsBetween({ counter: 65500, movementTotal: 65534 }, { counter: 59, movementTotal: 2 }))
      .toEqual({ events: 4, restarted: false });
  });

  it('spots a tag restart when the frame counter does not match the elapsed time', () => {
    // 10 minutes at 5 s should be ~120 frames, but the counter is back near 0.
    expect(movementEventsBetween({ counter: 40000, movementTotal: 900 }, { counter: 30, movementTotal: 2 }, { elapsedSec: 600, periodSec: 5 }))
      .toEqual({ events: 2, restarted: true });
  });

  it('returns null for frames that are not from a MOV tag', () => {
    expect(movementEventsBetween({ counter: 1, movementTotal: null }, { counter: 2, movementTotal: 3 })).toBeNull();
  });
});

describe('identity helpers', () => {
  it('normalises MAC addresses', () => {
    expect(normalizeBleMac('aa-bb-cc-dd-ee-ff')).toBe('AA:BB:CC:DD:EE:FF');
    expect(normalizeBleMac('AABBCCDDEEFF')).toBe('AA:BB:CC:DD:EE:FF');
    expect(normalizeBleMac('CRS-00142')).toBeNull();
  });

  it('reads an AAN from an NFC-written advertising name', () => {
    expect(aanFromAdvName('ug-1026-k7q2mx')).toBe(REF_AAN);
    expect(aanFromAdvName('P COIN 0A1B2C')).toBeNull();
  });
});
