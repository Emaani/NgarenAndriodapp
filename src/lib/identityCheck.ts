/**
 * Face ID for approving and submitting records (spec 3.1.5).
 *
 * Face ID is set up once on the user's profile (Tester feedback 2026-11-07:
 * "Face ID must have been set up at the time of profile creation"): the
 * phone's face unlock or fingerprint is checked, and this phone is linked to
 * the account in its profile. After that, approving a record asks the phone
 * to confirm it is the same person, in a system prompt, so the app stays open.
 *
 * There is no selfie fallback any more: a phone without face unlock or a
 * fingerprint, or one not linked to the profile, is sent to set Face ID up
 * (OTP stays available as the alternative). Every check is written to the
 * audit log against the user, for accountability.
 */
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import { supabase } from '@/services/supabase';

export type IdentityResult = 'verified' | 'cancelled' | 'not_set_up' | 'failed';

export interface IdentityPrompts {
  /** Shown in the system dialog, e.g. "Approve UG-1126-K9MWP2". */
  promptMessage: string;
  cancelLabel: string;
}

/** What the profile records about Face ID. */
export interface FaceIdProfile {
  enrolledAt: string;
  devices: { id: string; model: string; linkedAt: string }[];
}

const DEVICE_KEY = 'ngaren.device.id.v1';

/** A random id for this install, kept in secure storage, so a profile knows its phones. */
export async function deviceId(): Promise<string> {
  try {
    const existing = await SecureStore.getItemAsync(DEVICE_KEY);
    if (existing) return existing;
    const id = `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    await SecureStore.setItemAsync(DEVICE_KEY, id);
    return id;
  } catch {
    return 'unknown';
  }
}

/** True when the phone has face unlock or a fingerprint set up (a PIN alone isn't Face ID). */
export async function biometricReady(): Promise<boolean> {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return level >= LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK;
  } catch {
    return false;
  }
}

export async function getFaceIdProfile(): Promise<FaceIdProfile | null> {
  const { data } = await supabase.auth.getUser();
  const f = data.user?.user_metadata?.face_id as FaceIdProfile | undefined;
  return f?.enrolledAt ? f : null;
}

/** Set up: no profile yet, profile set up but this phone isn't linked, or ready. */
export async function faceIdState(): Promise<'none' | 'other_device' | 'ready'> {
  const profile = await getFaceIdProfile();
  if (!profile) return 'none';
  const id = await deviceId();
  return profile.devices.some((d) => d.id === id) ? 'ready' : 'other_device';
}

async function askDevice(prompts: IdentityPrompts): Promise<IdentityResult> {
  const res = await LocalAuthentication.authenticateAsync({
    promptMessage: prompts.promptMessage,
    cancelLabel: prompts.cancelLabel,
    // Face unlock on most Android tablets is a "weak" biometric; allow it.
    // No PIN fallback: the check has to be the person's face or finger.
    biometricsSecurityLevel: 'weak',
    disableDeviceFallback: true,
    requireConfirmation: false,
  });
  if (res.success) return 'verified';
  return res.error === 'user_cancel' || res.error === 'system_cancel' || res.error === 'app_cancel' ? 'cancelled' : 'failed';
}

/** Record a check against the user, with what it was for. */
async function audit(purpose: string, entity: string | undefined, result: IdentityResult): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const actorId = data.session?.user.id;
  if (!actorId) return;
  await supabase
    .from('livestock_audit_log')
    .insert({
      actor_id: actorId,
      action_type: 'identity_verified',
      entity_type: 'user',
      entity_id: entity ?? actorId,
      after: { purpose, result, method: 'device_biometric', device: await deviceId(), model: Device.modelName ?? 'unknown', at: new Date().toISOString() },
    })
    .then(() => undefined, () => undefined);
}

/**
 * Link this phone's face unlock or fingerprint to the signed-in profile. The
 * person proves it is them first; the profile keeps every phone linked.
 */
export async function enrolFaceId(prompts: IdentityPrompts): Promise<IdentityResult> {
  try {
    if (!(await biometricReady())) return 'not_set_up';
    const result = await askDevice(prompts);
    if (result !== 'verified') return result;
    const id = await deviceId();
    const now = new Date().toISOString();
    const current = await getFaceIdProfile();
    const devices = [...(current?.devices ?? []).filter((d) => d.id !== id), { id, model: Device.modelName ?? 'Android', linkedAt: now }];
    const { error } = await supabase.auth.updateUser({ data: { face_id: { enrolledAt: current?.enrolledAt ?? now, devices } } });
    if (error) return 'failed';
    await audit('face_id_setup', undefined, 'verified');
    return 'verified';
  } catch {
    return 'failed';
  }
}

/** Confirm it is the profile's owner before approving or submitting `entity`. */
export async function verifyIdentity(prompts: IdentityPrompts, purpose = 'approve_record', entity?: string): Promise<IdentityResult> {
  try {
    if ((await faceIdState()) !== 'ready' || !(await biometricReady())) return 'not_set_up';
    const result = await askDevice(prompts);
    if (result !== 'cancelled') await audit(purpose, entity, result);
    return result;
  } catch {
    return 'failed';
  }
}
