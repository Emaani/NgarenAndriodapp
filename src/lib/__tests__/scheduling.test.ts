import { ScheduleEntry, availabilityAt, fulfilmentByVet, occurrences, parseSlot, requestState, slotText, spanDays, timeProblem } from '@/lib/scheduling';

const entry = (bookingId: string, slot: string, state: ScheduleEntry['state'], at = '2026-11-07T08:00:00Z'): ScheduleEntry => ({
  bookingId, vetUserId: 'vet-1', date: '2026-11-10', slot, state, at,
});

describe('booking times', () => {
  it('needs an end after the start', () => {
    expect(timeProblem('2026-11-07', '09:00', '2026-11-07', '10:00')).toBeNull();
    expect(timeProblem('2026-11-07', '10:00', '2026-11-07', '09:30')).toBe('order');
    expect(timeProblem('2026-11-08', '09:00', '2026-11-07', '10:00')).toBe('order');
    expect(timeProblem('2026-11-07', '16:00', '2026-11-08', '08:00')).toBeNull();
    expect(timeProblem('2026-11-07', '', '2026-11-07', '10:00')).toBe('missing');
  });

  it('writes and reads the slot, including the older fixed slots', () => {
    expect(slotText('09:00', '10:00')).toBe('09:00–10:00');
    expect(parseSlot('08:00–10:00')).toEqual({ start: 480, end: 600 });
    expect(parseSlot('nonsense')).toBeNull();
  });

  it('repeats daily, weekly or monthly up to the end date, at most 12 visits', () => {
    expect(occurrences('2026-11-07', 'none', '2026-12-31')).toEqual(['2026-11-07']);
    expect(occurrences('2026-11-07', 'weekly', '2026-11-28')).toEqual(['2026-11-07', '2026-11-14', '2026-11-21', '2026-11-28']);
    expect(occurrences('2026-01-31', 'monthly', '2026-04-30')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
    expect(occurrences('2026-11-07', 'daily', '2027-12-31')).toHaveLength(12);
    expect(occurrences('2026-11-07', 'weekly', '2026-11-01')).toEqual(['2026-11-07']);
    expect(spanDays('2026-11-07', '2026-11-09')).toBe(2);
  });
});

describe('vet availability', () => {
  it('is busy when an accepted visit overlaps, tentative for a tentative one, otherwise available', () => {
    const entries = [entry('a', '09:00–10:00', 'busy'), entry('b', '13:00–14:00', 'tentative')];
    expect(availabilityAt(entries, '2026-11-10', '09:30', '10:30')).toBe('busy');
    expect(availabilityAt(entries, '2026-11-10', '13:30', '15:00')).toBe('tentative');
    expect(availabilityAt(entries, '2026-11-10', '10:00', '11:00')).toBe('available');
    expect(availabilityAt(entries, '2026-11-11', '09:00', '10:00')).toBe('available');
  });

  it('uses the latest answer for each booking', () => {
    const entries = [entry('a', '09:00–10:00', 'busy', '2026-11-07T08:00:00Z'), entry('a', '09:00–10:00', 'free', '2026-11-07T09:00:00Z')];
    expect(availabilityAt(entries, '2026-11-10', '09:00', '10:00')).toBe('available');
  });
});

describe('request status and fulfilment', () => {
  const today = '2026-11-07';
  it('tracks accepted, tentative, no response, declined and cancelled', () => {
    expect(requestState({ status: 'pending' }, today)).toBe('no_response');
    expect(requestState({ status: 'pending', response: 'Tentative' }, today)).toBe('tentative');
    expect(requestState({ status: 'accepted', date: '2026-11-10' }, today)).toBe('accepted');
    expect(requestState({ status: 'declined' }, today)).toBe('declined');
    expect(requestState({ status: 'declined', cancelled: true }, today)).toBe('cancelled');
  });

  it('counts a visit fulfilled once the vet completes it with a report, unfulfilled once its day passes without one', () => {
    expect(requestState({ status: 'completed', date: '2026-11-01' }, today)).toBe('fulfilled');
    expect(requestState({ status: 'accepted', date: '2026-11-01' }, today)).toBe('unfulfilled');
    expect(
      fulfilmentByVet([
        { vet: 'Dr A', state: 'fulfilled' },
        { vet: 'Dr A', state: 'fulfilled' },
        { vet: 'Dr A', state: 'unfulfilled' },
        { vet: 'Dr B', state: 'accepted' },
      ]),
    ).toEqual([{ vet: 'Dr A', fulfilled: 2, unfulfilled: 1, score: 67 }]);
  });
});
