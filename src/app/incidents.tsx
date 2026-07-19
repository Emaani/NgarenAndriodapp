import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Redirect } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { getIncidents, Incident, IncidentPriority, IncidentStatus } from '@/data/ops';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { ActionChip, AppText, EmptyState, GradientHeader, Icon, Screen } from '@/ui';

const PRIORITY_COLOR: Record<IncidentPriority, string> = {
  critical: '#DC2626',
  high: '#F59E0B',
  medium: '#0EA5E9',
  low: '#6B7280',
};

function statusVariant(s: IncidentStatus) {
  if (s === 'resolved' || s === 'closed') return 'success' as const;
  if (s === 'escalated') return 'error' as const;
  if (s === 'in_progress') return 'info' as const;
  return 'warning' as const;
}

function statusLabel(s: IncidentStatus) {
  return s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

type Filter = 'all' | 'open' | 'critical';

export default function Incidents() {
  const { isAdmin, loading, isAuthenticated } = useAuth();
  const { data: incidents } = useResource(getIncidents, []);
  const [filter, setFilter] = useState<Filter>('all');

  const visible = useMemo(() => {
    if (filter === 'open') return incidents.filter((i) => i.status !== 'resolved' && i.status !== 'closed');
    if (filter === 'critical') return incidents.filter((i) => i.priority === 'critical');
    return incidents;
  }, [incidents, filter]);

  const critical = incidents.filter((i) => i.priority === 'critical').length;
  const open = incidents.filter((i) => i.status !== 'resolved' && i.status !== 'closed').length;

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!isAdmin) return <Redirect href="/(tabs)/home" />;

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: `All (${incidents.length})` },
    { key: 'open', label: `Open (${open})` },
    { key: 'critical', label: `Critical (${critical})` },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Incidents & SLA" subtitle={`${open} open · ${critical} critical`} showBack />
      <View style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.md, paddingBottom: 0 }}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: radius.full,
                backgroundColor: active ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.divider,
              }}>
              <AppText variant="caption" color={active ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>
                {f.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {visible.length === 0 ? (
          <EmptyState icon="check-circle-outline" title="No incidents" subtitle="All systems nominal." />
        ) : (
          visible.map((inc: Incident) => (
            <View
              key={inc.id}
              style={[
                { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm, borderLeftWidth: 4, borderLeftColor: PRIORITY_COLOR[inc.priority] },
                shadow[1],
              ]}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <AppText variant="caption" color={colors.onSurfaceVariant}>
                    {inc.id} · {inc.category}
                  </AppText>
                  <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
                    {inc.title}
                  </AppText>
                </View>
                <ActionChip label={statusLabel(inc.status)} variant={statusVariant(inc.status)} />
              </View>

              <AppText variant="body" color={colors.onSurface}>
                {inc.description}
              </AppText>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <Icon name="flag-variant" size={14} color={PRIORITY_COLOR[inc.priority]} />
                  <AppText variant="caption" color={PRIORITY_COLOR[inc.priority]} style={{ fontWeight: '600', textTransform: 'capitalize' }}>
                    {inc.priority}
                  </AppText>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <Icon name="account-hard-hat-outline" size={14} color={colors.onSurfaceVariant} />
                  <AppText variant="caption" color={colors.onSurfaceVariant}>
                    {inc.assignedTo}
                  </AppText>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <Icon name="timer-sand" size={14} color={colors.onSurfaceVariant} />
                  <AppText variant="caption" color={colors.onSurfaceVariant}>
                    SLA {inc.slaDeadline}
                  </AppText>
                </View>
              </View>
            </View>
          ))
        )}
      </Screen>
    </View>
  );
}
