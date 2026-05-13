import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppHeader } from '@/frontend/components/ui/AppHeader';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { EmptyState } from '@/frontend/components/ui/EmptyState';
import { LoadingState } from '@/frontend/components/ui/LoadingState';
import { layout, radius, spacing, typography } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { auth } from '@/lib/firebaseConfig';
import {
  getTutorExerciseById,
  listSubmissionsForExercise,
  type TutorExerciseSubmissionDoc,
} from '@/lib/tutorExerciseService';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type LoadState = 'loading' | 'ready' | 'forbidden';

function formatSubmittedAt(value: unknown, locale: string): string {
  const ms =
    value && typeof (value as { toMillis?: () => number }).toMillis === 'function'
      ? (value as { toMillis: () => number }).toMillis()
      : 0;
  if (!ms) return '—';
  const loc = locale === 'he' ? 'he-IL' : 'en-US';
  return new Date(ms).toLocaleString(loc, { dateStyle: 'medium', timeStyle: 'short' });
}

function gradeLabel(grade: unknown): string | null {
  if (grade === null || grade === undefined) return null;
  if (typeof grade === 'number' && !Number.isNaN(grade)) return String(grade);
  if (typeof grade === 'string' && grade.trim() !== '') return grade.trim();
  return null;
}

export default function TutorExerciseSubmissionsListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ exerciseId?: string | string[] }>();
  const rawId = params.exerciseId;
  const exerciseId = Array.isArray(rawId) ? rawId[0] : rawId;

  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const styles = makeStyles();
  const isHebrewUi = i18n.language === 'he';

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [exerciseTitle, setExerciseTitle] = useState('');
  const [submissions, setSubmissions] = useState<TutorExerciseSubmissionDoc[]>([]);

  const load = useCallback(async () => {
    if (!exerciseId) {
      setLoadState('forbidden');
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      setLoadState('forbidden');
      return;
    }
    setLoadState('loading');
    try {
      const exercise = await getTutorExerciseById(exerciseId);
      if (!exercise || exercise.tutorUid !== user.uid) {
        setExerciseTitle('');
        setSubmissions([]);
        setLoadState('forbidden');
        return;
      }
      setExerciseTitle(exercise.title || '');
      const list = await listSubmissionsForExercise(exerciseId, user.uid);
      setSubmissions(list);
      setLoadState('ready');
    } catch (e) {
      console.warn('tutor submissions list load:', e);
      setSubmissions([]);
      setLoadState('forbidden');
    }
  }, [exerciseId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openSubmission = (submissionId: string) => {
    if (!exerciseId) return;
    router.push(`/tutor/exercises/${exerciseId}/submissions/${submissionId}` as any);
  };

  if (loadState === 'loading') {
    return (
      <AppScreen>
        <AppHeader title={t('tutor.submissionsList.title')} onBack={() => router.back()} />
        <LoadingState label={t('common.loading')} />
      </AppScreen>
    );
  }

  if (loadState === 'forbidden') {
    return (
      <AppScreen>
        <AppHeader title={t('tutor.submissionsList.title')} onBack={() => router.back()} />
        <View style={styles.centered}>
          <EmptyState
            title={t('tutor.submissionsList.forbiddenTitle')}
            subtitle={t('tutor.submissionsList.forbiddenSubtitle')}
          />
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <AppHeader title={t('tutor.submissionsList.title')} onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!!exerciseTitle && (
          <Text style={[styles.exerciseTitle, { color: colors.textPrimary }, isHebrewUi && styles.rtl]}>
            {exerciseTitle}
          </Text>
        )}

        {submissions.length === 0 ? (
          <View style={styles.centered}>
            <EmptyState title={t('tutor.submissionsList.empty')} subtitle="" />
          </View>
        ) : (
          submissions.map((sub) => {
            const pending = sub.status === 'submitted';
            const g = gradeLabel(sub.grade);
            return (
              <TouchableOpacity
                key={sub.id}
                activeOpacity={0.88}
                accessibilityRole="button"
                onPress={() => openSubmission(sub.id)}
              >
                <AppCard style={[styles.card, { borderColor: colors.border }]}>
                  <View style={styles.cardHeader}>
                    <Text style={[styles.studentName, { color: colors.textPrimary }, isHebrewUi && styles.rtl]} numberOfLines={2}>
                      {sub.studentName || sub.studentUid}
                    </Text>
                    <View
                      style={[
                        styles.statusPill,
                        {
                          borderColor: pending ? colors.border : colors.primary,
                          backgroundColor: pending ? colors.surfaceMuted : `${colors.primary}14`,
                        },
                      ]}
                    >
                      <Text style={{ color: pending ? colors.textSecondary : colors.primary, ...typography.caption, fontWeight: '700' }}>
                        {pending ? t('tutor.submissionsList.pendingReview') : t('tutor.submissionsList.graded')}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.meta, { color: colors.textSecondary }, isHebrewUi && styles.rtl]}>
                    {formatSubmittedAt(sub.submittedAt, i18n.language)}
                  </Text>
                  <View style={styles.metaRow}>
                    <Ionicons name="document-text-outline" size={16} color={colors.textSecondary} />
                    <Text style={[styles.meta, { color: colors.textSecondary }, isHebrewUi && styles.rtl]}>
                      {t('tutor.submissionsList.answersCount', { count: sub.answers.length })}
                    </Text>
                  </View>
                  {g != null ? (
                    <Text style={[styles.gradeLine, { color: colors.textPrimary }, isHebrewUi && styles.rtl]}>
                      {t('tutor.submissionsList.gradeLabel')}: {g}
                    </Text>
                  ) : null}
                </AppCard>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </AppScreen>
  );
}

function makeStyles() {
  return StyleSheet.create({
    centered: {
      flex: 1,
      paddingHorizontal: layout.screenPadding,
      justifyContent: 'center',
      minHeight: 200,
    },
    scroll: {
      paddingHorizontal: layout.screenPadding,
      paddingBottom: spacing.xxl,
      gap: spacing.md,
    },
    exerciseTitle: {
      ...typography.h3,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },
    rtl: {
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    card: {
      padding: spacing.lg,
      borderWidth: 1,
      borderRadius: radius.lg,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    studentName: {
      ...typography.body,
      fontWeight: '700',
      flex: 1,
    },
    statusPill: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.pill,
      borderWidth: 1,
    },
    meta: {
      ...typography.caption,
      marginTop: spacing.xs,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    gradeLine: {
      ...typography.caption,
      marginTop: spacing.sm,
      fontWeight: '600',
    },
  });
}
