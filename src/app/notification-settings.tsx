import { useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, radius, shadow, spacing } from '@/theme';
import {
  CHANNEL_LABELS,
  getNotificationSettings,
  updateNotificationSettings,
} from '@/data/api';
import { AlertChannel, NotificationSettings } from '@/data/types';
import { useT } from '@/i18n';
import { AppText, Button, Card, GradientHeader, Icon, IconName, Screen } from '@/ui';
import { enablePushNotifications, getPushPermissionStatus } from '@/services/push';

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
  const t = useT();
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
    // Reflect the OS permission state so the toggle starts in the right position.
    getPushPermissionStatus()
      .then((status) => setPushEnabled(status === 'granted'))
      .catch(() => {});
  }, []);

  const onTogglePush = async (next: boolean) => {
    if (!next) {
      // The OS won't let an app revoke its own permission, but honour the
      // user's intent visually; they can fully disable it in system settings.
      setPushEnabled(false);
      return;
    }
    // Optimistically reflect the tap, then confirm against the real permission.
    setPushEnabled(true);
    const status = await enablePushNotifications();
    if (status === 'granted') {
      setPushEnabled(true);
      return;
    }
    setPushEnabled(false);
    if (status === 'denied') {
      Alert.alert(
        t('notifset.blockedTitle'),
        t('notifset.blockedBody'),
        [
          { text: t('common.notNow'), style: 'cancel' },
          { text: t('notifset.openSettings'), onPress: () => Linking.openSettings() },
        ],
      );
    } else if (Platform.OS === 'web') {
      Alert.alert(t('notifset.notSupportedTitle'), t('notifset.notSupportedBody'));
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
      <GradientHeader title={t('settings.row.notificationPrefs')} subtitle={t('notifset.subtitle')} showBack />
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
                {t('notifset.push')}
              </AppText>
              <AppText variant="caption" color={colors.onSurfaceVariant}>
                {t('notifset.pushSub')}
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
          {t('notifset.emailSms')}
        </AppText>

        <AlertRow
          icon="flash"
          title={t('notifset.deviceActivity')}
          description={t('notifset.deviceActivitySub')}
          value={settings.deviceActivityConfig}
          onChange={(c) => setSettings((s) => ({ ...s, deviceActivityConfig: c }))}
        />
        <AlertRow
          icon="fence"
          title={t('notifset.boundary')}
          description={t('notifset.boundarySub')}
          value={settings.boundaryCheckAlertConfig}
          onChange={(c) => setSettings((s) => ({ ...s, boundaryCheckAlertConfig: c }))}
        />

        <View style={[{ borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.surface, marginTop: spacing.sm }, shadow[1]]}>
          <AppText variant="caption" color={colors.onSurfaceVariant} style={{ textAlign: 'center' }}>
            {t('notifset.poweredBy')}
          </AppText>
        </View>

        <Button label={t('notifset.save')} icon="content-save" loading={saving} onPress={onSave} style={{ marginTop: spacing.md }} />
      </Screen>
    </View>
  );
}
