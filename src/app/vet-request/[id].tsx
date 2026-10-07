import { View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { calloutRequests as calloutFallback } from '@/data/mock';
import { getCalloutRequests } from '@/data/api';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { CalloutRequest, CalloutStatus, CalloutUrgency } from '@/data/types';
import { useT, useTStatus } from '@/i18n';
import { ActionChip, AppText, Button, DetailRow, EmptyState, GradientHeader, Icon, IconName, Screen } from '@/ui';

const urgencyVariant = (u: CalloutUrgency) => (u === 'Emergency' ? 'error' : 'neutral');
const statusVariant = (s: CalloutStatus) =>
  s === 'accepted' ? 'success' : s === 'completed' ? 'info' : s === 'declined' ? 'error' : 'warning';

/** A step in the request's lifecycle timeline. */
function Step({ icon, title, subtitle, state, last }: { icon: IconName; title: string; subtitle?: string; state: 'done' | 'current' | 'todo' | 'failed'; last?: boolean }) {
  const tint =
    state === 'done' ? colors.success : state === 'current' ? colors.primary : state === 'failed' ? colors.error : colors.onSurfaceVariant;
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: state === 'todo' ? colors.background : tint + '1A', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: tint + '55' }}>
          <Icon name={icon} size={17} color={tint} />
        </View>
        {!last ? <View style={{ width: 2, flex: 1, backgroundColor: colors.divider, marginVertical: 2 }} /> : null}
      </View>
      <View style={{ flex: 1, paddingBottom: last ? 0 : spacing.md }}>
        <AppText variant="body" style={{ fontWeight: '700' }} color={state === 'todo' ? colors.onSurfaceVariant : colors.onSurface}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Vet request detail — the full record for one call-out a farmer booked:
 * animal, priority, location, timing, notes, and a lifecycle timeline
 * (requested → accepted/declined → completed).
 */
export default function VetRequestDetail() {
  const router = useRouter();
  const t = useT();
  const tStatus = useTStatus();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loading, isAuthenticated } = useAuth();
  const { data: requests } = useResource(() => getCalloutRequests(), calloutFallback);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  const req: CalloutRequest | undefined = requests.find((r) => r.id === Number(id));

  if (!req) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <GradientHeader title={t('vrq.title')} showBack />
        <EmptyState icon="clipboard-pulse-outline" title={t('vrq.notFoundTitle')} subtitle={t('vrq.notFoundSub')} />
      </View>
    );
  }

  const accepted = req.status === 'accepted' || req.status === 'completed';
  const declined = req.status === 'declined';
  const completed = req.status === 'completed';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('vrq.title')} subtitle={req.animal} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {/* Status summary */}
        <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.divider }, shadow[1]]}>
          <View style={{ width: 46, height: 46, borderRadius: radius.full, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="stethoscope" size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="bodyLarge" style={{ fontWeight: '700' }}>
              {req.animal}
            </AppText>
            <AppText variant="caption" color={colors.onSurfaceVariant}>
              {t('vrq.reqMeta', { location: req.locationName, time: req.requestedAt })}
            </AppText>
          </View>
          <ActionChip label={tStatus(req.status)} variant={statusVariant(req.status)} />
        </View>

        {/* Details */}
        <AppText variant="title" style={{ marginBottom: spacing.sm }}>
          {t('vrq.details')}
        </AppText>
        <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md, marginBottom: spacing.lg }, shadow[1]]}>
          <DetailRow label={t('ad.animalTitle')} value={req.animal} />
          <DetailRow label={t('vrq.priority')} value={t(`urgency.${req.urgency.toLowerCase()}`)} />
          <DetailRow label="SLA" value={req.urgency === 'Emergency' ? t('fv.slaEmergency') : t('fv.slaRoutine')} />
          <DetailRow label={t('ad.location')} value={req.locationName} />
          <DetailRow label={t('vrq.distance')} value={`${req.distanceKm} km`} />
          <DetailRow label={t('vrq.requested')} value={req.requestedAt} />
          <DetailRow label={t('vrq.requestedBy')} value={req.farmerName} last={!req.notes} />
          {req.notes ? <DetailRow label={t('ad.notes')} value={req.notes} last /> : null}
        </View>

        {/* Priority hint */}
        {req.urgency === 'Emergency' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.errorTint, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg }}>
            <Icon name="alert-decagram-outline" size={18} color={colors.error} />
            <AppText variant="caption" color={colors.error} style={{ flex: 1, fontWeight: '600' }}>
              {t('vrq.emergencyHint')}
            </AppText>
          </View>
        ) : null}

        {/* Lifecycle timeline */}
        <AppText variant="title" style={{ marginBottom: spacing.sm }}>
          {t('vrq.progress')}
        </AppText>
        <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.divider }, shadow[1]]}>
          <Step icon="clipboard-check-outline" title={t('vrq.sRequested')} subtitle={req.requestedAt} state="done" />
          {declined ? (
            <Step icon="close-circle-outline" title={t('vrq.sDeclined')} subtitle={t('vrq.sDeclinedSub')} state="failed" last />
          ) : (
            <>
              <Step
                icon="account-check-outline"
                title={t('vrq.sAccepted')}
                subtitle={accepted ? t('vrq.sAcceptedDone') : t('vrq.sAcceptedWait')}
                state={accepted ? 'done' : 'current'}
              />
              <Step
                icon="check-decagram-outline"
                title={t('vrq.sCompleted')}
                subtitle={completed ? t('vrq.sCompletedDone') : t('vrq.sCompletedPending')}
                state={completed ? 'done' : 'todo'}
                last
              />
            </>
          )}
        </View>

        {/* Relevant actions */}
        <Button label={t('vet.viewOnMap')} icon="map-marker-radius" variant="outline" onPress={() => router.push('/(tabs)/track')} style={{ marginBottom: spacing.sm }} />
        {completed ? (
          <Button
            label={t('vrq.rateVisit')}
            icon="star-outline"
            onPress={() => router.push(`/rate-vet?animal=${encodeURIComponent(req.animal)}&service=${encodeURIComponent(req.urgency + ' visit')}` as never)}
            style={{ marginBottom: spacing.sm }}
          />
        ) : (
          <Button label={t('vrq.bookAnother')} icon="stethoscope" onPress={() => router.push('/find-vet')} style={{ marginBottom: spacing.sm }} />
        )}
      </Screen>
    </View>
  );
}
