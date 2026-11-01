import { bytesFromBase64, encodeNgarenFrame, toHex } from '@/lib/bleFrame';
import { buildMacIndex, matchToHerd, nearestTags, NearbyTag, noteNearbyTag, resolveDetection } from '@/lib/bleResolve';
import { confirmationKey, confirmationSummary, mergeConfirmations, TagConfirmation } from '@/lib/tagConfirmation';

const seenAt = '2026-11-01T08:00:00.000Z';
const herd = [
  { id: 1, ngarenCode: 'UG-1026-K7Q2MX', devices: [{ type: 'ELA Blue COIN ID', serial: 'AA:BB:CC:DD:EE:01', bleMac: 'AA:BB:CC:DD:EE:01' }] },
  { id: 2, ngarenCode: 'UG-1026-B4C5D6', devices: [{ type: 'ELA Blue COIN ID', serial: 'AA:BB:CC:DD:EE:02', bleMac: 'AA:BB:CC:DD:EE:02' }] },
];
const macIndex = buildMacIndex(herd);
const byAan = new Map(herd.map((a) => [a.ngarenCode, a.id]));
const read = (mac: string, manufacturerData?: Uint8Array) => resolveDetection({ mac, manufacturerData, seenAt }, macIndex);

describe('bytesFromBase64', () => {
  it('decodes all padding lengths', () => {
    expect(toHex(bytesFromBase64('TmdhcmVu')!)).toBe('4E 67 61 72 65 6E');
    expect(toHex(bytesFromBase64('Tmc=')!)).toBe('4E 67');
    expect(toHex(bytesFromBase64('Tg==')!)).toBe('4E');
  });

  it('decodes the Ngaren frame as a BLE stack delivers it', () => {
    const frame = encodeNgarenFrame({ aan: 'UG-1026-K7Q2MX', counter: 1234 });
    const wire = Buffer.from(frame).toString('base64');
    expect(toHex(bytesFromBase64(wire)!)).toBe(toHex(frame));
  });

  it('returns null for empty or malformed input', () => {
    expect(bytesFromBase64(null)).toBeNull();
    expect(bytesFromBase64('')).toBeNull();
    expect(bytesFromBase64('a$b!')).toBeNull();
  });
});

describe('matchToHerd', () => {
  it('matches a registered MAC to its animal', () => {
    expect(matchToHerd(read('aa:bb:cc:dd:ee:02'), byAan)).toEqual({ kind: 'match', animalId: 2 });
  });

  it('never counts a tag reporting a different animal', () => {
    const frame = encodeNgarenFrame({ aan: 'UG-1026-K7Q2MX' });
    expect(matchToHerd(read('AA:BB:CC:DD:EE:02', frame), byAan)).toEqual({ kind: 'mismatch' });
  });

  it('flags Ngaren tags from another herd and ignores other Bluetooth devices', () => {
    const frame = encodeNgarenFrame({ aan: 'UG-1026-ZZZZZZ' });
    expect(matchToHerd(read('11:22:33:44:55:66', frame), byAan)).toEqual({ kind: 'foreign' });
    expect(matchToHerd(read('11:22:33:44:55:77'), byAan)).toEqual({ kind: 'ignored' });
  });
});

describe('nearby tags', () => {
  const sighted = (detections: { mac: string; name?: string; rssi?: number }[]) => {
    const found = new Map<string, NearbyTag>();
    for (const d of detections) noteNearbyTag(found, { ...d, seenAt });
    return found;
  };

  it('keeps the strongest signal and a name from any advert', () => {
    const found = sighted([
      { mac: 'aa:bb:cc:dd:ee:03', name: 'P_TAG', rssi: -80 },
      { mac: 'AA:BB:CC:DD:EE:03', rssi: -50 },
    ]);
    expect(found.get('AA:BB:CC:DD:EE:03')).toEqual({ mac: 'AA:BB:CC:DD:EE:03', name: 'P_TAG', rssi: -50 });
  });

  it('lists the closest first, leaving out tags already in use', () => {
    const found = sighted([
      { mac: 'AA:BB:CC:DD:EE:03', rssi: -80 },
      { mac: 'AA:BB:CC:DD:EE:04', rssi: -40 },
      { mac: 'AA:BB:CC:DD:EE:05', rssi: -30 },
    ]);
    const list = nearestTags(found, new Set(['AA:BB:CC:DD:EE:05']));
    expect(list.map((tag) => tag.mac)).toEqual(['AA:BB:CC:DD:EE:04', 'AA:BB:CC:DD:EE:03']);
  });

  it('ignores devices that report no usable address', () => {
    expect(sighted([{ mac: 'not-a-mac', rssi: -40 }]).size).toBe(0);
  });
});

describe('tag confirmations', () => {
  const base: TagConfirmation = { animalKey: 'UG-1026-K7Q2MX', at: '2026-11-01T08:00:00.000Z', by: 'Job', via: 'ble' };

  it('keeps the newest confirmation per animal', () => {
    const newer = { ...base, at: '2026-11-02T08:00:00.000Z', via: 'manual' as const };
    expect(mergeConfirmations({}, [base, newer])[base.animalKey]).toEqual(newer);
    expect(mergeConfirmations({ [base.animalKey]: newer }, [base])[base.animalKey]).toEqual(newer);
  });

  it('keys an animal by its AAN first', () => {
    expect(confirmationKey({ ngarenCode: 'UG-1', accountNumber: 'A', tag: 'T' })).toBe('UG-1');
    expect(confirmationKey({ tag: 'T' })).toBe('T');
  });

  it('summarises how and where, preferring the named location', () => {
    const t = (k: string) => k;
    expect(confirmationSummary({ ...base, locationName: 'Kraal A', lat: 0.1, lng: 32.1 }, t)).toContain('confirm.via.ble · Kraal A');
    expect(confirmationSummary({ ...base, lat: 0.34761, lng: 32.58252 }, t)).toContain('0.3476, 32.5825');
  });
});
