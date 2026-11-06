import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { colors, radius, shadow, spacing } from '@/theme';
import { canEditFence, deleteGeofence, getGeofenceRow, getGeofences, saveGeofence } from '@/data/geofences';
import { getHerd } from '@/data/herd';
import { useResource } from '@/data/hooks';
import { FenceDrawMap, FenceDrawMapHandle } from '@/components/FenceDrawMap';
import { AlertOn, FENCE_COLORS, FenceDraft, draftProblem, draftRing, emptyDraft, ringAreaHa, rowToDraft } from '@/lib/geofenceShapes';
import { useAuth } from '@/services/auth';
import { notify } from '@/lib/toast';
import { useT } from '@/i18n';
import { AppText, Button, GradientHeader, Icon, IconName, TextField } from '@/ui';

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: on ? colors.primary : colors.surface, borderWidth: 1, borderColor: on ? colors.primary : colors.divider }}>
      <AppText variant="caption" color={on ? '#fff' : colors.onSurfaceVariant} style={{ fontWeight: '600' }}>{label}</AppText>
    </Pressable>
  );
}

function MapButton({ icon, label, onPress, disabled }: { icon: IconName; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      style={[{ width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }, shadow[2]]}>
      <Icon name={icon} size={20} color={colors.primary} />
    </Pressable>
  );
}

const ALERTS: AlertOn[] = ['both', 'exit', 'enter', 'none'];

/**
 * Draw or change one boundary. Tap the map to place corners (polygon) or the
 * centre (circle). Saved to the shared `geofences` table, so the web shows it
 * straight away, and the Track map checks animals against it.
 */
export default function GeofenceEdit() {
  const router = useRouter();
  const t = useT();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { loading, isAuthenticated, user, appRole } = useAuth();
  const mapRef = useRef<FenceDrawMapHandle>(null);
  const [draft, setDraft] = useState<FenceDraft>(emptyDraft);
  const [owner, setOwner] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!id);
  const [saving, setSaving] = useState(false);
  const { data: allFences } = useResource(getGeofences, []);
  const { data: herd } = useResource(getHerd, []);

  useEffect(() => {
    if (!id) return;
    getGeofenceRow(id)
      .then((row) => {
        if (row) {
          setDraft(rowToDraft(row));
          setOwner(row.created_by);
        }
      })
      .catch(() => notify(t('gf.loadFail')))
      .finally(() => setLoaded(true));
  }, [id, t]);

  const others = useMemo(() => allFences.filter((f) => f.uuid !== id), [allFences, id]);
  const ring = useMemo(() => draftRing(draft), [draft]);
  const vertices = useMemo(() => (draft.fenceType === 'circle' ? (draft.center ? [draft.center] : []) : draft.points), [draft]);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  const editable = id ? !!owner && canEditFence({ created_by: owner }, user, appRole) : appRole === 'admin' || appRole === 'farmer';
  const update = (patch: Partial<FenceDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const problem = draftProblem(draft);

  const onTap = (p: { lat: number; lng: number }) => {
    if (!editable) return;
    setDraft((d) => (d.fenceType === 'circle' ? { ...d, center: p } : { ...d, points: [...d.points, p] }));
  };

  const goToMe = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('reg.locPermTitle'), t('trk.locPermBody'));
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      mapRef.current?.flyTo(pos.coords.latitude, pos.coords.longitude, 17);
    } catch {
      Alert.alert(t('trk.locUnavailTitle'), t('trk.locUnavailBody'));
    }
  };

  const onSave = async () => {
    if (problem || !user) return;
    setSaving(true);
    try {
      await saveGeofence(draft, user.id, id);
      notify(t('gf.saved'));
      router.back();
    } catch (e) {
      Alert.alert(t('gf.saveFail'), e instanceof Error ? e.message : '');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!id) return;
    Alert.alert(t('gf.deleteTitle'), t('gf.deleteBody', { name: draft.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('gf.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteGeofence(id);
            notify(t('gf.deleted'));
            router.back();
          } catch (e) {
            Alert.alert(t('gf.saveFail'), e instanceof Error ? e.message : '');
          }
        },
      },
    ]);
  };

  const area = ringAreaHa(ring);
  const hint =
    draft.fenceType === 'circle'
      ? draft.center ? t('gf.hintCircleMove') : t('gf.hintCircle')
      : draft.points.length < 3 ? t('gf.hintPolygon', { count: draft.points.length }) : t('gf.hintPolygonMore');
  const toggleAnimal = (key: string) =>
    update({ assignedAnimalIds: draft.assignedAnimalIds.includes(key) ? draft.assignedAnimalIds.filter((k) => k !== key) : [...draft.assignedAnimalIds, key] });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={id ? (editable ? t('gf.editTitle') : draft.name || t('gf.title')) : t('gf.new')} showBack />
      <View style={{ height: 320 }}>
        {loaded && <FenceDrawMap ref={mapRef} ring={ring} vertices={vertices} color={draft.color} keepOut={draft.mode === 'keep_out'} others={others} onTap={onTap} />}
        <View style={{ position: 'absolute', right: spacing.md, top: spacing.md, gap: spacing.sm }}>
          <MapButton icon="crosshairs-gps" label={t('trk.myLocation')} onPress={goToMe} />
          <MapButton icon="fit-to-screen-outline" label={t('gf.fit')} onPress={() => mapRef.current?.fitDraft()} disabled={ring.length < 3} />
          {editable && draft.fenceType === 'polygon' && (
            <MapButton icon="undo" label={t('gf.undo')} onPress={() => update({ points: draft.points.slice(0, -1) })} disabled={draft.points.length === 0} />
          )}
          {editable && (
            <MapButton icon="eraser" label={t('gf.clear')} onPress={() => update({ points: [], center: null })} disabled={vertices.length === 0} />
          )}
        </View>
        {editable && (
          <View style={{ position: 'absolute', left: spacing.md, bottom: spacing.md, right: 64, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: radius.md, padding: spacing.sm }}>
            <AppText variant="caption">{hint}</AppText>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }} keyboardShouldPersistTaps="handled">
        {editable ? (
          <>
            <AppText variant="overline" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>{t('gf.shape')}</AppText>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
              <Chip label={t('gf.type.polygon')} on={draft.fenceType === 'polygon'} onPress={() => update({ fenceType: 'polygon' })} />
              <Chip label={t('gf.type.circle')} on={draft.fenceType === 'circle'} onPress={() => update({ fenceType: 'circle' })} />
            </View>

            <TextField label={t('gf.name')} required value={draft.name} onChangeText={(v) => update({ name: v })} placeholder={t('gf.namePlaceholder')} />
            <TextField label={t('gf.description')} value={draft.description} onChangeText={(v) => update({ description: v })} multiline />
            {draft.fenceType === 'circle' && (
              <TextField
                label={t('gf.radius')}
                required
                keyboardType="numeric"
                value={draft.radiusM ? String(draft.radiusM) : ''}
                onChangeText={(v) => update({ radiusM: Math.max(0, Number(v.replace(/[^0-9.]/g, '')) || 0) })}
              />
            )}

            <AppText variant="overline" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>{t('gf.rule')}</AppText>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs }}>
              <Chip label={t('gf.keepIn')} on={draft.mode === 'keep_in'} onPress={() => update({ mode: 'keep_in' })} />
              <Chip label={t('gf.keepOut')} on={draft.mode === 'keep_out'} onPress={() => update({ mode: 'keep_out' })} />
            </View>
            <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.md }}>
              {draft.mode === 'keep_out' ? t('gf.keepOutHelp') : t('gf.keepInHelp')}
            </AppText>

            <AppText variant="overline" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>{t('gf.alertOn')}</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
              {ALERTS.map((a) => (
                <Chip key={a} label={t(`gf.alert.${a}`)} on={draft.alertOn === a} onPress={() => update({ alertOn: a })} />
              ))}
            </View>

            <AppText variant="overline" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>{t('gf.colour')}</AppText>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
              {FENCE_COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => update({ color: c })}
                  accessibilityLabel={c}
                  style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c, borderWidth: draft.color === c ? 3 : 0, borderColor: colors.onSurface }}
                />
              ))}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
              <AppText variant="bodyLarge">{t('gf.activeLabel')}</AppText>
              <Switch value={draft.active} onValueChange={(v) => update({ active: v })} />
            </View>

            <AppText variant="overline" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.xs }}>
              {t('gf.animals', { count: draft.assignedAnimalIds.length || t('gf.all') })}
            </AppText>
            <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>{t('gf.animalsHelp')}</AppText>
            {herd.map((a) => {
              const key = a.ngarenCode ?? a.tag;
              const on = draft.assignedAnimalIds.includes(key);
              return (
                <Pressable key={a.id} onPress={() => toggleAnimal(key)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}>
                  <Icon name={on ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={on ? colors.primary : colors.onSurfaceVariant} />
                  <AppText variant="body">{a.name ? `${a.name} · ${a.tag}` : a.tag}</AppText>
                </Pressable>
              );
            })}

            <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginTop: spacing.md }}>
              {t('gf.areaHa', { ha: area.toFixed(area < 10 ? 2 : 1) })}
            </AppText>
            {problem && <AppText variant="caption" color={colors.error} style={{ marginTop: spacing.xs }}>{t(`gf.problem.${problem}`)}</AppText>}
            <Button label={t('gf.save')} icon="content-save-outline" loading={saving} disabled={!!problem || saving} onPress={onSave} style={{ marginTop: spacing.md }} />
            {id && <Button label={t('gf.delete')} icon="delete-outline" variant="danger" onPress={onDelete} style={{ marginTop: spacing.sm }} />}
          </>
        ) : (
          <View style={{ gap: spacing.xs }}>
            <AppText variant="title">{draft.name}</AppText>
            {!!draft.description && <AppText variant="body" color={colors.onSurfaceVariant}>{draft.description}</AppText>}
            <AppText variant="body" color={colors.onSurfaceVariant}>
              {t(`gf.type.${draft.fenceType}`)} · {t(draft.mode === 'keep_out' ? 'gf.keepOut' : 'gf.keepIn')} · {t('gf.areaHa', { ha: area.toFixed(area < 10 ? 2 : 1) })}
            </AppText>
            <AppText variant="caption" color={colors.onSurfaceVariant}>{t('gf.readOnly')}</AppText>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
