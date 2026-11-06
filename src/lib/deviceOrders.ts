/**
 * Device orders, shared with the web command centre's Devices page through the
 * Supabase `device_orders` table. The order number is set by the database.
 *
 * A user places and sees their own orders, and may change them only while
 * pending or under review. Admins see every order and move it along.
 */

export type OrderStatus =
  | 'pending'
  | 'under_review'
  | 'approved'
  | 'inventory_assigned'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'activated'
  | 'cancelled'
  | 'rejected';

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'pending', 'under_review', 'approved', 'inventory_assigned',
  'processing', 'shipped', 'delivered', 'activated',
];

/** The web's labels, used for the notification text both apps send. */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending',
  under_review: 'Under Review',
  approved: 'Approved',
  inventory_assigned: 'Inventory Assigned',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  activated: 'Activated',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
};

export type DeviceCategory = 'cerestag' | 'gps_tag' | 'bluetooth_tag' | 'rfid_tag';
export const DEVICE_CATEGORIES: DeviceCategory[] = ['cerestag', 'gps_tag', 'bluetooth_tag', 'rfid_tag'];
export const USE_CASES = ['Farm Monitoring', 'Vet Services', 'Breeding Monitoring', 'Theft Prevention', 'Research', 'Other'];
export const LIVESTOCK = ['Cattle', 'Sheep', 'Goats', 'Camels', 'Mixed'];
export const CONTACT_METHODS = ['email', 'phone', 'whatsapp'];

export interface DeviceOrder {
  id: string;
  order_number: string;
  user_id: string;
  full_name: string;
  organisation: string | null;
  email: string;
  phone: string | null;
  country: string | null;
  district: string | null;
  quantity: number;
  device_category: DeviceCategory;
  livestock_type: string | null;
  estimated_herd_size: number | null;
  preferred_deployment_date: string | null;
  use_case: string | null;
  delivery_address: string | null;
  preferred_contact_method: string | null;
  notes: string | null;
  status: OrderStatus;
  admin_notes: string | null;
  assigned_serials: string[] | null;
  reserved_count: number | null;
  shipment_carrier: string | null;
  shipment_tracking_number: string | null;
  shipment_eta: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  activated_at: string | null;
  cancelled_at: string | null;
  rejected_at: string | null;
}

export interface OrderForm {
  full_name: string;
  organisation: string;
  email: string;
  phone: string;
  country: string;
  district: string;
  quantity: string;
  device_category: DeviceCategory;
  livestock_type: string;
  estimated_herd_size: string;
  preferred_deployment_date: string;
  use_case: string;
  delivery_address: string;
  preferred_contact_method: string;
  notes: string;
}

/** The web wizard's defaults. */
export function emptyOrderForm(init: { fullName?: string | null; email?: string | null } = {}): OrderForm {
  return {
    full_name: init.fullName ?? '',
    organisation: '',
    email: init.email ?? '',
    phone: '',
    country: '',
    district: '',
    quantity: '10',
    device_category: 'cerestag',
    livestock_type: 'Cattle',
    estimated_herd_size: '',
    preferred_deployment_date: '',
    use_case: 'Farm Monitoring',
    delivery_address: '',
    preferred_contact_method: 'email',
    notes: '',
  };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** What stops the order going in, or null. The web asks for a name and a valid email. */
export function orderProblem(f: OrderForm): 'name' | 'email' | 'quantity' | null {
  if (f.full_name.trim().length < 2) return 'name';
  if (!EMAIL.test(f.email.trim())) return 'email';
  const q = Number(f.quantity);
  if (!Number.isInteger(q) || q < 1) return 'quantity';
  return null;
}

const textOrNull = (v: string) => (v.trim() ? v.trim() : null);
const intOrNull = (v: string) => (v.trim() && Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : null);

export function buildOrderRow(f: OrderForm, userId: string) {
  return {
    user_id: userId,
    full_name: f.full_name.trim(),
    organisation: textOrNull(f.organisation),
    email: f.email.trim(),
    phone: textOrNull(f.phone),
    country: textOrNull(f.country),
    district: textOrNull(f.district),
    quantity: Math.max(1, Math.round(Number(f.quantity) || 1)),
    device_category: f.device_category,
    livestock_type: textOrNull(f.livestock_type),
    estimated_herd_size: intOrNull(f.estimated_herd_size),
    preferred_deployment_date: textOrNull(f.preferred_deployment_date),
    use_case: textOrNull(f.use_case),
    delivery_address: textOrNull(f.delivery_address),
    preferred_contact_method: f.preferred_contact_method,
    notes: textOrNull(f.notes),
    status: 'pending' as OrderStatus,
  };
}

/** How far along the flow an order is, 0–1; null once cancelled or rejected. */
export function orderProgress(status: OrderStatus): number | null {
  const i = ORDER_STATUS_FLOW.indexOf(status);
  return i < 0 ? null : i / (ORDER_STATUS_FLOW.length - 1);
}

/** The chip colour for a status. */
export function statusVariant(s: OrderStatus): 'success' | 'warning' | 'error' | 'neutral' | 'info' {
  if (s === 'rejected' || s === 'cancelled') return 'error';
  if (s === 'delivered' || s === 'activated') return 'success';
  if (s === 'pending' || s === 'under_review') return 'warning';
  return 'info';
}

/** The owner may cancel while the order is still waiting, as the table allows. */
export function canCancel(o: Pick<DeviceOrder, 'status'>): boolean {
  return o.status === 'pending' || o.status === 'under_review';
}

/** The next step along the flow, for the admin's "advance" action. */
export function nextStatus(status: OrderStatus): OrderStatus | null {
  const i = ORDER_STATUS_FLOW.indexOf(status);
  return i >= 0 && i < ORDER_STATUS_FLOW.length - 1 ? ORDER_STATUS_FLOW[i + 1] : null;
}

/** The status change plus the timestamp the web records with it. */
export function statusPatch(next: OrderStatus, now = new Date()): Record<string, unknown> {
  const at = now.toISOString();
  const stamp: Partial<Record<OrderStatus, string>> = {
    approved: 'approved_at',
    shipped: 'shipped_at',
    delivered: 'delivered_at',
    activated: 'activated_at',
    cancelled: 'cancelled_at',
    rejected: 'rejected_at',
  };
  const key = stamp[next];
  return key ? { status: next, [key]: at } : { status: next };
}

/** Serials typed as a list: commas, spaces or new lines; duplicates dropped. */
export function parseSerials(text: string): string[] {
  return [...new Set(text.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean))];
}

/** Delivery needs exactly one serial per device ordered, as on the web. */
export function deliveryProblem(o: Pick<DeviceOrder, 'quantity' | 'assigned_serials'>): 'no_serials' | 'count' | null {
  const n = (o.assigned_serials ?? []).filter(Boolean).length;
  if (n === 0) return 'no_serials';
  return n === o.quantity ? null : 'count';
}

/** The devices registered to the customer when an order is delivered (the web's rows). */
export function deliveredDeviceRows(o: Pick<DeviceOrder, 'assigned_serials' | 'device_category' | 'user_id' | 'organisation' | 'full_name'>) {
  return (o.assigned_serials ?? []).map((s) => ({
    tag_id: s,
    serial_number: s,
    device_category: o.device_category,
    device_type: o.device_category === 'cerestag' ? 'cerestag_pro' : o.device_category,
    status: 'online',
    battery_level: 100,
    signal_strength: 100,
    assigned_to: o.user_id,
    farm_name: o.organisation || o.full_name,
  }));
}

/** The note the customer gets when their order moves, worded as on the web. */
export function statusNotification(o: Pick<DeviceOrder, 'order_number' | 'user_id'>, next: OrderStatus) {
  return {
    user_id: o.user_id,
    type: next === 'rejected' ? 'warning' : 'info',
    title: `Order ${o.order_number} · ${ORDER_STATUS_LABEL[next]}`,
    body:
      next === 'delivered'
        ? 'Your devices are delivered and linked to your account. Visit Devices to view them.'
        : `Your device order is now ${ORDER_STATUS_LABEL[next].toLowerCase()}.`,
    link: '/devices',
  };
}
