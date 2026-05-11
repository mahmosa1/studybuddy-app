// app/profile/change-password.tsx — Firebase email/password update
import { auth } from '@/lib/firebaseConfig';
import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppHeader } from '@/frontend/components/ui/AppHeader';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { PrimaryButton } from '@/frontend/components/ui/PrimaryButton';
import { layout, spacing } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function mapAuthError(t: (k: string) => string, code: string | undefined): string {
  switch (code) {
    case 'auth/wrong-password':
      return t('changePasswordScreen.wrongPassword');
    case 'auth/weak-password':
      return t('changePasswordScreen.weakPassword');
    case 'auth/requires-recent-login':
      return t('changePasswordScreen.requiresRecentLogin');
    default:
      return t('changePasswordScreen.genericError');
  }
}

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const isHebrewUi = i18n.language === 'he';

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const hasPasswordProvider = () => {
    const user = auth.currentUser;
    if (!user) return false;
    return user.providerData.some((p) => p.providerId === 'password');
  };

  const handleSubmit = async () => {
    const user = auth.currentUser;
    if (!user?.email) {
      Alert.alert(t('common.error'), t('changePasswordScreen.genericError'));
      return;
    }
    if (!hasPasswordProvider()) {
      Alert.alert(t('common.error'), t('changePasswordScreen.noPasswordProvider'));
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert(t('common.error'), t('changePasswordScreen.weakPassword'));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('common.error'), t('changePasswordScreen.mismatch'));
      return;
    }
    if (newPassword === currentPassword) {
      Alert.alert(t('common.error'), t('changePasswordScreen.sameAsOld'));
      return;
    }

    try {
      setSubmitting(true);
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      Alert.alert(t('common.success'), t('changePasswordScreen.success'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ]);
    } catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : undefined;
      Alert.alert(t('common.error'), mapAuthError(t, code));
    } finally {
      setSubmitting(false);
    }
  };

  const rtlAlign = isHebrewUi ? 'right' : 'left';
  const inputExtra = isHebrewUi ? styles.inputRtl : undefined;

  const user = auth.currentUser;
  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!hasPasswordProvider()) {
    return (
      <AppScreen>
        <AppHeader title={t('changePasswordScreen.title')} onBack={() => router.back()} />
        <View style={[styles.topDecorWrap, { borderBottomColor: colors.border }]}>
          <View style={[styles.topDecorPrimary, { backgroundColor: colors.primary }]} />
          <View style={[styles.topDecorAccent, { backgroundColor: colors.accent }]} />
        </View>
        <View style={styles.content}>
          <AppCard style={[styles.noticeCard, { backgroundColor: colors.surface, borderColor: colors.warning }]}>
            <Text style={[styles.warn, { color: colors.warning }, isHebrewUi && styles.rtlText]}>
              {t('changePasswordScreen.noPasswordProvider')}
            </Text>
          </AppCard>
        </View>
      </AppScreen>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      <AppScreen>
        <AppHeader title={t('changePasswordScreen.title')} onBack={() => router.back()} />
        <View style={[styles.topDecorWrap, { borderBottomColor: colors.border }]}>
          <View style={[styles.topDecorPrimary, { backgroundColor: colors.primary }]} />
          <View style={[styles.topDecorAccent, { backgroundColor: colors.accent }]} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AppCard style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>{t('changePasswordScreen.currentPassword')}</Text>
            <TextInput
              style={[styles.input, inputExtra, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.textPrimary }]}
              secureTextEntry
              textContentType="password"
              autoCapitalize="none"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder={t('changePasswordScreen.currentPassword')}
              placeholderTextColor={colors.textSecondary}
              textAlign={rtlAlign}
            />

            <Text style={[styles.label, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>{t('changePasswordScreen.newPassword')}</Text>
            <TextInput
              style={[styles.input, inputExtra, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.textPrimary }]}
              secureTextEntry
              textContentType="newPassword"
              autoCapitalize="none"
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder={t('changePasswordScreen.newPassword')}
              placeholderTextColor={colors.textSecondary}
              textAlign={rtlAlign}
            />

            <Text style={[styles.label, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>{t('changePasswordScreen.confirmPassword')}</Text>
            <TextInput
              style={[styles.input, inputExtra, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.textPrimary }]}
              secureTextEntry
              textContentType="newPassword"
              autoCapitalize="none"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder={t('changePasswordScreen.confirmPassword')}
              placeholderTextColor={colors.textSecondary}
              textAlign={rtlAlign}
            />

            <PrimaryButton
              label={t('changePasswordScreen.submit')}
              onPress={handleSubmit}
              loading={submitting}
              disabled={submitting}
              style={styles.submitBtn}
            />
          </AppCard>
        </ScrollView>
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: 2,
  },
  noticeCard: { padding: spacing.lg },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  scroll: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: 2,
    paddingBottom: 40,
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
  formCard: {
    padding: spacing.lg,
  },
  warn: { fontSize: 14, marginBottom: 2, lineHeight: 20 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  inputRtl: { writingDirection: 'rtl' },
  submitBtn: {
    marginTop: 28,
  },
});
