import { useState } from 'react';
import { View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { colors, spacing } from '@/theme';
import { CalendarType } from '@/data/clinical';
import { addLocalEvent } from '@/data/localEvents';
import { useAuth } from '@/services/auth';
import { Button, DatePickerField, GradientHeader, PickerField, Screen, TextField } from '@/ui';

// Farmer-schedulable activity types (subset of CalendarType).
const TYPE_OPTIONS: { label: string; value: CalendarType }[] = [
  { label: 'Vet Visit', value: 'vet_visit' },
  { label: 'Stock Take', value: 'stock_take' },
  { label: 'Vaccination', value: 'vaccination' },
  { label: 'Follow-up', value: 'follow_up' },
];

/**
 * Schedule a farm calendar activity (vet visit, routine stock take, …). Both
 * farmers and vets can view scheduled events per their access; scheduling is
 * open to any signed-in user for the prototype.
 */
export default function AddEvent() {
  const router = useRouter();
  const { loading, isAuthenticated } = useAuth();

  const [title, setTitle] = useState('');
  const [type, setType] = useState<CalendarType>('vet_visit');
  const [date, setDate] = useState('');
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
      <GradientHeader title="Schedule Activity" subtitle="Add to the farm calendar" showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        <TextField label="Title" required value={title} onChangeText={setTitle} placeholder="e.g. Routine herd stock take" />
        <PickerField label="Activity type" required value={type} options={TYPE_OPTIONS} onSelect={(v) => setType(v as CalendarType)} />
        <DatePickerField label="Date" value={date} placeholder="Select a date" onSelect={setDate} />
        <Button label="Add to calendar" icon="calendar-plus" loading={saving} disabled={!canSubmit} onPress={onSubmit} style={{ marginTop: spacing.sm }} />
      </Screen>
    </View>
  );
}
