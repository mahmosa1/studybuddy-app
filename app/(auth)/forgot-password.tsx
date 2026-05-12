// app/(auth)/forgot-password.tsx
import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { PrimaryButton } from '@/frontend/components/ui/PrimaryButton';
import { layout, radius, spacing, typography } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  I18nManager,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { auth } from '@/lib/firebaseConfig';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const isHebrewUi = i18n.language === 'he';

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setError(t('auth.emailRequired') || 'Email is required');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError(t('auth.invalidEmail') || 'Invalid email address');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSuccess(true);
    } catch (err: any) {
      console.error('Password reset error:', err);
      let errorMessage = t('auth.passwordResetFailed') || 'Failed to send password reset email';

      if (err.code === 'auth/user-not-found') {
        errorMessage = t('auth.userNotFound') || 'No account found with this email address';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = t('auth.invalidEmail') || 'Invalid email address';
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = t('auth.tooManyRequests') || 'Too many requests. Please try again later';
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const backButtonEdge = I18nManager.isRTL ? { right: layout.screenPadding } : { left: layout.screenPadding };

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
          <View style={[styles.backButtonContainer, backButtonEdge]}>
            <TouchableOpacity
              style={[
                styles.backButton,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => router.back()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.85}
            >
              <Ionicons
                name={I18nManager.isRTL ? 'chevron-forward' : 'chevron-back'}
                size={22}
                color={colors.primary}
              />
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
                <Ionicons name="lock-closed" size={30} color={colors.primary} />
              </View>
            </View>
            <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>{t('auth.forgotPassword')}</Text>
            <Text style={[styles.heroTagline, { color: colors.textSecondary }]}>{t('auth.forgotPasswordSubtitle')}</Text>
          </View>

          <AppCard style={styles.formCard}>
            {success ? (
              <View
                style={[
                  styles.successPanel,
                  {
                    backgroundColor: colors.surfaceMuted,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.successIconWrap,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <Ionicons name="checkmark-circle" size={40} color={colors.success} />
                </View>
                <Text style={[styles.successTitle, { color: colors.textPrimary }]}>{t('auth.passwordResetSent')}</Text>
                <Text style={[styles.successText, { color: colors.textSecondary }]}>
                  {t('auth.passwordResetSentMessage', { email })}
                </Text>
                <PrimaryButton
                  label={t('auth.backToLogin')}
                  onPress={() => router.push('/(auth)/login' as any)}
                  style={styles.successButton}
                />
              </View>
            ) : (
              <>
                <View style={styles.cardTitleRow}>
                  <View style={[styles.cardIconWrap, { backgroundColor: colors.surfaceMuted }]}>
                    <Ionicons name="key-outline" size={20} color={colors.primary} />
                  </View>
                  <View style={styles.cardTitleTextCol}>
                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{t('auth.resetPassword')}</Text>
                    <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
                      {t('auth.resetPasswordSubtitle')}
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
                      style={[
                        styles.input,
                        {
                          color: colors.textPrimary,
                          textAlign: isHebrewUi ? 'right' : 'left',
                          writingDirection: isHebrewUi ? 'rtl' : 'ltr',
                        },
                      ]}
                      placeholder={t('auth.emailPlaceholder')}
                      placeholderTextColor={colors.textSecondary}
                      value={email}
                      onChangeText={(text) => {
                        setEmail(text);
                        setError(null);
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
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

                <PrimaryButton
                  label={t('auth.sendResetLink')}
                  onPress={handleResetPassword}
                  disabled={loading}
                  loading={loading}
                  style={styles.submitButton}
                />

                <TouchableOpacity
                  onPress={() => router.push('/(auth)/login' as any)}
                  style={styles.linkWrapper}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.linkText, { color: colors.textSecondary }]}>
                    {t('auth.rememberPassword')}{' '}
                    <Text style={[styles.linkTextBold, { color: colors.primary }]}>{t('auth.backToLogin')}</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </AppCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.xs,
  },
  backButtonContainer: {
    position: 'absolute',
    top: spacing.xs,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  errorText: {
    marginStart: spacing.sm,
    fontSize: 13,
    flex: 1,
  },
  submitButton: {
    marginTop: spacing.xs,
  },
  linkWrapper: {
    marginTop: spacing.lg,
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
  successPanel: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg,
    alignItems: 'center',
  },
  successIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  successTitle: {
    ...typography.h3,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  successText: {
    ...typography.body,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  successButton: {
    alignSelf: 'stretch',
    width: '100%',
  },
});
