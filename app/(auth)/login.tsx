// app/(auth)/login.tsx
import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { PrimaryButton } from '@/frontend/components/ui/PrimaryButton';
import { layout, radius, spacing, typography } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  I18nManager,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { auth, db } from '@/lib/firebaseConfig';
import { saveLanguage } from '@/lib/i18n';

export default function LoginScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language);

  useEffect(() => {
    setCurrentLanguage(i18n.language);
  }, [i18n.language]);

  // Check if user is already logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCheckingAuth(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (!snap.exists()) {
          setCheckingAuth(false);
          return;
        }

        const data = snap.data() as {
          role: 'student' | 'lecturer' | 'admin';
          status: 'pending' | 'active' | 'blocked' | 'rejected';
        };

        // If user is already logged in, redirect them
        if (data.status === 'pending' || data.status === 'rejected') {
          router.replace('/(auth)/pending-approval');
          return;
        }

        if (data.status === 'blocked') {
          await signOut(auth);
          setCheckingAuth(false);
          return;
        }

        // User is active, redirect to tabs
        if (data.status === 'active') {
          router.replace('/(tabs)');
          return;
        }
      } catch (err) {
        console.log('Error checking auth state:', err);
      } finally {
        setCheckingAuth(false);
      }
    });

    return unsubscribe;
  }, [router]);

  const handleLogin = async () => {
    setError(null);

    if (!email || !password) {
      setError('Please fill email and password.');
      return;
    }

    try {
      setLoading(true);

      // 1) Login with Firebase Auth
      const cred = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      const uid = cred.user.uid;

      // 2) Load user document from Firestore
      const userRef = doc(db, 'users', uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        await signOut(auth);
        setError('User data not found. Please contact support.');
        return;
      }

      const userData = snap.data() as {
        role: 'student' | 'lecturer' | 'admin';
        status: 'pending' | 'active' | 'blocked' | 'rejected';
      };

      // 3) Check status
      if (userData.status === 'pending' || userData.status === 'rejected') {
        router.replace('/(auth)/pending-approval');
        return;
      }

      if (userData.status === 'blocked') {
        await signOut(auth);
        setError('Your account is blocked. Please contact support.');
        return;
      }

      // 4) Route by role (בינתיים כולם ל-(tabs))
      if (userData.role === 'student') {
        router.replace('/(tabs)');
      } else if (userData.role === 'lecturer') {
        router.replace('/(tabs)');
      } else if (userData.role === 'admin') {
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      console.log('Login error:', err);
      setError(err?.message ?? 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const langButtonEdge = I18nManager.isRTL ? { left: layout.screenPadding } : { right: layout.screenPadding };

  // Show loading while checking authentication
  if (checkingAuth) {
    return (
      <AppScreen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.languageButtonContainer, langButtonEdge]}>
            <TouchableOpacity
              style={[
                styles.languageButton,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => setShowLanguageModal(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="globe-outline" size={15} color={colors.primary} />
              <Text style={[styles.languageButtonText, { color: colors.textPrimary }]}>
                {currentLanguage === 'he' ? 'HE' : 'EN'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.hero}>
            <View
              style={[
                styles.logoRing,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={[styles.logoInner, { backgroundColor: colors.surfaceMuted }]}>
                <Ionicons name="school" size={30} color={colors.primary} />
              </View>
            </View>
            <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>{t('home.title')}</Text>
            <Text style={[styles.heroTagline, { color: colors.textSecondary }]}>{t('home.tagline')}</Text>
          </View>

          <AppCard style={styles.formCard}>
            <View style={styles.cardTitleRow}>
              <View style={[styles.cardIconWrap, { backgroundColor: colors.surfaceMuted }]}>
                <Ionicons name="log-in-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.cardTitleTextCol}>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{t('auth.login')}</Text>
                <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                  {t('auth.login')} {t('common.to')} {t('home.title')}
                </Text>
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>{t('auth.email')}</Text>
              <View
                style={[
                  styles.inputRow,
                  {
                    backgroundColor: colors.surfaceMuted,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons name="mail-outline" size={18} color={colors.textSecondary} style={styles.inputRowIcon} />
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder={t('auth.email')}
                  placeholderTextColor={colors.textSecondary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>{t('auth.password')}</Text>
              <View
                style={[
                  styles.inputRow,
                  {
                    backgroundColor: colors.surfaceMuted,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} style={styles.inputRowIcon} />
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder={t('auth.password')}
                  placeholderTextColor={colors.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>
            </View>

            {error && (
              <View
                style={[
                  styles.errorContainer,
                  {
                    backgroundColor: colors.dangerSurface,
                    borderColor: colors.dangerBorder,
                  },
                ]}
              >
                <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
                <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.forgotPasswordContainer}
              onPress={() => router.push('/(auth)/forgot-password' as any)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.forgotPasswordText, { color: colors.primary }]}>{t('auth.forgotPassword')}</Text>
            </TouchableOpacity>

            <PrimaryButton
              label={t('auth.login')}
              onPress={handleLogin}
              disabled={loading}
              loading={loading}
              style={styles.loginButton}
            />
          </AppCard>

          <TouchableOpacity onPress={() => router.push('/(auth)/register-role')} style={styles.linkWrapper} activeOpacity={0.75}>
            <Text style={[styles.linkText, { color: colors.textSecondary }]}>
              {t('auth.dontHaveAccount')}{' '}
              <Text style={[styles.linkTextBold, { color: colors.primary }]}>{t('auth.register')}</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <Modal
          visible={showLanguageModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowLanguageModal(false)}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowLanguageModal(false)}
          >
            <View
              style={[
                styles.languageModalContent,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t('profile.selectLanguage')}</Text>
                <TouchableOpacity onPress={() => setShowLanguageModal(false)} style={styles.modalCloseButton} hitSlop={12}>
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <View style={styles.languageOptions}>
                <TouchableOpacity
                  style={[
                    styles.languageOption,
                    {
                      backgroundColor: colors.surfaceMuted,
                      borderColor: colors.border,
                    },
                    currentLanguage === 'en' && {
                      borderColor: colors.primary,
                      backgroundColor: colors.chipBg,
                    },
                  ]}
                  onPress={async () => {
                    await i18n.changeLanguage('en');
                    await saveLanguage('en');
                    setCurrentLanguage('en');
                    setShowLanguageModal(false);
                  }}
                >
                  <Ionicons
                    name={currentLanguage === 'en' ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={currentLanguage === 'en' ? colors.primary : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.languageOptionText,
                      { color: colors.textPrimary },
                      currentLanguage === 'en' && { color: colors.primary, fontWeight: '600' },
                    ]}
                  >
                    {t('profile.english')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.languageOption,
                    {
                      backgroundColor: colors.surfaceMuted,
                      borderColor: colors.border,
                    },
                    currentLanguage === 'he' && {
                      borderColor: colors.primary,
                      backgroundColor: colors.chipBg,
                    },
                  ]}
                  onPress={async () => {
                    await i18n.changeLanguage('he');
                    await saveLanguage('he');
                    setCurrentLanguage('he');
                    setShowLanguageModal(false);
                  }}
                >
                  <Ionicons
                    name={currentLanguage === 'he' ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={currentLanguage === 'he' ? colors.primary : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.languageOptionText,
                      { color: colors.textPrimary },
                      currentLanguage === 'he' && { color: colors.primary, fontWeight: '600' },
                    ]}
                  >
                    {t('profile.hebrew')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.xs,
  },
  languageButtonContainer: {
    position: 'absolute',
    top: spacing.xs,
    zIndex: 10,
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 48,
    height: 34,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  languageButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  hero: {
    alignItems: 'center',
    paddingTop: spacing.xxl + spacing.md,
    paddingBottom: spacing.md,
  },
  logoRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  logoInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    ...typography.h1,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  heroTagline: {
    ...typography.body,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    lineHeight: 20,
  },
  formCard: {
    marginTop: -spacing.sm,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: spacing.md,
  },
  cardTitleTextCol: {
    flex: 1,
  },
  cardTitle: {
    ...typography.h3,
    marginBottom: 2,
  },
  cardSubtitle: {
    ...typography.caption,
    lineHeight: 18,
  },
  fieldBlock: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.caption,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  inputRowIcon: {
    marginEnd: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xs,
    borderWidth: 1,
  },
  errorText: {
    marginStart: spacing.sm,
    fontSize: 13,
    flex: 1,
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '600',
  },
  loginButton: {
    marginTop: spacing.xs,
  },
  linkWrapper: {
    marginTop: spacing.xl,
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  linkText: {
    fontSize: 14,
    textAlign: 'center',
  },
  linkTextBold: {
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: layout.screenPadding,
  },
  languageModalContent: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalCloseButton: {
    padding: 4,
  },
  languageOptions: {
    gap: spacing.sm,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  languageOptionText: {
    fontSize: 16,
    fontWeight: '500',
    marginStart: spacing.md,
  },
});
