import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppHeader } from '@/frontend/components/ui/AppHeader';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { EmptyState } from '@/frontend/components/ui/EmptyState';
import { LoadingState } from '@/frontend/components/ui/LoadingState';
import { PrimaryButton } from '@/frontend/components/ui/PrimaryButton';
import { layout, radius, spacing, typography } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { auth } from '@/lib/firebaseConfig';
import {
  getSubmissionById,
  getTutorExerciseById,
  gradeTutorExerciseSubmission,
  TUTOR_EXERCISE_GRADE_ERROR,
  type TutorExerciseDoc,
  type TutorExerciseSubmissionDoc,
} from '@/lib/tutorExerciseService';
import type { TutorExerciseQuestion } from '@/shared/types/tutorExercise';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

type LoadState = 'loading' | 'ready' | 'invalid';

function formatSubmittedAt(value: unknown, locale: string): string {
  const ms =
    value && typeof (value as { toMillis?: () => number }).toMillis === 'function'
      ? (value as { toMillis: () => number }).toMillis()
      : 0;
  if (!ms) return '—';
  const loc = locale === 'he' ? 'he-IL' : 'en-US';
  return new Date(ms).toLocaleString(loc, { dateStyle: 'medium', timeStyle: 'short' });
}

function studentAnswerFor(sub: TutorExerciseSubmissionDoc, questionId: string): string {
  const a = sub.answers.find((x) => x.questionId === questionId);
  return a?.answer?.trim() ? a.answer : '—';
}

export default function TutorSubmissionReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    exerciseId?: string | string[];
    submissionId?: string | string[];
  }>();
  const exerciseId = Array.isArray(params.exerciseId) ? params.exerciseId[0] : params.exerciseId;
  const submissionId = Array.isArray(params.submissionId) ? params.submissionId[0] : params.submissionId;

  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const styles = makeStyles();
  const isHebrewUi = i18n.language === 'he';
  const textAlign = isHebrewUi ? 'right' : 'left';

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [exercise, setExercise] = useState<TutorExerciseDoc | null>(null);
  const [submission, setSubmission] = useState<TutorExerciseSubmissionDoc | null>(null);
  const [gradeInput, setGradeInput] = useState('');
  const [feedbackInput, setFeedbackInput] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!exerciseId || !submissionId) {
      setLoadState('invalid');
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      setLoadState('invalid');
      return;
    }
    setLoadState('loading');
    try {
      const [ex, sub] = await Promise.all([getTutorExerciseById(exerciseId), getSubmissionById(submissionId)]);
      if (
        !ex ||
        !sub ||
        ex.tutorUid !== user.uid ||
        sub.tutorUid !== user.uid ||
        sub.exerciseId !== exerciseId
      ) {
        setExercise(null);
        setSubmission(null);
        setLoadState('invalid');
        return;
      }
      setExercise(ex);
      setSubmission(sub);
      const g = sub.grade;
      if (typeof g === 'number' && !Number.isNaN(g)) {
        setGradeInput(String(g));
      } else if (typeof g === 'string' && g.trim() !== '') {
        setGradeInput(g.trim());
      } else {
        setGradeInput('');
      }
      setFeedbackInput(typeof sub.feedback === 'string' ? sub.feedback : '');
      setLoadState('ready');
    } catch (e) {
      console.warn('tutor submission review load:', e);
      setExercise(null);
      setSubmission(null);
      setLoadState('invalid');
    }
  }, [exerciseId, submissionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const parseGrade = (): number | null => {
    const raw = gradeInput.trim().replace(',', '.');
    if (raw === '') return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return n;
  };

  const onSave = async () => {
    if (!submissionId || !submission || !auth.currentUser) return;
    const n = parseGrade();
    if (n === null || n < 0 || n > 100) {
      Alert.alert('', t('tutor.submissionReview.invalidGrade'));
      return;
    }
    setSaving(true);
    try {
      await gradeTutorExerciseSubmission(submissionId, auth.currentUser.uid, {
        grade: n,
        feedback: feedbackInput.trim(),
      });
      const next = await getSubmissionById(submissionId);
      if (next) setSubmission(next);
      Alert.alert('', t('tutor.submissionReview.saveSuccess'), [{ text: t('common.ok'), onPress: () => router.back() }]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === TUTOR_EXERCISE_GRADE_ERROR.INVALID_GRADE) {
        Alert.alert('', t('tutor.submissionReview.invalidGrade'));
      } else {
        Alert.alert('', t('tutor.submissionReview.saveFailed'));
      }
    } finally {
      setSaving(false);
    }
  };

  if (loadState === 'loading') {
    return (
      <AppScreen>
        <AppHeader title={t('tutor.submissionReview.title')} onBack={() => router.back()} />
        <LoadingState label={t('common.loading')} />
      </AppScreen>
    );
  }

  if (loadState === 'invalid' || !exercise || !submission) {
    return (
      <AppScreen>
        <AppHeader title={t('tutor.submissionReview.title')} onBack={() => router.back()} />
        <View style={styles.centered}>
          <EmptyState title={t('tutor.submissionReview.notAvailable')} subtitle="" />
        </View>
      </AppScreen>
    );
  }

  const pending = submission.status === 'submitted';
  const questions: TutorExerciseQuestion[] = exercise.questions;

  return (
    <AppScreen>
      <AppHeader title={t('tutor.submissionReview.title')} onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AppCard style={[styles.hero, { borderColor: colors.border }]}>
          <Text style={[styles.exTitle, { color: colors.textPrimary }, isHebrewUi && styles.rtl]} numberOfLines={3}>
            {exercise.title}
          </Text>
          <Text style={[styles.meta, { color: colors.textSecondary }, isHebrewUi && styles.rtl]}>
            {submission.studentName || submission.studentUid}
          </Text>
          <Text style={[styles.meta, { color: colors.textSecondary }, isHebrewUi && styles.rtl]}>
            {formatSubmittedAt(submission.submittedAt, i18n.language)}
          </Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.pill,
                {
                  borderColor: pending ? colors.border : colors.primary,
                  backgroundColor: pending ? colors.surfaceMuted : `${colors.primary}14`,
                },
              ]}
            >
              <Text style={{ color: pending ? colors.textSecondary : colors.primary, ...typography.caption, fontWeight: '700' }}>
                {pending ? t('tutor.submissionReview.pendingReview') : t('tutor.submissionReview.graded')}
              </Text>
            </View>
            <Text style={[styles.meta, { color: colors.textSecondary }, isHebrewUi && styles.rtl]}>
              {t('tutor.submissionsList.answersCount', { count: submission.answers.length })}
            </Text>
          </View>
        </AppCard>

        {questions.map((q, idx) => (
          <AppCard key={q.id || String(idx)} style={[styles.qCard, { borderColor: colors.border }]}>
            <Text style={[styles.qLabel, { color: colors.textSecondary }, isHebrewUi && styles.rtl]}>
              {t('tutor.submissionReview.exerciseQuestion')} {idx + 1}
            </Text>
            <Text style={[styles.qText, { color: colors.textPrimary }, isHebrewUi && styles.rtl]}>{q.text || '—'}</Text>
            <Text style={[styles.blockLabel, { color: colors.textSecondary }, isHebrewUi && styles.rtl]}>
              {t('tutor.submissionReview.studentAnswer')}
            </Text>
            <Text style={[styles.answerText, { color: colors.textPrimary }, isHebrewUi && styles.rtl]}>
              {studentAnswerFor(submission, q.id)}
            </Text>
            <Text style={[styles.blockLabel, { color: colors.textSecondary }, isHebrewUi && styles.rtl]}>
              {t('tutor.submissionReview.correctAnswer')}
            </Text>
            <Text style={[styles.answerText, { color: colors.textPrimary }, isHebrewUi && styles.rtl]}>
              {q.correctAnswer?.trim() ? q.correctAnswer : '—'}
            </Text>
          </AppCard>
        ))}

        <AppCard style={[styles.formCard, { borderColor: colors.border }]}>
          <Text style={[styles.blockLabel, { color: colors.textSecondary }, isHebrewUi && styles.rtl]}>
            {t('tutor.submissionReview.grade')}
          </Text>
          <TextInput
            style={[
              styles.input,
              { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceMuted, textAlign },
            ]}
            placeholder="0–100"
            placeholderTextColor={colors.textSecondary}
            keyboardType="decimal-pad"
            value={gradeInput}
            onChangeText={setGradeInput}
          />
          <Text style={[styles.blockLabel, { color: colors.textSecondary, marginTop: spacing.md }, isHebrewUi && styles.rtl]}>
            {t('tutor.submissionReview.feedback')}
          </Text>
          <TextInput
            style={[
              styles.input,
              styles.textArea,
              { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceMuted, textAlign },
            ]}
            placeholder={t('tutor.submissionReview.feedbackPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            value={feedbackInput}
            onChangeText={setFeedbackInput}
            multiline
            textAlignVertical="top"
          />
        </AppCard>

        <PrimaryButton label={t('tutor.submissionReview.save')} onPress={() => void onSave()} loading={saving} />
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
    hero: {
      padding: spacing.lg,
      borderRadius: radius.lg,
      borderWidth: 1,
    },
    exTitle: {
      ...typography.h3,
      marginBottom: spacing.xs,
    },
    meta: {
      ...typography.caption,
      marginTop: 2,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    pill: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.pill,
      borderWidth: 1,
    },
    qCard: {
      padding: spacing.lg,
      borderRadius: radius.lg,
      borderWidth: 1,
    },
    qLabel: {
      ...typography.caption,
      fontWeight: '700',
      marginBottom: spacing.xs,
    },
    qText: {
      ...typography.body,
      marginBottom: spacing.md,
      lineHeight: 22,
    },
    blockLabel: {
      ...typography.caption,
      fontWeight: '700',
      marginBottom: spacing.xs,
    },
    answerText: {
      ...typography.body,
      marginBottom: spacing.md,
      lineHeight: 22,
    },
    formCard: {
      padding: spacing.lg,
      borderRadius: radius.lg,
      borderWidth: 1,
    },
    input: {
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      ...typography.body,
    },
    textArea: {
      minHeight: 100,
    },
    rtl: {
      textAlign: 'right',
      writingDirection: 'rtl',
    },
  });
}
