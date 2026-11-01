import { useEffect, useRef } from 'react';
import { Linking, Modal, Pressable, View } from 'react-native';
import { BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@/theme';
import { useT } from '@/i18n';
import { AppText, Button, Icon } from '@/ui';

// The camera reports the same code many times a second while it's in view.
const REPEAT_MS = 2500;

/**
 * Full-screen QR scanner. Stays open between tags so a round can walk the herd;
 * `note` shows what the last code matched. Mounted only while open, because
 * Android allows one camera preview at a time.
 */
export function QrTagScanner({
  note,
  onCode,
  onClose,
}: {
  note: { ok: boolean; text: string } | null;
  onCode: (code: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const last = useRef({ code: '', at: 0 });

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) void requestPermission();
  }, [permission, requestPermission]);

  const onScanned = ({ data }: BarcodeScanningResult) => {
    const now = Date.now();
    if (data === last.current.code && now - last.current.at < REPEAT_MS) return;
    last.current = { code: data, at: now };
    onCode(data);
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {permission?.granted ? (
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={onScanned}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg }}>
            <AppText variant="body" color="#fff" style={{ textAlign: 'center' }}>
              {t('stock.cameraNeededBody')}
            </AppText>
            {permission && !permission.canAskAgain ? (
              <Button label={t('stock.qrOpenSettings')} icon="cog-outline" onPress={() => void Linking.openSettings()} />
            ) : null}
          </View>
        )}
        <View style={{ position: 'absolute', left: spacing.md, right: spacing.md, top: insets.top + spacing.md, gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <AppText variant="bodyLarge" color="#fff" style={{ fontWeight: '700' }}>
              {t('stock.qrTitle')}
            </AppText>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('stock.qrDone')}>
              <Icon name="close" size={28} color="#fff" />
            </Pressable>
          </View>
          <AppText variant="caption" color="#fff">
            {t('stock.qrAim')}
          </AppText>
        </View>
        <View style={{ position: 'absolute', left: spacing.md, right: spacing.md, bottom: insets.bottom + spacing.md, gap: spacing.sm }}>
          {note ? (
            <View style={{ backgroundColor: note.ok ? colors.success : colors.error, borderRadius: radius.md, padding: spacing.md }}>
              <AppText variant="body" color="#fff" style={{ fontWeight: '700', textAlign: 'center' }}>
                {note.text}
              </AppText>
            </View>
          ) : null}
          <Button label={t('stock.qrDone')} icon="check" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}
