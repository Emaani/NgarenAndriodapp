/**
 * Device orders on Supabase `device_orders`, written and moved along exactly as
 * the web command centre's order wizard and orders panel do, so an order
 * placed on the phone appears on the web and the other way round.
 */
import { supabase } from '../services/supabase';
import { isSupabaseConfigured } from '../config';
import { reportDataFailure, reportDataSuccess } from '../services/dataHealth';
import {
  DeviceOrder,
  OrderForm,
  OrderStatus,
  buildOrderRow,
  deliveredDeviceRows,
  deliveryProblem,
  parseSerials,
  statusNotification,
  statusPatch,
} from '../lib/deviceOrders';

/** The user's own orders, or every order for an admin. Newest first. */
export async function getDeviceOrders(opts: { all: boolean; userId?: string }): Promise<DeviceOrder[]> {
  if (!isSupabaseConfigured()) return [];
  let q = supabase.from('device_orders').select('*').order('created_at', { ascending: false });
  if (!opts.all && opts.userId) q = q.eq('user_id', opts.userId);
  const { data, error } = await q;
  if (error) {
    reportDataFailure('device-orders', error);
    return [];
  }
  reportDataSuccess();
  return (data ?? []) as DeviceOrder[];
}

export async function getDeviceOrder(id: string): Promise<DeviceOrder | undefined> {
  const { data, error } = await supabase.from('device_orders').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? undefined) as DeviceOrder | undefined;
}

/**
 * Place an order. Then, as the web does and without failing the order if they
 * don't go through: a "Device order received" notification for the customer,
 * and the notify-device-order function, which tells the admins and sales.
 */
export async function placeDeviceOrder(form: OrderForm, userId: string): Promise<DeviceOrder> {
  if (!isSupabaseConfigured()) throw new Error('Orders need the live database.');
  const payload = buildOrderRow(form, userId);
  const { data, error } = await supabase.from('device_orders').insert(payload).select().single();
  if (error) throw new Error(error.message);
  const order = data as DeviceOrder;
  try {
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'info',
      title: 'Device order received',
      body: `Your order ${order.order_number} for ${payload.quantity} ${payload.device_category} device(s) has been submitted and is pending review.`,
      link: '/devices',
    });
  } catch {
    // Non-fatal, as on the web.
  }
  try {
    await supabase.functions.invoke('notify-device-order', { body: { order_id: order.id } });
  } catch {
    // Non-fatal, as on the web.
  }
  return order;
}

/**
 * Move an order to `next`. Delivery first checks the serials (one per device,
 * none already registered or on another order) and registers the devices to
 * the customer. The customer is notified either way.
 */
export async function setOrderStatus(order: DeviceOrder, next: OrderStatus): Promise<void> {
  if (next === 'delivered') {
    const problem = deliveryProblem(order);
    if (problem === 'no_serials') throw new Error('Assign serials before marking as delivered.');
    if (problem === 'count') throw new Error(`Serials (${order.assigned_serials?.length ?? 0}) must match quantity (${order.quantity}).`);
    await assertSerialsFree(order.id, order.assigned_serials ?? [], true);
    const { error: devErr } = await supabase.from('devices').insert(deliveredDeviceRows(order));
    if (devErr) throw new Error(`Device link failed: ${devErr.message}`);
  }
  const { error } = await supabase.from('device_orders').update(statusPatch(next)).eq('id', order.id);
  if (error) throw new Error(error.message);
  try {
    await supabase.from('notifications').insert(statusNotification(order, next));
  } catch {
    // Best effort, as on the web.
  }
}

async function assertSerialsFree(orderId: string, serials: string[], checkTagIds: boolean): Promise<void> {
  if (serials.length === 0) return;
  const quoted = serials.map((s) => `"${s.replace(/"/g, '')}"`).join(',');
  const { data: existing } = checkTagIds
    ? await supabase.from('devices').select('serial_number, tag_id').or(`serial_number.in.(${quoted}),tag_id.in.(${quoted})`)
    : await supabase.from('devices').select('serial_number, tag_id').in('serial_number', serials);
  if (existing && existing.length > 0) {
    throw new Error(`Already registered: ${existing.map((e) => e.serial_number || e.tag_id).join(', ')}`);
  }
  const { data: others } = await supabase
    .from('device_orders')
    .select('order_number, assigned_serials')
    .neq('id', orderId)
    .overlaps('assigned_serials', serials);
  if (others && others.length > 0) throw new Error(`Serials already on order ${others[0].order_number}`);
}

export interface FulfilmentInput {
  adminNotes: string;
  carrier: string;
  tracking: string;
  eta: string;
  serials: string;
}

/** The admin's fulfilment details: notes, shipment and the serials reserved for the order. */
export async function saveFulfilment(order: DeviceOrder, input: FulfilmentInput): Promise<void> {
  const serials = parseSerials(input.serials);
  if (serials.length > 0) await assertSerialsFree(order.id, serials, false);
  const { error } = await supabase
    .from('device_orders')
    .update({
      admin_notes: input.adminNotes.trim() || null,
      shipment_carrier: input.carrier.trim() || null,
      shipment_tracking_number: input.tracking.trim() || null,
      shipment_eta: input.eta.trim() || null,
      assigned_serials: serials,
      reserved_count: serials.length,
    })
    .eq('id', order.id);
  if (error) throw new Error(error.message);
}

/** Devices not yet on an animal: the web only lets an admin approve when there are enough. */
export async function getFreeInventoryCount(): Promise<number> {
  const { count, error } = await supabase.from('devices').select('id', { count: 'exact', head: true }).is('linked_animal_id', null);
  return error ? 0 : count ?? 0;
}
