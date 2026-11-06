/**
 * Face ID before a record is approved or submitted (spec 3.1.5).
 *
 * The device's own check comes first: face unlock, fingerprint, or the screen
 * lock PIN when neither is set up. It runs in a system dialog, so the app stays
 * open and the approval carries on. (The first version opened the camera for a
 * selfie; on Android the system can close the app while the camera is in front,
 * and the approval was lost — App Review 2026-11-05.)
 *
 * Only a device with no screen lock at all falls back to the live selfie.
 */
import * as LocalAuthentication from 'expo-local-authentication';
import * as ImagePicker from 'expo-image-picker';

export type IdentityResult = 'verified' | 'cancelled' | 'no_camera_permission' | 'failed';

export interface IdentityPrompts {
  /** Shown in the system dialog, e.g. "Approve UG-1126-K9MWP2". */
  promptMessage: string;
  cancelLabel: string;
}

/** True when the device can confirm its owner without the camera. */
export async function deviceCheckAvailable(): Promise<boolean> {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return level > LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

async function selfie(): Promise<IdentityResult> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return 'no_camera_permission';
  const shot = await ImagePicker.launchCameraAsync({ quality: 0.4, cameraType: ImagePicker.CameraType.front });
  if (!shot.canceled && shot.assets?.[0]) return 'verified';
  return 'cancelled';
}

export async function verifyIdentity(prompts: IdentityPrompts): Promise<IdentityResult> {
  try {
    if (await deviceCheckAvailable()) {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: prompts.promptMessage,
        cancelLabel: prompts.cancelLabel,
        // Face unlock on most Android tablets is a "weak" biometric; allow it,
        // and let the screen-lock PIN stand in when no biometric is enrolled.
        biometricsSecurityLevel: 'weak',
        disableDeviceFallback: false,
        requireConfirmation: false,
      });
      if (res.success) return 'verified';
      return res.error === 'user_cancel' || res.error === 'system_cancel' || res.error === 'app_cancel' ? 'cancelled' : 'failed';
    }
    return await selfie();
  } catch {
    return 'failed';
  }
}
