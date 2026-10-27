import {
  aanFromAdvName,
  decodeNgarenFrame,
  encodeNgarenFrame,
  findNgarenFrame,
  isPackableAan,
  normalizeBleMac,
  packAan,
  toHex,
  unpackAan,
} from '@/lib/bleFrame';
import { generateNgarenCode } from '@/lib/ngaren';

// Reference vectors (spec NGR-BLE-001 v1.1) — computed independently (Python)
// and quoted verbatim in the spec + payload examples sent to ELA R&D, so the
// app and the spec can't drift apart.
const REF_AAN = 'UG-1026-K7Q2MX';
const REF_PACKED = '01 A3 53 3D C5 4E 80';
const REF_ID = '4E 10 01 A3 53 3D C5 4E 80 04 D2 80 00';
const REF_MOV = '4E 11 01 A3 53 3D C5 4E 80 04 D2 00 03';
const REF_T = '4E 12 01 A3 53 3D C5 4E 80 04 D2 0E F1';
const REF_T_NEG_NO_COUNTER = '4E 12 01 A3 53 3D C5 4E 80 FF FF FD DA';

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

describe('Ngaren custom frame (v1.1)', () => {
  it('encodes the documented ID / MOV / T reference frames', () => {
    expect(toHex(encodeNgarenFrame({ aan: REF_AAN, variant: 'id', counter: 1234 }))).toBe(REF_ID);
    expect(toHex(encodeNgarenFrame({ aan: REF_AAN, variant: 'mov', counter: 1234, motionCount: 3 }))).toBe(REF_MOV);
    expect(toHex(encodeNgarenFrame({ aan: REF_AAN, variant: 't', counter: 1234, temperature: 38.25 }))).toBe(REF_T);
    expect(toHex(encodeNgarenFrame({ aan: REF_AAN, variant: 't', temperature: -5.5 }))).toBe(REF_T_NEG_NO_COUNTER);
  });

  it('decodes each variant back to its reading', () => {
    const id = decodeNgarenFrame(encodeNgarenFrame({ aan: REF_AAN, counter: 1234 }));
    expect(id).toEqual({ version: 1, variant: 'id', aan: REF_AAN, counter: 1234, motionCount: null, temperature: null });
    const mov = decodeNgarenFrame(encodeNgarenFrame({ aan: REF_AAN, variant: 'mov', counter: 7, motionCount: 3 }))!;
    expect(mov).toMatchObject({ variant: 'mov', motionCount: 3, temperature: null });
    const t = decodeNgarenFrame(encodeNgarenFrame({ aan: REF_AAN, variant: 't', temperature: -5.5 }))!;
    expect(t).toMatchObject({ variant: 't', temperature: -5.5, motionCount: null, counter: null });
  });

  it('rejects a reading the tag variant cannot produce (no motion + temperature on one tag)', () => {
    expect(() => encodeNgarenFrame({ aan: REF_AAN, variant: 'mov', temperature: 30 })).toThrow();
    expect(() => encodeNgarenFrame({ aan: REF_AAN, variant: 't', motionCount: 2 })).toThrow();
    expect(() => encodeNgarenFrame({ aan: REF_AAN, motionCount: 2 })).toThrow();
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
