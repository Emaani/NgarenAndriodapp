import { Pressable, View } from 'react-native';
import { LOCALES, useI18n } from '@/i18n';
import { colors, radius, shadow, spacing } from '@/theme';
import { AppText } from './AppText';
import { Icon } from './Icon';

/** Language selector, shared by the farmer profile and Settings (vets never reach the profile tab). */
export function LanguageCard() {
  const { locale, setLocale, t } = useI18n();
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <AppText variant="caption" color={colors.onSurfaceVariant} style={{ marginBottom: spacing.sm, textTransform: 'uppercase' }}>
        {t('common.language')}
      </AppText>
      <View style={[{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm }, shadow[1]]}>
        <AppText variant="caption" color={colors.onSurfaceVariant}>
          {t('common.chooseLanguage')}
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {LOCALES.map((l) => {
            const active = locale === l.code;
            return (
              <Pressable
                key={l.code}
                onPress={() => setLocale(l.code)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: active ? colors.primary : colors.background, borderWidth: 1, borderColor: active ? colors.primary : colors.divider }}>
                {active ? <Icon name="check" size={16} color="#fff" /> : null}
                <AppText variant="body" color={active ? '#fff' : colors.onSurface} style={{ fontWeight: '600' }}>
                  {l.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
