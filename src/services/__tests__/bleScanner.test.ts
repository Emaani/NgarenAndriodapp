const loadScanner = () => require('@/services/bleScanner') as typeof import('@/services/bleScanner');

const mockBle = (state: string, overrides: Record<string, unknown> = {}) => {
  const manager = {
    state: jest.fn().mockResolvedValue(state),
    startDeviceScan: jest.fn().mockResolvedValue(undefined),
    stopDeviceScan: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  jest.doMock('react-native-ble-plx', () => ({ BleManager: jest.fn(() => manager) }));
  return manager;
};

beforeEach(() => {
  jest.resetModules();
  jest.doMock('expo-location', () => ({ hasServicesEnabledAsync: jest.fn().mockResolvedValue(true) }));
});

describe('scanForTags', () => {
  it('reports unavailable instead of crashing when the native module is missing', async () => {
    jest.doMock('react-native-ble-plx', () => ({
      BleManager: jest.fn(() => {
        throw new TypeError('Cannot read property createClient of null');
      }),
    }));
    await expect(loadScanner().scanForTags(10, jest.fn())).resolves.toBe('unavailable');
  });

  it('tells the user to turn Bluetooth on', async () => {
    const manager = mockBle('PoweredOff');
    await expect(loadScanner().scanForTags(10, jest.fn())).resolves.toBe('bluetooth_off');
    expect(manager.startDeviceScan).not.toHaveBeenCalled();
  });

  it('reports each advertisement, then stops the radio', async () => {
    const seen: unknown[] = [];
    const manager = mockBle('PoweredOn', {
      startDeviceScan: jest.fn((_uuids, _options, listener) => {
        listener(null, { id: 'AA:BB:CC:DD:EE:01', localName: 'P_TAG', manufacturerData: 'Tg==', rssi: -60 });
        return Promise.resolve();
      }),
    });
    await expect(loadScanner().scanForTags(10, (d) => seen.push(d))).resolves.toBeNull();
    expect(seen).toEqual([expect.objectContaining({ mac: 'AA:BB:CC:DD:EE:01', name: 'P_TAG', rssi: -60, manufacturerData: new Uint8Array([0x4e]) })]);
    expect(manager.stopDeviceScan).toHaveBeenCalledTimes(1);
  });

  it('maps a scan error to something the user can act on', async () => {
    mockBle('PoweredOn', {
      startDeviceScan: jest.fn((_uuids, _options, listener) => {
        listener({ errorCode: 601 }, null);
        return Promise.resolve();
      }),
    });
    await expect(loadScanner().scanForTags(1000, jest.fn())).resolves.toBe('location_off');
  });

  it('can be stopped early', async () => {
    mockBle('PoweredOn');
    const scanner = loadScanner();
    const running = scanner.scanForTags(60_000, jest.fn());
    await new Promise((resolve) => setTimeout(resolve, 20));
    scanner.stopBleScan();
    await expect(running).resolves.toBeNull();
  });
});
