import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { animals as animalsFallback } from '@/data/mock';
import { getAnimals } from '@/data/api';
import { useResource } from '@/data/hooks';
import { Animal } from '@/data/types';
import { AppText, Button, GradientHeader, Icon, IconChip, Screen } from '@/ui';

type Mark = 'pending' | 'present' | 'missing';
type Phase = 'count' | 'summary';

function ProgressBar({ value }: { value: number }) {
  return (
    <View
      style={{
        height: 8,
        borderRadius: radius.full,
        backgroundColor: 'rgba(255,255,255,0.3)',
        overflow: 'hidden',
      }}>
      <View
        style={{
          width: `${Math.round(value * 100)}%`,
          height: '100%',
          borderRadius: radius.full,
          backgroundColor: '#fff',
        }}
      />
    </View>
  );
}

function MarkButton({
  label,
  icon,
  active,
  activeColor,
  onPress,
}: {
  label: string;
  icon: 'check' | 'close';
  active: boolean;
  activeColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        backgroundColor: active ? activeColor : colors.background,
        borderWidth: 1,
        borderColor: active ? activeColor : colors.divider,
      }}>
      <Icon name={icon} size={16} color={active ? '#fff' : colors.onSurfaceVariant} />
      <AppText variant="body" color={active ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>
        {label}
      </AppText>
    </Pressable>
  );
}

function AnimalRow({
  animal,
  mark,
  onMark,
}: {
  animal: Animal;
  mark: Mark;
  onMark: (m: Mark) => void;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          padding: spacing.md,
          gap: spacing.mdMinus,
          marginBottom: spacing.mdMinus,
          borderWidth: 1,
          borderColor: colors.divider,
        },
        shadow[1],
      ]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.mdMinus }}>
        <IconChip icon="cow" />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
            {animal.name ?? animal.tag}
          </AppText>
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            {animal.tag} · {animal.locationName ?? '—'}
          </AppText>
        </View>
        {mark === 'present' && <Icon name="check-circle" size={22} color={colors.success} />}
        {mark === 'missing' && <Icon name="alert-circle" size={22} color={colors.error} />}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <MarkButton
          label="Present"
          icon="check"
          active={mark === 'present'}
          activeColor={colors.success}
          onPress={() => onMark(mark === 'present' ? 'pending' : 'present')}
        />
        <MarkButton
          label="Missing"
          icon="close"
          active={mark === 'missing'}
          activeColor={colors.error}
          onPress={() => onMark(mark === 'missing' ? 'pending' : 'missing')}
        />
      </View>
    </View>
  );
}

function SummaryStat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={[{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: spacing.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.divider }, shadow[1]]}>
      <AppText variant="display" color={color}>
        {value}
      </AppText>
      <AppText variant="caption" color={colors.onSurfaceVariant}>
        {label}
      </AppText>
    </View>
  );
}

export default function StockTake() {
  const router = useRouter();
  const { data: allAnimals } = useResource(() => getAnimals(), animalsFallback);
  const [marks, setMarks] = useState<Record<number, Mark>>(() =>
    Object.fromEntries(animalsFallback.map((a) => [a.id, 'pending' as Mark])),
  );
  const [phase, setPhase] = useState<Phase>('count');

  // Add any newly-loaded animals to the count sheet as pending.
  useEffect(() => {
    setMarks((prev) => {
      const next = { ...prev };
      for (const a of allAnimals) if (!(a.id in next)) next[a.id] = 'pending';
      return next;
    });
  }, [allAnimals]);

  const counted = useMemo(
    () => allAnimals.filter((a) => marks[a.id] !== 'pending').length,
    [marks],
  );
  const present = useMemo(
    () => allAnimals.filter((a) => marks[a.id] === 'present').length,
    [marks],
  );
  const missing = useMemo(
    () => allAnimals.filter((a) => marks[a.id] === 'missing').length,
    [marks],
  );
  const notCounted = allAnimals.length - counted;
  const progress = allAnimals.length ? counted / allAnimals.length : 0;

  const setMark = (id: number, m: Mark) => setMarks((prev) => ({ ...prev, [id]: m }));
  const markRemaining = (m: Mark) =>
    setMarks((prev) => {
      const next = { ...prev };
      for (const a of allAnimals) if (next[a.id] === 'pending') next[a.id] = m;
      return next;
    });

  if (phase === 'summary') {
    const missingAnimals = allAnimals.filter((a) => marks[a.id] === 'missing');
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <GradientHeader title="Stock Take Report" subtitle="Review of today's count" showBack />
        <Screen contentStyle={{ paddingTop: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
            <SummaryStat value={present} label="Present" color={colors.success} />
            <SummaryStat value={missing} label="Missing" color={colors.error} />
            <SummaryStat value={notCounted} label="Not counted" color={colors.onSurfaceVariant} />
          </View>

          {missingAnimals.length > 0 && (
            <>
              <AppText variant="overline" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>
                Animals to follow up
              </AppText>
              {missingAnimals.map((a) => (
                <View
                  key={a.id}
                  style={[
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.mdMinus,
                      backgroundColor: colors.surface,
                      borderRadius: radius.md,
                      padding: spacing.md,
                      marginBottom: spacing.sm,
                      borderWidth: 1,
                      borderColor: colors.divider,
                    },
                    shadow[1],
                  ]}>
                  <IconChip icon="cow" bg={colors.errorTint} fg={colors.error} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
                      {a.name ?? a.tag}
                    </AppText>
                    <AppText variant="caption" color={colors.onSurfaceVariant}>
                      Last seen: {a.locationName ?? '—'}
                    </AppText>
                  </View>
                  <Pressable onPress={() => router.push('/(tabs)/track')} hitSlop={8}>
                    <Icon name="map-marker-radius" size={22} color={colors.primary} />
                  </Pressable>
                </View>
              ))}
            </>
          )}

          <Button
            label="Submit Report"
            icon="content-save-check"
            onPress={() => router.replace('/(tabs)/home')}
            style={{ marginTop: spacing.md }}
          />
          <Button
            label="Back to Count"
            variant="outline"
            onPress={() => setPhase('count')}
            style={{ marginTop: spacing.sm }}
          />
        </Screen>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Stock Take" subtitle="Verify your herd against the register" showBack>
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <AppText variant="body" color="rgba(255,255,255,0.92)">
              {counted} of {allAnimals.length} counted
            </AppText>
            <AppText variant="body" color="#fff" style={{ fontWeight: '600' }}>
              {present} present · {missing} missing
            </AppText>
          </View>
          <ProgressBar value={progress} />
        </View>
      </GradientHeader>

      <View style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.md, paddingBottom: 0 }}>
        <Pressable
          onPress={() => markRemaining('present')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Icon name="check-all" size={16} color={colors.success} />
          <AppText variant="body" color={colors.success} style={{ fontWeight: '600' }}>
            Mark remaining present
          </AppText>
        </Pressable>
      </View>

      <Screen contentStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xxl + 72 }}>
        {allAnimals.map((a) => (
          <AnimalRow key={a.id} animal={a} mark={marks[a.id] ?? 'pending'} onMark={(m) => setMark(a.id, m)} />
        ))}
      </Screen>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: spacing.md,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.divider,
        }}>
        <Button
          label={notCounted > 0 ? `Review (${notCounted} not counted)` : 'Review Stock Take'}
          icon="clipboard-check-outline"
          onPress={() => setPhase('summary')}
        />
      </View>
    </View>
  );
}
