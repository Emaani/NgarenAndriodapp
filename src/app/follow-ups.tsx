import { useState } from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { FollowUpInvite, getFollowUps, setFollowUpStatus } from '@/data/followUps';
import { addLocalEvent } from '@/data/localEvents';
import { addLocalNotification } from '@/data/localNotifications';
import { logAuditEvent } from '@/data/localAuditEvents';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { sendLocalNotification } from '@/services/push';
import { notify } from '@/lib/toast';
import { formatDate, formatDateTime } from '@/lib/date';
import { useT } from '@/i18n';
import { ActionChip, AppText, Button, EmptyState, GradientHeader, Icon, IconChip, Screen } from '@/ui';

const kindLabel = (k: FollowUpInvite['kind']) => (k === 'vaccination' ? 'Vaccination follow-up' : 'Treatment follow-up');
const statusVariant = (s: FollowUpInvite['status']) => (s === 'accepted' ? 'success' : s === 'declined' ? 'error' : 'warning');

/**
 * Follow-up invitations (Log Visit rework, Oct 20 2026). Farmers accept/decline
 * the follow-ups a vet booked during a visit; accepting schedules it on the
 * calendar (visible to both). Vets see the status of what they booked.
 */
export default function FollowUps() {
  const t = useT();
  const { loading, isAuthenticated, canVet, user } = useAuth();
  const { data: invites, reload } = useResource(getFollowUps, []);
  const [busy, setBusy] = useState<string | null>(null);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  const accept = async (f: FollowUpInvite) => {
    setBusy(f.id);
    await setFollowUpStatus(f.id, 'accepted');
    // Schedule it on the shared calendar — now visible on the vet's calendar too.
    await addLocalEvent({
      title: `${kindLabel(f.kind)}: ${f.animalLabel}`,
      date: f.date,
      time: f.time ?? undefined,
      type: f.kind === 'vaccination' ? 'vaccination' : 'follow_up',
    });
    const by = user?.fullName ?? user?.email ?? 'Farmer';
    void logAuditEvent({ type: 'other', title: `Follow-up accepted — ${f.animalLabel}`, detail: `${f.aan} · ${kindLabel(f.kind)} · ${f.date}`, by });
    void addLocalNotification({ title: 'Follow-up confirmed', message: `${by} accepted the ${kindLabel(f.kind).toLowerCase()} for ${f.animalLabel} on ${formatDate(f.date)}.` });
    void sendLocalNotification('Follow-up confirmed', `${f.animalLabel}: ${kindLabel(f.kind)} scheduled for ${formatDate(f.date)}.`, { type: 'FOLLOWUP_ACCEPTED' });
    setBusy(null);
    notify('Follow-up added to your calendar');
    reload();
  };

  const decline = async (f: FollowUpInvite) => {
    setBusy(f.id);
    await setFollowUpStatus(f.id, 'declined');
    setBusy(null);
    notify('Follow-up declined');
    reload();
  };

  const pending = invites.filter((f) => f.status === 'pending');
  const others = invites.filter((f) => f.status !== 'pending');

  const Row = ({ f, actionable }: { f: FollowUpInvite; actionable: boolean }) => (
    <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm, borderWidth: 1, borderColor: colors.divider }, shadow[1]]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <IconChip icon={f.kind === 'vaccination' ? 'needle' : 'medical-bag'} />
        <View style={{ flex: 1 }}>
          <AppText variant="bodyLarge" style={{ fontWeight: '700' }}>{f.animalLabel}</AppText>
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            {kindLabel(f.kind)} · {f.aan}
          </AppText>
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            {formatDate(f.date)}{f.time ? ` · ${f.time}` : ''} · {t('vma.submittedBy', { name: f.vetName, date: formatDateTime(f.createdAt) })}
          </AppText>
          {f.note ? <AppText variant="caption" color={colors.onSurfaceVariant}>{f.note}</AppText> : null}
        </View>
        <ActionChip label={f.status} variant={statusVariant(f.status)} />
      </View>
      {actionable ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button label="Accept" icon="check" loading={busy === f.id} onPress={() => accept(f)} style={{ flex: 1 }} />
          <Button label="Decline" variant="outline" disabled={busy === f.id} onPress={() => decline(f)} style={{ flex: 1 }} />
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Follow-ups" subtitle={canVet ? 'Follow-ups you booked' : 'Vet follow-up invitations'} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xxl }}>
        {invites.length === 0 ? (
          <EmptyState icon="calendar-clock-outline" title="No follow-ups" subtitle={canVet ? 'Follow-ups you book during a visit appear here.' : 'When a vet books a follow-up for your animal, you can accept it here.'} />
        ) : (
          <>
            {!canVet && pending.length > 0 ? (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
                  <Icon name="bell-ring-outline" size={16} color={colors.warning} />
                  <AppText variant="title">Awaiting your response</AppText>
                </View>
                {pending.map((f) => <Row key={f.id} f={f} actionable />)}
              </>
            ) : null}
            {canVet && pending.length > 0 ? (
              <>
                <AppText variant="title" style={{ marginBottom: spacing.sm }}>Awaiting farmer</AppText>
                {pending.map((f) => <Row key={f.id} f={f} actionable={false} />)}
              </>
            ) : null}
            {others.length > 0 ? (
              <>
                <AppText variant="title" style={{ marginTop: spacing.md, marginBottom: spacing.sm }}>History</AppText>
                {others.map((f) => <Row key={f.id} f={f} actionable={false} />)}
              </>
            ) : null}
          </>
        )}
      </Screen>
    </View>
  );
}
