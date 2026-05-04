// app/profile/settings.tsx — Full-screen settings hub (opens from profile gear)
import { auth } from '@/lib/firebaseConfig';
import { useUser } from '@/lib/UserContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ACCENT = '#047857';
const LOGOUT_RED = '#ef4444';

export default function ProfileSettingsScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { role } = useUser();
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
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={[styles.title, isHebrewUi && styles.rtlText]}>{t('profile.settingsTitle')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={[styles.row, isHebrewUi && styles.rtlRow]}
          onPress={() => router.push('/profile/account-settings')}
        >
          <Ionicons name="person-circle-outline" size={22} color={ACCENT} />
          <Text style={[styles.rowText, isHebrewUi && styles.rtlText]}>{t('accountSettingsScreen.menuTitle')}</Text>
        </TouchableOpacity>

        {role === 'student' && (
          <TouchableOpacity
            style={[styles.row, isHebrewUi && styles.rtlRow]}
            onPress={() => router.push('/profile/study-buddy-preferences')}
          >
            <Ionicons name="people-circle-outline" size={22} color={ACCENT} />
            <Text style={[styles.rowText, isHebrewUi && styles.rtlText]}>{t('profile.studyBuddyPreferences')}</Text>
          </TouchableOpacity>
        )}

        {role === 'student' && (
          <TouchableOpacity
            style={[styles.row, isHebrewUi && styles.rtlRow]}
            onPress={() => router.push('/tutor/apply')}
          >
            <Ionicons name="school-outline" size={22} color={ACCENT} />
            <Text style={[styles.rowText, isHebrewUi && styles.rtlText]}>{t('profile.tutorApplyButton')}</Text>
          </TouchableOpacity>
        )}

        <View style={styles.divider} />

        <TouchableOpacity
          style={[styles.row, isHebrewUi && styles.rtlRow]}
          onPress={() => router.push('/profile/language')}
        >
          <Ionicons name="language-outline" size={22} color={ACCENT} />
          <View style={styles.rowBody}>
            <Text style={[styles.rowText, isHebrewUi && styles.rtlText]}>{t('profile.selectLanguage')}</Text>
            <Text style={[styles.rowHint, isHebrewUi && styles.rtlText]}>
              {t('profile.settingsMenuLanguageHint', { lang: currentLangLabel })}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.row, isHebrewUi && styles.rtlRow]}
          onPress={() => router.push('/feed/saved')}
        >
          <Ionicons name="bookmark-outline" size={22} color={ACCENT} />
          <Text style={[styles.rowText, isHebrewUi && styles.rtlText]}>{t('feed.savedPosts')}</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          style={[styles.row, styles.logoutRow, isHebrewUi && styles.rtlRow]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={22} color={LOGOUT_RED} />
          <Text style={[styles.logoutText, isHebrewUi && styles.rtlText]}>{t('auth.logout')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  rtlRow: { flexDirection: 'row-reverse' },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  list: { paddingVertical: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  logoutRow: {
    borderBottomWidth: 0,
    marginBottom: 24,
  },
  rowBody: { flex: 1 },
  rowText: { fontSize: 16, fontWeight: '600', color: '#111827', flex: 1 },
  rowHint: { fontSize: 13, color: '#6b7280', marginTop: 4, fontWeight: '500' },
  logoutText: {
    fontSize: 16,
    fontWeight: '700',
    color: LOGOUT_RED,
    flex: 1,
  },
  divider: { height: 10, backgroundColor: '#f9fafb' },
});
