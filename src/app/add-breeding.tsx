import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { colors, radius, spacing } from '@/theme';
import { animals as animalsFallback } from '@/data/mock';
import { getHerd } from '@/data/herd';
import { addLocalBreedingRecord, expectedCalving } from '@/data/localBreeding';
import { useResource } from '@/data/hooks';
import { useAuth } from '@/services/auth';
import { notify } from '@/lib/toast';
import { formatDate } from '@/lib/date';
import { useT } from '@/i18n';
import { AppText, Button, DatePickerField, GradientHeader, Icon, PickerField, Screen, TextField } from '@/ui';

// Mating method value stays stable (English); the label translates.
const METHOD_KEYS: { key: string; value: string }[] = [
  { key: 'brd.method.natural', value: 'Natural' },
  { key: 'brd.method.ai', value: 'Artificial Insemination' },
  { key: 'brd.method.et', value: 'Embryo transfer' },
];

/**
 * Record a breeding event (mating). Captures the dam (from the herd), the sire,
 * the mating method and date; expected calving is auto-derived. The record is
 * created as `pending`, then advanced to confirmed/calved from the Breeding list.
 */
export default function AddBreeding() {
  const router = useRouter();
  const t = useT();
  const { loading, isAuthenticated } = useAuth();
  const { data: herd } = useResource(getHerd, animalsFallback);

  const [damId, setDamId] = useState('');
  const [sire, setSire] = useState('');
  const [method, setMethod] = useState('Natural');
  const [matingDate, setMatingDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const damOptions = useMemo(
    () => herd.map((a) => ({ label: `${a.name ?? a.tag} · ${a.tag}`, value: String(a.id) })),
    [herd],
  );
  const methodOptions = useMemo(() => METHOD_KEYS.map((m) => ({ label: t(m.key), value: m.value })), [t]);
  const dam = herd.find((a) => String(a.id) === damId);
  const due = matingDate ? expectedCalving(matingDate) : null;

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  const canSubmit = !!dam && !!matingDate;

  const onSubmit = async () => {
    if (!dam || !matingDate) return;
    setSaving(true);
    try {
      await addLocalBreedingRecord({
        damName: dam.name ?? dam.tag,
        damTag: dam.tag,
        sireName: sire.trim() || '—',
        sireTag: null,
        matingMethod: method,
        matingDate,
        notes: notes.trim() || null,
      });
      notify(t('brd.add.saved'));
      router.back();
    } catch {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('brd.add.title')} subtitle={t('brd.add.subtitle')} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        <PickerField label={t('reg.dam')} required value={damId} placeholder={t('brd.add.damPlaceholder')} options={damOptions} onSelect={setDamId} />
        <TextField label={t('reg.sire')} value={sire} onChangeText={setSire} placeholder={t('brd.add.sirePlaceholder')} />
        <PickerField label={t('brd.add.method')} required value={method} placeholder={t('brd.add.methodPlaceholder')} options={methodOptions} onSelect={setMethod} />
        <DatePickerField label={t('brd.add.matingDate')} value={matingDate} placeholder={t('brd.add.matingDatePlaceholder')} maximumIso={today} onSelect={setMatingDate} />

        {/* Auto-derived expected calving preview. */}
        {due ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primaryTint, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}>
            <Icon name="baby-carriage" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <AppText variant="body" style={{ fontWeight: '700' }} color={colors.primaryDark}>
                {t('brd.add.expectedCalving')}: {formatDate(due)}
              </AppText>
              <AppText variant="caption" color={colors.primaryDark}>
                {t('brd.add.expectedHint')}
              </AppText>
            </View>
          </View>
        ) : null}

        <TextField label={t('ad.notes')} value={notes} onChangeText={setNotes} placeholder={t('brd.add.notesPlaceholder')} multiline />
        <Button label={t('brd.add.save')} icon="content-save-outline" loading={saving} disabled={!canSubmit} onPress={onSubmit} style={{ marginTop: spacing.sm }} />
      </Screen>
    </View>
  );
}
