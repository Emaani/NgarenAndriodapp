/**
 * Delegated seats & team data (P1).
 *
 * Reads the organizations / organization_members / subscriptions tables added
 * in the delegated-seats migration. Because that migration may not be applied
 * yet (and to keep Demo Mode working), every function degrades gracefully to
 * mock data when Supabase isn't configured or the query errors — so the app
 * never breaks whether or not the backend is live.
 */
import { supabase } from '../services/supabase';
import { isSupabaseConfigured } from '../config';
import { reportDataFailure, reportDataSuccess } from '../services/dataHealth';
import { Permission, SEAT_ROLE_TEMPLATES, SeatRole } from '@/lib/permissions';

export type MemberStatus = 'invited' | 'active' | 'suspended';

export interface Organization {
  id: string;
  name: string;
  ownerUserId: string;
}

export interface SeatMember {
  id: string;
  orgId: string;
  userId: string | null;
  email: string;
  seatRole: SeatRole;
  status: MemberStatus;
}

export interface Subscription {
  orgId: string;
  plan: string;
  seatLimit: number;
  pricePerSeatMinor: number;
  currency: string;
  status: string;
}

/** The signed-in user's effective membership, resolved for the auth context. */
export interface Membership {
  orgId: string;
  seatRole: SeatRole;
  permissions: Permission[];
}

const MOCK_ORG: Organization = { id: 'demo-org', name: 'My Farm', ownerUserId: 'demo-user' };

const MOCK_MEMBERS: SeatMember[] = [
  { id: 'sm-owner', orgId: 'demo-org', userId: 'demo-user', email: 'owner@myfarm.ug', seatRole: 'owner', status: 'active' },
  { id: 'sm-1', orgId: 'demo-org', userId: 'u1', email: 'manager@myfarm.ug', seatRole: 'farm_manager', status: 'active' },
  { id: 'sm-2', orgId: 'demo-org', userId: 'u2', email: 'stockman@myfarm.ug', seatRole: 'stockman', status: 'active' },
  { id: 'sm-3', orgId: 'demo-org', userId: null, email: 'newhire@myfarm.ug', seatRole: 'viewer', status: 'invited' },
];

const MOCK_SUBSCRIPTION: Subscription = {
  orgId: 'demo-org',
  plan: 'Team',
  seatLimit: 5,
  pricePerSeatMinor: 1500000, // UGX 15,000 / seat / month
  currency: 'UGX',
  status: 'active',
};

function mapMember(r: Record<string, unknown>): SeatMember {
  return {
    id: String(r.id),
    orgId: String(r.org_id),
    userId: (r.user_id as string) ?? null,
    email: (r.email as string) ?? '—',
    seatRole: ((r.seat_role as string) ?? 'viewer') as SeatRole,
    status: ((r.status as string) ?? 'invited') as MemberStatus,
  };
}

/** The org the current user owns, else the org they're an active member of. */
export async function getMyOrganization(userId?: string): Promise<Organization | null> {
  if (!isSupabaseConfigured() || !userId) return MOCK_ORG;
  try {
    const owned = await supabase.from('organizations').select('id, name, owner_user_id').eq('owner_user_id', userId).maybeSingle();
    if (owned.data) {
      reportDataSuccess();
      const o = owned.data as Record<string, unknown>;
      return { id: String(o.id), name: (o.name as string) ?? 'My Farm', ownerUserId: String(o.owner_user_id) };
    }
    const membership = await supabase.from('organization_members').select('org_id').eq('user_id', userId).eq('status', 'active').maybeSingle();
    if (membership.data) {
      const org = await supabase.from('organizations').select('id, name, owner_user_id').eq('id', (membership.data as { org_id: string }).org_id).maybeSingle();
      if (org.data) {
        const o = org.data as Record<string, unknown>;
        return { id: String(o.id), name: (o.name as string) ?? 'Farm', ownerUserId: String(o.owner_user_id) };
      }
    }
    return null;
  } catch {
    return MOCK_ORG;
  }
}

/**
 * Resolve the signed-in user's effective permissions. Returns null when the
 * user has no membership, so the auth context can fall back to role defaults.
 */
export async function resolveMembership(userId?: string): Promise<Membership | null> {
  if (!isSupabaseConfigured() || !userId) return null;
  try {
    // Owner of an org → all permissions.
    const owned = await supabase.from('organizations').select('id').eq('owner_user_id', userId).maybeSingle();
    if (owned.data) {
      return { orgId: String((owned.data as { id: string }).id), seatRole: 'owner', permissions: SEAT_ROLE_TEMPLATES.owner };
    }
    // Active member → template permissions minus explicit denies, plus grants.
    const member = await supabase
      .from('organization_members')
      .select('id, org_id, seat_role')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();
    if (!member.data) return null;
    const m = member.data as { id: string; org_id: string; seat_role: SeatRole };
    const base = new Set<Permission>(SEAT_ROLE_TEMPLATES[m.seat_role] ?? []);
    const { data: overrides } = await supabase
      .from('member_permission_overrides')
      .select('permission_key, granted')
      .eq('member_id', m.id);
    for (const o of (overrides ?? []) as { permission_key: Permission; granted: boolean }[]) {
      if (o.granted) base.add(o.permission_key);
      else base.delete(o.permission_key);
    }
    return { orgId: m.org_id, seatRole: m.seat_role, permissions: [...base] };
  } catch {
    // Tables not present / offline — treat as "no membership" so the app falls
    // back to role defaults and current users are unaffected.
    return null;
  }
}

export async function getSeatMembers(orgId: string): Promise<SeatMember[]> {
  if (!isSupabaseConfigured() || orgId === MOCK_ORG.id) return MOCK_MEMBERS;
  try {
    const { data, error } = await supabase
      .from('organization_members')
      .select('id, org_id, user_id, email, seat_role, status')
      .eq('org_id', orgId)
      .order('created_at');
    if (error || !data) {
      reportDataFailure('seats', error);
      return MOCK_MEMBERS;
    }
    reportDataSuccess();
    return data.map(mapMember);
  } catch (e) {
    reportDataFailure('seats', e);
    return MOCK_MEMBERS;
  }
}

export async function getSubscription(orgId: string): Promise<Subscription> {
  if (!isSupabaseConfigured() || orgId === MOCK_ORG.id) return MOCK_SUBSCRIPTION;
  try {
    const { data } = await supabase
      .from('subscriptions')
      .select('org_id, plan, seat_limit, price_per_seat_minor, currency, status')
      .eq('org_id', orgId)
      .maybeSingle();
    if (!data) return { ...MOCK_SUBSCRIPTION, orgId };
    const s = data as Record<string, unknown>;
    return {
      orgId: String(s.org_id),
      plan: (s.plan as string) ?? 'free',
      seatLimit: Number(s.seat_limit ?? 1),
      pricePerSeatMinor: Number(s.price_per_seat_minor ?? 0),
      currency: (s.currency as string) ?? 'UGX',
      status: (s.status as string) ?? 'trialing',
    };
  } catch {
    return { ...MOCK_SUBSCRIPTION, orgId };
  }
}

/** Invite a member by email. No-ops safely in mock mode (UI shows optimistic). */
export async function inviteMember(orgId: string, email: string, seatRole: SeatRole, invitedBy?: string): Promise<boolean> {
  if (!isSupabaseConfigured() || orgId === MOCK_ORG.id) return false;
  try {
    const { error } = await supabase.from('organization_members').insert({
      org_id: orgId,
      email: email.trim().toLowerCase(),
      seat_role: seatRole,
      status: 'invited',
      invited_by: invitedBy ?? null,
    });
    return !error;
  } catch {
    return false;
  }
}

export async function updateMember(
  memberId: string,
  patch: { seatRole?: SeatRole; status?: MemberStatus },
): Promise<boolean> {
  if (!isSupabaseConfigured() || memberId.startsWith('sm-')) return false;
  try {
    const payload: Record<string, unknown> = {};
    if (patch.seatRole) payload.seat_role = patch.seatRole;
    if (patch.status) payload.status = patch.status;
    const { error } = await supabase.from('organization_members').update(payload).eq('id', memberId);
    return !error;
  } catch {
    return false;
  }
}

export function formatSeatPrice(sub: Subscription): string {
  return `${sub.currency} ${(sub.pricePerSeatMinor / 100).toLocaleString()}`;
}
