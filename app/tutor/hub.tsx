import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppHeader } from '@/frontend/components/ui/AppHeader';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { SectionTitle } from '@/frontend/components/ui/SectionTitle';
import { iconContainer, layout, radius, spacing, typography } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function TutorHubScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);

  return (
    <AppScreen>
      <AppHeader title={t('tutor.hub.title')} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroWrap}>
          <View style={styles.heroGlowPrimary} />
          <View style={styles.heroGlowAccent} />
          <View style={styles.heroBadge}>
            <Ionicons name="ribbon-outline" size={14} color={colors.primary} />
            <Text style={styles.heroBadgeText}>{t('tutor.hub.title')}</Text>
          </View>
          <SectionTitle title={t('tutor.hub.title')} subtitle={t('tutor.hub.participantsSubtitle')} />
        </View>

        <View style={styles.grid}>
          <Pressable style={({ pressed }) => pressed ? styles.cardPress : null} onPress={() => router.push('/tutor/participants' as any)}>
            <AppCard style={styles.card}>
              <View style={styles.cardAccentBar} />
              <View style={styles.cardIconWrap}>
                <Ionicons name="people-outline" size={20} color={colors.textPrimary} />
              </View>
              <View style={styles.cardTextWrap}>
                <Text style={styles.cardTitle}>{t('tutor.hub.participantsTitle')}</Text>
                <Text style={styles.cardSubtitle}>{t('tutor.hub.participantsSubtitle')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </AppCard>
          </Pressable>

          <Pressable style={({ pressed }) => pressed ? styles.cardPress : null} onPress={() => router.push('/tutor/exercises' as any)}>
            <AppCard style={styles.card}>
              <View style={styles.cardAccentBar} />
              <View style={styles.cardIconWrap}>
                <Ionicons name="document-text-outline" size={20} color={colors.textPrimary} />
              </View>
              <View style={styles.cardTextWrap}>
                <Text style={styles.cardTitle}>{t('tutor.hub.exercisesTitle')}</Text>
                <Text style={styles.cardSubtitle}>{t('tutor.hub.exercisesSubtitle')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </AppCard>
          </Pressable>
        </View>
      </ScrollView>
    </AppScreen>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: 28,
  },
  heroWrap: {
    position: 'relative',
    overflow: 'hidden',
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  heroGlowPrimary: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    top: -110,
    right: -60,
    backgroundColor: colors.primary,
    opacity: 0.08,
  },
  heroGlowAccent: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    bottom: -70,
    left: -30,
    backgroundColor: colors.accent,
    opacity: 0.08,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    marginBottom: spacing.sm,
  },
  heroBadgeText: {
    color: colors.textSecondary,
    ...typography.caption,
    fontWeight: '700',
  },
  grid: {
    gap: spacing.sm,
  },
  cardPress: {
    opacity: 0.88,
  },
  card: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  cardAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.primary,
    opacity: 0.35,
  },
  cardIconWrap: {
    width: iconContainer.size,
    height: iconContainer.size,
    borderRadius: iconContainer.radius,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTextWrap: {
    flex: 1,
  },
  cardTitle: {
    color: colors.textPrimary,
    ...typography.h3,
  },
  cardSubtitle: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
});
