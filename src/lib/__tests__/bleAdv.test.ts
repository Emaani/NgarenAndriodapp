import { encodeNgarenFrame, findNgarenFrame } from '@/lib/bleFrame';
import { ELA_COMPANY_ID, parseAdStructures, parseElaAdvertisement } from '@/lib/bleAdv';

// Byte layouts from ELA's battery-frame documentation (Nov 18 2026).
const FLAGS = [0x02, 0x01, 0x06];
const ngarenFrame = () => [0x10, 0xff, 0x57, 0x07, ...encodeNgarenFrame({ aan: 'UG-1026-K7Q2MX', counter: 1234 })];
const batteryVoltage = (mv: number) => [0x06, 0xff, 0x57, 0x07, 0xf2, mv & 0xff, mv >> 8];

describe('ELA advertising data', () => {
  it('uses company id 0x0757 (57 07 on air)', () => {
    expect(ELA_COMPANY_ID).toBe(0x0757);
  });

  it('splits a scan record into AD structures and stops at zero padding', () => {
    const ads = parseAdStructures(new Uint8Array([...FLAGS, ...batteryVoltage(3000), 0, 0, 0]));
    expect(ads.map((a) => a.type)).toEqual([0x01, 0xff]);
  });

  it('keeps the custom frame AND the scan-response battery mV, though both use 0x0757', () => {
    // Advertisement followed by scan response, as Android delivers it.
    const ela = parseElaAdvertisement(new Uint8Array([...FLAGS, ...ngarenFrame(), ...batteryVoltage(3021)]));
    expect(ela.batteryMv).toBe(3021); // 0x0BCD → CD 0B on air
    expect(ela.manufacturerData).toHaveLength(2);
    expect(ela.manufacturerData.map((m) => findNgarenFrame(m)?.aan ?? null)).toEqual(['UG-1026-K7Q2MX', null]);
    expect(ela.lowBatteryPercent).toBeNull();
  });

  it('reads the < 15 % alert in all three ELA formats', () => {
    expect(parseElaAdvertisement(new Uint8Array([0x05, 0xff, 0x57, 0x07, 0xf1, 12])).lowBatteryPercent).toBe(12);
    expect(parseElaAdvertisement(new Uint8Array([0x04, 0x16, 0x19, 0x2a, 9])).lowBatteryPercent).toBe(9);
    expect(parseElaAdvertisement(new Uint8Array([0x04, 0x16, 0x0f, 0x18, 7])).lowBatteryPercent).toBe(7);
  });

  it('ignores other companies and truncated structures', () => {
    const ela = parseElaAdvertisement(new Uint8Array([0x06, 0xff, 0x4c, 0x00, 0xf2, 0x10, 0x0b, 0x09, 0xff, 0x57]));
    expect(ela.batteryMv).toBeNull();
    expect(ela.manufacturerData).toHaveLength(1);
  });
});
