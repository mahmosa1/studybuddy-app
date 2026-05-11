import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppHeader } from '@/frontend/components/ui/AppHeader';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { SectionTitle } from '@/frontend/components/ui/SectionTitle';
import { iconContainer, layout, spacing, typography, ThemeColors } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function CourseAiHubScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);

  return (
    <AppScreen>
      <AppHeader title={t('courses.hub.aiHubTitle')} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroWrap}>
          <View style={styles.heroGlowPrimary} />
          <View style={styles.heroGlowAccent} />
          <View style={styles.heroBadge}>
            <Ionicons name="sparkles-outline" size={14} color={colors.accent} />
            <Text style={styles.heroBadgeText}>{t('courses.hub.aiPracticeTitle')}</Text>
          </View>
          <SectionTitle title={t('courses.hub.aiHubTitle')} subtitle={t('courses.hub.aiPracticeSubtitle')} />
        </View>

        <Pressable onPress={() => router.push('/ai-practice-setup' as any)} style={({ pressed }) => pressed ? styles.cardPress : null}>
          <AppCard style={styles.card}>
            <View style={[styles.cardAccentBar, styles.cardAccentBarAi]} />
            <View style={styles.iconWrap}>
              <Ionicons name="flask-outline" size={20} color={colors.accent} />
            </View>
            <View style={styles.cardTextWrap}>
              <Text style={styles.cardTitle}>{t('courses.hub.aiBuildTitle')}</Text>
              <Text style={styles.cardSubtitle}>{t('courses.hub.aiBuildSubtitle')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </AppCard>
        </Pressable>

        <Pressable onPress={() => router.push('/courses/statistics' as any)} style={({ pressed }) => pressed ? styles.cardPress : null}>
          <AppCard style={styles.card}>
            <View style={[styles.cardAccentBar, styles.cardAccentBarAi]} />
            <View style={styles.iconWrap}>
              <Ionicons name="bar-chart-outline" size={20} color={colors.accent} />
            </View>
            <View style={styles.cardTextWrap}>
              <Text style={styles.cardTitle}>{t('courses.hub.aiStatsTitle')}</Text>
              <Text style={styles.cardSubtitle}>{t('courses.hub.aiStatsSubtitle')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </AppCard>
        </Pressable>
      </ScrollView>
    </AppScreen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: 30,
    gap: spacing.sm,
  },
  heroWrap: {
    position: 'relative',
    overflow: 'hidden',
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  heroGlowPrimary: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    top: -105,
    right: -55,
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
    opacity: 0.1,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
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
    opacity: 0.45,
  },
  cardAccentBarAi: {
    backgroundColor: colors.accent,
  },
  iconWrap: {
    width: iconContainer.size,
    height: iconContainer.size,
    borderRadius: iconContainer.radius,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center'
  },
  cardTextWrap: {
    flex: 1,
  },
  cardTitle: {
    color: colors.textPrimary,
    ...typography.h3,
  },
  cardSubtitle: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
});
