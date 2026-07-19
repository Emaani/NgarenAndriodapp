import { Alert, Image, Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, radius, spacing } from '@/theme';
import { AppText } from './AppText';
import { Icon } from './Icon';

/**
 * Photo capture/upload field — take a picture with the camera or choose from the
 * gallery, preview it, and remove it. Reports the local file URI. Used when
 * registering an animal and for stock-take manual capture.
 */
export function PhotoField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string | null;
  onChange: (uri: string | null) => void;
}) {
  const pickFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera permission needed', 'Enable camera access to take a photo.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: true });
    if (!res.canceled && res.assets?.[0]) onChange(res.assets[0].uri);
  };

  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Photos permission needed', 'Enable photo access to upload an image.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.6, allowsEditing: true });
    if (!res.canceled && res.assets?.[0]) onChange(res.assets[0].uri);
  };

  const choose = () => {
    Alert.alert(label, 'Add a photo', [
      { text: 'Take photo', onPress: pickFromCamera },
      { text: 'Choose from gallery', onPress: pickFromLibrary },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={{ marginBottom: spacing.md }}>
      <AppText variant="body" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
        {label}
      </AppText>
      {value ? (
        <View style={{ position: 'relative' }}>
          <Image source={{ uri: value }} style={{ width: '100%', height: 180, borderRadius: radius.md }} resizeMode="cover" />
          <Pressable
            onPress={() => onChange(null)}
            style={{
              position: 'absolute',
              top: spacing.sm,
              right: spacing.sm,
              backgroundColor: 'rgba(0,0,0,0.55)',
              borderRadius: radius.full,
              padding: 6,
            }}>
            <Icon name="close" size={18} color="#fff" />
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={choose}
          style={{
            borderWidth: 1,
            borderColor: colors.divider,
            borderStyle: 'dashed',
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            paddingVertical: spacing.lg,
            alignItems: 'center',
            gap: spacing.xs,
          }}>
          <Icon name="camera-plus-outline" size={28} color={colors.primary} />
          <AppText variant="body" color={colors.onSurfaceVariant}>
            Take a photo or upload
          </AppText>
        </Pressable>
      )}
    </View>
  );
}
