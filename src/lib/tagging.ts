/**
 * Tagging methods — the device type an animal is identified by.
 *
 * Centralised so registration, the animal profile, the herd list and the
 * device-type dashboard all render the same labels and icons. "manual" is the
 * no-device day-1 path; the others are future hardware/satellite integrations.
 */
import { IconName } from '@/ui';
import { isBleDeviceType } from './bleResolve';

export type TaggingMethod = 'satellite' | 'bluetooth' | 'qr' | 'manual';

export const TAGGING_META: Record<TaggingMethod, { label: string; short: string; icon: IconName }> = {
  satellite: { label: 'Satellite tag', short: 'Satellite', icon: 'satellite-variant' },
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
  { value: 'ELA Blue COIN MOV', method: 'bluetooth', satellite: false },
  { value: 'ELA Blue COIN T', method: 'bluetooth', satellite: false },
  { value: 'ELA Blue PUCK ID', method: 'bluetooth', satellite: false },
  // PUCK MOV / T: battery curves in ELA doc 04E (Nov 9 2026).
  { value: 'ELA Blue PUCK MOV', method: 'bluetooth', satellite: false },
  { value: 'ELA Blue PUCK T', method: 'bluetooth', satellite: false },
  { value: 'Bluetooth', method: 'bluetooth', satellite: false },
  { value: 'Visual ear tag', method: 'manual', satellite: false },
];

export function deviceModel(type: string) {
  return DEVICE_MODELS.find((m) => m.value === type);
}

/**
 * Satellite and Bluetooth are separate integrations (Oct 28 2026): the farmer
 * chooses one identification type per animal, and that type decides which
 * devices can be added and how the dashboard behaves for the animal.
 */
export type IdentificationType = 'physical' | 'satellite' | 'bluetooth';

const METHOD_FOR_ID_TYPE: Record<IdentificationType, TaggingMethod> = {
  physical: 'manual',
  satellite: 'satellite',
  bluetooth: 'bluetooth',
};

export function deviceOptionsFor(idType: IdentificationType | '') {
  const method = idType ? METHOD_FOR_ID_TYPE[idType] : null;
  return DEVICE_MODELS.filter((m) => !method || m.method === method).map((m) => ({ label: m.value, value: m.value }));
}

/** False only for a known model of another type; older model names are kept. */
export function deviceFitsIdType(type: string, idType: IdentificationType | ''): boolean {
  const model = deviceModel(type);
  return !model || !idType || model.method === METHOD_FOR_ID_TYPE[idType];
}

/** Bluetooth animals have no live feed: the app shows their last confirmation. */
export function isBluetoothAnimal(a: {
  identificationType?: string | null;
  taggingMethod?: string | null;
  devices?: { type: string }[] | null;
}): boolean {
  if (a.identificationType) return a.identificationType === 'bluetooth';
  return a.taggingMethod === 'bluetooth' || (a.devices ?? []).some((d) => isBleDeviceType(d.type));
}

/** True for BLE models — these are identified by their static MAC. */
export function isBleModel(type: string): boolean {
  return deviceModel(type)?.method === 'bluetooth';
}

/**
 * ELA tag variant from the device model: a tag carries motion (MOV) OR
 * temperature (T), never both (ELA, Oct 27 2026).
 */
export function bleVariant(type: string): 'id' | 'mov' | 't' {
  if (/\bMOV\b/i.test(type)) return 'mov';
  if (/\bT$/i.test(type.trim())) return 't';
  return 'id';
}

/**
 * Blue COIN projected battery life, years, at a SUSTAINED +40 °C — ELA technical
 * support (Anthony Melliez, Oct 27 2026), for ELA's standard formats. The coin
 * cell caps every configuration at 5 years. Indicative only; a custom frame may
 * shift these slightly. COIN tags only — PUCK tags use ELA_PUCK_CURVES.
 */
export const ELA_AUTONOMY_40C: Record<'id' | 'mov' | 't', Record<string, number>> = {
  //        '<dBm>|<period s>'
  id: { '4|2': 2.6, '0|2': 2.75, '4|5': 4.9, '0|5': 5 },
  mov: { '4|2': 1.88, '0|2': 2.2, '4|5': 3.2, '0|5': 3.3 },
  t: { '4|2': 1.8, '0|2': 2.0, '4|5': 3.2, '0|5': 3.3 },
};

/** COIN projection at +40 °C, or null for a PUCK or an unlisted setting. */
export function projectedBatteryYears(type: string, txPowerDbm: number, intervalSec: number): number | null {
  if (bleFormFactor(type) === 'puck') return null;
  return ELA_AUTONOMY_40C[bleVariant(type)][`${txPowerDbm}|${intervalSec}`] ?? null;
}

/**
 * Blue PUCK battery life, years — read from ELA's "BLE PUCK format – Battery life
 * cycle 04E" (firmware v3.x.x, 10% self-discharge applied, capped at 20 years
 * including storage), sent by Anthony Melliez on Nov 9 2026. ELA has no +40 °C
 * curve; it publishes +23 °C and +80 °C, so a sustained +40 °C is planned on the
 * +80 °C figure (conservative). Other temperatures in the doc: −18 °C ≈ 9 y and
 * −30 °C ≈ 3 y at 3 s; −40 °C only 0.09 y at 3 s.
 *
 * `id23`, `id80`, `id23p4` are the Blue PUCK ID reference curves (0 dBm at +23 °C
 * and +80 °C, +4 dBm at +23 °C); `mov23` / `t23` are Blue PUCK MOV and ELA T at
 * 0 dBm, +23 °C. ELA's method (doc §10) scales a variant's +23 °C / 0 dBm curve by
 * the ID reference's temperature and power ratios.
 */
export const ELA_PUCK_PERIODS_S = [1, 2, 3, 5, 7.5, 10] as const;
export const ELA_PUCK_CURVES = {
  id23: [6.6, 11.0, 14.4, 18.4, 20, 20],
  id80: [5.6, 9.3, 12.2, 15.7, 18.5, 19.0],
  id23p4: [5.7, 9.7, 12.5, 16.9, 20, 20],
  mov23: [5.6, 9.7, 12.6, 16.6, 19.6, 20],
  t23: [4.8, 8.3, 11.0, 15.2, 18.6, 20],
} as const;
export const ELA_PUCK_MAX_YEARS = 20;

/**
 * Projected PUCK battery life at +80 °C (plan on this) and +23 °C, by ELA's
 * method, or null when the tag isn't a PUCK or the period isn't on the curves.
 */
export function puckBatteryYears(type: string, txPowerDbm: number, intervalSec: number): { at80: number; at23: number } | null {
  if (bleFormFactor(type) !== 'puck') return null;
  const i = ELA_PUCK_PERIODS_S.indexOf(intervalSec as (typeof ELA_PUCK_PERIODS_S)[number]);
  if (i < 0 || (txPowerDbm !== 0 && txPowerDbm !== 4)) return null;
  const c = ELA_PUCK_CURVES;
  const variant = bleVariant(type);
  const base = (variant === 'mov' ? c.mov23 : variant === 't' ? c.t23 : c.id23)[i];
  const power = txPowerDbm === 4 ? c.id23p4[i] / c.id23[i] : 1;
  const heat = c.id80[i] / c.id23[i];
  const round = (y: number) => Math.min(ELA_PUCK_MAX_YEARS, Math.round(y * 10) / 10);
  return { at80: round(base * power * heat), at23: round(base * power) };
}

/**
 * ELA's BLE connected mode (reconfiguring a tag over Bluetooth) is reachable only
 * when the advertising period is under 3 s (PUCK doc 04E). At longer periods a
 * tag must be configured before it is fitted (factory TAGSET02 or NFC).
 */
export const ELA_CONNECTED_MODE_MAX_PERIOD_S = 3;
export const bleReconfigurable = (intervalSec: number) => intervalSec < ELA_CONNECTED_MODE_MAX_PERIOD_S;

/**
 * Indicative open-field read range at +4 dBm, metres (ELA, Nov 2 2026). NOT a
 * guarantee: ELA (Anthony Melliez, Nov 9 2026) says range depends heavily on the
 * environment and the receiver, cannot be guaranteed, and should be tested on
 * site with 1–2 tags. No figure for 0 dBm. ELA BAF tags cannot use Bluetooth
 * Long Range (Coded PHY), so range can only come from TX power and the receiver.
 */
export const ELA_RANGE_M_AT_4DBM = { coin: 200, puck: 500 } as const;
export const ELA_SUPPORTS_CODED_PHY = false;

export function bleFormFactor(type: string): keyof typeof ELA_RANGE_M_AT_4DBM | null {
  if (/\bPUCK\b/i.test(type)) return 'puck';
  return /\bCOIN\b/i.test(type) ? 'coin' : null;
}

/** ELA's indicative open-field figure for this tag, or null for a tag ELA gave none for. */
export function openFieldRangeM(type: string): number | null {
  const form = bleFormFactor(type);
  return form ? ELA_RANGE_M_AT_4DBM[form] : null;
}

/**
 * BLE tag configuration (ELA BAF). On COIN tags only ID at 0 dBm / 5 s reaches
 * the 5-year target at +40 °C; PUCK tags clear it at every listed setting (ID
 * 0 dBm / 5 s ≈ 15.7 y at +80 °C). 5 s stays the default: a 15 s scan hears
 * about three adverts from every tag in range, so a stock-take doesn't need 2 s.
 * The trade-off: at 5 s the tag can't be reconfigured over Bluetooth (connected
 * mode needs < 3 s). +4 dBm buys range (indicative only) at the cost of battery.
 */
export const BLE_FRAME_FORMATS: { value: 'ela_id' | 'ngaren_custom' | 'name_aan'; label: string }[] = [
  { value: 'ngaren_custom', label: 'Ngaren custom frame (AAN in payload)' },
  { value: 'ela_id', label: 'Standard ELA frame (MAC → AAN)' },
  { value: 'name_aan', label: 'AAN in advertising name (NFC-written)' },
];
export const BLE_INTERVAL_OPTIONS = [
  { value: '5', label: '5 s — recommended (longest battery)' },
  { value: '2', label: '2 s — faster reads, much shorter battery' },
];
export const BLE_TX_POWER_OPTIONS = [
  { value: '0', label: '0 dBm — recommended' },
  { value: '4', label: '+4 dBm — longer range (ELA indicative, not guaranteed: ~200 m coin, ~500 m puck, open field)' },
];

/** Derive the animal's overall tagging method from its devices. */
export function methodForDevices(devices?: { type: string }[]): TaggingMethod {
  if (!devices || devices.length === 0) return 'manual';
  return deviceModel(devices[0].type)?.method ?? 'manual';
}
