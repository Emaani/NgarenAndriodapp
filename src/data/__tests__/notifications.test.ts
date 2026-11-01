jest.mock('../../services/supabase', () => ({ supabase: {} }));

import { AppNotification } from '../types';
import { markRemoteNotificationsRead, rowToNotification } from '../notifications';
import { supabase } from '../../services/supabase';

const ROW_ID = '3f2b1c9e-1234-4abc-9def-001122334455';
const row = {
  id: ROW_ID,
  type: 'vet_request',
  title: 'New Vet Request: Zara',
  body: 'A farmer submitted a request',
  read: false,
  created_at: '2026-11-01T10:00:00.000Z',
};

describe('rowToNotification', () => {
  it('shows a new booking as an unread booking alert', () => {
    expect(rowToNotification(row)).toMatchObject({
      remoteId: ROW_ID,
      category: 'booking',
      title: 'New Vet Request: Zara',
      message: 'A farmer submitted a request',
      unread: true,
    });
  });

  it('files anything else under the account', () => {
    expect(rowToNotification({ ...row, type: 'farmer_registration' }).category).toBe('account');
    expect(rowToNotification({ ...row, type: 'info', read: true })).toMatchObject({ category: 'account', unread: false });
  });

  it('keeps ids stable across reloads', () => {
    expect(rowToNotification(row).id).toBe(rowToNotification(row).id);
  });
});

describe('markRemoteNotificationsRead', () => {
  const inFn = jest.fn().mockResolvedValue({ error: null });
  const update = jest.fn(() => ({ in: inFn }));

  beforeEach(() => {
    jest.clearAllMocks();
    (supabase as unknown as { from: unknown }).from = jest.fn(() => ({ update }));
  });

  const item = (over: Partial<AppNotification>): AppNotification => ({
    id: 1,
    category: 'booking',
    title: '',
    message: '',
    timestamp: '',
    unread: true,
    ...over,
  });

  it('marks only unread rows that came from the database', async () => {
    await markRemoteNotificationsRead([
      item({ remoteId: 'a' }),
      item({ remoteId: 'b', unread: false }),
      item({}),
    ]);
    expect(update).toHaveBeenCalledWith({ read: true });
    expect(inFn).toHaveBeenCalledWith('id', ['a']);
  });

  it('makes no call when nothing is unread', async () => {
    await markRemoteNotificationsRead([item({ remoteId: 'b', unread: false })]);
    expect(update).not.toHaveBeenCalled();
  });
});
