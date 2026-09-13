import { useState } from 'react';
import { View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { calloutRequests as calloutFallback } from '@/data/mock';
import { getCalloutRequests, updateCalloutStatus } from '@/data/api';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { notify } from '@/lib/toast';
import { sendLocalNotification } from '@/services/push';
import { CalloutRequest, CalloutStatus } from '@/data/types';
import { ActionChip, AppText, Button, DetailRow, EmptyState, GradientHeader, Icon, IconName, PhotoField, Screen } from '@/ui';

const statusVariant = (s: CalloutStatus) =>
  s === 'accepted' ? 'success' : s === 'completed' ? 'info' : s === 'declined' ? 'error' : 'warning';

// The on-site service actions a vet performs (Sep 3 2026 MVP scope).
const SERVICES: { key: string; label: string; icon: IconName; route: (animal: string) => string }[] = [
  { key: 'stock', label: 'Stock-take', icon: 'clipboard-list-outline', route: () => '/stock-take' },
  { key: 'vaccination', label: 'Vaccination', icon: 'needle', route: (a) => `/add-health-record?animal=${encodeURIComponent(a)}&label=${encodeURIComponent(a)}&type=vaccination` },
  { key: 'treatment', label: 'Treatment', icon: 'medical-bag', route: (a) => `/add-health-record?animal=${encodeURIComponent(a)}&label=${encodeURIComponent(a)}&type=treatment` },
  { key: 'consultation', label: 'Consultation', icon: 'comment-question-outline', route: (a) => `/add-health-record?animal=${encodeURIComponent(a)}&label=${encodeURIComponent(a)}&type=consultation` },
];

/**
 * Vet call-out response — how a vet acts on a farmer's request: accept/decline,
 * then (once on-site) verify presence with a live photo to unlock the service
 * actions (stock-take / vaccination / treatment / consultation), and complete.
 * Records access is scoped to the appointment window (time-limited).
 */
export default function VetCallout() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loading, isAuthenticated, canVet } = useAuth();
  const { data: requests } = useResource(() => getCalloutRequests(), calloutFallback);

  const req: CalloutRequest | undefined = requests.find((r) => r.id === Number(id));
  const [status, setStatus] = useState<CalloutStatus | null>(null);
  // Per-task on-site activation (Sep 12 2026): each service task is activated
  // individually with a live Face-ID check before it can be opened.
  const [activated, setActivated] = useState<Record<string, string>>({});
  const [activeCapture, setActiveCapture] = useState<string | null>(null);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!canVet) return <Redirect href="/(tabs)/home" />;

  if (!req) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <GradientHeader title="Call-out" showBack />
        <EmptyState icon="clipboard-pulse-outline" title="Request not found" subtitle="This call-out may have been removed." />
      </View>
    );
  }

  const current = status ?? req.status;
  const accessHours = req.urgency === 'Emergency' ? 4 : 24;
  // Reveal-on-accept: farmer identity & exact location stay hidden until the
  // vet accepts (Sep 5 2026 anonymized vet view).
  const revealed = current !== 'pending';

  // On-site tasks the vet can activate individually (Sep 12 2026). The Visit
  // Scorecard is the comprehensive record; the others jump to focused screens.
  const TASKS: { key: string; label: string; icon: IconName; route: string }[] = req
    ? [
        { key: 'scorecard', label: 'Visit Scorecard', icon: 'clipboard-plus-outline', route: `/vet-scorecard/new?key=${encodeURIComponent(req.animal)}&label=${encodeURIComponent(req.animal)}&callout=${req.id}` },
        ...SERVICES.map((s) => ({ key: s.key, label: s.label, icon: s.icon, route: s.route(req.animal) })),
      ]
    : [];

  const setAndSync = (next: CalloutStatus, toast: string) => {
    setStatus(next);
    updateCalloutStatus(req.id, next).catch(() => undefined);
    notify(toast);
    if (next === 'accepted') {
      void sendLocalNotification('Call-out accepted', `You accepted ${req.farmerName}'s request for ${req.animal}.`, { type: 'VET_CALLOUT' });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Call-out" subtitle={req.animal} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xxl }}>
        {/* Summary */}
        <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.divider }, shadow[1]]}>
          <View style={{ width: 46, height: 46, borderRadius: radius.full, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={revealed ? 'account-outline' : 'account-lock-outline'} size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="bodyLarge" style={{ fontWeight: '700' }}>
              {revealed ? req.farmerName : 'Farmer hidden'}
            </AppText>
            <AppText variant="caption" color={colors.onSurfaceVariant}>
              {revealed ? `${req.locationName} · ${req.distanceKm} km · ${req.requestedAt}` : `~${req.distanceKm} km · ${req.requestedAt} · revealed on accept`}
            </AppText>
          </View>
          <ActionChip label={current[0].toUpperCase() + current.slice(1)} variant={statusVariant(current)} />
        </View>

        {/* Request details */}
        <AppText variant="title" style={{ marginBottom: spacing.sm }}>
          Request
        </AppText>
        <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md, marginBottom: spacing.lg }, shadow[1]]}>
          <DetailRow label="Animal" value={req.animal} />
          <DetailRow label="Priority" value={req.urgency} />
          <DetailRow label="SLA" value={req.urgency === 'Emergency' ? 'Respond within 4 hours' : 'Respond within 48 hours'} />
          <DetailRow label="Farmer" value={revealed ? req.farmerName : 'Hidden until accepted'} />
          <DetailRow label="Location" value={revealed ? `${req.locationName} · ${req.distanceKm} km` : `~${req.distanceKm} km · shown on accept`} last={!req.notes} />
          {req.notes ? <DetailRow label="Notes" value={req.notes} last /> : null}
        </View>

        {/* Time-limited access */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primaryTint, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg }}>
          <Icon name="lock-clock" size={18} color={colors.primary} />
          <AppText variant="caption" color={colors.primary} style={{ flex: 1, fontWeight: '600' }}>
            Records access is limited to this appointment window + {accessHours}h. It lapses automatically afterwards.
          </AppText>
        </View>

        {/* Status-driven actions */}
        {current === 'pending' ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button label="Decline" variant="outline" onPress={() => setAndSync('declined', 'Call-out declined')} style={{ flex: 1 }} />
            <Button label="Accept" icon="check" onPress={() => setAndSync('accepted', 'Call-out accepted')} style={{ flex: 1 }} />
          </View>
        ) : null}

        {current === 'declined' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.errorTint, borderRadius: radius.md, padding: spacing.md }}>
            <Icon name="close-circle-outline" size={18} color={colors.error} />
            <AppText variant="caption" color={colors.error} style={{ flex: 1, fontWeight: '600' }}>
              You declined this call-out. It returns to the pool for another vet.
            </AppText>
          </View>
        ) : null}

        {current === 'accepted' ? (
          <>
            <AppText variant="title" style={{ marginBottom: spacing.xs }}>
              On-site service activation
            </AppText>
            {/* 45-minute activation window from the scheduled time (Sep 12 2026). */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primaryTint, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
              <Icon name="clock-alert-outline" size={18} color={colors.primary} />
              <AppText variant="caption" color={colors.primary} style={{ flex: 1, fontWeight: '600' }}>
                Activate each task on-site within 45 minutes of the scheduled time. Each task needs a live Face-ID check for accountability.
              </AppText>
            </View>

            <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
              {TASKS.map((t) => {
                const isActive = !!activated[t.key];
                const capturing = activeCapture === t.key;
                return (
                  <View key={t.key} style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: isActive ? colors.success : colors.divider, gap: spacing.sm }, shadow[1]]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <View style={{ width: 34, height: 34, borderRadius: radius.full, backgroundColor: isActive ? colors.successTint : colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name={t.icon} size={18} color={isActive ? colors.success : colors.primary} />
                      </View>
                      <AppText variant="bodyLarge" style={{ fontWeight: '700', flex: 1 }}>
                        {t.label}
                      </AppText>
                      {isActive ? <Icon name="check-decagram" size={20} color={colors.success} /> : <Icon name="face-recognition" size={20} color={colors.onSurfaceVariant} />}
                    </View>

                    {isActive ? (
                      <Button label={`Open ${t.label}`} icon={t.icon} onPress={() => router.push(t.route as never)} />
                    ) : capturing ? (
                      <>
                        <AppText variant="caption" color={colors.onSurfaceVariant}>
                          Take a live Face-ID photo on the farm to activate this task.
                        </AppText>
                        <PhotoField
                          label="Face ID"
                          value={null}
                          onChange={(uri) => {
                            if (uri) {
                              setActivated((prev) => ({ ...prev, [t.key]: uri }));
                              setActiveCapture(null);
                              notify(`${t.label} activated`);
                            }
                          }}
                          liveOnly
                        />
                        <Button label="Cancel" variant="outline" onPress={() => setActiveCapture(null)} />
                      </>
                    ) : (
                      <Button label="Activate with Face ID" icon="face-recognition" variant="outline" onPress={() => setActiveCapture(t.key)} />
                    )}
                  </View>
                );
              })}
            </View>

            <Button
              label="Complete visit"
              icon="check-decagram-outline"
              disabled={Object.keys(activated).length === 0}
              onPress={() => setAndSync('completed', 'Visit completed')}
            />
            {Object.keys(activated).length === 0 ? (
              <AppText variant="caption" color={colors.onSurfaceVariant} style={{ textAlign: 'center', marginTop: spacing.xs }}>
                Activate at least one task on-site before completing.
              </AppText>
            ) : null}
          </>
        ) : null}

        {current === 'completed' ? (
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: '#0EA5E91A', borderRadius: radius.md, padding: spacing.md }}>
              <Icon name="check-decagram" size={18} color="#0EA5E9" />
              <AppText variant="caption" color="#0369A1" style={{ flex: 1, fontWeight: '600' }}>
                Visit completed. It now shows as fulfilled in the visits audit.
              </AppText>
            </View>
            <Button label="Log another service" icon="plus" variant="outline" onPress={() => router.push(`/add-health-record?animal=${encodeURIComponent(req.animal)}&label=${encodeURIComponent(req.animal)}` as never)} />
          </View>
        ) : null}
      </Screen>
    </View>
  );
}
