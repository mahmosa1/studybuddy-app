import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppChip } from '@/frontend/components/ui/AppChip';
import { AppHeader } from '@/frontend/components/ui/AppHeader';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { EmptyState } from '@/frontend/components/ui/EmptyState';
import { LoadingState } from '@/frontend/components/ui/LoadingState';
import { getParticipatingCourses } from '@/frontend/services/participationService';
import { iconContainer, layout, radius, spacing, ThemeColors } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { safeLower } from '@/frontend/utils/format';
import { useUser } from '@/lib/UserContext';
import { auth } from '@/lib/firebaseConfig';
import { ParticipatingCourse, ParticipationSource } from '@/shared/types/participation';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, TextInput, View, ScrollView } from 'react-native';

export default function ParticipatingCoursesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);
  const { role } = useUser();
  const [search, setSearch] = useState('');
  const [courses, setCourses] = useState<ParticipatingCourse[]>([]);
  const [sourceFilter, setSourceFilter] = useState<'all' | ParticipationSource>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setCourses([]);
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const list = await getParticipatingCourses({
          userUid: user.uid,
          unknownLecturerLabel: t('courses.hub.unknownLecturer'),
        });
        setCourses(list);
      } catch (error) {
        console.log('Failed loading participating courses:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [t]);

  const filtered = useMemo(() => {
    const q = safeLower(search);
    const bySource = sourceFilter === 'all'
      ? courses
      : courses.filter((c) => c.sources.includes(sourceFilter));
    if (!q) return bySource;
    return bySource.filter((c) =>
      safeLower(c.name).includes(q) ||
      safeLower(c.lecturer).includes(q) ||
      safeLower(c.tutorName).includes(q)
    );
  }, [courses, search, sourceFilter]);

  return (
    <AppScreen>
      <AppHeader title={t('courses.hub.participatingTitle')} onBack={() => router.back()} />

      <View style={styles.heroWrap}>
        <View style={styles.heroGlowPrimary} />
        <Text style={styles.heroSubtitle}>{t('courses.hub.participatingSubtitle')}</Text>
      </View>

      <View style={styles.searchPanel}>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder={t('search.searchPlaceholder')}
            placeholderTextColor={colors.textSecondary}
          />
        </View>
        <View style={styles.filtersRow}>
          <AppChip label={t('courses.hub.participatingFilterAll')} active={sourceFilter === 'all'} onPress={() => setSourceFilter('all')} />
          <AppChip label={t('courses.hub.participatingFilterLecturer')} active={sourceFilter === 'lecturer'} onPress={() => setSourceFilter('lecturer')} />
          <AppChip label={t('courses.hub.participatingFilterTutor')} active={sourceFilter === 'tutor'} onPress={() => setSourceFilter('tutor')} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <LoadingState label={t('common.loading')} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={t('courses.hub.participatingEmptyTitle')}
            subtitle={t('courses.hub.participatingEmptySubtitle')}
          />
        ) : (
          filtered.map((course) => (
            <Pressable
              key={course.id}
              style={({ pressed }) => pressed ? styles.cardPress : null}
              onPress={() => {
                if (role === 'lecturer') {
                  router.push({ pathname: '/lecturer-course/[courseId]' as any, params: { courseId: course.id, name: course.name } });
                  return;
                }
                router.push({ pathname: '/course/[courseId]' as any, params: { courseId: course.id, name: course.name } });
              }}
            >
              <AppCard style={styles.card}>
              <View style={styles.cardAccentBar} />
              <View style={styles.iconWrap}>
                <Ionicons name="book-outline" size={17} color={colors.textPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{course.name}</Text>
                {course.sources.includes('lecturer') ? (
                  <Text style={styles.meta}>{course.lecturer}</Text>
                ) : null}
                <View style={styles.sourceRow}>
                  {course.sources.includes('lecturer') ? (
                    <View style={styles.sourceBadge}>
                      <Text style={styles.sourceBadgeText}>{t('courses.hub.participatingSourceLecturer')}</Text>
                    </View>
                  ) : null}
                  {course.sources.includes('tutor') ? (
                    <View style={[styles.sourceBadge, styles.sourceBadgeTutor]}>
                      <Text style={styles.sourceBadgeText}>{t('courses.hub.participatingSourceTutor')}</Text>
                    </View>
                  ) : null}
                </View>
                {course.sources.includes('tutor') && course.tutorName ? (
                  <Text style={styles.meta}>{t('courses.hub.participatingTutorName', { name: course.tutorName })}</Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </AppCard>
            </Pressable>
          ))
        )}
      </ScrollView>
    </AppScreen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  heroWrap: {
    position: 'relative',
    overflow: 'hidden',
    marginHorizontal: layout.screenPadding,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  heroGlowPrimary: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    top: -90,
    right: -45,
    backgroundColor: colors.primary,
    opacity: 0.08,
  },
  heroSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  searchPanel: {
    marginHorizontal: layout.screenPadding,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  searchRow: {
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: 14 },
  filtersRow: {
    marginTop: spacing.sm,
    gap: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  content: { paddingHorizontal: layout.screenPadding, paddingBottom: 30, paddingTop: 2 },
  cardPress: {
    opacity: 0.88,
  },
  card: {
    marginBottom: 10,
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
    opacity: 0.3,
  },
  iconWrap: {
    width: iconContainer.size,
    height: iconContainer.size,
    borderRadius: iconContainer.radius,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { color: colors.textPrimary, fontSize: 20, fontWeight: '700' },
  meta: { marginTop: 2, color: colors.textSecondary, fontSize: 12 },
  sourceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  sourceBadge: {
    borderRadius: 999,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sourceBadgeTutor: {
    backgroundColor: colors.chipBg,
    borderColor: colors.border,
  },
  sourceBadgeText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
});

