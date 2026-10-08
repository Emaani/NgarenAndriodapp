import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import {
  MemberStatus,
  Organization,
  SeatMember,
  Subscription,
  formatSeatPrice,
  getMyOrganization,
  getSeatMembers,
  getSubscription,
  inviteMember,
  updateMember,
} from '@/data/seats';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { SEAT_ROLE_LABELS, SEAT_ROLE_TEMPLATES, SeatRole } from '@/lib/permissions';
import { useT, useTStatus } from '@/i18n';
import {
  ActionChip,
  AppText,
  BottomSheet,
  Button,
  GradientHeader,
  Icon,
  IconChip,
  PickerField,
  Screen,
  TextField,
} from '@/ui';

type Loaded = { org: Organization | null; members: SeatMember[]; subscription: Subscription | null };
const EMPTY: Loaded = { org: null, members: [], subscription: null };

const ROLE_OPTIONS = (['farm_manager', 'stockman', 'viewer'] as SeatRole[]).map((r) => ({
  label: SEAT_ROLE_LABELS[r],
  value: r,
}));

const statusVariant = (s: MemberStatus) =>
  s === 'active' ? 'success' : s === 'invited' ? 'warning' : 'neutral';

/**
 * Team & Seats — the Farm Owner manages delegated profiles (Google Workspace
 * style per-seat model). Invite members, assign a seat role, see seat usage vs
 * the plan, and suspend/remove. Restricted to owners / solo farmers / admins.
 */
export default function Team() {
  const router = useRouter();
  const t = useT();
  const tStatus = useTStatus();
  const { user, loading, isAuthenticated, canManageTeam } = useAuth();
  const { data } = useResource(async () => {
    const org = await getMyOrganization(user?.id);
    if (!org) return EMPTY;
    const [members, subscription] = await Promise.all([getSeatMembers(org.id), getSubscription(org.id)]);
    return { org, members, subscription };
  }, EMPTY);

  const [local, setLocal] = useState<SeatMember[] | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [manage, setManage] = useState<SeatMember | null>(null);

  // Invite form.
  const [email, setEmail] = useState('');
  const [seatRole, setSeatRole] = useState<SeatRole>('stockman');
  const [saving, setSaving] = useState(false);

  const members = local ?? data.members;
  const activeSeats = useMemo(() => members.filter((m) => m.status === 'active').length, [members]);
  const seatLimit = data.subscription?.seatLimit ?? Math.max(activeSeats, 1);
  const seatsFull = activeSeats >= seatLimit;

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!canManageTeam) return <Redirect href="/(tabs)/home" />;

  const onInvite = async () => {
    if (!data.org) return;
    setSaving(true);
    await inviteMember(data.org.id, email, seatRole, user?.id);
    const optimistic: SeatMember = {
      id: `sm-new-${Date.now()}`,
      orgId: data.org.id,
      userId: null,
      email: email.trim().toLowerCase(),
      seatRole,
      status: 'invited',
    };
    setLocal((prev) => [...(prev ?? data.members), optimistic]);
    setSaving(false);
    setInviteOpen(false);
    setEmail('');
    setSeatRole('stockman');
  };

  const applyMember = async (m: SeatMember, patch: { seatRole?: SeatRole; status?: MemberStatus }) => {
    setLocal((prev) => (prev ?? data.members).map((x) => (x.id === m.id ? { ...x, ...patch } : x)));
    await updateMember(m.id, patch);
    setManage(null);
  };

  const removeMember = async (m: SeatMember) => {
    setLocal((prev) => (prev ?? data.members).filter((x) => x.id !== m.id));
    await updateMember(m.id, { status: 'suspended' });
    setManage(null);
  };

  const pct = Math.min(1, activeSeats / Math.max(seatLimit, 1));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('action.teamSeats')} subtitle={data.org?.name ?? t('tm.yourFarm')} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xxl }}>
        {/* Seat usage meter */}
        <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, gap: spacing.sm }, shadow[1]]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <AppText variant="bodyLarge" style={{ fontWeight: '700' }}>
              {t('tm.seatsUsed', { active: activeSeats, limit: seatLimit })}
            </AppText>
            {data.subscription ? (
              <ActionChip label={data.subscription.plan} variant="info" />
            ) : null}
          </View>
          <View style={{ height: 8, borderRadius: radius.full, backgroundColor: colors.divider, overflow: 'hidden' }}>
            <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: seatsFull ? colors.warning : colors.primary }} />
          </View>
          {data.subscription ? (
            <AppText variant="caption" color={colors.onSurfaceVariant}>
              {t('tm.pricePerSeat', { price: formatSeatPrice(data.subscription) })}
            </AppText>
          ) : null}
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button
              label={t('tm.inviteMember')}
              icon="account-plus-outline"
              onPress={() => setInviteOpen(true)}
              disabled={seatsFull || !data.org}
              style={{ flex: 1 }}
            />
            <Button label={t('tm.addSeats')} variant="outline" icon="plus" onPress={() => router.push('/payments')} style={{ flex: 1 }} />
          </View>
          {!data.org ? (
            <AppText variant="caption" color={colors.onSurfaceVariant}>
              {t('tm.notSetup')}
            </AppText>
          ) : seatsFull ? (
            <AppText variant="caption" color={colors.warning}>
              {t('tm.seatsFull')}
            </AppText>
          ) : null}
        </View>

        <AppText variant="overline" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>
          {t('tm.members', { count: members.length })}
        </AppText>
        {members.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => (m.seatRole === 'owner' ? undefined : setManage(m))}
            style={({ pressed }) => [
              { flexDirection: 'row', alignItems: 'center', gap: spacing.mdMinus, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.divider, opacity: pressed ? 0.9 : 1 },
              shadow[1],
            ]}>
            <IconChip icon={m.seatRole === 'owner' ? 'shield-account-outline' : 'account-outline'} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
                {m.email}
              </AppText>
              <AppText variant="caption" color={colors.onSurfaceVariant}>
                {SEAT_ROLE_LABELS[m.seatRole]}
              </AppText>
            </View>
            <ActionChip label={tStatus(m.status)} variant={statusVariant(m.status)} />
          </Pressable>
        ))}
      </Screen>

      {/* Invite sheet */}
      <BottomSheet visible={inviteOpen} onClose={() => setInviteOpen(false)} title={t('usr.inviteBtn')}>
        <TextField label={t('usr.email')} required value={email} onChangeText={setEmail} placeholder="name@farm.ug" keyboardType="email-address" />
        <PickerField label={t('tm.seatRole')} required value={seatRole} options={ROLE_OPTIONS} onSelect={(v) => setSeatRole(v as SeatRole)} />
        <View style={{ backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.divider }}>
          <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.xs }}>
            {t('tm.roleCan', { role: SEAT_ROLE_LABELS[seatRole] })}
          </AppText>
          <AppText variant="caption" color={colors.onSurface}>
            {SEAT_ROLE_TEMPLATES[seatRole].map((p) => p.replace(/_/g, ' ')).join(' · ')}
          </AppText>
        </View>
        <Button label={t('usr.sendInvite')} loading={saving} disabled={!email.trim()} onPress={onInvite} />
      </BottomSheet>

      {/* Manage member sheet */}
      <BottomSheet visible={!!manage} onClose={() => setManage(null)} title={manage?.email}>
        {manage ? (
          <>
            <PickerField
              label={t('tm.seatRole')}
              value={manage.seatRole}
              options={ROLE_OPTIONS}
              onSelect={(v) => applyMember(manage, { seatRole: v as SeatRole })}
            />
            {manage.status === 'suspended' ? (
              <Button label={t('tm.reactivate')} icon="account-check-outline" onPress={() => applyMember(manage, { status: 'active' })} disabled={seatsFull} />
            ) : (
              <Button label={t('tm.suspend')} variant="outline" icon="account-off-outline" onPress={() => applyMember(manage, { status: 'suspended' })} />
            )}
            <Button label={t('tm.removeFromTeam')} variant="outline" icon="trash-can-outline" onPress={() => removeMember(manage)} style={{ marginTop: spacing.sm }} />
          </>
        ) : null}
      </BottomSheet>
    </View>
  );
}
