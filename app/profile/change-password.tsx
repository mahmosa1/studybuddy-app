// app/profile/change-password.tsx — Firebase email/password update
import { auth } from '@/lib/firebaseConfig';
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
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ACCENT = '#047857';

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
          <Text style={[styles.title, isHebrewUi && styles.rtlText]}>{t('changePasswordScreen.title')}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.scroll}>
          <Text style={[styles.warn, isHebrewUi && styles.rtlText]}>{t('changePasswordScreen.noPasswordProvider')}</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
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
          <Text style={[styles.title, isHebrewUi && styles.rtlText]}>{t('changePasswordScreen.title')}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.label, isHebrewUi && styles.rtlText]}>{t('changePasswordScreen.currentPassword')}</Text>
          <TextInput
            style={[styles.input, inputExtra]}
            secureTextEntry
            textContentType="password"
            autoCapitalize="none"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder={t('changePasswordScreen.currentPassword')}
            placeholderTextColor="#9ca3af"
            textAlign={rtlAlign}
          />

          <Text style={[styles.label, isHebrewUi && styles.rtlText]}>{t('changePasswordScreen.newPassword')}</Text>
          <TextInput
            style={[styles.input, inputExtra]}
            secureTextEntry
            textContentType="newPassword"
            autoCapitalize="none"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder={t('changePasswordScreen.newPassword')}
            placeholderTextColor="#9ca3af"
            textAlign={rtlAlign}
          />

          <Text style={[styles.label, isHebrewUi && styles.rtlText]}>{t('changePasswordScreen.confirmPassword')}</Text>
          <TextInput
            style={[styles.input, inputExtra]}
            secureTextEntry
            textContentType="newPassword"
            autoCapitalize="none"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder={t('changePasswordScreen.confirmPassword')}
            placeholderTextColor="#9ca3af"
            textAlign={rtlAlign}
          />

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>{t('changePasswordScreen.submit')}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  scroll: { padding: 20, paddingBottom: 40 },
  warn: { fontSize: 14, color: '#b45309', marginBottom: 16, lineHeight: 20 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  inputRtl: { writingDirection: 'rtl' },
  submitBtn: {
    marginTop: 28,
    backgroundColor: ACCENT,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
