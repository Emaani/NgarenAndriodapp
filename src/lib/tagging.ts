/**
 * Tagging methods — the device type an animal is identified by.
 *
 * Centralised so registration, the animal profile, the herd list and the
 * device-type dashboard all render the same labels and icons. "manual" is the
 * no-device day-1 path; the others are future hardware/satellite integrations.
 */
import { IconName } from '@/ui';

export type TaggingMethod = 'satellite' | 'bluetooth' | 'qr' | 'manual';

export const TAGGING_META: Record<TaggingMethod, { label: string; short: string; icon: IconName }> = {
  satellite: { label: 'Satellite tag (Ceres Tag)', short: 'Satellite', icon: 'satellite-variant' },
  bluetooth: { label: 'Bluetooth (BLE) tag', short: 'Bluetooth', icon: 'bluetooth' },
  qr: { label: 'QR-code ear tag', short: 'QR tag', icon: 'qrcode' },
  manual: { label: 'Manual / visual tag (no device)', short: 'Ordinary', icon: 'eye-outline' },
};

export const SMART_METHODS: TaggingMethod[] = ['satellite', 'bluetooth', 'qr'];

/** Options for the registration picker (value = method key). */
export const TAGGING_METHOD_OPTIONS = (Object.keys(TAGGING_META) as TaggingMethod[]).map((value) => ({
  label: TAGGING_META[value].label,
  value,
}));

export function taggingMeta(method?: string) {
  return TAGGING_META[(method as TaggingMethod) ?? 'manual'] ?? TAGGING_META.manual;
}

/**
 * Device models the app can capture (AAN step 1d.ii), each mapped to its
 * tagging-method category and whether it needs satellite-provider linkage.
 */
export const DEVICE_MODELS: { value: string; method: TaggingMethod; satellite: boolean }[] = [
  { value: 'Ceres Gen6', method: 'satellite', satellite: true },
  { value: 'Ceres Rancher', method: 'satellite', satellite: true },
  { value: 'Gsat Rancher', method: 'satellite', satellite: true },
  { value: 'Bluetooth', method: 'bluetooth', satellite: false },
];

export const DEVICE_MODEL_OPTIONS = DEVICE_MODELS.map((m) => ({ label: m.value, value: m.value }));

export function deviceModel(type: string) {
  return DEVICE_MODELS.find((m) => m.value === type);
}

/** Derive the animal's overall tagging method from its devices. */
export function methodForDevices(devices?: { type: string }[]): TaggingMethod {
  if (!devices || devices.length === 0) return 'manual';
  return deviceModel(devices[0].type)?.method ?? 'manual';
}
