import {
  bleVariant,
  deviceFitsIdType,
  deviceOptionsFor,
  isBleModel,
  isBluetoothAnimal,
  methodForDevices,
  projectedBatteryYears,
} from '@/lib/tagging';

describe('separate satellite and Bluetooth integrations', () => {
  const names = (idType: Parameters<typeof deviceOptionsFor>[0]) => deviceOptionsFor(idType).map((o) => o.value);

  it('offers only the devices of the chosen identification type', () => {
    expect(names('bluetooth')).toContain('ELA Blue COIN T');
    expect(names('bluetooth')).not.toContain('Gsat Rancher');
    expect(names('satellite')).toContain('Gsat Rancher');
    expect(names('satellite')).not.toContain('ELA Blue COIN ID');
    expect(names('physical')).toEqual(['Visual ear tag']);
  });

  it('rejects a device of another type but keeps older model names', () => {
    expect(deviceFitsIdType('Ceres Gen6', 'bluetooth')).toBe(false);
    expect(deviceFitsIdType('ELA Blue COIN ID', 'bluetooth')).toBe(true);
    expect(deviceFitsIdType('Some retired model', 'bluetooth')).toBe(true);
  });

  it('treats a visual ear tag as ordinary identification', () => {
    expect(methodForDevices([{ type: 'Visual ear tag' }])).toBe('manual');
    expect(isBleModel('Visual ear tag')).toBe(false);
  });

  it('recognises Bluetooth animals, with the chosen type taking priority', () => {
    expect(isBluetoothAnimal({ identificationType: 'bluetooth' })).toBe(true);
    expect(isBluetoothAnimal({ taggingMethod: 'bluetooth' })).toBe(true);
    expect(isBluetoothAnimal({ devices: [{ type: 'ELA Blue COIN ID' }] })).toBe(true);
    expect(isBluetoothAnimal({ identificationType: 'satellite', devices: [{ type: 'ELA Blue COIN ID' }] })).toBe(false);
    expect(isBluetoothAnimal({ taggingMethod: 'satellite' })).toBe(false);
  });
});

describe('ELA BLE tag variants & battery projection', () => {
  it('maps device models to the ELA variant (motion OR temperature, never both)', () => {
    expect(bleVariant('ELA Blue COIN ID')).toBe('id');
    expect(bleVariant('ELA Blue COIN MOV')).toBe('mov');
    expect(bleVariant('ELA Blue COIN T')).toBe('t');
    expect(bleVariant('ELA Blue PUCK ID')).toBe('id');
    expect(bleVariant('Bluetooth')).toBe('id');
  });

  it('treats ELA models as BLE and satellite models as not', () => {
    expect(isBleModel('ELA Blue COIN T')).toBe(true);
    expect(isBleModel('Ceres Gen6')).toBe(false);
  });

  it("returns ELA's +40 °C projections (only ID @ 0 dBm / 5 s reaches 5 years)", () => {
    expect(projectedBatteryYears('ELA Blue COIN ID', 0, 5)).toBe(5);
    expect(projectedBatteryYears('ELA Blue COIN ID', 0, 2)).toBe(2.75);
    expect(projectedBatteryYears('ELA Blue COIN MOV', 4, 2)).toBe(1.88);
    expect(projectedBatteryYears('ELA Blue COIN T', 0, 5)).toBe(3.3);
    expect(projectedBatteryYears('ELA Blue COIN ID', 0, 10)).toBeNull();
  });
});
