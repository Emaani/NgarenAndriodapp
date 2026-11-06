import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
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
import { getDrafts, deleteDraft, RegistrationDraft } from '@/data/localRegistrationDrafts';
import { getHerd, setLineageApproval } from '@/data/herd';
import { decideSharedAmendment, getAssignments, getSharedAmendments, updateAssignment } from '@/data/recordAssignments';
import { RecordAssignment, SharedAmendment, isActive } from '@/lib/recordAssignments';
import { verifyIdentity } from '@/lib/identityCheck';
import { formatDate } from '@/lib/date';
import { notify } from '@/lib/toast';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { ageFromDate } from '@/lib/date';
import { taggingMeta } from '@/lib/tagging';
import { useT } from '@/i18n';
import { ActionChip, AnimalPhoto, AppText, Button, EmptyState, GradientHeader, Icon, IconChip, Screen } from '@/ui';

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
  const { loading, isAuthenticated, canManageTeam, can, isAdmin, user } = useAuth();
  const { data: pending, reload } = useResource(getPendingLocalAnimals, []);
  const { data: amendmentsData, reload: reloadAmendments } = useResource(getPendingAmendments, []);
  const { data: drafts, reload: reloadDrafts } = useResource(getDrafts, []);
  // Shared with the vet (App Review 2026-11-05): what was handed over, the
  // records the vet finished, and the changes the vet proposes.
  const { data: assignments, reload: reloadAssignments } = useResource(getAssignments, []);
  const { data: herd, reload: reloadHerd } = useResource(getHerd, []);
  const { data: sharedAmendments, reload: reloadShared } = useResource(getSharedAmendments, []);
  const [doneRemote, setDoneRemote] = useState<string[]>([]);
  // Coming back from a booking shows the record as "Submitted to vet" straight away.
  useFocusEffect(
    useCallback(() => {
      reloadDrafts();
      reloadAssignments();
      reloadHerd();
      reloadShared();
    }, [reloadDrafts, reloadAssignments, reloadHerd, reloadShared]),
  );
  const [local, setLocal] = useState<Animal[] | null>(null);
  const [localAmend, setLocalAmend] = useState<AnimalAmendment[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [busyAmend, setBusyAmend] = useState<string | null>(null);

  const assignmentByAan = useMemo(() => new Map(assignments.map((a) => [a.aan, a])), [assignments]);
  // Records the vet completed: pending on the shared record but not captured on this phone.
  // A record the farmer handed over is the farmer's to approve, even if this
  // phone also holds the vet's copy (farmer and vet sharing a device).
  const handedBack = useMemo(
    () => new Set(assignments.filter((a) => a.status === 'submitted_for_approval' && a.kind === 'registration').map((a) => a.aan)),
    [assignments],
  );
  const vetCompleted = useMemo(() => {
    const localCodes = new Set(pending.map((a) => a.ngarenCode));
    return herd.filter(
      (a) =>
        a.approvalStatus === 'pending' &&
        !!a.ngarenCode &&
        (!localCodes.has(a.ngarenCode) || handedBack.has(a.ngarenCode)) &&
        !doneRemote.includes(a.ngarenCode),
    );
  }, [herd, pending, doneRemote, handedBack]);
  // The vet's changes to this farmer's animals that haven't been decided.
  const mineShared = useMemo(() => {
    const myCodes = new Set(herd.map((a) => a.ngarenCode).filter(Boolean));
    return sharedAmendments.filter((a) => (a.farmerId ? a.farmerId === user?.id : myCodes.has(a.animalKey)) && !doneRemote.includes(a.id));
  }, [sharedAmendments, herd, user?.id, doneRemote]);

  // Field-Operations validators (owner / admin / delegated approver) review here.
  const canApprove = canManageTeam || can('approve_records');
  // Which party the signed-in user represents in a dual approval.
  const party: 'admin' | 'farmer' = isAdmin ? 'admin' : 'farmer';

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  if (!canApprove) return <Redirect href="/(tabs)/home" />;

  const items = (local ?? pending).filter((a) => !a.ngarenCode || !handedBack.has(a.ngarenCode) || doneRemote.includes(a.ngarenCode));
  const amendments = localAmend ?? amendmentsData;
  // A draft the vet has finished leaves "in progress".
  const openDrafts = drafts.filter((d) => {
    const a = assignmentByAan.get(d.aan);
    return !a || isActive(a) || a.status === 'cancelled';
  });
  const me = { id: user?.id ?? '', name: user?.fullName ?? user?.email ?? undefined };

  // Approving the vet's record finalises it for everyone; sending it back
  // returns it to the vet's task list.
  const decideVetRecord = async (animal: Animal, approve: boolean) => {
    const aan = animal.ngarenCode as string;
    if (approve) {
      const check = await verifyIdentity({ promptMessage: t('reg.faceIdPrompt', { aan }), cancelLabel: t('common.cancel') });
      if (check !== 'verified') {
        if (check !== 'cancelled') Alert.alert(t('reg.faceIdTitle'), t('reg.faceIdFailed'));
        return;
      }
    }
    setBusy(animal.id);
    try {
      if (approve && !(await setLineageApproval(aan, 'approved'))) throw new Error('not saved');
      // Keep a copy on this phone in step, so it doesn't ask again.
      const localCopy = pending.find((p) => p.ngarenCode === aan);
      if (approve && localCopy) await setLocalAnimalApproval(localCopy.id, 'approved');
      const a = assignmentByAan.get(aan);
      if (a) await updateAssignment(a, approve ? 'approved' : 'submitted_to_vet', me);
      if (approve) await deleteDraft(aan);
      setDoneRemote((prev) => [...prev, aan]);
      notify(approve ? t('approvals.activated', { name: animal.name ?? animal.tag }) : t('approvals.sentBack', { aan }));
    } catch {
      Alert.alert(t('approvals.saveFailTitle'), t('approvals.saveFailBody'));
    } finally {
      setBusy(null);
    }
  };

  const decideShared = async (am: SharedAmendment, status: 'approved' | 'rejected') => {
    setBusyAmend(am.id);
    try {
      await decideSharedAmendment(am, status);
      if (status === 'approved') await updateLocalAnimal((a) => a.ngarenCode === am.animalKey, am.patch);
      const a = assignmentByAan.get(am.animalKey);
      if (a && a.status === 'submitted_for_approval') await updateAssignment(a, 'approved', me);
      setDoneRemote((prev) => [...prev, am.id]);
      notify(status === 'approved' ? t('approvals.amendApproved', { name: am.animalLabel }) : t('approvals.amendRejected', { name: am.animalLabel }));
    } catch {
      Alert.alert(t('approvals.saveFailTitle'), t('approvals.saveFailBody'));
    } finally {
      setBusyAmend(null);
    }
  };

  const assignmentNote = (a: RecordAssignment) =>
    [a.date ? formatDate(a.date) : '', a.slot ?? '', a.mode ? t(`fv.${a.mode}`) : ''].filter(Boolean).join(' · ');

  const refresh = () => {
    reload();
    reloadAmendments();
    reloadDrafts();
    reloadAssignments();
    reloadHerd();
    reloadShared();
  };

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
      <GradientHeader title={t('approvals.title')} subtitle={t('approvals.subtitle', { count: items.length + amendments.length + vetCompleted.length + mineShared.length })} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }} onRefresh={refresh} refreshing={false}>
        {/* Hand one or more records to Ngaren support or a vet (App Review 2026-11-05). */}
        <Button
          label={t('approvals.assignRecords')}
          icon="account-arrow-right-outline"
          variant="outline"
          onPress={() => router.push('/find-vet/request?purpose=Registration' as never)}
          style={{ marginBottom: spacing.md }}
        />

        {/* Records the vet completed, waiting for the farmer's approval. */}
        {vetCompleted.length > 0 ? (
          <>
            <AppText variant="overline" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>
              {t('approvals.sectionVetDone')}
            </AppText>
            {vetCompleted.map((a) => (
              <View
                key={a.id}
                style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm, borderWidth: 1, borderColor: colors.divider }, shadow[1]]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.mdMinus }}>
                  <AnimalPhoto uri={a.photos?.[0]} size={48} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>{a.name ?? a.tag}</AppText>
                    <AppText variant="caption" color={colors.onSurfaceVariant}>{a.ngarenCode} · {a.breed.name}</AppText>
                  </View>
                  <ActionChip label={t('approvals.awaitingYou')} variant="warning" />
                </View>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Button label={t('approvals.approve')} icon="check" loading={busy === a.id} onPress={() => decideVetRecord(a, true)} style={{ flex: 1 }} />
                  <Button label={t('approvals.sendBack')} variant="outline" onPress={() => decideVetRecord(a, false)} style={{ flex: 1 }} />
                </View>
              </View>
            ))}
            <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: spacing.md }} />
          </>
        ) : null}
        {/* Registration in Progress — resume a draft or assign Ngaren Service
            Support to complete it (spec 3.1.1). */}
        {openDrafts.length > 0 ? (
          <>
            <AppText variant="overline" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>
              {t('approvals.sectionDrafts')}
            </AppText>
            {openDrafts.map((d: RegistrationDraft) => {
              const assignment = assignmentByAan.get(d.aan);
              const withVet = assignment ? isActive(assignment) : !!d.assignedToVet;
              return (
              <View
                key={d.aan}
                style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm, borderWidth: 1, borderColor: colors.divider }, shadow[1]]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.mdMinus }}>
                  <IconChip icon="progress-clock" />
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>{d.aan}</AppText>
                    <AppText variant="caption" color={colors.onSurfaceVariant}>
                      {[d.name || d.tag, d.idType ? t(`reg.id${d.idType === 'physical' ? 'Physical' : d.idType === 'satellite' ? 'Satellite' : 'Bluetooth'}`) : t('approvals.draftNoInfo')].filter(Boolean).join(' · ')}
                    </AppText>
                  </View>
                  <Pressable onPress={async () => { await deleteDraft(d.aan); reloadDrafts(); }} hitSlop={8}>
                    <Icon name="trash-can-outline" size={18} color={colors.onSurfaceVariant} />
                  </Pressable>
                </View>
                {withVet ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primaryTint, borderRadius: radius.sm, padding: spacing.sm }}>
                    <Icon name="account-arrow-right-outline" size={16} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <AppText variant="caption" color={colors.primaryDark} style={{ fontWeight: '700' }}>
                        {assignment?.status === 'vet_in_progress' ? t('approvals.vetCompleting') : t('approvals.submittedToVet')}
                      </AppText>
                      {assignment && assignmentNote(assignment) ? (
                        <AppText variant="caption" color={colors.primaryDark}>{assignmentNote(assignment)}</AppText>
                      ) : null}
                    </View>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <Button label={t('approvals.continueReg')} icon="pencil-outline" onPress={() => router.push(`/register-animal?draft=${encodeURIComponent(d.aan)}` as never)} style={{ flex: 1 }} />
                    <Button label={t('approvals.assignNgaren')} variant="outline" icon="calendar-plus" onPress={() => router.push(`/find-vet/request?purpose=Registration&aan=${encodeURIComponent(d.aan)}` as never)} style={{ flex: 1 }} />
                  </View>
                )}
              </View>
              );
            })}
            <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: spacing.md }} />
          </>
        ) : null}

        {items.length === 0 && amendments.length === 0 && openDrafts.length === 0 && vetCompleted.length === 0 && mineShared.length === 0 ? (
          <EmptyState
            icon="check-decagram-outline"
            title={t('approvals.emptyTitle')}
            subtitle={t('approvals.emptySub')}
            actionLabel={t('common.refresh')}
            onAction={refresh}
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
                  <AnimalPhoto uri={a.photos?.[0]} size={48} />
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

          {/* The vet's proposed changes, shared from the vet's phone. */}
          {mineShared.length > 0 ? (
            <>
              <AppText variant="overline" color={colors.onSurfaceVariant} style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
                {t('approvals.sectionAmendShared')}
              </AppText>
              {mineShared.map((am) => (
                <View
                  key={am.id}
                  style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm, borderWidth: 1, borderColor: colors.divider }, shadow[1]]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.mdMinus }}>
                    <IconChip icon="pencil-outline" />
                    <View style={{ flex: 1 }}>
                      <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>{am.animalLabel}</AppText>
                      <AppText variant="caption" color={colors.onSurfaceVariant}>
                        {am.animalKey} · {t('approvals.proposedBy', { name: am.proposedBy })}
                      </AppText>
                    </View>
                  </View>
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
                    <Button label={t('approvals.approveChange')} icon="check" loading={busyAmend === am.id} onPress={() => decideShared(am, 'approved')} style={{ flex: 1 }} />
                    <Button label={t('approvals.reject')} variant="outline" onPress={() => decideShared(am, 'rejected')} style={{ flex: 1 }} />
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
