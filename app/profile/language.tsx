// app/profile/language.tsx — App language selection (full screen)
import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppHeader } from '@/frontend/components/ui/AppHeader';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { layout, spacing } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { saveLanguage } from '@/lib/i18n';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ProfileLanguageScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const isHebrewUi = i18n.language === 'he';
  const [current, setCurrent] = useState(i18n.language);

  useEffect(() => {
    setCurrent(i18n.language);
  }, [i18n.language]);

  return (
    <AppScreen>
      <AppHeader title={t('profile.selectLanguage')} onBack={() => router.back()} />
      <View style={[styles.topDecorWrap, { borderBottomColor: colors.border }]}>
        <View style={[styles.topDecorPrimary, { backgroundColor: colors.primary }]} />
        <View style={[styles.topDecorAccent, { backgroundColor: colors.accent }]} />
      </View>

      <View style={styles.content}>
        <AppCard style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.option,
            { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
            current === 'en' && { backgroundColor: colors.surfaceElevated, borderColor: colors.primary, borderWidth: 2 },
            isHebrewUi && styles.rtlRow,
          ]}
          onPress={async () => {
            await saveLanguage('en');
            await i18n.changeLanguage('en');
            setCurrent('en');
          }}
        >
          <Ionicons
            name={current === 'en' ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={current === 'en' ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.optionText, { color: colors.textPrimary }, current === 'en' && { color: colors.primary }, isHebrewUi && styles.rtlText]}>
            {t('profile.english')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.option,
            { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
            current === 'he' && { backgroundColor: colors.surfaceElevated, borderColor: colors.primary, borderWidth: 2 },
            isHebrewUi && styles.rtlRow,
          ]}
          onPress={async () => {
            await saveLanguage('he');
            await i18n.changeLanguage('he');
            setCurrent('he');
          }}
        >
          <Ionicons
            name={current === 'he' ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={current === 'he' ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.optionText, { color: colors.textPrimary }, current === 'he' && { color: colors.primary }, isHebrewUi && styles.rtlText]}>
            {t('profile.hebrew')}
          </Text>
        </TouchableOpacity>
        </AppCard>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: layout.screenPadding,
    paddingTop: 2,
    gap: spacing.sm,
  },
  topDecorWrap: {
    position: 'relative',
    overflow: 'hidden',
    height: 26,
    marginHorizontal: layout.screenPadding,
    marginTop: -2,
    marginBottom: 2,
    borderBottomWidth: 1,
  },
  topDecorPrimary: {
    position: 'absolute',
    width: 128,
    height: 128,
    borderRadius: 64,
    top: -108,
    right: -14,
    opacity: 0.055,
  },
  topDecorAccent: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
    top: -88,
    left: -8,
    opacity: 0.07,
  },
  rtlRow: { flexDirection: 'row-reverse' },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  card: { padding: 12 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    gap: 12,
  },
  optionText: { fontSize: 16, fontWeight: '500', flex: 1 },
});
