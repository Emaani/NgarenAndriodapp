import { encodeNgarenFrame } from '@/lib/bleFrame';
import { buildMacIndex, makeDeduper, resolveDetection } from '@/lib/bleResolve';

const herd = [
  { ngarenCode: 'UG-1026-K7Q2MX', devices: [{ type: 'ELA Blue COIN ID', serial: 'AA:BB:CC:DD:EE:01', bleMac: 'AA:BB:CC:DD:EE:01' }] },
  { ngarenCode: 'UG-1026-B4C5D6', devices: [{ type: 'Bluetooth', serial: 'aabbccddee02' }] },
  // A satellite serial that happens to be 12 hex digits must NOT become a MAC.
  { ngarenCode: 'UG-1026-SAT001', devices: [{ type: 'Ceres Gen6', serial: '123456789012' }] },
];
const index = buildMacIndex(herd);
const now = '2026-10-26T10:00:00.000Z';

describe('buildMacIndex', () => {
  it('binds static BLE MACs to AANs and skips satellite serials', () => {
    expect(index.get('AA:BB:CC:DD:EE:01')).toBe('UG-1026-K7Q2MX');
    expect(index.get('AA:BB:CC:DD:EE:02')).toBe('UG-1026-B4C5D6');
    expect(index.has('12:34:56:78:90:12')).toBe(false);
  });
});

describe('resolveDetection', () => {
  it('resolves via the custom frame, with battery from the scan response', () => {
    const r = resolveDetection(
      {
        mac: 'aa:bb:cc:dd:ee:01',
        manufacturerData: encodeNgarenFrame({ aan: 'UG-1026-K7Q2MX', variant: 'mov', counter: 7, motionCount: 4 }),
        batteryMv: 2950,
        lowBatteryAlert: true,
        seenAt: now,
      },
      index,
    );
    expect(r).toMatchObject({ aan: 'UG-1026-K7Q2MX', via: 'frame', mismatch: false, variant: 'mov', motionCount: 4, counter: 7, batteryMv: 2950, lowBattery: true });
  });

  it('falls back to the NFC-written name, then the static MAC', () => {
    expect(resolveDetection({ mac: '11:22:33:44:55:66', name: 'UG-1026-ZZZZZZ', seenAt: now }, index)).toMatchObject({ aan: 'UG-1026-ZZZZZZ', via: 'name' });
    expect(resolveDetection({ mac: 'AA:BB:CC:DD:EE:02', seenAt: now }, index)).toMatchObject({ aan: 'UG-1026-B4C5D6', via: 'mac' });
  });

  it('flags a tag whose self-reported AAN disagrees with its bound MAC', () => {
    const r = resolveDetection({ mac: 'AA:BB:CC:DD:EE:01', name: 'UG-1026-ZZZZZZ', seenAt: now }, index);
    expect(r.mismatch).toBe(true);
    expect(r.aan).toBe('UG-1026-K7Q2MX'); // the registered binding wins
  });

  it('returns no AAN for an unknown tag', () => {
    expect(resolveDetection({ mac: '99:99:99:99:99:99', seenAt: now }, index)).toMatchObject({ aan: null, via: null });
  });
});

describe('makeDeduper', () => {
  it('drops repeat (mac, counter) frames heard by several readers', () => {
    const isNew = makeDeduper();
    const frame = { mac: 'AA:BB:CC:DD:EE:01', manufacturerData: encodeNgarenFrame({ aan: 'UG-1026-K7Q2MX', counter: 42 }), seenAt: now };
    expect(isNew(resolveDetection(frame, index))).toBe(true);
    expect(isNew(resolveDetection(frame, index))).toBe(false);
  });

  it('de-duplicates counter-less reads per MAC within the window', () => {
    const isNew = makeDeduper(30_000);
    const at = (iso: string) => resolveDetection({ mac: 'AA:BB:CC:DD:EE:02', seenAt: iso }, index);
    expect(isNew(at('2026-10-26T10:00:00.000Z'))).toBe(true);
    expect(isNew(at('2026-10-26T10:00:10.000Z'))).toBe(false);
    expect(isNew(at('2026-10-26T10:01:00.000Z'))).toBe(true);
  });
});
