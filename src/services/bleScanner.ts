/**
 * On-device Bluetooth scan — the radio side of a BLE stock-take. Hands each
 * advertisement to the caller as a `BleDetection`; `lib/bleResolve` turns those
 * into animals.
 *
 * The native module is loaded lazily and every failure comes back as a value,
 * so a device without BLE (or a build without the module) loses only the scan.
 */
import { PermissionsAndroid, Platform } from 'react-native';
import * as Location from 'expo-location';
import type { BleManager } from 'react-native-ble-plx';
import { bytesFromBase64 } from '@/lib/bleFrame';
import type { BleDetection } from '@/lib/bleResolve';

export type BleScanFailure = 'unavailable' | 'permission' | 'bluetooth_off' | 'location_off' | 'failed';

// react-native-ble-plx error codes (BleErrorCode).
const ERROR_MAP: Record<number, BleScanFailure> = {
  100: 'unavailable',
  101: 'permission',
  102: 'bluetooth_off',
  601: 'location_off',
};
const SCAN_MODE_LOW_LATENCY = 2;
// The adapter reports "Unknown" for a moment after the client is created.
const STATE_POLLS = 10;
const STATE_POLL_MS = 150;
const PROMPT_CLOSE_MS = 500;

let manager: BleManager | null = null;
let finishScan: ((result: BleScanFailure | null) => void) | null = null;

function getManager(): BleManager | null {
  if (manager) return manager;
  try {
    const { BleManager: Manager } = require('react-native-ble-plx') as typeof import('react-native-ble-plx');
    manager = new Manager();
  } catch {
    manager = null;
  }
  return manager;
}

async function hasPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const { BLUETOOTH_SCAN, BLUETOOTH_CONNECT, ACCESS_FINE_LOCATION } = PermissionsAndroid.PERMISSIONS;
  // Location stays required on Android 12+: declaring "neverForLocation" would
  // make Android filter beacon-style advertisers, which is what ELA tags are.
  const wanted = Number(Platform.Version) >= 31
    ? [BLUETOOTH_SCAN, BLUETOOTH_CONNECT, ACCESS_FINE_LOCATION]
    : [ACCESS_FINE_LOCATION];
  const held = await Promise.all(wanted.map((p) => PermissionsAndroid.check(p)));
  if (held.every(Boolean)) return true;
  const granted = await PermissionsAndroid.requestMultiple(wanted);
  // An alert raised while the permission dialog is closing never shows.
  await new Promise((resolve) => setTimeout(resolve, PROMPT_CLOSE_MS));
  return wanted.every((p) => granted[p] === PermissionsAndroid.RESULTS.GRANTED);
}

async function adapterProblem(ble: BleManager): Promise<BleScanFailure | null> {
  for (let i = 0; i < STATE_POLLS; i++) {
    const state = await ble.state();
    if (state === 'PoweredOn') return null;
    if (state === 'PoweredOff') return 'bluetooth_off';
    if (state === 'Unauthorized') return 'permission';
    if (state === 'Unsupported') return 'unavailable';
    await new Promise((resolve) => setTimeout(resolve, STATE_POLL_MS));
  }
  return 'unavailable';
}

/** End a running scan early. Safe to call when nothing is scanning. */
export function stopBleScan() {
  finishScan?.(null);
}

/**
 * Listen for `durationMs`, reporting every advertisement heard. Resolves with
 * null when the scan ran to the end (or was stopped), else why it could not run.
 */
export async function scanForTags(
  durationMs: number,
  onDetection: (detection: BleDetection) => void,
): Promise<BleScanFailure | null> {
  const ble = getManager();
  if (!ble) return 'unavailable';
  try {
    if (!(await hasPermissions())) return 'permission';
    const problem = await adapterProblem(ble);
    if (problem) return problem;
    if (!(await Location.hasServicesEnabledAsync())) return 'location_off';
  } catch {
    return 'failed';
  }

  return new Promise((resolve) => {
    let done = false;
    const finish = (result: BleScanFailure | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      finishScan = null;
      Promise.resolve(ble.stopDeviceScan()).catch(() => undefined);
      resolve(result);
    };
    const timer = setTimeout(() => finish(null), durationMs);
    finishScan = finish;
    Promise.resolve(
      ble.startDeviceScan(null, { allowDuplicates: true, scanMode: SCAN_MODE_LOW_LATENCY }, (error, device) => {
        if (error) {
          finish(ERROR_MAP[error.errorCode] ?? 'failed');
          return;
        }
        if (!device) return;
        onDetection({
          mac: device.id,
          name: device.localName ?? device.name,
          manufacturerData: bytesFromBase64(device.manufacturerData),
          rssi: device.rssi,
          seenAt: new Date().toISOString(),
        });
      }),
    ).catch(() => finish('failed'));
  });
}
