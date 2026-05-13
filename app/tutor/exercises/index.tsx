import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppHeader } from '@/frontend/components/ui/AppHeader';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { EmptyState } from '@/frontend/components/ui/EmptyState';
import { LoadingState } from '@/frontend/components/ui/LoadingState';
import { PrimaryButton } from '@/frontend/components/ui/PrimaryButton';
import { iconContainer, layout, radius, spacing, typography } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { auth } from '@/lib/firebaseConfig';
import {
  fetchTutorApprovedCourses,
  listTutorExercisesForTutor,
  type TutorExerciseDoc,
} from '@/lib/tutorExerciseService';
import type { TutorApprovedCourseRef } from '@/shared/types/tutorExercise';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

function formatExerciseDate(ex: TutorExerciseDoc, lang: string): string {
  const locale = lang === 'he' ? 'he-IL' : 'en-US';
  const ts = ex.status === 'published' ? ex.publishedAt : ex.createdAt;
  const ms =
    ts && typeof (ts as { toMillis?: () => number }).toMillis === 'function'
      ? (ts as { toMillis: () => number }).toMillis()
      : 0;
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString(locale, { dateStyle: 'medium' });
}

export default function TutorExercisesListScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);
  const isHebrewUi = i18n.language === 'he';

  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<TutorApprovedCourseRef[]>([]);
  const [exercises, setExercises] = useState<TutorExerciseDoc[]>([]);
  const [filterCourseId, setFilterCourseId] = useState('');
  const [showCourseFilter, setShowCourseFilter] = useState(false);

  const load = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setCourses([]);
      setExercises([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [approved, list] = await Promise.all([
        fetchTutorApprovedCourses(user.uid),
        listTutorExercisesForTutor(user.uid),
      ]);
      setCourses(approved);
      setExercises(list);
      setFilterCourseId((prev) => {
        if (prev && approved.some((c) => c.courseId === prev)) return prev;
        return '';
      });
    } catch (e) {
      console.log('tutor exercises load error:', e);
      setExercises([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const filteredExercises = useMemo(() => {
    if (!filterCourseId) return exercises;
    return exercises.filter((e) => e.courseId === filterCourseId);
  }, [exercises, filterCourseId]);

  const filterLabel = useMemo(() => {
    if (!filterCourseId) return t('tutor.exercises.allCourses');
    return courses.find((c) => c.courseId === filterCourseId)?.courseName || t('tutor.exercises.course');
  }, [filterCourseId, courses, t]);

  return (
    <AppScreen>
      <View style={styles.screenInner}>
        <View pointerEvents="none" style={styles.pageDecor}>
          <View style={[styles.decorGlowPrimary, { backgroundColor: colors.primary }]} />
          <View style={[styles.decorGlowAccent, { backgroundColor: colors.accent }]} />
        </View>
        <AppHeader title={t('tutor.exercises.pageTitle')} onBack={() => router.back()} />

        {loading ? (
          <View style={styles.loadingWrap}>
            <LoadingState label={t('common.loading')} />
          </View>
        ) : (
          <ScrollView style={styles.mainScroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text
              style={[
                styles.pageDescription,
                { color: colors.textSecondary },
                isHebrewUi ? styles.pageDescriptionRtl : styles.pageDescriptionLtr,
              ]}
            >
              {t('tutor.hub.exercisesSubtitle')}
            </Text>

            {courses.length === 0 ? (
              <EmptyState title={t('tutor.exercises.notApprovedTitle')} subtitle={t('tutor.exercises.notApprovedSubtitle')} />
            ) : (
              <>
                <AppCard style={styles.filterCard}>
                  <TouchableOpacity style={styles.filterBtn} onPress={() => setShowCourseFilter(true)}>
                    <View style={styles.iconBadge}>
                      <Ionicons name="funnel-outline" size={18} color={colors.textPrimary} />
                    </View>
                    <Text style={[styles.filterText, isHebrewUi && styles.rtlText]} numberOfLines={1}>
                      {filterLabel}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </AppCard>

                <Modal
                  visible={showCourseFilter}
                  transparent
                  animationType="fade"
                  onRequestClose={() => setShowCourseFilter(false)}
                >
                  <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCourseFilter(false)}>
                    <View style={styles.modalContent}>
                      <View style={styles.modalHeader}>
                        <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t('tutor.exercises.course')}</Text>
                        <TouchableOpacity onPress={() => setShowCourseFilter(false)}>
                          <Ionicons name="close" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                      <ScrollView style={styles.optionsList}>
                        <TouchableOpacity
                          style={[styles.listOptionButton, !filterCourseId && styles.listOptionButtonSelected]}
                          onPress={() => {
                            setFilterCourseId('');
                            setShowCourseFilter(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.listOptionText,
                              { color: colors.textPrimary },
                              !filterCourseId && { color: colors.primary, fontWeight: '700' },
                            ]}
                          >
                            {t('tutor.exercises.allCourses')}
                          </Text>
                          {!filterCourseId ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
                        </TouchableOpacity>
                        {courses.map((c) => (
                          <TouchableOpacity
                            key={c.courseId}
                            style={[
                              styles.listOptionButton,
                              filterCourseId === c.courseId && styles.listOptionButtonSelected,
                            ]}
                            onPress={() => {
                              setFilterCourseId(c.courseId);
                              setShowCourseFilter(false);
                            }}
                          >
                            <Text
                              style={[
                                styles.listOptionText,
                                { color: colors.textPrimary },
                                filterCourseId === c.courseId && { color: colors.primary, fontWeight: '700' },
                              ]}
                              numberOfLines={2}
                            >
                              {c.courseName || c.courseId}
                            </Text>
                            {filterCourseId === c.courseId ? (
                              <Ionicons name="checkmark" size={20} color={colors.primary} />
                            ) : null}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </TouchableOpacity>
                </Modal>

                <PrimaryButton
                  label={t('tutor.exercises.createExercise')}
                  onPress={() => router.push('/tutor/exercises/new' as any)}
                  style={styles.createBtn}
                />

                {filteredExercises.length === 0 ? (
                  <EmptyState title={t('tutor.exercises.emptyTitle')} subtitle={t('tutor.exercises.emptySubtitle')} />
                ) : (
                  filteredExercises.map((ex) => (
                    <TouchableOpacity
                      key={ex.id}
                      activeOpacity={0.88}
                      onPress={() => router.push(`/tutor/exercises/${ex.id}` as any)}
                    >
                      <AppCard style={styles.card}>
                        <View style={styles.cardAccentBar} />
                        <View style={styles.cardTop}>
                          <Text style={[styles.cardTitle, isHebrewUi && styles.rtlText]} numberOfLines={2}>
                            {ex.title || '—'}
                          </Text>
                          <View
                            style={[
                              styles.statusPill,
                              {
                                backgroundColor:
                                  ex.status === 'published' ? `${colors.primary}18` : colors.surfaceMuted,
                                borderColor: ex.status === 'published' ? colors.primary : colors.border,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.statusPillText,
                                { color: ex.status === 'published' ? colors.primary : colors.textSecondary },
                              ]}
                            >
                              {ex.status === 'published' ? t('tutor.exercises.published') : t('tutor.exercises.draft')}
                            </Text>
                          </View>
                        </View>
                        <Text style={[styles.courseLine, isHebrewUi && styles.rtlText]} numberOfLines={1}>
                          {ex.courseName}
                        </Text>
                        <View style={styles.metaRow}>
                          <Text style={[styles.meta, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
                            {t('tutor.exercises.questionCount', { count: ex.questions.length })} ·{' '}
                            {formatExerciseDate(ex, i18n.language)}
                          </Text>
                        </View>
                      </AppCard>
                    </TouchableOpacity>
                  ))
                )}
              </>
            )}
          </ScrollView>
        )}
      </View>
    </AppScreen>
  );
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    screenInner: {
      flex: 1,
    },
    pageDecor: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 260,
      zIndex: 0,
      overflow: 'hidden',
    },
    decorGlowPrimary: {
      position: 'absolute',
      width: 130,
      height: 130,
      borderRadius: 65,
      top: -56,
      right: -36,
      opacity: 0.08,
    },
    decorGlowAccent: {
      position: 'absolute',
      width: 100,
      height: 100,
      borderRadius: 50,
      top: 72,
      left: -28,
      opacity: 0.1,
    },
    mainScroll: {
      flex: 1,
      zIndex: 1,
    },
    loadingWrap: {
      flex: 1,
      zIndex: 1,
    },
    content: {
      paddingHorizontal: layout.screenPadding,
      paddingTop: spacing.sm,
      paddingBottom: 32,
      gap: spacing.sm,
    },
    pageDescription: {
      ...typography.body,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: spacing.sm,
    },
    pageDescriptionRtl: {
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    pageDescriptionLtr: {
      textAlign: 'left',
      writingDirection: 'ltr',
    },
    rtlText: {
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    filterCard: {
      padding: 0,
      marginBottom: spacing.sm,
      overflow: 'hidden',
    },
    filterBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
    },
    iconBadge: {
      width: iconContainer.size,
      height: iconContainer.size,
      borderRadius: iconContainer.radius,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterText: {
      flex: 1,
      ...typography.body,
      color: colors.textPrimary,
    },
    createBtn: {
      marginBottom: spacing.md,
    },
    card: {
      padding: 14,
      marginBottom: spacing.sm,
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
    cardTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    cardTitle: {
      flex: 1,
      ...typography.h3,
      color: colors.textPrimary,
    },
    statusPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radius.pill,
      borderWidth: 1,
    },
    statusPillText: {
      ...typography.caption,
      fontWeight: '700',
    },
    courseLine: {
      marginTop: spacing.xs,
      ...typography.caption,
      color: colors.textSecondary,
    },
    metaRow: {
      marginTop: spacing.sm,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    meta: {
      ...typography.caption,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    modalContent: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      maxHeight: '70%',
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      ...typography.h3,
    },
    optionsList: {
      maxHeight: 360,
    },
    listOptionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    listOptionButtonSelected: {
      backgroundColor: colors.surfaceMuted,
    },
    listOptionText: {
      flex: 1,
      ...typography.body,
      marginEnd: spacing.sm,
    },
  });
