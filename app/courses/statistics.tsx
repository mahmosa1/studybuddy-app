import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppChip } from '@/frontend/components/ui/AppChip';
import { AppHeader } from '@/frontend/components/ui/AppHeader';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { EmptyState } from '@/frontend/components/ui/EmptyState';
import { LoadingState } from '@/frontend/components/ui/LoadingState';
import { PrimaryButton } from '@/frontend/components/ui/PrimaryButton';
import { SectionTitle } from '@/frontend/components/ui/SectionTitle';
import { StatCard } from '@/frontend/components/ui/StatCard';
import { layout, radius, spacing, typography, ThemeColors } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { auth, db } from '@/lib/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

type Stat = {
  totalCourses: number;
  totalSessions: number;
  avgScore: number;
  bestScore: number;
  recentScores: number[];
};

type CourseItem = {
  id: string;
  name: string;
};

export default function CourseStatsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stat>({
    totalCourses: 0,
    totalSessions: 0,
    avgScore: 0,
    bestScore: 0,
    recentScores: [],
  });
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [allResults, setAllResults] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');

  useEffect(() => {
    const load = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const [coursesSnap, resultsSnap] = await Promise.all([
          getDocs(query(collection(db, 'courses'), where('ownerUid', '==', user.uid))),
          getDocs(query(collection(db, 'practiceResults'), where('userId', '==', user.uid))),
        ]);
        const courseItems: CourseItem[] = coursesSnap.docs.map((d) => ({
          id: d.id,
          name: String(d.data()?.name || 'Course'),
        }));
        setCourses(courseItems);

        const results = resultsSnap.docs.map((d) => d.data() as any);
        setAllResults(results);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const filteredResults =
      selectedCourseId === 'all'
        ? allResults
        : allResults.filter((r) => String(r.courseId || '') === selectedCourseId);

    const scores = filteredResults
      .map((r) => Number(r.scorePercent ?? r.score ?? 0))
      .filter((v) => Number.isFinite(v) && v >= 0);

    const totalSessions = scores.length;
    const avgScore = totalSessions ? Math.round(scores.reduce((a, b) => a + b, 0) / totalSessions) : 0;
    const bestScore = totalSessions ? Math.max(...scores) : 0;
    const recentScores = [...scores].slice(-7);

    setStats({
      totalCourses: selectedCourseId === 'all' ? courses.length : (selectedCourseId ? 1 : 0),
      totalSessions,
      avgScore,
      bestScore,
      recentScores,
    });
  }, [allResults, selectedCourseId, courses.length]);

  return (
    <AppScreen>
      <AppHeader title={t('courses.hub.statisticsTitle')} onBack={() => router.back()} />

      {loading ? (
        <LoadingState label={t('common.loading')} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.heroWrap}>
            <View style={styles.heroGlowPrimary} />
            <View style={styles.heroGlowAccent} />
            <View style={styles.heroBadge}>
              <Ionicons name="stats-chart-outline" size={14} color={colors.accent} />
              <Text style={styles.heroBadgeText}>{t('courses.hub.statisticsTitle')}</Text>
            </View>
            <SectionTitle title={t('courses.hub.statisticsTitle')} subtitle={t('courses.hub.statisticsFilterTitle')} />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersRow}
          >
            <AppChip
              label={t('courses.hub.statisticsAllCourses')}
              active={selectedCourseId === 'all'}
              onPress={() => setSelectedCourseId('all')}
            />
            {courses.map((course) => (
              <AppChip
                key={course.id}
                label={course.name}
                active={selectedCourseId === course.id}
                onPress={() => setSelectedCourseId(course.id)}
                style={styles.filterChip}
              />
            ))}
          </ScrollView>

          <View style={styles.grid}>
            <StatCard value={stats.totalCourses} label={t('courses.hub.totalCourses')} style={styles.statCard} />
            <StatCard value={stats.totalSessions} label={t('courses.hub.totalSessions')} style={styles.statCard} />
            <StatCard value={`${stats.avgScore}%`} label={t('courses.hub.averageScore')} style={styles.statCard} />
            <StatCard value={`${stats.bestScore}%`} label={t('courses.hub.bestScore')} style={styles.statCard} />
          </View>

          <AppCard style={styles.trendCard}>
            <View style={styles.cardAccentBar} />
            <Text style={styles.trendTitle}>{t('courses.hub.recentTrend')}</Text>
            {stats.recentScores.length > 0 ? (
              <>
                <View style={styles.trendBarsRow}>
                  {stats.recentScores.map((score, index) => (
                    <View key={`${score}-${index}`} style={styles.trendBarWrap}>
                      <View style={[styles.trendBar, { height: Math.max(10, Math.min(100, score)) }]} />
                      <Text style={styles.trendBarLabel}>{Math.round(score)}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.trendHint}>{t('courses.hub.recentTrendHint')}</Text>
              </>
            ) : (
              <EmptyState title={t('courses.hub.noSessionsYet')} subtitle={t('courses.hub.recentTrendHint')} />
            )}
          </AppCard>

          <PrimaryButton
            label={t('courses.hub.startPractice')}
            onPress={() => router.push('/ai-practice-setup' as any)}
            style={styles.actionBtn}
          />
        </ScrollView>
      )}
    </AppScreen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  content: { padding: layout.screenPadding, paddingBottom: 28 },
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
  filtersRow: {
    gap: spacing.sm,
    paddingBottom: 6,
    marginBottom: 10,
  },
  filterChip: {
    maxWidth: 180,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.sm },
  statCard: {
    width: '48.5%',
  },
  trendCard: {
    marginTop: 14,
    padding: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  cardAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.accent,
    opacity: 0.45,
  },
  trendTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  trendBarsRow: {
    marginTop: 12,
    height: 120,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 6,
  },
  trendBarWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  trendBar: {
    width: '100%',
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    minHeight: 10,
  },
  trendBarLabel: { marginTop: 5, color: colors.textSecondary, fontSize: 10, fontWeight: '600' },
  trendHint: { marginTop: 10, color: colors.textSecondary, ...typography.caption },
  actionBtn: {
    marginTop: 18,
  }
});

