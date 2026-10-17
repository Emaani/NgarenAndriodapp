import { Alert, Image, Pressable, ScrollView, View } from 'react-native';
import * as MailComposer from 'expo-mail-composer';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import {
  animals as animalsFallback,
  calloutRequests as calloutFallback,
} from '@/data/mock';
import { getCalloutRequests } from '@/data/api';
import { getCeresBehaviour } from '@/data/ceresBehaviour';
import { getHerdAnimalById, deleteHerdAnimal } from '@/data/herd';
import { getLocalAnimalById, deleteLocalAnimal } from '@/data/localAnimals';
import { logAuditEvent } from '@/data/localAuditEvents';
import { addLocalNotification } from '@/data/localNotifications';
import { sendLocalNotification } from '@/services/push';
import { notify } from '@/lib/toast';
import { NGAREN_SUPPORT_EMAIL } from '@/lib/contact';
import { HEALTH_TYPE_LABELS, getLocalHealthRecords } from '@/data/localHealth';
import { useResource } from '@/data/hooks';
import { ageFromDate, formatDate } from '@/lib/date';
import { taggingMeta } from '@/lib/tagging';
import { useAuth } from '@/services/auth';
import { useT, useTStatus } from '@/i18n';
import { ActionChip, AnimalPhoto, AppText, Button, ChartCard, DetailRow, EmptyState, GradientHeader, Icon, Screen } from '@/ui';

export default function AnimalDetail() {
  const router = useRouter();
  const t = useT();
  const tStatus = useTStatus();
  // Health-record input is reserved for certified professionals (Sep 5 2026
  // standup): farmers get a view-only Health Score Card + history.
  const { canVet, isAdmin, appRole, user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  // Farmers and admins can delete an animal (Oct 2026). Vets cannot.
  const canDelete = isAdmin || appRole === 'farmer';
  // Local animals take precedence, else the live animal_lineage herd.
  const { data: animal } = useResource(
    () => getHerdAnimalById(Number(id)),
    animalsFallback.find((a) => a.id === Number(id)),
  );
  // Live Ceres telemetry for THIS animal: resolve its tag identifiers, then
  // query ceres_telemetry. Empty [] when it has no synced telemetry.
  const { data: behaviour, loading: behaviourLoading } = useResource(async () => {
    const a = (await getLocalAnimalById(Number(id))) ?? (await getHerdAnimalById(Number(id)));
    const keys = [a?.deviceSerial ?? undefined, a?.tag, a?.ngarenCode].filter(
      (k): k is string => !!k,
    );
    return getCeresBehaviour(keys);
  }, []);
  const { data: callouts } = useResource(() => getCalloutRequests(), calloutFallback);
  // All local health records; filtered to this animal below once it resolves.
  const { data: allHealth } = useResource(() => getLocalHealthRecords(), []);
  // A Ceres Tag device reports on every series at once, so if every series is
  // empty it means this animal has no synced telemetry yet (unlinked device,
  // device not yet synced, or too new) rather than one chart failing alone.
  const hasBehaviourData = behaviour.some((s) => s.actual.length > 0 || s.pfi.length > 0);

  if (!animal) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <GradientHeader title={t('ad.animalTitle')} showBack />
        <EmptyState icon="cow" title={t('ad.notFoundTitle')} subtitle={t('ad.notFoundSub')} />
      </View>
    );
  }

  // Services consumed — derived from what the animal record actually carries.
  const hasTag = !!animal.deviceSerial;
  const tagActive = hasTag && animal.status === 'active';
  // Vet visits booked against this animal (matched by name or tag).
  const needle = (animal.name ?? animal.tag).toLowerCase();
  const vetVisits = callouts.filter(
    (c) => c.animal.toLowerCase().includes(needle) || c.animal.toLowerCase().includes(animal.tag.toLowerCase()),
  ).length;

  // Digital health card — records keyed to this animal's Ngaren code (or tag).
  const animalKey = animal.ngarenCode ?? animal.tag;
  const animalLabel = animal.name ?? animal.tag;
  const animalHealth = allHealth.filter((r) => r.animalKey === animalKey);

  // Delete the animal (Farmer/Admin). Records an Event Log entry and notifies
  // the Ngaren Admin both in-app and by email.
  const doDelete = async () => {
    const by = user?.fullName ?? user?.email ?? (isAdmin ? 'Admin' : 'Farmer');
    const refA = animal.ngarenCode ?? animal.accountNumber ?? animal.tag;
    await deleteLocalAnimal(animal.id);
    await deleteHerdAnimal(animal.ngarenCode ?? animal.tag);
    // Event Log.
    await logAuditEvent({ type: 'animal_deleted', title: `Animal deleted — ${animalLabel}`, detail: `${refA} · deleted by ${by}`, by });
    // In-app notification to the Admin + a device push.
    await addLocalNotification({ title: 'Animal deleted', message: `${animalLabel} (${refA}) was deleted by ${by}.` });
    void sendLocalNotification('Animal deleted', `${animalLabel} (${refA}) was deleted by ${by}.`, { type: 'ANIMAL_DELETED' });
    // Email notification to the Ngaren Admin (best-effort; opens the composer).
    try {
      if (await MailComposer.isAvailableAsync()) {
        await MailComposer.composeAsync({
          recipients: [NGAREN_SUPPORT_EMAIL],
          subject: `Ngaren — Animal deleted (${refA})`,
          body: `${animalLabel} (${refA}) was deleted by ${by} on ${new Date().toLocaleString()}.`,
        });
      }
    } catch {
      // best-effort
    }
    notify(t('ad.deletedToast', { name: animalLabel }));
    router.replace('/(tabs)/animals');
  };

  const confirmDelete = () => {
    Alert.alert(t('ad.deleteTitle'), t('ad.deleteBody', { name: animalLabel }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('ad.deleteConfirm'), style: 'destructive', onPress: () => void doDelete() },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader
        title={animal.name ?? animal.tag}
        subtitle={animal.accountNumber ? `${animal.accountNumber} · ${animal.breed.name}` : animal.breed.name}
        showBack
      />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        <View style={{ alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
          <AnimalPhoto uri={animal.photos?.[0]} size={120} rounded={radius.lg} />
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            <ActionChip
              label={tStatus(animal.status)}
              variant={animal.status === 'active' ? 'success' : 'neutral'}
            />
            {animal.approvalStatus === 'pending' ? (
              <ActionChip label={t('ad.pendingActivation')} variant="warning" />
            ) : animal.approvalStatus === 'rejected' ? (
              <ActionChip label={tStatus('rejected')} variant="error" />
            ) : null}
          </View>
        </View>

        {/* Photo ID gallery (front / side / back) — the primary identifier.
            Always offer add/update so existing animals can be photographed. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
          <AppText variant="title">{t('ad.photoId')}</AppText>
          <Pressable
            onPress={() => router.push(`/edit-animal-photos?id=${animal.id}` as never)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Icon name={animal.photos && animal.photos.length > 0 ? 'image-edit-outline' : 'camera-plus-outline'} size={18} color={colors.primary} />
            <AppText variant="body" color={colors.primary} style={{ fontWeight: '600' }}>
              {animal.photos && animal.photos.length > 0 ? t('common.update') : t('ad.addPhotos')}
            </AppText>
          </Pressable>
        </View>
        {animal.photos && animal.photos.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm }}
            style={{ marginBottom: spacing.lg }}>
            {animal.photos.map((uri, i) => (
              <AnimalPhoto key={uri + i} uri={uri} size={150} />
            ))}
          </ScrollView>
        ) : (
          <Pressable
            onPress={() => router.push(`/edit-animal-photos?id=${animal.id}` as never)}
            style={{
              borderWidth: 1,
              borderColor: colors.divider,
              borderStyle: 'dashed',
              borderRadius: radius.md,
              backgroundColor: colors.surface,
              paddingVertical: spacing.lg,
              alignItems: 'center',
              gap: spacing.xs,
              marginBottom: spacing.lg,
            }}>
            <Icon name="camera-plus-outline" size={28} color={colors.primary} />
            <AppText variant="body" color={colors.onSurfaceVariant}>
              {t('ad.noPhotos')}
            </AppText>
          </Pressable>
        )}

        {/* Static record — the animal's own identity that doesn't change. */}
        <AppText variant="title" style={{ marginBottom: spacing.sm }}>
          {t('ad.staticRecord')}
        </AppText>
        <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md }, shadow[1]]}>
          {/* Dual ID: the AAN (system) + the owner's farmer reference. */}
          {animal.accountNumber ? <DetailRow label={t('ad.accountNumber')} value={animal.accountNumber} /> : null}
          {animal.ngarenCode ? <DetailRow label={t('ad.internalId')} value={animal.ngarenCode} /> : null}
          <DetailRow label={t('ad.farmerRef')} value={animal.tag} />
          <DetailRow label={t('ad.breed')} value={animal.breed.name} />
          {animal.color ? <DetailRow label={t('ad.colour')} value={animal.color} /> : null}
          <DetailRow label={t('ad.location')} value={animal.locationName ?? '—'} />
          {animal.physicalAddress ? <DetailRow label={t('ad.address')} value={animal.physicalAddress} /> : null}
          {/* Privacy: display age, not the date of birth. */}
          <DetailRow label={t('ad.age')} value={ageFromDate(animal.dateOfBirth)} />
          <DetailRow label={t('ad.taggingMethod')} value={taggingMeta(animal.taggingMethod).short} />
          <DetailRow label={t('ad.dam')} value={animal.damTag ?? t('reg.unknown')} />
          <DetailRow label={t('ad.sire')} value={animal.sireTag ?? t('reg.unknown')} last={!animal.description} />
          {animal.description ? <DetailRow label={t('ad.notes')} value={animal.description} last /> : null}
        </View>

        {/* Services consumed — the connected services running on this animal. */}
        <AppText variant="title" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
          {t('ad.services')}
        </AppText>
        <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md }, shadow[1]]}>
          <DetailRow label={t('ad.tagAssociated')} value={animal.deviceSerial ?? t('ad.none')} />
          <DetailRow label={t('ad.tagStatus')} value={hasTag ? (tagActive ? tStatus('active') : tStatus('inactive')) : t('ad.notConnected')} />
          <DetailRow label={t('ad.telemetry')} value={hasBehaviourData ? t('ad.syncing') : hasTag ? t('ad.awaitingSync') : t('ad.noDevice')} />
          <DetailRow label={t('ad.vetVisits')} value={vetVisits === 0 ? t('ad.noneBooked') : String(vetVisits)} />
          <DetailRow label={t('ad.alertsMonitoring')} value={tagActive ? t('ad.on') : t('ad.off')} last />
        </View>

        {/* Associated devices (AAN can carry more than one). */}
        {animal.devices && animal.devices.length > 0 ? (
          <>
            <AppText variant="title" style={{ marginTop: spacing.lg, marginBottom: spacing.sm }}>
              {t('ad.devices', { count: animal.devices.length })}
            </AppText>
            <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing.md }, shadow[1]]}>
              {animal.devices.map((d, i) => (
                <DetailRow
                  key={d.serial + i}
                  label={d.type}
                  value={`${d.serial}${d.linkage ? ` · ${d.linkage === 'support' ? t('reg.ngarenLinkage') : t('reg.selfLinkage')}` : ''}`}
                  last={i === animal.devices!.length - 1}
                />
              ))}
            </View>
          </>
        ) : null}

        {/* Digital Health Card — chronological history for this animal's code. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.sm }}>
          <AppText variant="title">{t('ad.healthHistory')}</AppText>
          {/* Only certified professionals may input health records (Sep 5 2026). */}
          {canVet ? (
            <Pressable
              onPress={() => router.push(`/add-health-record?animal=${encodeURIComponent(animalKey)}&label=${encodeURIComponent(animalLabel)}` as never)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Icon name="plus-circle-outline" size={18} color={colors.primary} />
              <AppText variant="body" color={colors.primary} style={{ fontWeight: '600' }}>
                {t('common.add')}
              </AppText>
            </Pressable>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Icon name="lock-outline" size={16} color={colors.onSurfaceVariant} />
              <AppText variant="caption" color={colors.onSurfaceVariant} style={{ fontWeight: '600' }}>
                {t('ad.viewOnly')}
              </AppText>
            </View>
          )}
        </View>
        {animalHealth.length === 0 ? (
          <AppText variant="body" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.lg }}>
            {canVet ? t('ad.noHealthVet') : t('ad.noHealthFarmer')}
          </AppText>
        ) : (
          <View style={{ marginBottom: spacing.lg, gap: spacing.sm }}>
            {animalHealth.map((r) => (
              <View
                key={r.id}
                style={[
                  { flexDirection: 'row', gap: spacing.mdMinus, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.divider },
                  shadow[1],
                ]}>
                <View style={{ width: 8, borderRadius: 4, backgroundColor: r.type === 'ailment' ? colors.error : r.type === 'treatment' ? colors.info : colors.success }} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
                      {HEALTH_TYPE_LABELS[r.type]}
                    </AppText>
                    <AppText variant="caption" color={colors.onSurfaceVariant}>
                      {formatDate(r.date)}
                    </AppText>
                  </View>
                  {r.medication ? (
                    <AppText variant="caption" color={colors.onSurfaceVariant}>
                      {r.medication}
                    </AppText>
                  ) : null}
                  <AppText variant="body" color={colors.onSurface}>
                    {r.notes}
                  </AppText>
                  <AppText variant="caption" color={colors.onSurfaceVariant}>
                    {t('ad.loggedBy', { name: r.recordedBy })}
                  </AppText>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
          <Button label={t('ad.scorecard')} icon="file-document-outline" onPress={() => router.push(`/health-scorecard?id=${animal.id}` as never)} />
          <Button label={t('ad.trackMap')} icon="map-marker-radius" variant="outline" onPress={() => router.push('/(tabs)/track')} />
          <Button label={t('health.requestVet')} icon="stethoscope" variant="outline" onPress={() => router.push('/find-vet')} />
        </View>

        <AppText variant="title" style={{ marginBottom: spacing.md }}>
          {t('ad.ceresActivity')}
        </AppText>
        {!behaviourLoading && !hasBehaviourData ? (
          <EmptyState
            icon="chart-line"
            title={t('ad.noCeresTitle')}
            subtitle={t('ad.noCeresSub')}
            actionLabel={t('ad.goDevices')}
            onAction={() => router.push('/devices')}
          />
        ) : (
          behaviour.map((series) => <ChartCard key={series.label} series={series} />)
        )}

        {/* Delete animal — Farmer/Admin only (Oct 2026). */}
        {canDelete ? (
          <Button
            label={t('ad.deleteAnimal')}
            icon="trash-can-outline"
            variant="danger"
            onPress={confirmDelete}
            style={{ marginTop: spacing.xl }}
          />
        ) : null}
      </Screen>
    </View>
  );
}
