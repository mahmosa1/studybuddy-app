// app/profile/settings.tsx — Full-screen settings hub (opens from profile gear)
import { auth } from '@/lib/firebaseConfig';
import { useUser } from '@/lib/UserContext';
import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppHeader } from '@/frontend/components/ui/AppHeader';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { layout, radius, spacing } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ProfileSettingsScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { role } = useUser();
  const { colors } = useAppTheme();
  const isHebrewUi = i18n.language === 'he';
  const currentLangLabel = i18n.language === 'he' ? t('profile.hebrew') : t('profile.english');

  const performLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/(auth)/login');
    } catch (e) {
      console.log('signOut error', e);
      Alert.alert(t('common.error'), t('profile.logoutFailed'));
    }
  };

  const handleLogout = () => {
    Alert.alert(t('profile.logoutConfirmTitle'), t('profile.logoutConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('auth.logout'), style: 'destructive', onPress: () => void performLogout() },
    ]);
  };

  return (
    <AppScreen>
      <AppHeader title={t('profile.settingsTitle')} onBack={() => router.back()} />
      <View style={[styles.topDecorWrap, { borderBottomColor: colors.border }]}>
        <View style={[styles.topDecorPrimary, { backgroundColor: colors.primary }]} />
        <View style={[styles.topDecorAccent, { backgroundColor: colors.accent }]} />
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        <AppCard style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.row, isHebrewUi && styles.rtlRow, { borderBottomColor: colors.border }]}
            onPress={() => router.push('/profile/account-settings')}
          >
            <View style={[styles.rowIconWrap, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name="person-circle-outline" size={20} color={colors.primary} />
            </View>
            <Text style={[styles.rowText, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>{t('accountSettingsScreen.menuTitle')}</Text>
            <Ionicons name={isHebrewUi ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          {role === 'student' && (
            <TouchableOpacity
              style={[styles.row, isHebrewUi && styles.rtlRow, { borderBottomColor: colors.border }]}
              onPress={() => router.push('/profile/study-buddy-preferences')}
            >
              <View style={[styles.rowIconWrap, { backgroundColor: colors.surfaceElevated }]}>
                <Ionicons name="people-circle-outline" size={20} color={colors.primary} />
              </View>
              <Text style={[styles.rowText, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>{t('profile.studyBuddyPreferences')}</Text>
              <Ionicons name={isHebrewUi ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.row, isHebrewUi && styles.rtlRow, { borderBottomColor: colors.border }]}
            onPress={() => router.push('/profile/language')}
          >
            <View style={[styles.rowIconWrap, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name="language-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.rowBody}>
              <Text style={[styles.rowText, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>{t('profile.selectLanguage')}</Text>
              <Text style={[styles.rowHint, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
                {t('profile.settingsMenuLanguageHint', { lang: currentLangLabel })}
              </Text>
            </View>
            <Ionicons name={isHebrewUi ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.row, isHebrewUi && styles.rtlRow, { borderBottomColor: colors.border }]}
            onPress={() => router.push('/feed/saved')}
          >
            <View style={[styles.rowIconWrap, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name="bookmark-outline" size={20} color={colors.primary} />
            </View>
            <Text style={[styles.rowText, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>{t('feed.savedPosts')}</Text>
            <Ionicons name={isHebrewUi ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          {role === 'student' && (
            <TouchableOpacity
              style={[styles.row, styles.lastRow, isHebrewUi && styles.rtlRow]}
              onPress={() => router.push('/tutor/apply')}
            >
              <View style={[styles.rowIconWrap, { backgroundColor: colors.surfaceElevated }]}>
                <Ionicons name="school-outline" size={20} color={colors.primary} />
              </View>
              <Text style={[styles.rowText, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>{t('profile.tutorApplyButton')}</Text>
              <Ionicons name={isHebrewUi ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </AppCard>

        <AppCard style={[styles.logoutCard, { backgroundColor: colors.surface, borderColor: colors.dangerBorder }]}>
          <TouchableOpacity
            style={[styles.logoutRow, isHebrewUi && styles.rtlRow, { backgroundColor: colors.dangerSurface }]}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            <Text style={[styles.logoutText, { color: colors.danger }, isHebrewUi && styles.rtlText]}>{t('auth.logout')}</Text>
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
    paddingBottom: 40,
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
  lastRow: {
    borderBottomWidth: 0,
  },
  rowBody: { flex: 1 },
  rowText: { fontSize: 15, fontWeight: '600', flex: 1 },
  rowHint: { fontSize: 12, marginTop: 3, fontWeight: '500' },
  logoutCard: {
    padding: 10,
  },
  logoutRow: {
    borderBottomWidth: 0,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
});
