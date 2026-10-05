import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Redirect, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { animals as animalsFallback } from '@/data/mock';
import { getHerd } from '@/data/herd';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { Animal } from '@/data/types';
import { useT } from '@/i18n';
import { AppText, Button, GradientHeader, Icon, IconChip, IconName, Screen } from '@/ui';

type Mark = 'pending' | 'present' | 'missing';
type Phase = 'method' | 'count' | 'summary';
type StockMethod = 'photo' | 'bluetooth' | 'qr' | 'manual';

// Stock take is a non-satellite verification: you confirm each animal in front
// of you by whatever tag it carries (tester feedback Q9). title/blurb hold i18n
// keys, translated at render.
const METHODS: { value: StockMethod; icon: IconName; title: string; blurb: string }[] = [
  { value: 'photo', icon: 'camera-outline', title: 'stock.photoTitle', blurb: 'stock.photoBlurb' },
  { value: 'bluetooth', icon: 'bluetooth', title: 'stock.bleTitle', blurb: 'stock.bleBlurb' },
  { value: 'qr', icon: 'qrcode-scan', title: 'stock.qrTitle', blurb: 'stock.qrBlurb' },
  { value: 'manual', icon: 'gesture-tap', title: 'stock.manualTitle', blurb: 'stock.manualBlurb' },
];

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
  photoMode,
  photoUri,
  onCapture,
}: {
  animal: Animal;
  mark: Mark;
  onMark: (m: Mark) => void;
  photoMode?: boolean;
  photoUri?: string;
  onCapture?: () => void;
}) {
  const t = useT();
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
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={{ width: 38, height: 38, borderRadius: radius.sm }} />
        ) : (
          <IconChip icon="cow" />
        )}
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
        {/* Photo mode: confirming presence requires a current picture. */}
        {photoMode && mark !== 'present' ? (
          <MarkButton label={t('stock.photoToConfirm')} icon="check" active={false} activeColor={colors.success} onPress={() => onCapture?.()} />
        ) : (
          <MarkButton
            label={t('stock.present')}
            icon="check"
            active={mark === 'present'}
            activeColor={colors.success}
            onPress={() => onMark(mark === 'present' ? 'pending' : 'present')}
          />
        )}
        <MarkButton
          label={t('stock.absent')}
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
  const t = useT();
  const { can } = useAuth();
  const { data: allAnimals } = useResource(getHerd, animalsFallback);
  const [marks, setMarks] = useState<Record<number, Mark>>(() =>
    Object.fromEntries(animalsFallback.map((a) => [a.id, 'pending' as Mark])),
  );
  const [phase, setPhase] = useState<Phase>('method');
  const [method, setMethod] = useState<StockMethod>('photo');
  // Confirmation photos captured in photo mode, keyed by animal id.
  const [photos, setPhotos] = useState<Record<number, string>>({});

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
    [marks, allAnimals],
  );
  const present = useMemo(
    () => allAnimals.filter((a) => marks[a.id] === 'present').length,
    [marks, allAnimals],
  );
  const missing = useMemo(
    () => allAnimals.filter((a) => marks[a.id] === 'missing').length,
    [marks, allAnimals],
  );
  const notCounted = allAnimals.length - counted;
  const progress = allAnimals.length ? counted / allAnimals.length : 0;

  const setMark = (id: number, m: Mark) => setMarks((prev) => ({ ...prev, [id]: m }));

  // Photo mode: taking a current picture is what confirms presence.
  const captureFor = async (id: number) => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return;
      const res = await ImagePicker.launchCameraAsync({ quality: 0.5 });
      if (!res.canceled && res.assets?.[0]) {
        setPhotos((prev) => ({ ...prev, [id]: res.assets[0].uri }));
        setMark(id, 'present');
      }
    } catch {
      // camera unavailable — leave unmarked
    }
  };
  const markRemaining = (m: Mark) =>
    setMarks((prev) => {
      const next = { ...prev };
      for (const a of allAnimals) if (next[a.id] === 'pending') next[a.id] = m;
      return next;
    });

  // BLE: associate every animal whose tag is broadcasting (has a linked, active
  // device) as present in one pass — the "acceptance" step of a BLE round.
  const associateBleTags = () =>
    setMarks((prev) => {
      const next = { ...prev };
      for (const a of allAnimals) {
        if (a.deviceSerial && a.status === 'active' && next[a.id] === 'pending') next[a.id] = 'present';
      }
      return next;
    });

  // QR: mark the next uncounted animal present, simulating scanning one tag.
  const scanNextTag = () => {
    const nextPending = allAnimals.find((a) => (marks[a.id] ?? 'pending') === 'pending');
    if (nextPending) setMark(nextPending.id, 'present');
  };

  const activeMethod = METHODS.find((m) => m.value === method)!;

  // Defence in depth: a delegated member without stock-take rights can't reach
  // this even via a deep link (the dashboard action is already hidden).
  if (!can('stock_take')) return <Redirect href="/(tabs)/home" />;

  // Step 1 — choose how this herd is tagged before counting.
  if (phase === 'method') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <GradientHeader title={t('action.stockTake')} subtitle={t('stock.methodSubtitle')} showBack />
        <Screen contentStyle={{ paddingTop: spacing.md }}>
          <AppText variant="body" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.md }}>
            {t('stock.intro')}
          </AppText>
          {METHODS.map((m) => {
            const selected = method === m.value;
            return (
              <Pressable
                key={m.value}
                onPress={() => setMethod(m.value)}
                style={[
                  {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    padding: spacing.md,
                    marginBottom: spacing.sm,
                    borderRadius: radius.md,
                    backgroundColor: colors.surface,
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? colors.primary : colors.divider,
                  },
                  shadow[1],
                ]}>
                <IconChip
                  icon={m.icon}
                  bg={selected ? colors.primaryTint : colors.background}
                  fg={selected ? colors.primary : colors.onSurfaceVariant}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
                    {t(m.title)}
                  </AppText>
                  <AppText variant="caption" color={colors.onSurfaceVariant}>
                    {t(m.blurb)}
                  </AppText>
                </View>
                {selected && <Icon name="check-circle" size={22} color={colors.primary} />}
              </Pressable>
            );
          })}
          <Button
            label={t('stock.startCount')}
            icon="arrow-right"
            onPress={() => setPhase('count')}
            style={{ marginTop: spacing.md }}
          />
        </Screen>
      </View>
    );
  }

  if (phase === 'summary') {
    const missingAnimals = allAnimals.filter((a) => marks[a.id] === 'missing');
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <GradientHeader title={t('stock.reportTitle')} subtitle={t('stock.reportSubtitle')} showBack />
        <Screen contentStyle={{ paddingTop: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
            <SummaryStat value={present} label={t('stock.present')} color={colors.success} />
            <SummaryStat value={missing} label={t('stock.missing')} color={colors.error} />
            <SummaryStat value={notCounted} label={t('stock.notCounted')} color={colors.onSurfaceVariant} />
          </View>

          {missingAnimals.length > 0 && (
            <>
              <AppText variant="overline" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>
                {t('stock.followUpList')}
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
                      {t('stock.lastSeen', { loc: a.locationName ?? '—' })}
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
            label={t('stock.submit')}
            icon="content-save-check"
            onPress={() => router.replace('/(tabs)/home')}
            style={{ marginTop: spacing.md }}
          />
          <Button
            label={t('stock.backToCount')}
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
      <GradientHeader title={t('action.stockTake')} subtitle={t('stock.countSubtitle')} showBack>
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <AppText variant="body" color="rgba(255,255,255,0.92)">
              {t('stock.counted', { counted, total: allAnimals.length })}
            </AppText>
            <AppText variant="body" color="#fff" style={{ fontWeight: '600' }}>
              {t('stock.presentMissing', { present, missing })}
            </AppText>
          </View>
          <ProgressBar value={progress} />
        </View>
      </GradientHeader>

      {/* Method banner + the method's primary scan/associate action. */}
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.sm }}>
        <Pressable
          onPress={() => setPhase('method')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Icon name={activeMethod.icon} size={16} color={colors.primary} />
          <AppText variant="body" color={colors.primary} style={{ fontWeight: '600' }}>
            {t(activeMethod.title)}
          </AppText>
          <Icon name="pencil-outline" size={13} color={colors.onSurfaceVariant} />
        </Pressable>

        {method === 'bluetooth' && (
          <Button label={t('stock.scanBle')} icon="bluetooth" variant="outline" onPress={associateBleTags} />
        )}
        {method === 'qr' && (
          <Button label={t('stock.scanQr')} icon="qrcode-scan" variant="outline" onPress={scanNextTag} />
        )}
        {method === 'manual' && (
          <Pressable
            onPress={() => markRemaining('present')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Icon name="check-all" size={16} color={colors.success} />
            <AppText variant="body" color={colors.success} style={{ fontWeight: '600' }}>
              {t('stock.markRemaining')}
            </AppText>
          </Pressable>
        )}
        {method === 'photo' && (
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            {t('stock.photoHint')}
          </AppText>
        )}
      </View>

      <Screen contentStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xxl + 72 }}>
        {allAnimals.map((a) => (
          <AnimalRow
            key={a.id}
            animal={a}
            mark={marks[a.id] ?? 'pending'}
            onMark={(m) => setMark(a.id, m)}
            photoMode={method === 'photo'}
            photoUri={photos[a.id]}
            onCapture={() => captureFor(a.id)}
          />
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
          label={notCounted > 0 ? t('stock.reviewN', { count: notCounted }) : t('stock.review')}
          icon="clipboard-check-outline"
          onPress={() => setPhase('summary')}
        />
      </View>
    </View>
  );
}
