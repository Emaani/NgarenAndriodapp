import { bleVariant, isBleModel, projectedBatteryYears } from '@/lib/tagging';

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
