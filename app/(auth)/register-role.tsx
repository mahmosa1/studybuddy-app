// app/(auth)/register-role.tsx
import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { layout, radius, spacing, typography } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { I18nManager, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function RegisterRoleScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const isRtl = I18nManager.isRTL;

  return (
    <AppScreen>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
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
          <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>{t('auth.studybuddy')}</Text>
          <Text style={[styles.heroTagline, { color: colors.textSecondary }]}>{t('auth.tagline')}</Text>
        </View>

        <AppCard style={styles.formCard}>
          <View style={styles.cardTitleRow}>
            <View style={[styles.cardIconWrap, { backgroundColor: colors.surfaceMuted }]}>
              <Ionicons name="person-add-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.cardTitleTextCol}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{t('auth.createAccount')}</Text>
              <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>{t('auth.chooseRole')}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.roleCard,
              {
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.border,
              },
            ]}
            onPress={() => router.push('/(auth)/register-student')}
            activeOpacity={0.75}
          >
            <View style={[styles.roleRow, isRtl && styles.roleRowRtl]}>
              <View style={[styles.roleIconWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="school-outline" size={22} color={colors.primary} />
              </View>
              <View style={styles.roleTextCol}>
                <Text style={[styles.roleTitle, { color: colors.textPrimary }]}>{t('auth.iAmStudent')}</Text>
                <Text style={[styles.roleDesc, { color: colors.textSecondary }]}>{t('auth.studentDescription')}</Text>
              </View>
              <Ionicons
                name={isRtl ? 'chevron-back' : 'chevron-forward'}
                size={20}
                color={colors.textSecondary}
              />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.roleCard,
              {
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.border,
              },
            ]}
            onPress={() => router.push('/(auth)/register-lecturer')}
            activeOpacity={0.75}
          >
            <View style={[styles.roleRow, isRtl && styles.roleRowRtl]}>
              <View style={[styles.roleIconWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="person-outline" size={22} color={colors.accent} />
              </View>
              <View style={styles.roleTextCol}>
                <Text style={[styles.roleTitle, { color: colors.textPrimary }]}>{t('auth.iAmLecturer')}</Text>
                <Text style={[styles.roleDesc, { color: colors.textSecondary }]}>{t('auth.lecturerDescription')}</Text>
              </View>
              <Ionicons
                name={isRtl ? 'chevron-back' : 'chevron-forward'}
                size={20}
                color={colors.textSecondary}
              />
            </View>
          </TouchableOpacity>
        </AppCard>

        <TouchableOpacity
          onPress={() => router.push('/(auth)/login')}
          style={styles.linkWrapper}
          activeOpacity={0.75}
        >
          <Text style={[styles.linkText, { color: colors.textSecondary }]}>
            {t('auth.alreadyHaveAccount')}{' '}
            <Text style={[styles.linkTextBold, { color: colors.primary }]}>{t('auth.login')}</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.xs,
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
  roleCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  roleRowRtl: {
    flexDirection: 'row-reverse',
  },
  roleIconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  roleTextCol: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  roleDesc: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
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
});
