/**
 * Intake intelligence — how much an animal is eating against what it should,
 * using the web command centre's model (`intakeIntelligenceEngine.ts`):
 * expected dry-matter intake is 2.5% of body weight a day, and adequacy is the
 * share of that the animal achieves.
 *
 * Android only uses what is measured. The web page fills in lactation,
 * rumination, air temperature and humidity with stand-in numbers per animal;
 * here, a missing input is left out and the result says what it rests on:
 *   - intake measured by the CERES tag (PFI `dry_matter_intake_kg_per_day`), or
 *   - estimated from body weight and a fall in rumination time.
 * Heat stress needs air temperature and humidity, which no source supplies yet,
 * so it isn't applied.
 */

/** Typical adult weights the web uses when an animal has none recorded. */
export const BREED_WEIGHT: Record<string, number> = {
  Zebu: 320, Boran: 420, Ankole: 380, Holstein: 550, Sahiwal: 400,
  Friesian: 540, Hereford: 500, Brahman: 450, Nguni: 310, Other: 360,
};
export const DEFAULT_WEIGHT_KG = 360;

export const DMI_SHARE_OF_WEIGHT = 0.025;

/** Temperature-humidity index, as the web computes it. */
export function calculateTHI(tempC: number, humidityPct: number): number {
  return 1.8 * tempC + 32 - (0.55 - 0.0055 * humidityPct) * (1.8 * tempC - 26);
}

/** The web's heat adjustment: intake falls 0.5% per THI point over 72, to at most 30%. */
export function heatAdjustment(thi: number): number {
  return thi > 72 ? Math.max(0.7, 1 - (thi - 72) * 0.005) : 1;
}

export type IntakeRisk = 'low' | 'medium' | 'high';

export function riskFor(adequacyPct: number): IntakeRisk {
  return adequacyPct >= 90 ? 'low' : adequacyPct >= 80 ? 'medium' : 'high';
}

export interface IntakeInputs {
  weightKg: number | null;
  breed: string | null;
  /** Latest CERES daily intake, kg dry matter. */
  measuredDmiKg: number | null;
  /** Average rumination minutes over the last day and over the fortnight before. */
  ruminationRecent: number | null;
  ruminationBaseline: number | null;
}

export interface IntakeAssessment {
  weightKg: number;
  weightSource: 'recorded' | 'breed';
  expectedDmiKg: number;
  dmiKg: number;
  dmiSource: 'measured' | 'estimated';
  adequacyPct: number;
  risk: IntakeRisk;
  /** Fall in rumination against the animal's own baseline, %; null when not measured. */
  ruminationDropPct: number | null;
}

const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;

export function assessIntake(i: IntakeInputs): IntakeAssessment {
  const recorded = typeof i.weightKg === 'number' && i.weightKg > 0;
  const weightKg = recorded ? (i.weightKg as number) : BREED_WEIGHT[i.breed ?? ''] ?? DEFAULT_WEIGHT_KG;
  const expected = DMI_SHARE_OF_WEIGHT * weightKg;

  const drop =
    typeof i.ruminationRecent === 'number' && typeof i.ruminationBaseline === 'number' && i.ruminationBaseline > 0
      ? (i.ruminationBaseline - i.ruminationRecent) / i.ruminationBaseline
      : null;

  let dmi: number;
  let adequacy: number;
  const measured = typeof i.measuredDmiKg === 'number' && i.measuredDmiKg > 0;
  if (measured) {
    dmi = i.measuredDmiKg as number;
    // As on the web: a measured intake can run above expectation, shown up to 120%.
    adequacy = Math.min(120, (dmi / expected) * 100);
  } else {
    // The web's activity adjustment: rumination down by more than 15% means about 10% less eaten.
    dmi = expected * (drop !== null && drop > 0.15 ? 0.9 : 1);
    adequacy = Math.min(100, (dmi / expected) * 100);
  }

  return {
    weightKg,
    weightSource: recorded ? 'recorded' : 'breed',
    expectedDmiKg: round(expected, 2),
    dmiKg: round(dmi, 2),
    dmiSource: measured ? 'measured' : 'estimated',
    adequacyPct: round(adequacy, 1),
    risk: riskFor(adequacy),
    ruminationDropPct: drop === null ? null : Math.round(drop * 100),
  };
}

export interface PfiRow {
  animal_tag_id: string;
  recorded_at: string;
  dry_matter_intake_kg_per_day: number | null;
  feed_intake_kg: number | null;
  ruminating_mins: number | null;
  resting_and_ruminating_mins: number | null;
}

/**
 * Per tag: the latest measured intake (within the last day) and rumination now
 * against the fortnight before. Older firmware only reports resting and
 * ruminating together, which is used when plain rumination is missing.
 */
export function pfiInputs(rows: PfiRow[], now = Date.now()): Map<string, Pick<IntakeInputs, 'measuredDmiKg' | 'ruminationRecent' | 'ruminationBaseline'>> {
  const DAY = 86_400_000;
  const byTag = new Map<string, PfiRow[]>();
  for (const r of rows) {
    const list = byTag.get(r.animal_tag_id) ?? [];
    list.push(r);
    byTag.set(r.animal_tag_id, list);
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const out = new Map<string, Pick<IntakeInputs, 'measuredDmiKg' | 'ruminationRecent' | 'ruminationBaseline'>>();
  for (const [tag, list] of byTag) {
    list.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
    const age = (r: PfiRow) => now - new Date(r.recorded_at).getTime();
    const intake = list.find((r) => age(r) <= DAY && typeof (r.dry_matter_intake_kg_per_day ?? r.feed_intake_kg) === 'number');
    const rum = (r: PfiRow) => r.ruminating_mins ?? r.resting_and_ruminating_mins;
    const recent = list.filter((r) => age(r) <= DAY).map(rum).filter((v): v is number => typeof v === 'number');
    const before = list.filter((r) => age(r) > DAY).map(rum).filter((v): v is number => typeof v === 'number');
    out.set(tag, {
      measuredDmiKg: intake ? (intake.dry_matter_intake_kg_per_day ?? intake.feed_intake_kg) : null,
      ruminationRecent: avg(recent),
      ruminationBaseline: avg(before),
    });
  }
  return out;
}
