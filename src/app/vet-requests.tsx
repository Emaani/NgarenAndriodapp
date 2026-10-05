import { Pressable, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { calloutRequests as calloutFallback } from '@/data/mock';
import { getCalloutRequests } from '@/data/api';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { CalloutRequest, CalloutStatus, CalloutUrgency } from '@/data/types';
import { useT, useTStatus } from '@/i18n';
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
  const t = useT();
  const tStatus = useTStatus();
  const { loading, isAuthenticated } = useAuth();
  const { data: requests } = useResource(() => getCalloutRequests(), calloutFallback);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  const pending = requests.filter((r) => r.status === 'pending').length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('action.vetRequests')} subtitle={t('vetReq.subtitle', { count: requests.length, pending })} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        <Button
          label={t('vetReq.book')}
          icon="stethoscope"
          onPress={() => router.push('/find-vet')}
          style={{ marginBottom: spacing.md }}
        />

        {requests.length === 0 ? (
          <EmptyState
            icon="clipboard-pulse-outline"
            title={t('vetReq.emptyTitle')}
            subtitle={t('vetReq.emptySub')}
            actionLabel={t('action.findVet')}
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
                <ActionChip label={t(`urgency.${r.urgency.toLowerCase()}`)} variant={urgencyVariant(r.urgency)} />
              </View>

              {!!r.notes && (
                <AppText variant="body" color={colors.onSurface}>
                  “{r.notes}”
                </AppText>
              )}

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <ActionChip label={tStatus(r.status)} variant={statusVariant(r.status)} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <AppText variant="caption" color={colors.primary} style={{ fontWeight: '600' }}>
                    {t('vetReq.viewDetails')}
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
