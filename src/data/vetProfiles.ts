/**
 * Vet professional persona — profile, booking calendar and the Veterinary
 * Impact dashboard (Aug 29 2026 standup). Two entry points:
 *
 *  - getVetProfile(id): a browsed vet's resume-style profile for the farmer's
 *    "Find a vet" flow — persona + availability calendar + headline impact.
 *    Impact here is portfolio data (no per-vet record store yet) but internally
 *    consistent (service split sums to visits; observations ≤ visits).
 *
 *  - getMyVetImpact(): the LOGGED-IN vet's own dashboard, counted from real
 *    app data (completed call-outs + health records) so the numbers are exact.
 */
import { getCalloutRequests } from './api';
import { getHealthRecords } from './clinical';
import { getLocalHealthRecords } from './localHealth';
import { vets } from './mock';
import { getEnlistedVetById } from './vetEnlistments';
import { Vet, VetDayAvailability, VetImpact, VetProfile } from './types';

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDayLabel(iso: string): { weekday: string; day: string } {
  const d = new Date(iso + 'T00:00:00');
  return { weekday: WEEKDAY[d.getDay()], day: `${MONTH[d.getMonth()]} ${d.getDate()}` };
}

/** A ~10-day rolling booking calendar. Sundays are closed (0 appts). */
function buildAvailability(seed: number, video: boolean): VetDayAvailability[] {
  const days: VetDayAvailability[] = [];
  const start = new Date();
  for (let i = 0; i < 10; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const isSunday = d.getDay() === 0;
    // Deterministic-but-varied appointment counts, 2..13.
    const appts = isSunday ? 0 : 2 + ((seed * (i + 3) * 7) % 12);
    days.push({ dateIso: iso, appts, video });
  }
  return days;
}

/** Portfolio impact for a browsed vet — internally consistent from headline stats. */
function portfolioImpact(vet: Vet): VetImpact {
  const totalVisits = vet.reviews;
  const animalsManaged = Math.round(totalVisits * 2.6);
  const farmersServiced = Math.max(1, Math.round(totalVisits * 0.35));
  // Split visits across service types; force the split to sum to totalVisits.
  const treatment = Math.round(totalVisits * 0.4);
  const vaccination = Math.round(totalVisits * 0.3);
  const stockTaking = Math.round(totalVisits * 0.15);
  const others = totalVisits - treatment - vaccination - stockTaking;
  return {
    totalVisits,
    animalsManaged,
    farmersServiced,
    services: { treatment, vaccination, stockTaking, others: Math.max(0, others) },
    observations: {
      ticks: Math.round(totalVisits * 0.22),
      flies: Math.round(totalVisits * 0.15),
      disease: Math.round(totalVisits * 0.18),
    },
  };
}

export async function getVetProfile(id: number): Promise<VetProfile | undefined> {
  // Seeded vets first, then admin-enlisted vets (created in-app).
  const vet: Vet | undefined = vets.find((v) => v.id === id) ?? (await getEnlistedVetById(id));
  if (!vet) return undefined;
  return {
    ...vet,
    availability: buildAvailability(id, vet.videoVisits ?? false),
    impact: portfolioImpact(vet),
  };
}

const has = (text: string | null | undefined, ...needles: string[]) => {
  const t = (text ?? '').toLowerCase();
  return needles.some((n) => t.includes(n));
};

/**
 * The logged-in vet's real impact, counted from the app's own records:
 *  - Total visits  = completed call-outs.
 *  - Animals managed = distinct animals across call-outs + health records.
 *  - Farmers serviced = distinct farmer names on call-outs.
 *  - Nature of services = health-record types (treatment / vaccination /
 *    stock-taking / others).
 *  - Key observations = keyword hits (ticks / flies / disease) in notes.
 */
export async function getMyVetImpact(): Promise<VetImpact> {
  const [callouts, clinical, local] = await Promise.all([
    getCalloutRequests(),
    getHealthRecords(),
    getLocalHealthRecords(),
  ]);

  const completed = callouts.filter((c) => c.status === 'completed');

  // Distinct animals & farmers with occurrence counts (case-insensitive keys,
  // original-case labels) — powers the drill-down lists.
  const animalsMap = new Map<string, { label: string; count: number }>();
  const addAnimal = (label?: string | null) => {
    if (!label) return;
    const k = label.toLowerCase();
    const e = animalsMap.get(k) ?? { label, count: 0 };
    e.count += 1;
    animalsMap.set(k, e);
  };
  for (const c of callouts) addAnimal(c.animal);
  for (const r of clinical) addAnimal(r.animalName);
  const farmersMap = new Map<string, { label: string; count: number }>();
  for (const c of callouts) {
    if (!c.farmerName) continue;
    const k = c.farmerName.toLowerCase();
    const e = farmersMap.get(k) ?? { label: c.farmerName, count: 0 };
    e.count += 1;
    farmersMap.set(k, e);
  }
  const animals = animalsMap;
  const farmers = farmersMap;

  const services = { treatment: 0, vaccination: 0, stockTaking: 0, others: 0 };
  const bump = (text: string | null | undefined, type?: string) => {
    if (type === 'vaccination' || has(text, 'vaccin')) services.vaccination += 1;
    else if (type === 'treatment' || has(text, 'treat')) services.treatment += 1;
    else if (has(text, 'stock')) services.stockTaking += 1;
    else services.others += 1;
  };
  for (const r of local) bump(r.notes, r.type);
  for (const r of clinical) bump(r.notes);

  const obsText = [
    ...local.map((r) => `${r.notes} ${r.medication ?? ''}`),
    ...clinical.map((r) => `${r.notes ?? ''}`),
  ];
  const observations = {
    ticks: obsText.filter((t) => has(t, 'tick')).length,
    flies: obsText.filter((t) => has(t, 'fly', 'flies', 'fli')).length,
    disease: obsText.filter((t) => has(t, 'disease', 'infection', 'fever')).length,
  };

  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
  return {
    totalVisits: completed.length,
    animalsManaged: animals.size,
    farmersServiced: farmers.size,
    services,
    observations,
    detail: {
      visits: completed.map((c) => ({ label: c.animal, sub: `${c.farmerName} · ${c.urgency} · ${c.requestedAt}` })),
      animals: [...animals.values()].map((a) => ({ label: a.label, sub: plural(a.count, 'record') })),
      farmers: [...farmers.values()].map((f) => ({ label: f.label, sub: plural(f.count, 'visit') })),
    },
  };
}
