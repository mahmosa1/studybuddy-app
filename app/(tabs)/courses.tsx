// app/(tabs)/courses.tsx
import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { SectionTitle } from '@/frontend/components/ui/SectionTitle';
import { iconContainer, layout, spacing, typography, ThemeColors } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { useUser } from '@/lib/UserContext';
import { auth, db } from '@/lib/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';

export default function CoursesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { role } = useUser();
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);
  const [isApprovedTutor, setIsApprovedTutor] = useState(false);
  const isLecturer = role === 'lecturer';

  useEffect(() => {
    const loadTutorFlag = async () => {
      const user = auth.currentUser;
      if (!user) {
        setIsApprovedTutor(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const data = snap.data() as any;
        const approved = Array.isArray(data?.tutorApprovedCourses) ? data.tutorApprovedCourses : [];
        setIsApprovedTutor(approved.length > 0);
      } catch {
        setIsApprovedTutor(false);
      }
    };
    loadTutorFlag();
  }, []);

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroWrap}>
          <View style={styles.heroGlowPrimary} />
          <View style={styles.heroGlowAccent} />
          <View style={styles.heroBadge}>
            <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
            <Text style={styles.heroBadgeText}>{t('courses.title')}</Text>
          </View>
          <SectionTitle title={t('courses.hub.title')} subtitle={t('courses.hub.subtitle')} />
        </View>

        <Text style={styles.groupLabel}>{t('courses.hub.myCoursesTitle')}</Text>
        <View style={styles.grid}>
          <Pressable onPress={() => router.push('/courses/my' as any)} style={({ pressed }) => pressed ? styles.cardPress : null}>
            <AppCard style={styles.card}>
              <View style={styles.cardAccentBar} />
              <View style={styles.cardIcon}>
                <Ionicons name="book-outline" size={19} color={colors.textPrimary} />
              </View>
              <View style={styles.cardTextWrap}>
                <Text style={styles.cardTitle}>{t('courses.hub.myCoursesTitle')}</Text>
                <Text style={styles.cardSubtitle}>{t('courses.hub.myCoursesSubtitle')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
            </AppCard>
          </Pressable>

          {isLecturer ? (
            <>
              <Text style={styles.groupLabel}>{t('lecturer.courseActionsTitle')}</Text>
              <Pressable onPress={() => router.push('/lecturer/join-requests' as any)} style={({ pressed }) => pressed ? styles.cardPress : null}>
                <AppCard style={styles.card}>
                  <View style={[styles.cardAccentBar, styles.cardAccentBarAction]} />
                  <View style={styles.cardIcon}>
                    <Ionicons name="mail-unread-outline" size={19} color={colors.textPrimary} />
                  </View>
                  <View style={styles.cardTextWrap}>
                    <Text style={styles.cardTitle}>{t('lecturer.joinRequests')}</Text>
                    <Text style={styles.cardSubtitle}>{t('lecturer.joinRequestsCardSubtitle')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </AppCard>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable onPress={() => router.push('/courses/participating' as any)} style={({ pressed }) => pressed ? styles.cardPress : null}>
                <AppCard style={styles.card}>
                  <View style={styles.cardAccentBar} />
                  <View style={styles.cardIcon}>
                    <Ionicons name="people-outline" size={19} color={colors.textPrimary} />
                  </View>
                  <View style={styles.cardTextWrap}>
                    <Text style={styles.cardTitle}>{t('courses.hub.participatingTitle')}</Text>
                    <Text style={styles.cardSubtitle}>{t('courses.hub.participatingSubtitle')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </AppCard>
              </Pressable>

              <Text style={styles.groupLabel}>{t('courses.hub.aiPracticeTitle')}</Text>
              <Pressable onPress={() => router.push('/courses/ai-hub' as any)} style={({ pressed }) => pressed ? styles.cardPress : null}>
                <AppCard style={styles.card}>
                  <View style={[styles.cardAccentBar, styles.cardAccentBarAi]} />
                  <View style={styles.cardIcon}>
                    <Ionicons name="flask-outline" size={19} color={colors.accent} />
                  </View>
                  <View style={styles.cardTextWrap}>
                    <Text style={styles.cardTitle}>{t('courses.hub.aiPracticeTitle')}</Text>
                    <Text style={styles.cardSubtitle}>{t('courses.hub.aiPracticeSubtitle')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </AppCard>
              </Pressable>

              {role === 'student' && isApprovedTutor && (
                <Pressable onPress={() => router.push('/tutor/hub' as any)} style={({ pressed }) => pressed ? styles.cardPress : null}>
                  <AppCard style={styles.card}>
                    <View style={styles.cardAccentBar} />
                    <View style={styles.cardIcon}>
                      <Ionicons name="ribbon-outline" size={19} color={colors.textPrimary} />
                    </View>
                    <View style={styles.cardTextWrap}>
                      <Text style={styles.cardTitle}>{t('courses.hub.tutorHubTitle')}</Text>
                      <Text style={styles.cardSubtitle}>{t('courses.hub.tutorHubSubtitle')}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                  </AppCard>
                </Pressable>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </AppScreen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  scrollContent: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: 30,
  },
  heroWrap: {
    position: 'relative',
    overflow: 'hidden',
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  heroGlowPrimary: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    top: -110,
    right: -60,
    backgroundColor: colors.primary,
    opacity: 0.08,
  },
  heroGlowAccent: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    bottom: -75,
    left: -35,
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
  groupLabel: {
    marginBottom: 6,
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
  cardAccentBarAi: {
    backgroundColor: colors.accent,
    opacity: 0.45,
  },
  cardAccentBarAction: {
    backgroundColor: colors.primary,
    opacity: 0.4,
  },
  cardIcon: {
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

