import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { animals as animalsFallback } from '@/data/mock';
import { getHerd } from '@/data/herd';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { ageFromDate } from '@/lib/date';
import { Animal } from '@/data/types';
import { useT } from '@/i18n';
import { AnimalPhoto, AppText, EmptyState, GradientHeader, Icon, IconName, Screen } from '@/ui';

type DeviceType = 'Ceres' | 'GSAT' | 'Bluetooth';

/** Classify a device-tracked animal by the kind of tag it carries. */
function classify(a: Animal): DeviceType | null {
  const type = (a.devices?.[0]?.type ?? '').toLowerCase();
  const serial = (a.deviceSerial ?? '').toLowerCase();
  const method = (a.taggingMethod ?? '').toLowerCase();
  const id = a.identificationType;
  if (type.includes('bluetooth') || method === 'bluetooth' || id === 'bluetooth') return 'Bluetooth';
  if (type.includes('gsat') || serial.startsWith('gst') || serial.startsWith('gsat')) return 'GSAT';
  if (type.includes('ceres') || serial.startsWith('crs') || method === 'satellite' || id === 'satellite') return 'Ceres';
  if (a.deviceSerial) return 'Ceres';
  return null; // visually identified — not a device
}

const META: Record<DeviceType, { icon: IconName; tint: string }> = {
  Ceres: { icon: 'satellite-variant', tint: '#16A34A' },
  GSAT: { icon: 'access-point', tint: '#0EA5E9' },
  Bluetooth: { icon: 'bluetooth', tint: '#2563EB' },
};

/**
 * Animals by device type (Oct 2026) — reached from the dashboard "Devices" row.
 * Splits the device-tracked herd into GSAT, Ceres and Bluetooth, listing the
 * animals under each type.
 */
export default function AnimalDevices() {
  const router = useRouter();
  const t = useT();
  const { loading, isAuthenticated } = useAuth();
  const { data: herd } = useResource(getHerd, animalsFallback);

  const groups = useMemo(() => {
    const g: Record<DeviceType, Animal[]> = { Ceres: [], GSAT: [], Bluetooth: [] };
    for (const a of herd) {
      const c = classify(a);
      if (c) g[c].push(a);
    }
    return g;
  }, [herd]);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  const order: DeviceType[] = ['GSAT', 'Ceres', 'Bluetooth'];
  const total = order.reduce((s, k) => s + groups[k].length, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('adev.title')} subtitle={t('adev.subtitle', { count: total })} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {total === 0 ? (
          <EmptyState icon="tag-off-outline" title={t('adev.emptyTitle')} subtitle={t('adev.emptySub')} />
        ) : (
          order.map((type) => {
            const list = groups[type];
            if (list.length === 0) return null;
            const meta = META[type];
            return (
              <View key={type} style={{ marginBottom: spacing.lg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
                  <Icon name={meta.icon} size={18} color={meta.tint} />
                  <AppText variant="title" style={{ flex: 1 }}>{type}</AppText>
                  <AppText variant="body" color={colors.onSurfaceVariant} style={{ fontWeight: '700' }}>{list.length}</AppText>
                </View>
                {list.map((a) => (
                  <Pressable
                    key={a.id}
                    onPress={() => router.push(`/animals/${a.id}` as never)}
                    style={({ pressed }) => [
                      { flexDirection: 'row', alignItems: 'center', gap: spacing.mdMinus, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.divider, opacity: pressed ? 0.9 : 1 },
                      shadow[1],
                    ]}>
                    <AnimalPhoto uri={a.photos?.[0]} size={42} />
                    <View style={{ flex: 1 }}>
                      <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>{a.name ?? a.tag}</AppText>
                      <AppText variant="caption" color={colors.onSurfaceVariant}>
                        {(a.accountNumber ?? a.ngarenCode ?? a.tag)} · {a.breed.name} · {ageFromDate(a.dateOfBirth)}
                      </AppText>
                    </View>
                    <Icon name="chevron-right" size={18} color={colors.onSurfaceVariant} />
                  </Pressable>
                ))}
              </View>
            );
          })
        )}
      </Screen>
    </View>
  );
}
