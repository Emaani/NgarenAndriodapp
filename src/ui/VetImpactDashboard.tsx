import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { colors, radius, shadow, spacing } from '@/theme';
import { VetImpact, VetImpactRow } from '@/data/types';
import { AppText } from './AppText';
import { BottomSheet } from './BottomSheet';
import { Icon, IconName } from './Icon';

/**
 * Veterinary Impact dashboard (Aug 29 2026 standup): the vet's headline reach —
 * total visits, animals managed, farmers serviced — plus the nature of services
 * delivered and the key field observations recorded.
 */
function Tile({ value, label, icon, tint, onPress }: { value: number; label: string; icon: IconName; tint: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs, borderWidth: 1, borderColor: colors.divider, opacity: pressed ? 0.9 : 1 }, shadow[1]]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ width: 34, height: 34, borderRadius: radius.full, backgroundColor: tint + '1A', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={18} color={tint} />
        </View>
        {onPress ? <Icon name="chevron-right" size={16} color={colors.onSurfaceVariant} /> : null}
      </View>
      <AppText variant="headline" style={{ fontWeight: '800' }}>
        {value.toLocaleString()}
      </AppText>
      <AppText variant="caption" color={colors.onSurfaceVariant}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** A scrollable list of drill-down rows, or an honest empty/portfolio note. */
function DetailList({ rows, emptyNote }: { rows: VetImpactRow[]; emptyNote: string }) {
  if (rows.length === 0) {
    return (
      <AppText variant="body" color={colors.onSurfaceVariant} style={{ paddingVertical: spacing.sm }}>
        {emptyNote}
      </AppText>
    );
  }
  return (
    <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ gap: spacing.xs }} showsVerticalScrollIndicator={false}>
      {rows.map((r, i) => (
        <View key={`${r.label}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: i === rows.length - 1 ? 0 : 1, borderBottomColor: colors.divider }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />
          <View style={{ flex: 1 }}>
            <AppText variant="body" style={{ fontWeight: '600' }}>
              {r.label}
            </AppText>
            {r.sub ? (
              <AppText variant="caption" color={colors.onSurfaceVariant}>
                {r.sub}
              </AppText>
            ) : null}
          </View>
        </View>
      ))}
    </ScrollView>
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

type Drill = 'visits' | 'animals' | 'farmers';

export function VetImpactDashboard({ impact }: { impact: VetImpact }) {
  const s = impact.services;
  const servicesTotal = s.treatment + s.vaccination + s.stockTaking + s.others;
  const [drill, setDrill] = useState<Drill | null>(null);
  const detail = impact.detail;

  const DRILLS: Record<Drill, { title: string; rows: VetImpactRow[]; empty: string }> = {
    visits: {
      title: `Total visits · ${impact.totalVisits}`,
      rows:
        detail?.visits ??
        // Fallback (browsed vet): show the service-type breakdown we do have.
        [
          { label: 'Treatment', sub: `${s.treatment} visits` },
          { label: 'Vaccination', sub: `${s.vaccination} visits` },
          { label: 'Stock-taking', sub: `${s.stockTaking} visits` },
          { label: 'Others', sub: `${s.others} visits` },
        ].filter((r) => !r.sub.startsWith('0 ')),
      empty: 'No visits recorded yet.',
    },
    animals: {
      title: `Animals managed · ${impact.animalsManaged}`,
      rows: detail?.animals ?? [],
      empty: detail ? 'No animals recorded yet.' : `${impact.animalsManaged} animals across this vet's practice (portfolio figure).`,
    },
    farmers: {
      title: `Farmers serviced · ${impact.farmersServiced}`,
      rows: detail?.farmers ?? [],
      empty: detail ? 'No farmers recorded yet.' : `${impact.farmersServiced} farmers served (portfolio figure).`,
    },
  };
  const active = drill ? DRILLS[drill] : null;

  return (
    <View style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Tile value={impact.totalVisits} label="Total visits" icon="clipboard-pulse-outline" tint="#2563EB" onPress={() => setDrill('visits')} />
        <Tile value={impact.animalsManaged} label="Animals managed" icon="cow" tint="#16A34A" onPress={() => setDrill('animals')} />
        <Tile value={impact.farmersServiced} label="Farmers serviced" icon="account-group-outline" tint="#9333EA" onPress={() => setDrill('farmers')} />
      </View>

      {/* Anonymized-by-default posture (Sep 5 2026 standup). */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <Icon name="shield-lock-outline" size={14} color={colors.onSurfaceVariant} />
        <AppText variant="caption" color={colors.onSurfaceVariant}>
          Farmer identities are anonymized to protect privacy.
        </AppText>
      </View>

      <BottomSheet visible={drill !== null} onClose={() => setDrill(null)} title={active?.title ?? ''}>
        {active ? <DetailList rows={active.rows} emptyNote={active.empty} /> : null}
      </BottomSheet>

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
