import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { animals as animalsFallback } from '@/data/mock';
import { getHerd } from '@/data/herd';
import { getDrafts } from '@/data/localRegistrationDrafts';
import { getAmendments } from '@/data/localAmendments';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { ageFromDate, formatDateTime } from '@/lib/date';
import { Animal } from '@/data/types';
import { useT } from '@/i18n';
import { ActionChip, AnimalPhoto, AppText, Button, GradientHeader, Icon, IconChip, Screen, SearchBar } from '@/ui';

type Tab = 'progress' | 'approval' | 'approved';

/** A sub-section heading inside a tab. */
function SubHeader({ icon, title, sub }: { icon: Parameters<typeof Icon>[0]['name']; title: string; sub?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.sm }}>
      <IconChip icon={icon} />
      <View style={{ flex: 1 }}>
        <AppText variant="bodyLarge" style={{ fontWeight: '700' }}>{title}</AppText>
        {sub ? <AppText variant="caption" color={colors.onSurfaceVariant}>{sub}</AppText> : null}
      </View>
    </View>
  );
}

/**
 * Manage Animal Records (Oct 20 2026 vet spec 2). The vet's workspace for AAN
 * records, in three states:
 *   • AAN In Progress — Registration (resume farmer-transferred drafts),
 *     Edit (amend an existing AAN), Creation (start a new AAN).
 *   • Approval in progress — AANs the vet amended & submitted for farmer approval.
 *   • Approved — removed from the working view; the processed count is surfaced
 *     as an activity trend under Reports (not the live profile).
 * Submitting any AAN change requires Face ID / OTP (handled in the edit & AAN
 * flows) and is tracked per user with date/time in the audit log.
 */
export default function VetManageAnimals() {
  const router = useRouter();
  const t = useT();
  const { loading, isAuthenticated, canVet } = useAuth();
  const { data: herd } = useResource(getHerd, animalsFallback);
  const { data: drafts } = useResource(getDrafts, []);
  const { data: amendments } = useResource(getAmendments, []);
  const [tab, setTab] = useState<Tab>('progress');
  const [query, setQuery] = useState('');

  const pending = useMemo(() => amendments.filter((a) => a.status === 'pending'), [amendments]);
  const approved = useMemo(() => amendments.filter((a) => a.status === 'approved'), [amendments]);

  const filteredHerd = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return herd;
    return herd.filter((a) =>
      [a.name, a.tag, a.accountNumber, a.ngarenCode, a.breed.name].filter(Boolean).some((x) => String(x).toLowerCase().includes(q)),
    );
  }, [herd, query]);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!canVet) return <Redirect href="/(tabs)/home" />;

  const AnimalEditRow = ({ a }: { a: Animal }) => (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.mdMinus, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.divider }, shadow[1]]}>
      <AnimalPhoto uri={a.photos?.[0]} size={44} />
      <View style={{ flex: 1 }}>
        <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>{a.name ?? a.tag}</AppText>
        <AppText variant="caption" color={colors.onSurfaceVariant}>
          {(a.ngarenCode ?? a.accountNumber ?? a.tag)} · {a.breed.name} · {ageFromDate(a.dateOfBirth)}
        </AppText>
      </View>
      <Button
        label={t('vma.edit')}
        variant="outline"
        icon="pencil-outline"
        onPress={() => router.push(`/vet-edit-animal?id=${a.id}` as never)}
        style={{ paddingHorizontal: spacing.md }}
      />
    </View>
  );

  const TabButton = ({ value, label, count }: { value: Tab; label: string; count?: number }) => {
    const on = tab === value;
    return (
      <Pressable
        onPress={() => setTab(value)}
        style={{ flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, alignItems: 'center', backgroundColor: on ? colors.primary : colors.surface, borderWidth: 1, borderColor: on ? colors.primary : colors.divider }}>
        <AppText variant="caption" color={on ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '700', textAlign: 'center' }}>
          {label}{count ? ` (${count})` : ''}
        </AppText>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('vma.title')} subtitle={t('vma.subtitle')} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md, paddingBottom: spacing.xxl }}>
        <View style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md }}>
          <TabButton value="progress" label={t('vma.tabProgress')} />
          <TabButton value="approval" label={t('vma.tabApproval')} count={pending.length} />
          <TabButton value="approved" label={t('vma.tabApproved')} count={approved.length} />
        </View>

        {tab === 'progress' ? (
          <>
            {/* AAN Registration — resume incomplete drafts transferred by farmers. */}
            <SubHeader icon="progress-pencil" title={t('vma.aanRegistration')} sub={t('vma.aanRegistrationSub')} />
            {drafts.length === 0 ? (
              <AppText variant="caption" color={colors.onSurfaceVariant}>{t('vma.noDrafts')}</AppText>
            ) : (
              drafts.map((d) => (
                <Pressable
                  key={d.aan}
                  onPress={() => router.push(`/register-animal?draft=${encodeURIComponent(d.aan)}` as never)}
                  style={({ pressed }) => [
                    { flexDirection: 'row', alignItems: 'center', gap: spacing.mdMinus, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.divider, opacity: pressed ? 0.9 : 1 },
                    shadow[1],
                  ]}>
                  <IconChip icon="file-document-edit-outline" />
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>{d.name || d.tag || d.aan}</AppText>
                    <AppText variant="caption" color={colors.onSurfaceVariant}>
                      {d.aan} · {t('vma.updated', { date: formatDateTime(d.updatedAt) })}
                    </AppText>
                  </View>
                  <ActionChip label={t('vma.continue')} variant="neutral" />
                  <Icon name="chevron-right" size={18} color={colors.onSurfaceVariant} />
                </Pressable>
              ))
            )}

            {/* AAN Creation — start a brand-new AAN. */}
            <SubHeader icon="plus-circle-outline" title={t('vma.aanCreation')} sub={t('vma.aanCreationSub')} />
            <Button label={t('vma.addAan')} icon="plus-circle-outline" onPress={() => router.push('/register-animal' as never)} />

            {/* AAN Edit — amend an existing AAN (farmer approves). */}
            <SubHeader icon="pencil-box-outline" title={t('vma.aanEdit')} sub={t('vma.aanEditSub')} />
            <SearchBar value={query} onChangeText={setQuery} placeholder={t('animals.search')} />
            <View style={{ height: spacing.sm }} />
            {filteredHerd.length === 0 ? (
              <AppText variant="caption" color={colors.onSurfaceVariant}>{t('hsc.noAnimalsTitle')}</AppText>
            ) : (
              filteredHerd.map((a) => <AnimalEditRow key={a.id} a={a} />)
            )}
          </>
        ) : null}

        {tab === 'approval' ? (
          pending.length === 0 ? (
            <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl }}>
              <Icon name="clock-outline" size={32} color={colors.onSurfaceVariant} />
              <AppText variant="body" color={colors.onSurfaceVariant} style={{ textAlign: 'center' }}>{t('vma.noApproval')}</AppText>
            </View>
          ) : (
            pending.map((a) => (
              <View key={a.id} style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.divider, gap: 4 }, shadow[1]]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <IconChip icon="account-clock-outline" />
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>{a.animalLabel}</AppText>
                    <AppText variant="caption" color={colors.onSurfaceVariant}>{a.animalKey} · {t('vma.changesCount', { count: a.changes.length })}</AppText>
                  </View>
                  <ActionChip label={t('vma.awaitingFarmer')} variant="warning" />
                </View>
                <AppText variant="caption" color={colors.onSurfaceVariant}>
                  {t('vma.submittedBy', { name: a.proposedBy, date: formatDateTime(a.proposedAt) })}
                </AppText>
              </View>
            ))
          )
        ) : null}

        {tab === 'approved' ? (
          <View style={{ gap: spacing.md }}>
            <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg }}>
              <Icon name="check-decagram-outline" size={32} color={colors.success} />
              <AppText variant="title" color={colors.success}>{approved.length}</AppText>
              <AppText variant="body" color={colors.onSurfaceVariant} style={{ textAlign: 'center' }}>{t('vma.approvedProcessed')}</AppText>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.primaryTint, borderRadius: radius.md, padding: spacing.md }}>
              <Icon name="chart-timeline-variant" size={18} color={colors.primary} />
              <AppText variant="caption" color={colors.primaryDark} style={{ flex: 1 }}>{t('vma.approvedNote')}</AppText>
            </View>
            <Button label={t('vma.viewReports')} variant="outline" icon="file-chart-outline" onPress={() => router.push('/vet-reports' as never)} />
          </View>
        ) : null}
      </Screen>
    </View>
  );
}
