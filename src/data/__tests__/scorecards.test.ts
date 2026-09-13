jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
// Avoid loading the real Supabase client (pulls RealtimeClient/WebSocket) — the
// status logic under test is pure and needs no backend.
jest.mock('../../services/supabase', () => ({ isSupabaseConfigured: () => false, supabase: {} }));

import { deriveScorecardStatus, isTemperatureAbnormal, syncScorecardToSupabase, Scorecard } from '../scorecards';

const base = {
  vitals: { bcs: 4 as number | null, temperature: null as number | null },
  diagnosisTags: [] as string[],
  diagnosisNotes: null as string | null,
  treatment: {} as { drug?: string | null },
  flagRecheck: false,
};

describe('deriveScorecardStatus', () => {
  it('is healthy for good BCS, no diagnosis or treatment', () => {
    expect(deriveScorecardStatus(base)).toBe('healthy');
  });

  it('is urgent when BCS is very low', () => {
    expect(deriveScorecardStatus({ ...base, vitals: { bcs: 2, temperature: null } })).toBe('urgent');
  });

  it('is urgent for a serious condition tag', () => {
    expect(deriveScorecardStatus({ ...base, diagnosisTags: ['Mastitis'] })).toBe('urgent');
  });

  it('is urgent for a clearly abnormal temperature', () => {
    expect(deriveScorecardStatus({ ...base, vitals: { bcs: 4, temperature: 40.5 } })).toBe('urgent');
  });

  it('is monitor when a treatment is in progress', () => {
    expect(deriveScorecardStatus({ ...base, treatment: { drug: 'Flunixin' } })).toBe('monitor');
  });

  it('is monitor when flagged for recheck', () => {
    expect(deriveScorecardStatus({ ...base, flagRecheck: true })).toBe('monitor');
  });

  it('is monitor for a mid-range BCS', () => {
    expect(deriveScorecardStatus({ ...base, vitals: { bcs: 3, temperature: null } })).toBe('monitor');
  });
});

describe('syncScorecardToSupabase', () => {
  const card = { id: 'sc-1', animalKey: 'A', animalLabel: 'A', status: 'healthy', visitType: 'Routine check', vitals: { bcs: 4 }, diagnosisTags: [], treatment: {}, grooming: [], flagRecheck: false, vetName: 'Vet', date: '2026-09-13', createdAt: '', locked: true } as Scorecard;

  it('drops the op (success) when no backend is configured — the local copy is the record', async () => {
    await expect(syncScorecardToSupabase(card, 'user-1')).resolves.toBe(true);
  });
});

describe('isTemperatureAbnormal', () => {
  it('flags outside the cattle normal band', () => {
    expect(isTemperatureAbnormal(37.4)).toBe(true);
    expect(isTemperatureAbnormal(39.8)).toBe(true);
  });
  it('accepts a normal reading and null', () => {
    expect(isTemperatureAbnormal(38.6)).toBe(false);
    expect(isTemperatureAbnormal(null)).toBe(false);
  });
});
