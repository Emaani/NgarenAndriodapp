import { useState } from 'react';
import { View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { colors, spacing } from '@/theme';
import { CalendarType } from '@/data/clinical';
import { addLocalEvent } from '@/data/localEvents';
import { useAuth } from '@/services/auth';
import { useT } from '@/i18n';
import { Button, DatePickerField, GradientHeader, PickerField, Screen, TextField } from '@/ui';

// Farmer-schedulable activity types (subset of CalendarType). label holds an
// i18n key, translated at render.
const TYPE_OPTIONS: { label: string; value: CalendarType }[] = [
  { label: 'ae.vetVisit', value: 'vet_visit' },
  { label: 'ae.stockTake', value: 'stock_take' },
  { label: 'ae.vaccination', value: 'vaccination' },
  { label: 'ae.followUp', value: 'follow_up' },
];

/**
 * Schedule a farm calendar activity (vet visit, routine stock take, …). Both
 * farmers and vets can view scheduled events per their access; scheduling is
 * open to any signed-in user for the prototype.
 */
export default function AddEvent() {
  const router = useRouter();
  const t = useT();
  const { loading, isAuthenticated } = useAuth();
  const typeOptions = TYPE_OPTIONS.map((o) => ({ label: t(o.label), value: o.value }));
  const { date: presetDate } = useLocalSearchParams<{ date?: string }>();

  const [title, setTitle] = useState('');
  const [type, setType] = useState<CalendarType>('vet_visit');
  const [date, setDate] = useState(presetDate ?? '');
  const [saving, setSaving] = useState(false);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  const canSubmit = title.trim().length > 0 && !!date;

  const onSubmit = async () => {
    setSaving(true);
    await addLocalEvent({ title: title.trim(), type, date });
    setSaving(false);
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title={t('ae.title')} subtitle={t('ae.subtitle')} showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        <TextField label={t('mkt.fTitle')} required value={title} onChangeText={setTitle} placeholder={t('ae.titlePlaceholder')} />
        <PickerField label={t('ae.activityType')} required value={type} options={typeOptions} onSelect={(v) => setType(v as CalendarType)} />
        <DatePickerField label={t('ae.date')} value={date} placeholder={t('ae.datePlaceholder')} onSelect={setDate} />
        <Button label={t('ae.addBtn')} icon="calendar-plus" loading={saving} disabled={!canSubmit} onPress={onSubmit} style={{ marginTop: spacing.sm }} />
      </Screen>
    </View>
  );
}
