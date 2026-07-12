import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { formatDate } from '@/lib/date';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { BottomSheet } from './BottomSheet';

const boxStyle = {
  borderWidth: 1,
  borderColor: colors.divider,
  borderRadius: radius.md,
  backgroundColor: colors.surface,
  paddingHorizontal: spacing.mdMinus,
  minHeight: 48,
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  justifyContent: 'space-between' as const,
};

function Label({ text, required }: { text: string; required?: boolean }) {
  return (
    <AppText variant="body" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
      {text}
      {required ? ' *' : ''}
    </AppText>
  );
}

export interface PickerOption {
  label: string;
  value: string;
}

/**
 * A real dropdown: tapping the field opens a bottom sheet listing the options,
 * with the current selection ticked. Selecting one closes the sheet and reports
 * the value. Replaces the old "cycle through values on tap" behaviour.
 */
export function PickerField({
  label,
  required,
  value,
  placeholder = 'Select...',
  options,
  onSelect,
}: {
  label: string;
  required?: boolean;
  value?: string;
  placeholder?: string;
  options: PickerOption[];
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={{ marginBottom: spacing.md }}>
      <Label text={label} required={required} />
      <Pressable onPress={() => setOpen(true)} style={boxStyle}>
        <AppText variant="bodyLarge" color={selected ? colors.onSurface : colors.onSurfaceVariant}>
          {selected?.label ?? placeholder}
        </AppText>
        <Icon name="chevron-down" size={20} color={colors.onSurfaceVariant} />
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)} title={label}>
        {options.length === 0 ? (
          <AppText variant="body" color={colors.onSurfaceVariant} style={{ paddingVertical: spacing.md }}>
            No options available.
          </AppText>
        ) : (
          <ScrollView style={{ maxHeight: 360 }}>
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    onSelect(opt.value);
                    setOpen(false);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: spacing.md,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.divider,
                  }}>
                  <AppText variant="bodyLarge" color={active ? colors.primary : colors.onSurface} style={{ fontWeight: active ? '600' : '400' }}>
                    {opt.label}
                  </AppText>
                  {active && <Icon name="check" size={20} color={colors.primary} />}
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </BottomSheet>
    </View>
  );
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** ISO (YYYY-MM-DD) -> friendly "12 Mar 2024" for display. Delegates to the
 * canonical app date formatter so every date renders identically. */
export function formatIsoDate(iso?: string | null): string {
  if (!iso) return '';
  return formatDate(iso);
}

/**
 * A functional calendar date picker (JS-only, no native module — works
 * identically on every Android version). Opens a bottom sheet with a month grid
 * you can page through; picking a day reports an ISO (YYYY-MM-DD) string.
 */
export function DatePickerField({
  label,
  required,
  value,
  placeholder = 'Select a date',
  maximumIso,
  onSelect,
}: {
  label: string;
  required?: boolean;
  value?: string;
  placeholder?: string;
  /** Optional upper bound (e.g. today for a date of birth). */
  maximumIso?: string;
  onSelect: (iso: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const initial = value ? new Date(value) : new Date();
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  const maxDate = maximumIso ? new Date(maximumIso) : null;
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const totalDays = daysInMonth(viewYear, viewMonth);
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];

  const step = (delta: number) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  };

  const pick = (day: number) => {
    const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onSelect(iso);
    setOpen(false);
  };

  const isDisabled = (day: number) => {
    if (!maxDate) return false;
    return new Date(viewYear, viewMonth, day) > maxDate;
  };

  const selISO = value ?? '';

  return (
    <View style={{ marginBottom: spacing.md }}>
      <Label text={label} required={required} />
      <Pressable onPress={() => setOpen(true)} style={boxStyle}>
        <AppText variant="bodyLarge" color={value ? colors.onSurface : colors.onSurfaceVariant}>
          {value ? formatIsoDate(value) : placeholder}
        </AppText>
        <Icon name="calendar" size={20} color={colors.onSurfaceVariant} />
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)} title={label}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
          <Pressable onPress={() => step(-1)} hitSlop={8} style={{ padding: spacing.xs }}>
            <Icon name="chevron-left" size={26} color={colors.primary} />
          </Pressable>
          <AppText variant="title">{MONTHS[viewMonth]} {viewYear}</AppText>
          <Pressable onPress={() => step(1)} hitSlop={8} style={{ padding: spacing.xs }}>
            <Icon name="chevron-right" size={26} color={colors.primary} />
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', marginBottom: spacing.xs }}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center' }}>
              <AppText variant="caption" color={colors.onSurfaceVariant}>{d}</AppText>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {cells.map((day, i) => {
            if (day === null) return <View key={`e${i}`} style={{ width: `${100 / 7}%`, height: 42 }} />;
            const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const active = iso === selISO;
            const disabled = isDisabled(day);
            return (
              <Pressable
                key={`d${i}`}
                disabled={disabled}
                onPress={() => pick(day)}
                style={{ width: `${100 / 7}%`, height: 42, alignItems: 'center', justifyContent: 'center' }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: active ? colors.primary : 'transparent',
                  }}>
                  <AppText
                    variant="body"
                    color={active ? '#fff' : disabled ? colors.divider : colors.onSurface}>
                    {day}
                  </AppText>
                </View>
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </View>
  );
}
