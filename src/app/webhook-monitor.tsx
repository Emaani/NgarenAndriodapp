import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { buildIngestionSummary, getWebhookLogs, WebhookLog } from '@/data/ceresWebhooks';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { formatDateTime } from '@/lib/date';
import { ActionChip, AppText, GradientHeader, Icon, IconName, SearchBar, Screen } from '@/ui';

const TYPES = ['all', 'alerts', 'historical', 'standard', 'pfi', 'activity', 'repro'];

const statusVariant = (s: string) =>
  s === 'processed' ? 'success' : s === 'duplicate' ? 'info' : s === 'failed' || s === 'error' ? 'error' : 'warning';

function StatTile({ value, label, icon, tint }: { value: number; label: string; icon: IconName; tint: string }) {
  return (
    <View style={[{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.divider }, shadow[1]]}>
      <Icon name={icon} size={16} color={tint} />
      <AppText variant="title" color={tint}>
        {value}
      </AppText>
      <AppText variant="caption" color={colors.onSurfaceVariant}>
        {label}
      </AppText>
    </View>
  );
}

/**
 * CERES Webhook Monitor (Admin) — inspect and replay CERES webhook deliveries.
 * Reads ceres_webhook_log directly; mirrors the web CeresWebhookMonitorPage.
 */
export default function WebhookMonitor() {
  const router = useRouter();
  const { loading, isAuthenticated, isAdmin } = useAuth();
  const [type, setType] = useState('all');
  const [search, setSearch] = useState('');
  const { data: rows, loading: loadingRows, reload } = useResource(() => getWebhookLogs(type), []);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) => !search || r.webhookType.toLowerCase().includes(search.toLowerCase()) || JSON.stringify(r.payload).toLowerCase().includes(search.toLowerCase()),
      ),
    [rows, search],
  );
  const summary = useMemo(() => buildIngestionSummary(rows), [rows]);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!isAdmin) return <Redirect href="/(tabs)/home" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Webhook Monitor" subtitle="Inspect, debug and replay CERES deliveries" showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
          <StatTile value={summary.total} label="Total" icon="webhook" tint={colors.primary} />
          <StatTile value={summary.processed} label="Processed" icon="check-circle-outline" tint={colors.success} />
          <StatTile value={summary.failed} label="Failed" icon="close-circle-outline" tint={summary.failed > 0 ? colors.error : colors.onSurfaceVariant} />
          <StatTile value={summary.uniqueTags} label="Tags" icon="tag-outline" tint="#0EA5E9" />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }} contentContainerStyle={{ gap: spacing.xs }}>
          {TYPES.map((t) => (
            <Pressable
              key={t}
              onPress={() => setType(t)}
              style={{
                paddingHorizontal: spacing.mdMinus,
                paddingVertical: spacing.xs,
                borderRadius: radius.full,
                backgroundColor: type === t ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: type === t ? colors.primary : colors.divider,
              }}>
              <AppText variant="caption" color={type === t ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>
                {t}
              </AppText>
            </Pressable>
          ))}
        </ScrollView>

        <SearchBar value={search} onChangeText={setSearch} placeholder="Search payload or type..." />

        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginVertical: spacing.sm }}>
          {loadingRows ? 'Loading…' : `${filtered.length} deliveries · last received ${summary.lastReceived ? formatDateTime(summary.lastReceived) : '—'}`}
        </AppText>

        {!loadingRows && filtered.length === 0 && (
          <AppText variant="body" color={colors.onSurfaceVariant} style={{ textAlign: 'center', paddingVertical: spacing.xl }}>
            No deliveries.
          </AppText>
        )}

        {filtered.map((r: WebhookLog) => (
          <Pressable
            key={r.id}
            onPress={() => router.push(`/webhook-monitor/${r.id}` as never)}
            style={({ pressed }) => [
              { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.xs, borderWidth: 1, borderColor: colors.divider, opacity: pressed ? 0.9 : 1 },
              shadow[1],
            ]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
                {r.webhookType}
              </AppText>
              <ActionChip label={r.status} variant={statusVariant(r.status)} />
            </View>
            <AppText variant="caption" color={colors.onSurfaceVariant}>
              {formatDateTime(r.receivedAt)}
              {r.errorMessage ? ` · ${r.errorMessage}` : ''}
            </AppText>
          </Pressable>
        ))}

        <Pressable onPress={() => reload()} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.md }}>
          <Icon name="reload" size={16} color={colors.primary} />
          <AppText variant="body" color={colors.primary} style={{ fontWeight: '600' }}>
            Refresh
          </AppText>
        </Pressable>
      </Screen>
    </View>
  );
}
