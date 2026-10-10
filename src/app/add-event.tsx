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

// Time-of-day slots (Oct 2026 standup — add a time field to event creation).
// 30-minute steps across the working day; the time is optional.
const TIME_OPTIONS = Array.from({ length: 29 }, (_, i) => {
  const mins = 6 * 60 + i * 30; // 06:00 → 20:00
  const hh = String(Math.floor(mins / 60)).padStart(2, '0');
  const mm = String(mins % 60).padStart(2, '0');
  const v = `${hh}:${mm}`;
  return { label: v, value: v };
});

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
  const [time, setTime] = useState('');
  const [saving, setSaving] = useState(false);

  if (loading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;

  const canSubmit = title.trim().length > 0 && !!date;

  const onSubmit = async () => {
    setSaving(true);
    await addLocalEvent({ title: title.trim(), type, date, time: time || undefined });
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
        <PickerField label={t('ae.time')} value={time} placeholder={t('ae.timePlaceholder')} options={TIME_OPTIONS} onSelect={setTime} />
        <Button label={t('ae.addBtn')} icon="calendar-plus" loading={saving} disabled={!canSubmit} onPress={onSubmit} style={{ marginTop: spacing.sm }} />
      </Screen>
    </View>
  );
}
