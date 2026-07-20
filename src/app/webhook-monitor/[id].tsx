import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { CERES_DATA_DOWNLOAD_DISCLAIMER, getWebhookLogs, replayWebhook } from '@/data/ceresWebhooks';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { formatDateTime } from '@/lib/date';
import { ActionChip, AppText, Button, DetailRow, EmptyState, GradientHeader, Icon, Screen } from '@/ui';

const statusVariant = (s: string) =>
  s === 'processed' ? 'success' : s === 'duplicate' ? 'info' : s === 'failed' || s === 'error' ? 'error' : 'warning';

/** One webhook delivery — payload, diagnostics and a replay action. */
export default function WebhookDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loading, isAuthenticated, isAdmin } = useAuth();
  const { data: rows } = useResource(() => getWebhookLogs(), []);
  const [replaying, setReplaying] = useState(false);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!isAdmin) return <Redirect href="/(tabs)/home" />;

  const log = rows.find((r) => r.id === id);

  if (!log) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <GradientHeader title="Webhook" showBack />
        <EmptyState icon="webhook" title="Delivery not found" subtitle="It may have rolled off the last 100 deliveries." />
      </View>
    );
  }

  const onReplay = async () => {
    setReplaying(true);
    const res = await replayWebhook(log);
    setReplaying(false);
    Alert.alert(res.ok ? 'Replayed' : 'Replay failed', res.ok ? 'The delivery was resubmitted.' : res.message ?? 'Unknown error');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={log.webhookType} subtitle={formatDateTime(log.receivedAt)} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
          <ActionChip label={log.status} variant={statusVariant(log.status)} />
          <ActionChip label={log.senderVerified ? 'verified' : log.verificationMethod ?? 'unverified'} variant={log.senderVerified ? 'success' : 'warning'} />
        </View>

        <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md }, shadow[1]]}>
          <DetailRow label="Received" value={formatDateTime(log.receivedAt)} />
          <DetailRow label="Processed" value={log.processedAt ? formatDateTime(log.processedAt) : '—'} />
          <DetailRow label="Source" value={log.sourceClass ?? 'unknown'} />
          <DetailRow label="Persisted" value={String(log.persistedCount)} />
          <DetailRow label="Duplicates" value={String(log.duplicateCount)} />
          <DetailRow label="Retries" value={String(log.retryCount)} />
          <DetailRow label="Delayed" value={String(log.delayedCount)} last={!log.errorMessage && !log.authError} />
          {log.errorMessage ? <DetailRow label="Error" value={log.errorMessage} last={!log.authError} /> : null}
          {log.authError ? <DetailRow label="Auth error" value={log.authError} last /> : null}
        </View>

        <AppText variant="title" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
          Payload
        </AppText>
        <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md }, shadow[1]]}>
          <AppText variant="caption" style={{ fontFamily: 'monospace' }} color={colors.onSurface}>
            {JSON.stringify(log.payload, null, 2)}
          </AppText>
        </View>

        {/* SWP §Data Download: required disclaimer when raw CERES data is shown. */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: spacing.xs,
            marginTop: spacing.md,
            padding: spacing.md,
            borderRadius: radius.md,
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.divider,
          }}>
          <Icon name="information-outline" size={14} color={colors.onSurfaceVariant} />
          <AppText variant="caption" color={colors.onSurfaceVariant} style={{ flex: 1 }}>
            <AppText variant="caption" style={{ fontWeight: '700' }} color={colors.onSurface}>
              CERES TAG Data Notice:{' '}
            </AppText>
            {CERES_DATA_DOWNLOAD_DISCLAIMER}
          </AppText>
        </View>

        <Button label="Replay delivery" icon="replay" variant="outline" loading={replaying} onPress={onReplay} style={{ marginTop: spacing.lg, marginBottom: spacing.lg }} />
      </Screen>
    </View>
  );
}
