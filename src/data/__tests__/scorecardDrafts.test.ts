jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteScorecardDraft, getOpenScorecardDraft, saveScorecardDraft } from '../scorecardDrafts';

const draft = (id: string, animalKey: string, vetId: string | null, notes = '') => ({ id, animalKey, animalLabel: animalKey, vetId, notes });

beforeEach(() => AsyncStorage.clear());

describe('getOpenScorecardDraft', () => {
  it('carries on with the unfinished scorecard for that animal', async () => {
    await saveScorecardDraft(draft('a', 'UG-1', 'vet-1', 'Lame on the left'));
    expect((await getOpenScorecardDraft('vet-1', 'UG-1'))?.notes).toBe('Lame on the left');
  });

  it('picks the most recently edited draft', async () => {
    await saveScorecardDraft(draft('a', 'UG-1', 'vet-1', 'older'));
    await new Promise((resolve) => setTimeout(resolve, 5));
    await saveScorecardDraft(draft('b', 'UG-1', 'vet-1', 'newer'));
    expect((await getOpenScorecardDraft('vet-1', 'UG-1'))?.id).toBe('b');
  });

  it('never opens another vet’s draft or another animal’s', async () => {
    await saveScorecardDraft(draft('a', 'UG-1', 'vet-1'));
    expect(await getOpenScorecardDraft('vet-2', 'UG-1')).toBeUndefined();
    expect(await getOpenScorecardDraft('vet-1', 'UG-2')).toBeUndefined();
  });

  it('starts fresh once a scorecard was submitted', async () => {
    await saveScorecardDraft(draft('a', 'UG-1', 'vet-1'));
    await deleteScorecardDraft('a');
    expect(await getOpenScorecardDraft('vet-1', 'UG-1')).toBeUndefined();
  });
});
