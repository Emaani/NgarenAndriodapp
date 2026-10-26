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

// Reference vector — computed independently (Python) and quoted verbatim in the
// frame spec sent to ELA R&D, so the app and the spec can't drift apart.
const REF_AAN = 'UG-1026-K7Q2MX';
const REF_PACKED = '01 A3 53 3D C5 4E 80';
const REF_FRAME = '4E 12 01 A3 53 3D C5 4E 80 57 04 D2 03 1F';

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

describe('Ngaren custom frame', () => {
  const input = { aan: REF_AAN, motionDetected: true, battery: 87, counter: 1234, motionCount: 3, temperature: 31 };

  it('encodes the documented reference frame', () => {
    expect(toHex(encodeNgarenFrame(input))).toBe(REF_FRAME);
  });

  it('decodes what it encodes', () => {
    expect(decodeNgarenFrame(encodeNgarenFrame(input))).toEqual({
      version: 1,
      aan: REF_AAN,
      lowBattery: false,
      motionDetected: true,
      battery: 87,
      counter: 1234,
      motionCount: 3,
      temperature: 31,
    });
  });

  it('encodes negative temperatures and "not supported" sentinels', () => {
    const f = decodeNgarenFrame(encodeNgarenFrame({ aan: REF_AAN, temperature: -5 }))!;
    expect(f.temperature).toBe(-5);
    expect(f.battery).toBeNull();
    expect(f.motionCount).toBeNull();
    const bare = decodeNgarenFrame(encodeNgarenFrame({ aan: REF_AAN }))!;
    expect(bare.temperature).toBeNull();
  });

  it('finds the frame with or without the 2-byte company id prefix', () => {
    const frame = encodeNgarenFrame(input);
    const withCompany = new Uint8Array([0x34, 0x12, ...frame]);
    expect(findNgarenFrame(frame)?.aan).toBe(REF_AAN);
    expect(findNgarenFrame(withCompany)?.aan).toBe(REF_AAN);
  });

  it('ignores foreign frames', () => {
    expect(decodeNgarenFrame(new Uint8Array(14))).toBeNull();
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
