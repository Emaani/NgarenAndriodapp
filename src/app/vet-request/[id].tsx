import { View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { calloutRequests as calloutFallback } from '@/data/mock';
import { getCalloutRequests } from '@/data/api';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { CalloutRequest, CalloutStatus, CalloutUrgency } from '@/data/types';
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loading, isAuthenticated } = useAuth();
  const { data: requests } = useResource(() => getCalloutRequests(), calloutFallback);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  const req: CalloutRequest | undefined = requests.find((r) => r.id === Number(id));

  if (!req) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <GradientHeader title="Vet request" showBack />
        <EmptyState icon="clipboard-pulse-outline" title="Request not found" subtitle="This request may have been removed." />
      </View>
    );
  }

  const accepted = req.status === 'accepted' || req.status === 'completed';
  const declined = req.status === 'declined';
  const completed = req.status === 'completed';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Vet request" subtitle={req.animal} showBack />
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
              {req.locationName} · requested {req.requestedAt}
            </AppText>
          </View>
          <ActionChip label={req.status[0].toUpperCase() + req.status.slice(1)} variant={statusVariant(req.status)} />
        </View>

        {/* Details */}
        <AppText variant="title" style={{ marginBottom: spacing.sm }}>
          Details
        </AppText>
        <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md, marginBottom: spacing.lg }, shadow[1]]}>
          <DetailRow label="Animal" value={req.animal} />
          <DetailRow label="Priority" value={req.urgency} />
          <DetailRow label="SLA" value={req.urgency === 'Emergency' ? 'Response within 4 hours' : 'Response within 48 hours'} />
          <DetailRow label="Location" value={req.locationName} />
          <DetailRow label="Distance" value={`${req.distanceKm} km`} />
          <DetailRow label="Requested" value={req.requestedAt} />
          <DetailRow label="Requested by" value={req.farmerName} last={!req.notes} />
          {req.notes ? <DetailRow label="Notes" value={req.notes} last /> : null}
        </View>

        {/* Priority hint */}
        {req.urgency === 'Emergency' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.errorTint, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg }}>
            <Icon name="alert-decagram-outline" size={18} color={colors.error} />
            <AppText variant="caption" color={colors.error} style={{ flex: 1, fontWeight: '600' }}>
              Marked as an emergency — prioritised for the fastest available vet.
            </AppText>
          </View>
        ) : null}

        {/* Lifecycle timeline */}
        <AppText variant="title" style={{ marginBottom: spacing.sm }}>
          Progress
        </AppText>
        <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.divider }, shadow[1]]}>
          <Step icon="clipboard-check-outline" title="Requested" subtitle={req.requestedAt} state="done" />
          {declined ? (
            <Step icon="close-circle-outline" title="Declined" subtitle="No vet was able to take this request" state="failed" last />
          ) : (
            <>
              <Step
                icon="account-check-outline"
                title="Accepted by a vet"
                subtitle={accepted ? 'A vet has accepted and is scheduled' : 'Waiting for a nearby vet to accept'}
                state={accepted ? 'done' : 'current'}
              />
              <Step
                icon="check-decagram-outline"
                title="Visit completed"
                subtitle={completed ? 'The vet completed the visit' : 'Pending the visit'}
                state={completed ? 'done' : 'todo'}
                last
              />
            </>
          )}
        </View>

        {/* Relevant actions */}
        <Button label="View on map" icon="map-marker-radius" variant="outline" onPress={() => router.push('/(tabs)/track')} style={{ marginBottom: spacing.sm }} />
        {completed ? (
          <Button
            label="Rate this visit"
            icon="star-outline"
            onPress={() => router.push(`/rate-vet?animal=${encodeURIComponent(req.animal)}&service=${encodeURIComponent(req.urgency + ' visit')}` as never)}
            style={{ marginBottom: spacing.sm }}
          />
        ) : (
          <Button label="Book another vet" icon="stethoscope" onPress={() => router.push('/find-vet')} style={{ marginBottom: spacing.sm }} />
        )}
      </Screen>
    </View>
  );
}
