import {
  buildOrderRow,
  canCancel,
  deliveredDeviceRows,
  deliveryProblem,
  emptyOrderForm,
  nextStatus,
  orderProblem,
  orderProgress,
  parseSerials,
  statusNotification,
  statusPatch,
} from '@/lib/deviceOrders';

describe('device orders', () => {
  it('starts with the web wizard defaults', () => {
    expect(emptyOrderForm({ fullName: 'Asha', email: 'a@x.co' })).toMatchObject({
      full_name: 'Asha',
      email: 'a@x.co',
      quantity: '10',
      device_category: 'cerestag',
      livestock_type: 'Cattle',
      use_case: 'Farm Monitoring',
      preferred_contact_method: 'email',
    });
  });

  it('needs a name, a valid email and at least one device', () => {
    const ok = emptyOrderForm({ fullName: 'Asha', email: 'a@x.co' });
    expect(orderProblem(ok)).toBeNull();
    expect(orderProblem({ ...ok, full_name: 'A' })).toBe('name');
    expect(orderProblem({ ...ok, email: 'nope' })).toBe('email');
    expect(orderProblem({ ...ok, quantity: '0' })).toBe('quantity');
  });

  it('writes a pending row with blanks as nulls', () => {
    const row = buildOrderRow({ ...emptyOrderForm({ fullName: ' Asha ', email: 'a@x.co ' }), estimated_herd_size: '40', country: '  ' }, 'u1');
    expect(row).toMatchObject({ user_id: 'u1', full_name: 'Asha', email: 'a@x.co', quantity: 10, estimated_herd_size: 40, country: null, status: 'pending' });
    expect(row).not.toHaveProperty('order_number'); // the database sets it
  });

  it('follows the web status flow', () => {
    expect(nextStatus('pending')).toBe('under_review');
    expect(nextStatus('activated')).toBeNull();
    expect(nextStatus('cancelled')).toBeNull();
    expect(orderProgress('pending')).toBe(0);
    expect(orderProgress('activated')).toBe(1);
    expect(orderProgress('rejected')).toBeNull();
    expect(canCancel({ status: 'under_review' })).toBe(true);
    expect(canCancel({ status: 'approved' })).toBe(false);
  });

  it('stamps the time the web records with each status', () => {
    const at = new Date('2026-11-03T10:00:00Z');
    expect(statusPatch('shipped', at)).toEqual({ status: 'shipped', shipped_at: '2026-11-03T10:00:00.000Z' });
    expect(statusPatch('processing', at)).toEqual({ status: 'processing' });
  });

  it('needs one serial per device before delivery', () => {
    expect(parseSerials('A1, A2\nA2 ; A3')).toEqual(['A1', 'A2', 'A3']);
    expect(deliveryProblem({ quantity: 2, assigned_serials: [] })).toBe('no_serials');
    expect(deliveryProblem({ quantity: 2, assigned_serials: ['A1'] })).toBe('count');
    expect(deliveryProblem({ quantity: 2, assigned_serials: ['A1', 'A2'] })).toBeNull();
  });

  it('registers delivered devices to the customer as the web does', () => {
    const rows = deliveredDeviceRows({ assigned_serials: ['S1'], device_category: 'cerestag', user_id: 'u1', organisation: null, full_name: 'Asha' });
    expect(rows).toEqual([
      { tag_id: 'S1', serial_number: 'S1', device_category: 'cerestag', device_type: 'cerestag_pro', status: 'online', battery_level: 100, signal_strength: 100, assigned_to: 'u1', farm_name: 'Asha' },
    ]);
  });

  it('words the customer notification as the web does', () => {
    expect(statusNotification({ order_number: 'NG-ORD-1', user_id: 'u1' }, 'under_review')).toEqual({
      user_id: 'u1',
      type: 'info',
      title: 'Order NG-ORD-1 · Under Review',
      body: 'Your device order is now under review.',
      link: '/devices',
    });
    expect(statusNotification({ order_number: 'NG-ORD-1', user_id: 'u1' }, 'rejected').type).toBe('warning');
  });
});
