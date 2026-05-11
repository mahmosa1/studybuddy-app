// app/profile/account-settings.tsx — Edit profile + change password entry
import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppHeader } from '@/frontend/components/ui/AppHeader';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { layout, spacing } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function AccountSettingsScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const isHebrewUi = i18n.language === 'he';

  return (
    <AppScreen>
      <AppHeader title={t('accountSettingsScreen.title')} onBack={() => router.back()} />
      <View style={[styles.topDecorWrap, { borderBottomColor: colors.border }]}>
        <View style={[styles.topDecorPrimary, { backgroundColor: colors.primary }]} />
        <View style={[styles.topDecorAccent, { backgroundColor: colors.accent }]} />
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        <AppCard style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.row, isHebrewUi && styles.rtlRow, { borderBottomColor: colors.border }]}
            onPress={() => router.push('/edit-profile')}
          >
            <View style={[styles.rowIconWrap, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name="create-outline" size={18} color={colors.primary} />
            </View>
            <Text style={[styles.rowText, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>{t('profile.editProfile')}</Text>
            <Ionicons name={isHebrewUi ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.row, styles.lastRow, isHebrewUi && styles.rtlRow]}
            onPress={() => router.push('/profile/change-password')}
          >
            <View style={[styles.rowIconWrap, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name="key-outline" size={18} color={colors.primary} />
            </View>
            <Text style={[styles.rowText, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>{t('accountSettingsScreen.changePassword')}</Text>
            <Ionicons name={isHebrewUi ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </AppCard>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  rtlRow: { flexDirection: 'row-reverse' },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  list: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: 2,
    gap: spacing.sm,
    paddingBottom: 36,
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
  menuCard: {
    padding: 0,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lastRow: { borderBottomWidth: 0 },
  rowText: { fontSize: 15, fontWeight: '600', flex: 1 },
});
