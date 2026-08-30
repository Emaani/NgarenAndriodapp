import { View } from 'react-native';
import { colors, radius, shadow, spacing } from '@/theme';
import { VetImpact } from '@/data/types';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';

/**
 * Veterinary Impact dashboard (Aug 29 2026 standup): the vet's headline reach —
 * total visits, animals managed, farmers serviced — plus the nature of services
 * delivered and the key field observations recorded.
 */
function Tile({ value, label, icon, tint }: { value: number; label: string; icon: IconName; tint: string }) {
  return (
    <View style={[{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs, borderWidth: 1, borderColor: colors.divider }, shadow[1]]}>
      <View style={{ width: 34, height: 34, borderRadius: radius.full, backgroundColor: tint + '1A', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} color={tint} />
      </View>
      <AppText variant="headline" style={{ fontWeight: '800' }}>
        {value.toLocaleString()}
      </AppText>
      <AppText variant="caption" color={colors.onSurfaceVariant}>
        {label}
      </AppText>
    </View>
  );
}

function Bar({ label, value, total, tint }: { label: string; value: number; total: number; tint: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <AppText variant="body" color={colors.onSurface}>
          {label}
        </AppText>
        <AppText variant="body" style={{ fontWeight: '700' }}>
          {value.toLocaleString()}
        </AppText>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.background, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: 8, borderRadius: 4, backgroundColor: tint }} />
      </View>
    </View>
  );
}

function ObsChip({ label, value, icon, tint }: { label: string; value: number; icon: IconName; tint: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2, backgroundColor: tint + '14', borderRadius: radius.md, paddingVertical: spacing.md, borderWidth: 1, borderColor: tint + '33' }}>
      <Icon name={icon} size={20} color={tint} />
      <AppText variant="title" style={{ fontWeight: '800' }}>
        {value.toLocaleString()}
      </AppText>
      <AppText variant="caption" color={colors.onSurfaceVariant}>
        {label}
      </AppText>
    </View>
  );
}

export function VetImpactDashboard({ impact }: { impact: VetImpact }) {
  const s = impact.services;
  const servicesTotal = s.treatment + s.vaccination + s.stockTaking + s.others;
  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Tile value={impact.totalVisits} label="Total visits" icon="clipboard-pulse-outline" tint="#2563EB" />
        <Tile value={impact.animalsManaged} label="Animals managed" icon="cow" tint="#16A34A" />
        <Tile value={impact.farmersServiced} label="Farmers serviced" icon="account-group-outline" tint="#9333EA" />
      </View>

      <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.divider }, shadow[1]]}>
        <AppText variant="bodyLarge" style={{ fontWeight: '700' }}>
          Nature of services
        </AppText>
        <Bar label="Treatment" value={s.treatment} total={servicesTotal} tint="#EF4444" />
        <Bar label="Vaccination" value={s.vaccination} total={servicesTotal} tint="#16A34A" />
        <Bar label="Stock-taking" value={s.stockTaking} total={servicesTotal} tint="#F59E0B" />
        <Bar label="Others" value={s.others} total={servicesTotal} tint="#6D874F" />
      </View>

      <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.divider }, shadow[1]]}>
        <AppText variant="bodyLarge" style={{ fontWeight: '700' }}>
          Key observations
        </AppText>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <ObsChip label="Ticks" value={impact.observations.ticks} icon="bug-outline" tint="#F59E0B" />
          <ObsChip label="Flies" value={impact.observations.flies} icon="bee" tint="#0EA5E9" />
          <ObsChip label="Disease" value={impact.observations.disease} icon="virus-outline" tint="#EF4444" />
        </View>
      </View>
    </View>
  );
}
