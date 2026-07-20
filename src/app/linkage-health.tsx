import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Redirect } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { CeresLinkageRecord, LinkageState, getLinkageState, syncGrant } from '@/data/ceresLinkage';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { ActionChip, AppText, GradientHeader, Icon, IconName, Screen } from '@/ui';

const FALLBACK: LinkageState = {
  environment: 'TEST',
  linkages: [],
  farms: [],
  connected: 0,
  pending: 0,
  disconnected: 0,
  totalActiveTags: 0,
  totalAlerts: 0,
  error: null,
};

function StatusRow({ ok, label, detail }: { ok: boolean | null; label: string; detail?: string }) {
  const icon: IconName = ok === null ? 'alert-circle-outline' : ok ? 'check-circle-outline' : 'close-circle-outline';
  const tone = ok === null ? colors.warning : ok ? colors.success : colors.error;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.background, marginBottom: spacing.sm }}>
      <Icon name={icon} size={18} color={tone} />
      <View style={{ flex: 1 }}>
        <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
          {label}
        </AppText>
        {detail ? (
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            {detail}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const linkageVariant = (s: CeresLinkageRecord['linkageStatus']) =>
  s === 'connected' ? 'success' : s === 'pending' ? 'warning' : s === 'error' ? 'error' : 'neutral';

/**
 * CERES Linkage Health (Admin) — status of the CERES Tag software partnership
 * integration: environment, endpoint reachability and per-property linkages.
 * Mirrors the web CeresLinkageHealthPage / useCeresIntegration.
 */
export default function LinkageHealth() {
  const { loading, isAuthenticated, isAdmin } = useAuth();
  const { data: state, loading: loadingState, reload } = useResource(getLinkageState, FALLBACK);
  const [syncing, setSyncing] = useState<string | null>(null);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!isAdmin) return <Redirect href="/(tabs)/home" />;

  const onSync = async (grantId: string) => {
    setSyncing(grantId);
    await syncGrant(grantId);
    setSyncing(null);
    reload();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader
        title="Linkage Health"
        subtitle={`${state.environment} · ${state.connected} connected · ${state.pending} pending · ${state.disconnected} disconnected`}
        showBack
      />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg }, shadow[1]]}>
          <AppText variant="bodyLarge" style={{ fontWeight: '600', marginBottom: spacing.sm }}>
            Integration endpoints
          </AppText>
          <StatusRow ok={!state.error} label="ceres-linkage edge function" detail={state.error ?? 'Linkage state retrieved successfully'} />
          <StatusRow ok={state.connected > 0} label="Software partner auth (OAuth)" detail={state.connected > 0 ? `${state.connected} active linkage(s)` : 'No connected linkages yet'} />
          <StatusRow ok={state.connected > 0} label="Customer account identifiers" detail="Issued via ceres-customer-identifiers using signed JWT" />
          <StatusRow ok={state.totalActiveTags > 0} label="Property linkage persistence" detail={`${state.totalActiveTags} active tags tracked`} />
        </View>

        <AppText variant="title" style={{ marginBottom: spacing.sm }}>
          Linkages ({state.linkages.length})
        </AppText>
        {loadingState ? (
          <AppText variant="body" color={colors.onSurfaceVariant}>
            Loading…
          </AppText>
        ) : state.linkages.length === 0 ? (
          <AppText variant="body" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.lg }}>
            No linkages yet. Connect a CERES customer from Settings → Integrations.
          </AppText>
        ) : (
          state.linkages.map((l) => (
            <View key={l.id} style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.xs, borderWidth: 1, borderColor: colors.divider }, shadow[1]]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <AppText variant="bodyLarge" style={{ fontWeight: '600', flex: 1 }}>
                  {l.farmDisplayName ?? l.propertyName}
                </AppText>
                <ActionChip label={l.linkageStatus} variant={linkageVariant(l.linkageStatus)} />
              </View>
              <AppText variant="caption" color={colors.onSurfaceVariant}>
                Sync: {l.syncState} · Tags: {l.activeTags} · Alerts: {l.alertsCount}
              </AppText>
              {l.lastError ? (
                <AppText variant="caption" color={colors.error}>
                  {l.lastError}
                </AppText>
              ) : null}
              <Pressable
                disabled={syncing === l.grantId}
                onPress={() => onSync(l.grantId)}
                style={{ alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs }}>
                <Icon name="sync" size={14} color={colors.primary} />
                <AppText variant="caption" color={colors.primary} style={{ fontWeight: '600' }}>
                  {syncing === l.grantId ? 'Syncing…' : 'Sync'}
                </AppText>
              </Pressable>
            </View>
          ))
        )}

        {state.farms.length > 0 && (
          <>
            <AppText variant="title" style={{ marginTop: spacing.md, marginBottom: spacing.sm }}>
              CERES farms ({state.farms.length})
            </AppText>
            {state.farms.map((f) => (
              <View key={f.id} style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, gap: 2, borderWidth: 1, borderColor: colors.divider }, shadow[1]]}>
                <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
                  {f.name}
                </AppText>
                <AppText variant="caption" color={colors.onSurfaceVariant}>
                  {f.region}, {f.country} · {f.animalCount} animals · {f.activeTags} active tags · health {f.healthScore}
                </AppText>
              </View>
            ))}
          </>
        )}
      </Screen>
    </View>
  );
}
