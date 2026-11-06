import { PfiRow, assessIntake, calculateTHI, heatAdjustment, pfiInputs, riskFor } from '@/lib/intake';

const NOW = Date.parse('2026-11-03T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const pfi = (h: number, over: Partial<PfiRow> = {}): PfiRow => ({
  animal_tag_id: 'T1',
  recorded_at: hoursAgo(h),
  dry_matter_intake_kg_per_day: null,
  feed_intake_kg: null,
  ruminating_mins: null,
  resting_and_ruminating_mins: null,
  ...over,
});

describe('intake intelligence', () => {
  it('uses the web model: 2.5% of body weight a day', () => {
    const a = assessIntake({ weightKg: 400, breed: 'Boran', measuredDmiKg: 9, ruminationRecent: null, ruminationBaseline: null });
    expect(a).toMatchObject({ expectedDmiKg: 10, dmiKg: 9, dmiSource: 'measured', adequacyPct: 90, risk: 'low', weightSource: 'recorded' });
  });

  it('caps a measured intake at 120% as the web does', () => {
    expect(assessIntake({ weightKg: 400, breed: null, measuredDmiKg: 20, ruminationRecent: null, ruminationBaseline: null }).adequacyPct).toBe(120);
  });

  it('estimates from weight when the tag has not measured intake, cutting 10% for a rumination drop over 15%', () => {
    const steady = assessIntake({ weightKg: 400, breed: null, measuredDmiKg: null, ruminationRecent: 60, ruminationBaseline: 62 });
    expect(steady).toMatchObject({ dmiSource: 'estimated', dmiKg: 10, adequacyPct: 100, ruminationDropPct: 3 });
    const down = assessIntake({ weightKg: 400, breed: null, measuredDmiKg: null, ruminationRecent: 40, ruminationBaseline: 60 });
    expect(down).toMatchObject({ dmiKg: 9, adequacyPct: 90, ruminationDropPct: 33 });
  });

  it('falls back to the breed weight, and says so', () => {
    expect(assessIntake({ weightKg: null, breed: 'Holstein', measuredDmiKg: null, ruminationRecent: null, ruminationBaseline: null })).toMatchObject({ weightKg: 550, weightSource: 'breed' });
    expect(assessIntake({ weightKg: 0, breed: 'Unknown', measuredDmiKg: null, ruminationRecent: null, ruminationBaseline: null }).weightKg).toBe(360);
  });

  it('grades risk on the web thresholds', () => {
    expect([riskFor(95), riskFor(85), riskFor(70)]).toEqual(['low', 'medium', 'high']);
  });

  it('keeps the web heat formula for when weather data arrives', () => {
    // 86 °F less (0.55 − 0.33) × 28
    expect(calculateTHI(30, 60)).toBeCloseTo(79.84, 2);
    expect(heatAdjustment(70)).toBe(1);
    expect(heatAdjustment(82)).toBeCloseTo(0.95, 5);
    expect(heatAdjustment(200)).toBe(0.7);
  });

  it('reads the latest measured intake and rumination now against before', () => {
    const inputs = pfiInputs(
      [
        pfi(3, { dry_matter_intake_kg_per_day: 8.2, ruminating_mins: 400 }),
        pfi(10, { ruminating_mins: 420 }),
        pfi(30, { dry_matter_intake_kg_per_day: 9.9, ruminating_mins: 500 }),
        pfi(54, { resting_and_ruminating_mins: 520 }),
      ],
      NOW,
    ).get('T1');
    expect(inputs).toEqual({ measuredDmiKg: 8.2, ruminationRecent: 410, ruminationBaseline: 510 });
  });

  it('does not count an intake over a day old as measured, and accepts the older column', () => {
    expect(pfiInputs([pfi(30, { dry_matter_intake_kg_per_day: 9 })], NOW).get('T1')?.measuredDmiKg).toBeNull();
    expect(pfiInputs([pfi(2, { feed_intake_kg: 7.5 })], NOW).get('T1')?.measuredDmiKg).toBe(7.5);
  });
});
