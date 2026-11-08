import { DirectMessage, conversations, otherParty, roleOf } from '@/lib/messages';

const msg = (id: string, from: string, to: string, at: string, read = false, name: string | null = null): DirectMessage => ({
  id, sender_id: from, recipient_id: to, sender_name: name, body: `m${id}`, created_at: at, read_at: read ? at : null,
});

describe('direct message conversations', () => {
  const me = 'farmer-1';
  const rows = [
    msg('1', 'vet-1', me, '2026-11-08T08:00:00Z', true, 'Dr. Sarah'),
    msg('2', me, 'vet-1', '2026-11-08T08:05:00Z'),
    msg('3', 'vet-1', me, '2026-11-08T09:00:00Z', false, 'Dr. Sarah'),
    msg('4', 'admin-1', me, '2026-11-08T07:00:00Z', false, 'Ngaren Support'),
  ];

  it('groups by the other person, newest first, with unread counts', () => {
    const list = conversations(rows, me);
    expect(list.map((c) => [c.otherId, c.name, c.last.id, c.unread])).toEqual([
      ['vet-1', 'Dr. Sarah', '3', 1],
      ['admin-1', 'Ngaren Support', '4', 1],
    ]);
  });

  it('names a person from the contact list when it has them', () => {
    expect(conversations(rows, me, [{ userId: 'vet-1', name: 'Sarah Namukasa', role: 'veterinary' }])[0].name).toBe('Sarah Namukasa');
  });

  it('counts only messages sent to me as unread', () => {
    expect(conversations([msg('5', me, 'vet-2', '2026-11-08T10:00:00Z')], me)[0].unread).toBe(0);
    expect(otherParty(rows[1], me)).toBe('vet-1');
  });

  it('shows Ngaren staff, vets and farmers by role', () => {
    expect(roleOf({ role: 'admin' })).toBe('ngaren');
    expect(roleOf({ role: 'farmer,veterinary' })).toBe('vet');
    expect(roleOf({ role: 'farmer' })).toBe('farmer');
    expect(roleOf({ role: '' })).toBe('other');
  });
});
