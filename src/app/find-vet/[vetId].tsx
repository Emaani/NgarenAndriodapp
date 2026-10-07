import { useEffect, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { getVetProfile, formatDayLabel } from '@/data/vetProfiles';
import { isPrimaryVet, togglePrimaryVet } from '@/data/primaryVets';
import { notify } from '@/lib/toast';
import { VetDayAvailability } from '@/data/types';
import { useResource } from '@/data/hooks';
import { useT } from '@/i18n';
import { AppText, Button, EmptyState, GradientHeader, Icon, Screen, VetImpactDashboard } from '@/ui';

// Real-time availability colours (Sep 3 2026 standup): green = open slots,
// red = fully booked/committed. Green days are tappable to book directly.
const AVAIL_GREEN = '#16A34A';
const AVAIL_RED = '#EF4444';

function initials(name: string): string {
  const parts = name.replace(/^Dr\.?\s+/i, '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

/** A single day tile: green when slots are open (tappable to book), red when
 *  fully booked/committed. Real-time availability at a glance. */
function DayCard({ day, onBook }: { day: VetDayAvailability; onBook: () => void }) {
  const t = useT();
  const { weekday, day: date } = formatDayLabel(day.dateIso);
  const available = day.appts > 0;
  const tint = available ? AVAIL_GREEN : AVAIL_RED;
  return (
    <Pressable
      onPress={available ? onBook : undefined}
      disabled={!available}
      style={({ pressed }) => ({
        width: 92,
        borderRadius: radius.md,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.xs,
        alignItems: 'center',
        gap: 2,
        backgroundColor: tint + (pressed ? '33' : '18'),
        borderWidth: 1,
        borderColor: tint + '66',
      })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <AppText variant="body" style={{ fontWeight: '700' }} color={colors.onSurface}>
          {weekday}
        </AppText>
        {available && day.video ? <Icon name="video" size={13} color={tint} /> : null}
      </View>
      <AppText variant="caption" color={colors.onSurface}>
        {date}
      </AppText>
      <AppText variant="caption" color={tint} style={{ fontWeight: '700' }}>
        {available ? t('vp.nOpen', { count: day.appts }) : t('vp.booked')}
      </AppText>
    </Pressable>
  );
}

export default function VetProfileScreen() {
  const router = useRouter();
  const t = useT();
  const { vetId } = useLocalSearchParams<{ vetId: string }>();
  const { data: vet } = useResource(() => getVetProfile(Number(vetId)), undefined);

  // Trusted "primary provider" save (Sep 3 2026 standup).
  const [primary, setPrimary] = useState(false);
  useEffect(() => {
    let active = true;
    isPrimaryVet(Number(vetId)).then((v) => active && setPrimary(v));
    return () => {
      active = false;
    };
  }, [vetId]);
  const onTogglePrimary = async () => {
    const saved = await togglePrimaryVet(Number(vetId));
    setPrimary(saved);
    notify(saved ? t('vp.savedTrusted') : t('vp.removedTrusted'));
  };

  if (!vet) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <GradientHeader title={t('vp.title')} showBack />
        <EmptyState icon="stethoscope" title={t('vp.notFoundTitle')} subtitle={t('vp.notFoundSub')} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader
        title={t('vp.title')}
        subtitle={t('vp.distanceAway', { km: vet.distanceKm })}
        showBack
        right={
          <Pressable onPress={onTogglePrimary} hitSlop={8} accessibilityLabel={primary ? 'Remove trusted vet' : 'Save trusted vet'}>
            <Icon name={primary ? 'star' : 'star-outline'} size={24} color={primary ? '#FBBF24' : '#fff'} />
          </Pressable>
        }
      />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {/* Persona header */}
        <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.divider }, shadow[1]]}>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View>
              {vet.photo ? (
                <Image source={{ uri: vet.photo }} style={{ width: 72, height: 72, borderRadius: radius.full }} />
              ) : (
                <View style={{ width: 72, height: 72, borderRadius: radius.full, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' }}>
                  <AppText variant="headline" color={colors.primaryDark} style={{ fontWeight: '800' }}>
                    {initials(vet.name)}
                  </AppText>
                </View>
              )}
              {vet.videoVisits ? (
                <View style={{ position: 'absolute', right: -2, bottom: -2, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.onSurface, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface }}>
                  <Icon name="video" size={13} color="#fff" />
                </View>
              ) : null}
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' }}>
                <AppText variant="title" style={{ fontWeight: '800' }}>
                  {vet.name}
                </AppText>
                {vet.sponsored ? (
                  <View style={{ backgroundColor: colors.background, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2, borderWidth: 1, borderColor: colors.divider }}>
                    <AppText variant="caption" color={colors.onSurfaceVariant} style={{ fontWeight: '600' }}>
                      {t('vp.sponsored')}
                    </AppText>
                  </View>
                ) : null}
              </View>
              <AppText variant="body" color={colors.onSurfaceVariant}>
                {vet.credentials ?? vet.specialty}
              </AppText>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Icon name="star" size={15} color={colors.warning} />
                <AppText variant="body" style={{ fontWeight: '700' }}>
                  {vet.rating.toFixed(2)}
                </AppText>
                <AppText variant="body" color={colors.onSurfaceVariant}>
                  · {vet.reviews} {t('common.reviews')}
                </AppText>
              </View>
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: 2 }} />
          {vet.videoVisits ? <PersonaLine icon="video" text={t('vp.videoVisits')} /> : null}
          {vet.selfPay ? <PersonaLine icon="cash-multiple" text={t('vp.selfPay')} /> : null}
          {vet.institution ? <PersonaLine icon="school-outline" text={vet.institution} /> : null}
          <PersonaLine icon="stethoscope" text={`${vet.specialty}${vet.yearsExperience ? ` · ${t('vp.yrsExp', { yrs: vet.yearsExperience })}` : ''}`} />
          {vet.tagline ? (
            <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginTop: 2 }}>
              {vet.tagline}
            </AppText>
          ) : null}
        </View>

        {/* Services offered (managed-health MVP categories) */}
        <AppText variant="title" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
          {t('vp.servicesOffered')}
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {[
            { label: t('vp.svStockTake'), icon: 'clipboard-list-outline' as const },
            { label: t('vp.svVaccination'), icon: 'needle' as const },
            { label: t('vp.svTreatment'), icon: 'medical-bag' as const },
            { label: t('vp.svConsultation'), icon: 'comment-question-outline' as const },
          ].map((sv) => (
            <View key={sv.label} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.mdMinus, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider }}>
              <Icon name={sv.icon} size={15} color={colors.primary} />
              <AppText variant="caption" color={colors.onSurface} style={{ fontWeight: '600' }}>
                {sv.label}
              </AppText>
            </View>
          ))}
        </View>

        {/* Booking calendar */}
        <AppText variant="title" style={{ marginTop: spacing.lg, marginBottom: spacing.xs }}>
          {t('vp.availability')}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: AVAIL_GREEN }} />
            <AppText variant="caption" color={colors.onSurfaceVariant}>{t('vp.open')}</AppText>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: AVAIL_RED }} />
            <AppText variant="caption" color={colors.onSurfaceVariant}>{t('vp.booked')}</AppText>
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {vet.availability.map((d) => (
            <DayCard key={d.dateIso} day={d} onBook={() => router.push(`/find-vet/request?vetId=${vet.id}&date=${d.dateIso}` as never)} />
          ))}
        </View>

        {/* Impact dashboard */}
        <AppText variant="title" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
          {t('vp.impact')}
        </AppText>
        <VetImpactDashboard impact={vet.impact} />

        <Button
          label={t('vp.requestAppt')}
          icon="calendar-check"
          onPress={() => router.push(`/find-vet/request?vetId=${vet.id}` as never)}
          style={{ marginTop: spacing.lg }}
        />
        <Button
          label={t('vp.rateThis')}
          variant="outline"
          icon="star-outline"
          onPress={() => router.push(`/rate-vet?vetId=${vet.id}` as never)}
          style={{ marginTop: spacing.sm }}
        />
      </Screen>
    </View>
  );
}

function PersonaLine({ icon, text }: { icon: Parameters<typeof Icon>[0]['name']; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Icon name={icon} size={16} color={colors.onSurfaceVariant} />
      <AppText variant="body" color={colors.onSurface}>
        {text}
      </AppText>
    </View>
  );
}
