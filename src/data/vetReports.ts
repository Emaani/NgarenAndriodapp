/**
 * Vet-scoped report builders (Sep 3 2026 standup: accurate, shareable reporting
 * with an audit trail). Produces CSV exports for the vet's practice metrics and
 * a comprehensive per-animal Health Score Card — the source of truth for an
 * animal's data. Counts are derived from the same records the impact dashboard
 * uses, so the reports match what the vet sees on screen.
 */
import { toCsv } from '@/lib/export';
import { ageFromDate, formatDate, formatDateTime } from '@/lib/date';
import { Animal, CalloutRequest, VetImpact, VetImpactRow } from '@/data/types';
import { HEALTH_TYPE_LABELS, LocalHealthRecord } from '@/data/localHealth';
import { VetVisit } from '@/data/vetVisits';

export function servicesSummaryCsv(impact: VetImpact): string {
  const s = impact.services;
  return toCsv(
    ['Service', 'Count'],
    [
      ['Treatment', s.treatment],
      ['Vaccination', s.vaccination],
      ['Stock-taking', s.stockTaking],
      ['Others', s.others],
      ['TOTAL', s.treatment + s.vaccination + s.stockTaking + s.others],
    ],
  );
}

export function observationsCsv(impact: VetImpact): string {
  const o = impact.observations;
  return toCsv(
    ['Observation', 'Count'],
    [
      ['Ticks', o.ticks],
      ['Flies', o.flies],
      ['Disease', o.disease],
    ],
  );
}

export function rowsCsv(headers: [string, string], rows: VetImpactRow[]): string {
  return toCsv(headers, rows.map((r) => [r.label, r.sub ?? '']));
}

export function visitsLogCsv(callouts: CalloutRequest[]): string {
  const fulfilment = (s: string) =>
    s === 'completed' ? 'Fulfilled' : s === 'declined' ? 'Unfulfilled' : s === 'accepted' ? 'In progress' : 'Awaiting';
  return toCsv(
    ['Animal', 'Farmer', 'Location', 'Priority', 'Status', 'Fulfilment', 'Requested'],
    callouts.map((c) => [c.animal, c.farmerName, c.locationName, c.urgency, c.status, fulfilment(c.status), c.requestedAt]),
  );
}

/* ---------------------------------------------------------------------------
 * Health Score Card — the animal's complete record, in one shareable document.
 * ------------------------------------------------------------------------ */

export interface HealthScoreCardInput {
  animal: Animal;
  health: LocalHealthRecord[];
  visits: VetVisit[];
  generatedBy: string;
  telemetrySummary?: string;
}

/** A compact on-screen summary of the card's key health numbers. */
export function healthScoreCardSummary(health: LocalHealthRecord[]) {
  const count = (t: string) => health.filter((r) => r.type === t).length;
  const observations = Array.from(new Set(health.flatMap((r) => r.observations ?? [])));
  const openFollowUps = health.filter((r) => r.nextDueDate && new Date(r.nextDueDate).getTime() >= Date.now()).length;
  return {
    total: health.length,
    vaccinations: count('vaccination'),
    treatments: count('treatment'),
    consultations: count('consultation'),
    ailments: count('ailment'),
    openFollowUps,
    observations,
  };
}

function line(label: string, value?: string | null): string {
  return `${label}: ${value && String(value).trim() ? value : '—'}`;
}

/** Build the full Health Score Card as a shareable plain-text document. */
export function healthScoreCardText(input: HealthScoreCardInput): string {
  const { animal, health, visits, generatedBy, telemetrySummary } = input;
  const s = healthScoreCardSummary(health);
  const L: string[] = [];
  L.push('NGAREN — ANIMAL HEALTH SCORE CARD');
  L.push('The source of truth for this animal’s data.');
  L.push(`Generated: ${formatDateTime(new Date().toISOString())} by ${generatedBy}`);
  L.push('');
  L.push('— IDENTITY —');
  L.push(line('Account number', animal.accountNumber));
  L.push(line('Internal ID (AAN)', animal.ngarenCode));
  L.push(line('Farmer reference (tag)', animal.tag));
  L.push(line('Name', animal.name));
  L.push(line('Breed', animal.breed?.name));
  L.push(line('Colour / markings', animal.color));
  L.push(line('Age', ageFromDate(animal.dateOfBirth)));
  L.push(line('Date of birth', animal.dateOfBirth ? formatDate(animal.dateOfBirth) : undefined));
  L.push(line('Status', animal.status));
  L.push(line('Location', animal.locationName));
  L.push(line('Address', animal.physicalAddress));
  L.push(line('Coordinates', animal.coordinates ? `${animal.coordinates.lat.toFixed(5)}, ${animal.coordinates.lng.toFixed(5)}` : undefined));
  L.push(line('Dam (mother)', animal.damTag));
  L.push(line('Sire (father)', animal.sireTag));
  L.push('');
  L.push(`— DEVICES (${animal.devices?.length ?? (animal.deviceSerial ? 1 : 0)}) —`);
  if (animal.devices?.length) {
    for (const d of animal.devices) L.push(`• ${d.type} · ${d.serial}${d.linkage ? ` · ${d.linkage === 'support' ? 'Ngaren linkage' : 'Self-linkage'}` : ''}`);
  } else if (animal.deviceSerial) {
    L.push(`• ${animal.deviceSerial}`);
  } else {
    L.push('None (photo/visual ID)');
  }
  L.push('');
  L.push(`— HEALTH HISTORY (${health.length}) —`);
  if (health.length === 0) {
    L.push('No health records yet.');
  } else {
    for (const r of health) {
      const parts = [
        formatDate(r.date),
        HEALTH_TYPE_LABELS[r.type],
        r.medication ?? undefined,
        r.diagnosis ?? undefined,
        r.observations?.length ? `obs: ${r.observations.join(', ')}` : undefined,
        r.notes,
        `by ${r.recordedBy}`,
      ].filter(Boolean);
      L.push(`• ${parts.join(' · ')}`);
    }
  }
  L.push('');
  L.push(`— VET VISITS (${visits.length}) —`);
  if (visits.length === 0) {
    L.push('No logged visits.');
  } else {
    for (const v of visits) L.push(`• ${formatDateTime(v.loggedAt)} · ${v.outcome} · ${v.findings} · by ${v.vetName}`);
  }
  L.push('');
  L.push('— CERES TELEMETRY —');
  L.push(telemetrySummary && telemetrySummary.trim() ? telemetrySummary : 'No synced telemetry.');
  L.push('');
  L.push('— HEALTH SUMMARY —');
  L.push(`Total records: ${s.total} · Vaccinations: ${s.vaccinations} · Treatments: ${s.treatments} · Consultations: ${s.consultations} · Ailments: ${s.ailments}`);
  L.push(`Open follow-ups: ${s.openFollowUps}`);
  L.push(`Observations flagged: ${s.observations.length ? s.observations.join(', ') : 'none'}`);
  L.push('');
  L.push('Generated with the Ngaren app · Ngaren Digital');
  return L.join('\n');
}
