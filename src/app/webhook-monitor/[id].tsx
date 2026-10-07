import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { CERES_DATA_DOWNLOAD_DISCLAIMER, getWebhookLogs, replayWebhook } from '@/data/ceresWebhooks';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { formatDateTime } from '@/lib/date';
import { useT, useTStatus } from '@/i18n';
import { ActionChip, AppText, Button, DetailRow, EmptyState, GradientHeader, Icon, Screen } from '@/ui';

const statusVariant = (s: string) =>
  s === 'processed' ? 'success' : s === 'duplicate' ? 'info' : s === 'failed' || s === 'error' ? 'error' : 'warning';

/** One webhook delivery — payload, diagnostics and a replay action. */
export default function WebhookDetail() {
  const t = useT();
  const tStatus = useTStatus();
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
        <GradientHeader title={t('wh.title')} showBack />
        <EmptyState icon="webhook" title={t('wh.notFoundTitle')} subtitle={t('wh.notFoundSub')} />
      </View>
    );
  }

  const onReplay = async () => {
    setReplaying(true);
    const res = await replayWebhook(log);
    setReplaying(false);
    Alert.alert(res.ok ? t('wh.replayed') : t('wh.replayFailed'), res.ok ? t('wh.replayOk') : res.message ?? t('wh.unknownError'));
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={log.webhookType} subtitle={formatDateTime(log.receivedAt)} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
          <ActionChip label={tStatus(log.status)} variant={statusVariant(log.status)} />
          <ActionChip label={log.senderVerified ? t('wh.verified') : log.verificationMethod ?? t('wh.unverified')} variant={log.senderVerified ? 'success' : 'warning'} />
        </View>

        <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md }, shadow[1]]}>
          <DetailRow label={t('wh.received')} value={formatDateTime(log.receivedAt)} />
          <DetailRow label={t('wh.processed')} value={log.processedAt ? formatDateTime(log.processedAt) : '—'} />
          <DetailRow label={t('wh.source')} value={log.sourceClass ?? t('wh.unknown')} />
          <DetailRow label={t('wh.persisted')} value={String(log.persistedCount)} />
          <DetailRow label={t('wh.duplicates')} value={String(log.duplicateCount)} />
          <DetailRow label={t('wh.retries')} value={String(log.retryCount)} />
          <DetailRow label={t('wh.delayed')} value={String(log.delayedCount)} last={!log.errorMessage && !log.authError} />
          {log.errorMessage ? <DetailRow label={t('wh.error')} value={log.errorMessage} last={!log.authError} /> : null}
          {log.authError ? <DetailRow label={t('wh.authError')} value={log.authError} last /> : null}
        </View>

        <AppText variant="title" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
          {t('wh.payload')}
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

        <Button label={t('wh.replayBtn')} icon="replay" variant="outline" loading={replaying} onPress={onReplay} style={{ marginTop: spacing.lg, marginBottom: spacing.lg }} />
      </Screen>
    </View>
  );
}
