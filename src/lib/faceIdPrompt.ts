import { Alert } from 'react-native';
import { IdentityResult } from './identityCheck';

/**
 * What to tell the user after a Face ID check that didn't pass: send them to
 * set Face ID up, or say the phone couldn't confirm them. Returns true when
 * verified.
 */
export function handleIdentityResult(result: IdentityResult, t: (key: string) => string, openSetup: () => void): boolean {
  if (result === 'verified') return true;
  if (result === 'not_set_up') {
    Alert.alert(t('fid.needTitle'), t('fid.needBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('fid.setUpNow'), onPress: openSetup },
    ]);
  } else if (result === 'failed') {
    Alert.alert(t('reg.faceIdTitle'), t('reg.faceIdFailed'));
  }
  return false;
}
