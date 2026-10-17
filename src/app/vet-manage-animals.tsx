import { useMemo, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { animals as animalsFallback } from '@/data/mock';
import { getCalloutRequests } from '@/data/api';
import { getHerd } from '@/data/herd';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { ageFromDate } from '@/lib/date';
import { CalloutRequest, Animal } from '@/data/types';
import { useT } from '@/i18n';
import { ActionChip, AnimalPhoto, AppText, Button, GradientHeader, Icon, IconChip, Screen } from '@/ui';

/**
 * Manage Animal Records — the vet's entry to register or amend an animal in the
 * context of an accepted meeting request (Oct 2026 Q&A 4.1). The vet picks the
 * accepted meeting (which identifies the farmer), then sees the existing records
 * to amend (AAN locked, farmer approves) or registers a new animal (AAN flow).
 * If the meeting names a specific animal it is highlighted; otherwise all of the
 * herd is shown. Open to vets and admins.
 */
export default function VetManageAnimals() {
  const router = useRouter();
  const t = useT();
  const { loading, isAuthenticated, canVet } = useAuth();
  const { data: requests } = useResource(getCalloutRequests, []);
  const { data: herd } = useResource(getHerd, animalsFallback);
  const [meetingId, setMeetingId] = useState<number | null>(null);

  const accepted = useMemo(() => requests.filter((r) => r.status === 'accepted'), [requests]);
  const meeting: CalloutRequest | undefined = useMemo(
    () => accepted.find((r) => r.id === meetingId),
    [accepted, meetingId],
  );

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!canVet) return <Redirect href="/(tabs)/home" />;

  // The animal named in the meeting (best-effort match), shown first.
  const namedAnimal: Animal | undefined = meeting
    ? herd.find((a) => [a.name, a.tag, a.accountNumber].filter(Boolean).some((x) => String(x) === meeting.animal))
    : undefined;
  const orderedHerd = namedAnimal
    ? [namedAnimal, ...herd.filter((a) => a.id !== namedAnimal.id)]
    : herd;

  const AnimalRow = ({ a, highlighted }: { a: Animal; highlighted?: boolean }) => (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', gap: spacing.mdMinus, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: highlighted ? 2 : 1, borderColor: highlighted ? colors.primary : colors.divider },
        shadow[1],
      ]}>
      <AnimalPhoto uri={a.photos?.[0]} size={44} />
      <View style={{ flex: 1 }}>
        <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>{a.name ?? a.tag}</AppText>
        <AppText variant="caption" color={colors.onSurfaceVariant}>
          {(a.ngarenCode ?? a.accountNumber ?? a.tag)} · {a.breed.name} · {ageFromDate(a.dateOfBirth)}
        </AppText>
        {highlighted ? <AppText variant="caption" color={colors.primary} style={{ fontWeight: '600' }}>{t('vma.specified')}</AppText> : null}
      </View>
      <Button
        label={t('vma.edit')}
        variant="outline"
        icon="pencil-outline"
        onPress={() => router.push(`/vet-edit-animal?id=${a.id}&farmer=${encodeURIComponent(meeting?.farmerName ?? '')}` as never)}
        style={{ paddingHorizontal: spacing.md }}
      />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('vma.title')} subtitle={t('vma.subtitle')} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {/* Step 1 — choose the accepted meeting (identifies the farmer). */}
        <AppText variant="title" style={{ marginBottom: spacing.sm }}>{t('vma.selectMeeting')}</AppText>
        {accepted.length === 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.warningTint, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
            <Icon name="information-outline" size={18} color={colors.warning} />
            <AppText variant="caption" color={colors.onSurface} style={{ flex: 1 }}>{t('vma.noMeetings')}</AppText>
          </View>
        ) : (
          accepted.map((r) => {
            const on = r.id === meetingId;
            return (
              <Pressable
                key={r.id}
                onPress={() => setMeetingId(on ? null : r.id)}
                style={[
                  { flexDirection: 'row', alignItems: 'center', gap: spacing.mdMinus, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: on ? 2 : 1, borderColor: on ? colors.primary : colors.divider },
                  shadow[1],
                ]}>
                <IconChip icon="calendar-account" bg={on ? colors.primaryTint : colors.background} fg={on ? colors.primary : colors.onSurfaceVariant} />
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>{r.farmerName}</AppText>
                  <AppText variant="caption" color={colors.onSurfaceVariant}>
                    {r.animal} · {r.service ?? t('vma.generalVisit')}
                  </AppText>
                </View>
                {r.service ? <ActionChip label={r.service} variant="neutral" /> : null}
                <Icon name={on ? 'check-circle' : 'chevron-right'} size={on ? 22 : 18} color={on ? colors.primary : colors.onSurfaceVariant} />
              </Pressable>
            );
          })
        )}

        {/* Step 2 — existing records (edit) + register new, for the chosen farmer. */}
        {(meeting || accepted.length === 0) && (
          <>
            <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: spacing.md }} />
            <AppText variant="title" style={{ marginBottom: spacing.xs }}>{t('vma.existingRecords')}</AppText>
            <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.md }}>
              {meeting ? t('vma.forFarmer', { name: meeting.farmerName }) : t('vma.allAnimals')}
            </AppText>

            <Button
              label={t('vma.registerNew')}
              icon="plus-circle-outline"
              onPress={() => router.push('/register-animal' as never)}
              style={{ marginBottom: spacing.md }}
            />

            {orderedHerd.length === 0 ? (
              <AppText variant="body" color={colors.onSurfaceVariant}>{t('hsc.noAnimalsTitle')}</AppText>
            ) : (
              orderedHerd.map((a) => <AnimalRow key={a.id} a={a} highlighted={namedAnimal?.id === a.id} />)
            )}
          </>
        )}
      </Screen>
    </View>
  );
}
