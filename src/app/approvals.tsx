import { useState } from 'react';
import { Image, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import { Animal } from '@/data/types';
import {
  getPendingLocalAnimals,
  requiresDualApproval,
  setLocalAnimalApproval,
  setLocalAnimalApprovalStep,
  updateLocalAnimal,
} from '@/data/localAnimals';
import { getPendingAmendments, setAmendmentStatus, AnimalAmendment } from '@/data/localAmendments';
import { setLineageApproval } from '@/data/herd';
import { notify } from '@/lib/toast';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { ageFromDate } from '@/lib/date';
import { taggingMeta } from '@/lib/tagging';
import { useT } from '@/i18n';
import { AppText, Button, EmptyState, GradientHeader, Icon, IconChip, Screen } from '@/ui';

/**
 * Record Activation (maker-checker). A capture by a third party (a vet) is NOT
 * final until BOTH an admin validates it AND the farmer confirms it (Oct 2026
 * standup — dual approval). A record captured by a delegated farm member needs
 * a single checker (owner/admin). Each approver only sees — and can action —
 * the step that is theirs; the record finalises once both steps are done.
 */

/** A small two-step progress chip row for a dual-approval record. */
function DualProgress({ admin, farmer, t }: { admin: boolean; farmer: boolean; t: (k: string) => string }) {
  const Step = ({ label, done }: { label: string; done: boolean }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <Icon name={done ? 'check-circle' : 'clock-outline'} size={15} color={done ? colors.success : colors.onSurfaceVariant} />
      <AppText variant="caption" color={done ? colors.success : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>
        {label} · {done ? t('approvals.done') : t('approvals.awaiting')}
      </AppText>
    </View>
  );
  return (
    <View style={{ gap: 4 }}>
      <Step label={t('approvals.stepAdmin')} done={admin} />
      <Step label={t('approvals.stepFarmer')} done={farmer} />
    </View>
  );
}

export default function Approvals() {
  const router = useRouter();
  const t = useT();
  const { loading, isAuthenticated, canManageTeam, can, isAdmin } = useAuth();
  const { data: pending, reload } = useResource(getPendingLocalAnimals, []);
  const { data: amendmentsData, reload: reloadAmendments } = useResource(getPendingAmendments, []);
  const [local, setLocal] = useState<Animal[] | null>(null);
  const [localAmend, setLocalAmend] = useState<AnimalAmendment[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [busyAmend, setBusyAmend] = useState<string | null>(null);

  // Field-Operations validators (owner / admin / delegated approver) review here.
  const canApprove = canManageTeam || can('approve_records');
  // Which party the signed-in user represents in a dual approval.
  const party: 'admin' | 'farmer' = isAdmin ? 'admin' : 'farmer';

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!canApprove) return <Redirect href="/(tabs)/home" />;

  const items = local ?? pending;
  const amendments = localAmend ?? amendmentsData;

  const removeRow = (id: number) => setLocal((prev) => (prev ?? pending).filter((a) => a.id !== id));

  // Farmer reviews a vet's proposed amendment to an existing record. On approval
  // the patch is applied to the on-device animal; the AAN is never touched.
  const decideAmendment = async (am: AnimalAmendment, status: 'approved' | 'rejected') => {
    setBusyAmend(am.id);
    setLocalAmend((prev) => (prev ?? amendmentsData).filter((x) => x.id !== am.id));
    if (status === 'approved') {
      await updateLocalAnimal((a) => a.id === am.animalId, am.patch);
    }
    await setAmendmentStatus(am.id, status);
    setBusyAmend(null);
    notify(status === 'approved' ? t('approvals.amendApproved', { name: am.animalLabel }) : t('approvals.amendRejected', { name: am.animalLabel }));
  };

  // Single-checker decision (non-dual captures).
  const decideSingle = async (animal: Animal, status: 'approved' | 'rejected') => {
    setBusy(animal.id);
    removeRow(animal.id);
    await setLocalAnimalApproval(animal.id, status);
    await setLineageApproval(animal.ngarenCode, status);
    setBusy(null);
    const who = animal.name ?? animal.tag;
    notify(status === 'approved' ? t('approvals.activated', { name: who }) : t('approvals.rejected', { name: who }));
  };

  // One party's step of a dual approval. Only removes the row once the record is
  // finalised (approved) or rejected; a partial approval stays, now showing the
  // other party's step as still outstanding.
  const decideDual = async (animal: Animal, status: 'approved' | 'rejected') => {
    setBusy(animal.id);
    const result = await setLocalAnimalApprovalStep(animal.id, party, status);
    if (result === 'approved' || result === 'rejected') {
      removeRow(animal.id);
      await setLineageApproval(animal.ngarenCode, result);
      const who = animal.name ?? animal.tag;
      notify(result === 'approved' ? t('approvals.activated', { name: who }) : t('approvals.rejected', { name: who }));
    } else {
      // Partial — reflect the new step state in place.
      setLocal((prev) =>
        (prev ?? pending).map((a) =>
          a.id === animal.id
            ? { ...a, adminApproved: a.adminApproved || party === 'admin', farmerApproved: a.farmerApproved || party === 'farmer' }
            : a,
        ),
      );
    }
    setBusy(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('approvals.title')} subtitle={t('approvals.subtitle', { count: items.length + amendments.length })} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        {items.length === 0 && amendments.length === 0 ? (
          <EmptyState
            icon="check-decagram-outline"
            title={t('approvals.emptyTitle')}
            subtitle={t('approvals.emptySub')}
            actionLabel={t('common.refresh')}
            onAction={() => { reload(); reloadAmendments(); }}
          />
        ) : (
          <>
          {items.length > 0 ? (
            <AppText variant="overline" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>
              {t('approvals.sectionNew')}
            </AppText>
          ) : null}
          {items.map((a) => {
            const meta = taggingMeta(a.taggingMethod);
            const dual = requiresDualApproval(a);
            const myStepDone = party === 'admin' ? !!a.adminApproved : !!a.farmerApproved;
            return (
              <View
                key={a.id}
                style={[
                  { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm, borderWidth: 1, borderColor: colors.divider },
                  shadow[1],
                ]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.mdMinus }}>
                  {a.photos?.[0] ? (
                    <Image source={{ uri: a.photos[0] }} style={{ width: 48, height: 48, borderRadius: radius.md }} />
                  ) : (
                    <IconChip icon="cow" />
                  )}
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
                      {a.name ?? a.tag}
                    </AppText>
                    <AppText variant="caption" color={colors.onSurfaceVariant}>
                      {a.ngarenCode ?? a.tag} · {a.breed.name}
                    </AppText>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    <Icon name={meta.icon} size={16} color={colors.onSurfaceVariant} />
                    <AppText variant="caption" color={colors.onSurfaceVariant}>
                      {meta.short}
                    </AppText>
                  </View>
                </View>
                <AppText variant="caption" color={colors.onSurfaceVariant}>
                  {t('approvals.rowMeta', { tag: a.tag, color: a.color ?? '—', location: a.locationName ?? '—', age: ageFromDate(a.dateOfBirth), photos: a.photos?.length ?? 0 })}
                </AppText>

                {dual ? (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, backgroundColor: colors.warningTint, borderRadius: radius.sm, padding: spacing.sm }}>
                      <Icon name="account-switch-outline" size={15} color={colors.warning} />
                      <AppText variant="caption" color={colors.onSurface} style={{ flex: 1 }}>
                        {t('approvals.capturedByVet')}
                      </AppText>
                    </View>
                    <DualProgress admin={!!a.adminApproved} farmer={!!a.farmerApproved} t={t} />
                    {myStepDone ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                        <Icon name="check" size={15} color={colors.success} />
                        <AppText variant="caption" color={colors.onSurfaceVariant}>
                          {t('approvals.awaitingOther')}
                        </AppText>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                        <Button
                          label={party === 'admin' ? t('approvals.validateAdmin') : t('approvals.confirmFarmer')}
                          icon="check"
                          loading={busy === a.id}
                          onPress={() => decideDual(a, 'approved')}
                          style={{ flex: 1 }}
                        />
                        <Button label={t('approvals.reject')} variant="outline" onPress={() => decideDual(a, 'rejected')} style={{ flex: 1 }} />
                      </View>
                    )}
                  </>
                ) : (
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <Button label={t('approvals.activate')} icon="check" loading={busy === a.id} onPress={() => decideSingle(a, 'approved')} style={{ flex: 1 }} />
                    <Button label={t('approvals.reject')} variant="outline" onPress={() => decideSingle(a, 'rejected')} style={{ flex: 1 }} />
                  </View>
                )}
              </View>
            );
          })}

          {/* Vet-proposed amendments to existing records — the farmer approves
              (AAN never changes; approval applies the patch). Oct 2026 Q&A 4.1. */}
          {amendments.length > 0 ? (
            <>
              <AppText variant="overline" color={colors.onSurfaceVariant} style={{ marginTop: items.length > 0 ? spacing.lg : 0, marginBottom: spacing.sm }}>
                {t('approvals.sectionAmend')}
              </AppText>
              {amendments.map((am) => (
                <View
                  key={am.id}
                  style={[
                    { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm, borderWidth: 1, borderColor: colors.divider },
                    shadow[1],
                  ]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.mdMinus }}>
                    <IconChip icon="pencil-outline" />
                    <View style={{ flex: 1 }}>
                      <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>{am.animalLabel}</AppText>
                      <AppText variant="caption" color={colors.onSurfaceVariant}>
                        {am.animalKey} · {t('approvals.proposedBy', { name: am.proposedBy })}
                      </AppText>
                    </View>
                  </View>
                  {/* The proposed changes (before → after). */}
                  <View style={{ gap: 4, backgroundColor: colors.background, borderRadius: radius.sm, padding: spacing.sm }}>
                    {am.changes.map((c) => (
                      <View key={c.field} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: spacing.xs }}>
                        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ fontWeight: '600' }}>{c.label}:</AppText>
                        <AppText variant="caption" color={colors.onSurfaceVariant} style={{ textDecorationLine: 'line-through' }}>{c.before}</AppText>
                        <Icon name="arrow-right" size={12} color={colors.onSurfaceVariant} />
                        <AppText variant="caption" color={colors.primary} style={{ fontWeight: '600' }}>{c.after}</AppText>
                      </View>
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <Button label={t('approvals.approveChange')} icon="check" loading={busyAmend === am.id} onPress={() => decideAmendment(am, 'approved')} style={{ flex: 1 }} />
                    <Button label={t('approvals.reject')} variant="outline" onPress={() => decideAmendment(am, 'rejected')} style={{ flex: 1 }} />
                  </View>
                </View>
              ))}
            </>
          ) : null}
          </>
        )}
      </Screen>
    </View>
  );
}
