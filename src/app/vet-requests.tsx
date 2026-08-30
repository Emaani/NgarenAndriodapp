import { Pressable, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { calloutRequests as calloutFallback } from '@/data/mock';
import { getCalloutRequests } from '@/data/api';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { CalloutRequest, CalloutStatus, CalloutUrgency } from '@/data/types';
import { ActionChip, AppText, Button, EmptyState, GradientHeader, Icon, IconChip, Screen } from '@/ui';

const urgencyVariant = (u: CalloutUrgency) =>
  u === 'Emergency' ? 'error' : 'neutral';

const statusVariant = (s: CalloutStatus) =>
  s === 'accepted' ? 'success' : s === 'completed' ? 'info' : s === 'declined' ? 'error' : 'warning';

/**
 * Farmer vet activity — view the status of vet call-out requests you've booked
 * and start a new one. Addresses the "no vet activity on the farmer side"
 * tester feedback.
 */
export default function VetRequests() {
  const router = useRouter();
  const { loading, isAuthenticated } = useAuth();
  const { data: requests } = useResource(() => getCalloutRequests(), calloutFallback);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  const pending = requests.filter((r) => r.status === 'pending').length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Vet Requests" subtitle={`${requests.length} requests · ${pending} pending`} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        <Button
          label="Book a vet call-out"
          icon="stethoscope"
          onPress={() => router.push('/find-vet')}
          style={{ marginBottom: spacing.md }}
        />

        {requests.length === 0 ? (
          <EmptyState
            icon="clipboard-pulse-outline"
            title="No vet requests yet"
            subtitle="Book a call-out and track its status here."
            actionLabel="Find a Vet"
            onAction={() => router.push('/find-vet')}
          />
        ) : (
          requests.map((r: CalloutRequest) => (
            <Pressable
              key={r.id}
              onPress={() => router.push(`/vet-request/${r.id}` as never)}
              style={({ pressed }) => [
                { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm, borderWidth: 1, borderColor: colors.divider, opacity: pressed ? 0.9 : 1 },
                shadow[1],
              ]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.mdMinus }}>
                <IconChip icon="cow" />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
                    {r.animal}
                  </AppText>
                  <AppText variant="caption" color={colors.onSurfaceVariant}>
                    {r.locationName} · {r.requestedAt}
                  </AppText>
                </View>
                <ActionChip label={r.urgency} variant={urgencyVariant(r.urgency)} />
              </View>

              {!!r.notes && (
                <AppText variant="body" color={colors.onSurface}>
                  “{r.notes}”
                </AppText>
              )}

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <ActionChip label={r.status[0].toUpperCase() + r.status.slice(1)} variant={statusVariant(r.status)} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <AppText variant="caption" color={colors.primary} style={{ fontWeight: '600' }}>
                    View details
                  </AppText>
                  <Icon name="chevron-right" size={16} color={colors.primary} />
                </View>
              </View>
            </Pressable>
          ))
        )}
      </Screen>
    </View>
  );
}
