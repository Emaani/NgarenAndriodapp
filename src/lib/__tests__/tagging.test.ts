import {
  ELA_SUPPORTS_CODED_PHY,
  bleFormFactor,
  bleReconfigurable,
  bleVariant,
  puckBatteryYears,
  deviceFitsIdType,
  deviceOptionsFor,
  isBleModel,
  isBluetoothAnimal,
  methodForDevices,
  openFieldRangeM,
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

  it('does not apply the COIN +40 °C table to PUCK tags', () => {
    expect(projectedBatteryYears('ELA Blue PUCK ID', 0, 5)).toBeNull();
    expect(puckBatteryYears('ELA Blue COIN ID', 0, 5)).toBeNull();
  });

  it("reads ELA's PUCK curves at +80 °C (plan figure) and +23 °C", () => {
    expect(puckBatteryYears('ELA Blue PUCK ID', 0, 5)).toEqual({ at80: 15.7, at23: 18.4 });
    expect(puckBatteryYears('ELA Blue PUCK ID', 0, 2)).toEqual({ at80: 9.3, at23: 11 });
    expect(puckBatteryYears('ELA Blue PUCK ID', 4, 5)).toEqual({ at80: 14.4, at23: 16.9 });
    expect(puckBatteryYears('ELA Blue PUCK ID', 0, 4)).toBeNull();
  });

  it("scales MOV and T curves by the ID reference, as ELA's doc §10 does", () => {
    expect(puckBatteryYears('ELA Blue PUCK MOV', 0, 5)).toEqual({ at80: 14.2, at23: 16.6 });
    expect(puckBatteryYears('ELA Blue PUCK T', 0, 5)).toEqual({ at80: 13, at23: 15.2 });
    // +4 dBm at 3 s: ID ratio 14.4 / 12.5 (the doc's own worked figures).
    expect(puckBatteryYears('ELA Blue PUCK T', 4, 3)).toEqual({ at80: 8.1, at23: 9.5 });
  });

  it('allows Bluetooth reconfiguration (connected mode) only under 3 s', () => {
    expect(bleReconfigurable(2)).toBe(true);
    expect(bleReconfigurable(3)).toBe(false);
    expect(bleReconfigurable(5)).toBe(false);
  });
});

describe('ELA read range', () => {
  it('records that ELA BAF tags have no Coded PHY (long range)', () => {
    expect(ELA_SUPPORTS_CODED_PHY).toBe(false);
  });

  it("returns ELA's indicative open-field figures at +4 dBm by form factor", () => {
    expect(openFieldRangeM('ELA Blue PUCK ID')).toBe(500);
    expect(openFieldRangeM('ELA Blue COIN ID')).toBe(200);
    expect(openFieldRangeM('ELA Blue COIN MOV')).toBe(200);
    expect(openFieldRangeM('ELA Blue COIN T')).toBe(200);
  });

  it('gives no figure for a tag ELA did not measure', () => {
    expect(bleFormFactor('Bluetooth')).toBeNull();
    expect(openFieldRangeM('Bluetooth')).toBeNull();
    expect(openFieldRangeM('Ceres Gen6')).toBeNull();
  });
});
