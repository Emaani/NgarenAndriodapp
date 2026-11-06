import { LineageLink, TelemetryRow, accuracyOf, feedSummary, latestFixes, satelliteTags } from '@/lib/liveFixes';
import { uuidToId } from '@/lib/ids';

const NOW = Date.parse('2026-11-03T12:00:00Z');
const ago = (mins: number) => new Date(NOW - mins * 60_000).toISOString();

const lineage: LineageLink[] = [
  { id: 'aaaaaaaa-0000-4000-8000-000000000001', animal_id: 'UG-1126-AAAAAA', animal_name: 'Bella', animal_tag_id: '982000123', visual_tag_number: 'A-042' },
  { id: 'bbbbbbbb-0000-4000-8000-000000000002', animal_id: 'UG-1126-BBBBBB', animal_name: null, animal_tag_id: '982000456', visual_tag_number: null },
  { id: 'cccccccc-0000-4000-8000-000000000003', animal_id: 'UG-1126-CCCCCC', animal_name: 'Ble', animal_tag_id: 'AA:BB:CC:DD:EE:FF', visual_tag_number: null },
];

const row = (tag: string, mins: number, over: Partial<TelemetryRow> = {}): TelemetryRow => ({
  animal_tag_id: tag,
  record_type: 'standard',
  recorded_at: ago(mins),
  latitude: 0.35,
  longitude: 32.58,
  gps_accuracy_m: 12,
  location_accuracy_label: null,
  temperature_celsius: null,
  battery_pct: 80,
  activity_level: null,
  activity_label: null,
  behaviour: null,
  confidence_label: null,
  ...over,
});

describe('live satellite fixes', () => {
  it('only asks for satellite tags, never Bluetooth MACs', () => {
    expect(satelliteTags(lineage)).toEqual(['982000123', '982000456']);
  });

  it('keeps the latest fix per animal, whatever order the rows come in', () => {
    const markers = latestFixes(
      lineage,
      [row('982000123', 90, { latitude: 0.1 }), row('982000123', 10, { latitude: 0.2 }), row('982000456', 2000)],
      NOW,
    );
    expect(markers).toHaveLength(2);
    expect(markers[0]).toMatchObject({ animalId: uuidToId(lineage[0].id), tag: 'A-042', lat: 0.2, lastSeenMins: 10, status: 'active', accuracy: 'Good', provider: 'Ceres Tag' });
    expect(markers[0].keys).toEqual(expect.arrayContaining(['UG-1126-AAAAAA', '982000123']));
    // Over a day old shows as inactive; with no name it falls back to the AAN.
    expect(markers[1]).toMatchObject({ tag: 'UG-1126-BBBBBB', status: 'inactive' });
  });

  it('ignores rows with no fix, a 0,0 fix, or a tag on no animal', () => {
    const markers = latestFixes(
      lineage,
      [row('982000123', 5, { latitude: null }), row('982000123', 6, { latitude: 0, longitude: 0 }), row('999', 1)],
      NOW,
    );
    expect(markers).toEqual([]);
  });

  it('grades accuracy, and never calls an unknown one good', () => {
    expect(accuracyOf({ gps_accuracy_m: 20, location_accuracy_label: null })).toBe('Good');
    expect(accuracyOf({ gps_accuracy_m: 80, location_accuracy_label: null })).toBe('Fair');
    expect(accuracyOf({ gps_accuracy_m: 400, location_accuracy_label: null })).toBe('Poor');
    expect(accuracyOf({ gps_accuracy_m: null, location_accuracy_label: 'High' })).toBe('Good');
    expect(accuracyOf({ gps_accuracy_m: null, location_accuracy_label: null })).toBe('Fair');
  });

  it('summarises a record in a line', () => {
    expect(feedSummary(row('t', 1, { temperature_celsius: 38.62 }))).toEqual({ kind: 'position', parts: ['0.35000, 32.58000 ±12 m', '38.6 °C', '80%'] });
    expect(feedSummary(row('t', 1, { record_type: 'activity', latitude: null, battery_pct: null, activity_label: 'Moderate' }))).toEqual({ kind: 'activity', parts: ['Moderate'] });
    expect(feedSummary(row('t', 1, { record_type: 'alert', latitude: null, battery_pct: null, behaviour: 'Possible calving', confidence_label: 'High' })).parts).toEqual(['Possible calving (High)']);
  });
});
