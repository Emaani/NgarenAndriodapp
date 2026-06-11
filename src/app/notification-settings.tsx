import { useEffect, useState } from 'react';
import { Platform, Pressable, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import {
  CHANNEL_LABELS,
  getNotificationSettings,
  updateNotificationSettings,
} from '@/data/api';
import { AlertChannel, NotificationSettings } from '@/data/types';
import { AppText, Button, Card, GradientHeader, Icon, IconName, Screen } from '@/ui';
import { registerForPushNotifications } from '@/services/push';

const CHANNELS: AlertChannel[] = ['EMAIL', 'SMS', 'EMAIL_AND_SMS'];

function ChannelSelector({
  value,
  onChange,
}: {
  value: AlertChannel;
  onChange: (c: AlertChannel) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      {CHANNELS.map((c) => {
        const active = value === c;
        return (
          <Pressable
            key={c}
            onPress={() => onChange(c)}
            style={{
              flex: 1,
              paddingVertical: spacing.sm,
              borderRadius: radius.full,
              alignItems: 'center',
              backgroundColor: active ? colors.primary : colors.background,
              borderWidth: 1,
              borderColor: active ? colors.primary : colors.divider,
            }}>
            <AppText
              variant="caption"
              color={active ? '#fff' : colors.onSurfaceVariant}
              style={{ fontWeight: '600' }}>
              {CHANNEL_LABELS[c]}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function AlertRow({
  icon,
  title,
  description,
  value,
  onChange,
}: {
  icon: IconName;
  title: string;
  description: string;
  value: AlertChannel;
  onChange: (c: AlertChannel) => void;
}) {
  return (
    <Card style={{ marginBottom: spacing.mdMinus, gap: spacing.mdMinus }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.full,
            backgroundColor: colors.primaryTint,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon name={icon} size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
            {title}
          </AppText>
          <AppText variant="caption" color={colors.onSurfaceVariant}>
            {description}
          </AppText>
        </View>
      </View>
      <ChannelSelector value={value} onChange={onChange} />
    </Card>
  );
}

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<NotificationSettings>({
    deviceActivityConfig: 'EMAIL_AND_SMS',
    boundaryCheckAlertConfig: 'EMAIL_AND_SMS',
  });
  const [pushEnabled, setPushEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getNotificationSettings()
      .then(setSettings)
      .catch(() => {});
  }, []);

  const onTogglePush = async (next: boolean) => {
    setPushEnabled(next);
    if (next) {
      const token = await registerForPushNotifications();
      // On web/simulator no token is returned; reflect that push isn't active.
      if (!token && Platform.OS !== 'web') setPushEnabled(false);
    }
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await updateNotificationSettings(settings);
      router.back();
    } catch {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <GradientHeader title="Notification Preferences" subtitle="Choose how you get alerts" showBack />
      <Screen contentStyle={{ paddingTop: spacing.md }}>
        <Card style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.full,
                backgroundColor: colors.primaryTint,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Icon name="cellphone-message" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="bodyLarge" style={{ fontWeight: '600' }}>
                Push notifications
              </AppText>
              <AppText variant="caption" color={colors.onSurfaceVariant}>
                Receive instant alerts on this device
              </AppText>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={onTogglePush}
              trackColor={{ true: colors.primary, false: colors.divider }}
              thumbColor="#fff"
            />
          </View>
        </Card>

        <AppText variant="overline" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm }}>
          Email & SMS delivery
        </AppText>

        <AlertRow
          icon="flash"
          title="Device Activity"
          description="Battery, signal & telemetry changes"
          value={settings.deviceActivityConfig}
          onChange={(c) => setSettings((s) => ({ ...s, deviceActivityConfig: c }))}
        />
        <AlertRow
          icon="fence"
          title="Animal Outside Boundary"
          description="When an animal leaves a geofence"
          value={settings.boundaryCheckAlertConfig}
          onChange={(c) => setSettings((s) => ({ ...s, boundaryCheckAlertConfig: c }))}
        />

        <View style={[{ borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.surface, marginTop: spacing.sm }, shadow[1]]}>
          <AppText variant="caption" color={colors.onSurfaceVariant} style={{ textAlign: 'center' }}>
            Powered by Ceres Tag Technology
          </AppText>
        </View>

        <Button label="Save Preferences" icon="content-save" loading={saving} onPress={onSave} style={{ marginTop: spacing.md }} />
      </Screen>
    </View>
  );
}
