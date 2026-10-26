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
  { value: 'ELA Blue COIN ID', method: 'bluetooth', satellite: false },
  { value: 'ELA Blue PUCK ID', method: 'bluetooth', satellite: false },
  { value: 'Bluetooth', method: 'bluetooth', satellite: false },
];

export const DEVICE_MODEL_OPTIONS = DEVICE_MODELS.map((m) => ({ label: m.value, value: m.value }));

export function deviceModel(type: string) {
  return DEVICE_MODELS.find((m) => m.value === type);
}

/** True for BLE models — these are identified by their static MAC. */
export function isBleModel(type: string): boolean {
  return deviceModel(type)?.method === 'bluetooth';
}

/**
 * BLE tag configuration (ELA BAF, Oct 2026). Battery life is chemistry-capped
 * at 5 years; shorter periods and +4 dBm shorten it (ELA lifecycle curves).
 * 2 s suits handheld walk-by reads; 5 s suits fixed gateways.
 */
export const BLE_FRAME_FORMATS: { value: 'ela_id' | 'ngaren_custom' | 'name_aan'; label: string }[] = [
  { value: 'ngaren_custom', label: 'Ngaren custom frame (AAN in payload)' },
  { value: 'ela_id', label: 'Standard ELA ID frame (MAC → AAN)' },
  { value: 'name_aan', label: 'AAN in advertising name (NFC-written)' },
];
export const BLE_INTERVAL_OPTIONS = [
  { value: '2', label: '2 s — handheld walk-by reads' },
  { value: '5', label: '5 s — fixed gateways, longer battery' },
];
export const BLE_TX_POWER_OPTIONS = [
  { value: '0', label: '0 dBm — standard' },
  { value: '4', label: '+4 dBm — extended range, shorter battery' },
];

/** Derive the animal's overall tagging method from its devices. */
export function methodForDevices(devices?: { type: string }[]): TaggingMethod {
  if (!devices || devices.length === 0) return 'manual';
  return deviceModel(devices[0].type)?.method ?? 'manual';
}
