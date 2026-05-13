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
  fetchTutorDisplayName,
  getPublishedExerciseWithSolutionsIfGraded,
  getPublishedTutorExerciseForStudent,
  getStudentSubmissionForExercise,
  submitTutorExerciseSolution,
  TUTOR_EXERCISE_SUBMIT_ERROR,
  type PublishedTutorExerciseForStudent,
  type TutorExerciseSubmissionDoc,
} from '@/lib/tutorExerciseService';
import type { TutorExerciseDoc, TutorExerciseQuestionType } from '@/shared/types/tutorExercise';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type LoadState = 'loading' | 'ready' | 'invalid';

function formatPublishedDate(
  ex: PublishedTutorExerciseForStudent,
  locale: string,
): string {
  const ts = ex.publishedAt ?? ex.updatedAt;
  const ms =
    ts && typeof (ts as { toMillis?: () => number }).toMillis === 'function'
      ? (ts as { toMillis: () => number }).toMillis()
      : 0;
  if (!ms) return '—';
  const loc = locale === 'he' ? 'he-IL' : 'en-US';
  return new Date(ms).toLocaleDateString(loc, { dateStyle: 'medium' });
}

function formatTimestampField(value: unknown, locale: string): string {
  const ms =
    value && typeof (value as { toMillis?: () => number }).toMillis === 'function'
      ? (value as { toMillis: () => number }).toMillis()
      : 0;
  if (!ms) return '—';
  const loc = locale === 'he' ? 'he-IL' : 'en-US';
  return new Date(ms).toLocaleString(loc, { dateStyle: 'medium', timeStyle: 'short' });
}

function formatGradeDisplay(grade: unknown): string {
  if (grade == null) return '—';
  if (typeof grade === 'number' && Number.isFinite(grade)) return String(grade);
  const s = String(grade).trim();
  return s || '—';
}

function formatAnswerForStudentView(
  questionType: TutorExerciseQuestionType,
  raw: string,
  t: (key: string) => string,
): string {
  const v = (raw ?? '').trim();
  if (questionType === 'true_false') {
    const low = v.toLowerCase();
    if (low === 'true') return t('tutor.studentSolve.true');
    if (low === 'false') return t('tutor.studentSolve.false');
  }
  return v || '—';
}

export default function StudentTutorExerciseScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const isHebrewUi = i18n.language === 'he';
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);
  const textAlign = isHebrewUi ? 'right' : 'left';
  const writingDirection = isHebrewUi ? 'rtl' : 'ltr';

  const params = useLocalSearchParams<{
    courseId?: string | string[];
    exerciseId?: string | string[];
  }>();
  const courseId = Array.isArray(params.courseId) ? params.courseId[0] : params.courseId;
  const exerciseId = Array.isArray(params.exerciseId) ? params.exerciseId[0] : params.exerciseId;

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [exercise, setExercise] = useState<PublishedTutorExerciseForStudent | null>(null);
  const [exerciseWithSolutions, setExerciseWithSolutions] = useState<TutorExerciseDoc | null>(null);
  const [submission, setSubmission] = useState<TutorExerciseSubmissionDoc | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const hasSubmission = !!submission;
  const isGraded = submission?.status === 'graded';
  const isPendingReview = hasSubmission && submission.status === 'submitted';
  const readOnlyAnswers = hasSubmission;

  const load = useCallback(async () => {
    if (!courseId || !exerciseId) {
      setLoadState('invalid');
      setExercise(null);
      setExerciseWithSolutions(null);
      setSubmission(null);
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      setLoadState('invalid');
      setExercise(null);
      setExerciseWithSolutions(null);
      setSubmission(null);
      return;
    }
    setLoadState('loading');
    try {
      const [ex, sub] = await Promise.all([
        getPublishedTutorExerciseForStudent(courseId, exerciseId),
        getStudentSubmissionForExercise(exerciseId, user.uid),
      ]);
      if (!ex) {
        setExercise(null);
        setExerciseWithSolutions(null);
        setSubmission(null);
        setLoadState('invalid');
        return;
      }
      setExercise(ex);
      setSubmission(sub);
      let withSolutions: TutorExerciseDoc | null = null;
      if (sub?.status === 'graded') {
        withSolutions = await getPublishedExerciseWithSolutionsIfGraded(courseId, exerciseId, user.uid);
      }
      setExerciseWithSolutions(withSolutions);
      if (sub?.answers?.length) {
        const fromSub: Record<string, string> = {};
        for (const a of sub.answers) {
          fromSub[a.questionId] = a.answer;
        }
        setAnswers(fromSub);
      } else {
        const init: Record<string, string> = {};
        for (const q of ex.questions) {
          init[q.id] = '';
        }
        setAnswers(init);
      }
      setLoadState('ready');
    } catch (e) {
      console.warn('student tutor exercise load:', e);
      setExercise(null);
      setExerciseWithSolutions(null);
      setSubmission(null);
      setLoadState('invalid');
    }
  }, [courseId, exerciseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const setAnswer = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const answerForReadOnly = useCallback(
    (questionId: string) => submission?.answers.find((a) => a.questionId === questionId)?.answer ?? '',
    [submission],
  );

  const handleSubmit = async () => {
    if (!courseId || !exerciseId || !exercise || hasSubmission || submitting) return;
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('', t('tutor.studentSolve.mustSignIn'));
      return;
    }
    for (const q of exercise.questions) {
      const v = (answers[q.id] ?? '').trim();
      if (!v) {
        Alert.alert('', t('tutor.studentSolve.answerAllBeforeSubmit'));
        return;
      }
    }
    setSubmitting(true);
    try {
      const studentName = (await fetchTutorDisplayName(user.uid)) || user.email || user.uid;
      await submitTutorExerciseSolution({
        exerciseId,
        courseIdFromRoute: courseId,
        studentUid: user.uid,
        studentName,
        answersByQuestionId: answers,
      });
      const sub = await getStudentSubmissionForExercise(exerciseId, user.uid);
      setSubmission(sub);
      setExerciseWithSolutions(null);
      Alert.alert('', t('tutor.studentSolve.submitSuccess'));
    } catch (e: unknown) {
      const code = e instanceof Error ? e.message : '';
      if (code === TUTOR_EXERCISE_SUBMIT_ERROR.ALREADY_SUBMITTED) {
        Alert.alert('', t('tutor.studentSolve.alreadySubmitted'));
        void load();
      } else if (code === TUTOR_EXERCISE_SUBMIT_ERROR.ANSWERS_INCOMPLETE) {
        Alert.alert('', t('tutor.studentSolve.answerAllBeforeSubmit'));
      } else {
        Alert.alert('', t('tutor.studentSolve.submitFailed'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const headerTitle = t('tutor.studentSolve.exercise');

  const questionTypeLabel = (type: TutorExerciseQuestionType): string => {
    if (type === 'multiple_choice') return t('tutor.exercises.typeMultipleChoice');
    if (type === 'true_false') return t('tutor.exercises.typeTrueFalse');
    return t('tutor.exercises.typeOpenText');
  };

  const renderQuestionInput = (q: PublishedTutorExerciseForStudent['questions'][0]) => {
    const ro = readOnlyAnswers;
    const val = ro ? answerForReadOnly(q.id) : answers[q.id] ?? '';

    if (exercise!.questionType === 'multiple_choice') {
      const opts = q.options && q.options.length > 0 ? q.options : null;
      if (opts) {
        return (
          <View style={styles.optionsBlock}>
            {opts.map((opt, i) => {
              const selected = val === opt;
              return (
                <TouchableOpacity
                  key={`${q.id}_opt_${i}`}
                  activeOpacity={0.85}
                  disabled={ro}
                  onPress={() => setAnswer(q.id, opt)}
                  style={[
                    styles.optionRow,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? `${colors.primary}18` : colors.surfaceMuted,
                    },
                  ]}
                >
                  <Text style={[styles.optionText, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
                    {opt}
                  </Text>
                  {selected ? (
                    <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                  ) : (
                    <View style={styles.optionRadio} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        );
      }
      return (
        <TextInput
          style={[
            styles.textInput,
            {
              color: colors.textPrimary,
              borderColor: colors.border,
              backgroundColor: colors.surfaceMuted,
              textAlign,
            },
            isHebrewUi && styles.rtlText,
          ]}
          placeholder={t('tutor.studentSolve.yourAnswer')}
          placeholderTextColor={colors.textSecondary}
          value={val}
          editable={!ro}
          onChangeText={(text) => setAnswer(q.id, text)}
          multiline
          textAlignVertical="top"
        />
      );
    }

    if (exercise!.questionType === 'true_false') {
      const tfTrue = t('tutor.studentSolve.true');
      const tfFalse = t('tutor.studentSolve.false');
      const pairs: { value: 'true' | 'false'; label: string }[] = [
        { value: 'true', label: tfTrue },
        { value: 'false', label: tfFalse },
      ];
      return (
        <View style={styles.tfRow}>
          {pairs.map(({ value, label }) => {
            const selected = val === value;
            return (
              <TouchableOpacity
                key={value}
                activeOpacity={0.85}
                disabled={ro}
                onPress={() => setAnswer(q.id, value)}
                style={[
                  styles.tfButton,
                  {
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? `${colors.primary}18` : colors.surfaceMuted,
                  },
                ]}
              >
                <Text style={[styles.tfButtonText, { color: colors.textPrimary }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }

    return (
      <TextInput
        style={[
          styles.textInput,
          {
            color: colors.textPrimary,
            borderColor: colors.border,
            backgroundColor: colors.surfaceMuted,
            textAlign,
          },
          isHebrewUi && styles.rtlText,
        ]}
        placeholder={t('tutor.studentSolve.yourAnswer')}
        placeholderTextColor={colors.textSecondary}
        value={val}
        editable={!ro}
        onChangeText={(text) => setAnswer(q.id, text)}
        multiline
        textAlignVertical="top"
      />
    );
  };

  if (loadState === 'loading' || (loadState === 'ready' && !exercise)) {
    return (
      <AppScreen>
        <AppHeader title={headerTitle} onBack={() => router.back()} />
        <View style={styles.centered}>
          <LoadingState />
        </View>
      </AppScreen>
    );
  }

  if (loadState === 'invalid' || !exercise) {
    return (
      <AppScreen>
        <AppHeader title={headerTitle} onBack={() => router.back()} />
        <View style={styles.centered}>
          <EmptyState title={t('tutor.studentSolve.notAvailableTitle')} subtitle={t('tutor.studentSolve.notAvailableSubtitle')} />
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <AppHeader title={exercise.title || headerTitle} onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        style={{ direction: writingDirection }}
      >
        <AppCard style={styles.heroCard}>
          <Text style={[styles.title, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
            {exercise.title}
          </Text>
          <Text style={[styles.metaLine, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
            {exercise.courseName}
          </Text>
          {!!exercise.tutorName && (
            <Text style={[styles.metaLine, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
              {exercise.tutorName}
            </Text>
          )}
          <View style={styles.metaRow}>
            <Text style={[styles.badgeText, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
              {t('tutor.exercises.questionCount', { count: exercise.questions.length })}
            </Text>
            <Text style={[styles.badgeText, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
              {formatPublishedDate(exercise, i18n.language)}
            </Text>
          </View>
          {isPendingReview ? (
            <View style={[styles.waitingBanner, { borderColor: colors.primary, backgroundColor: `${colors.primary}12` }]}>
              <Ionicons name="time-outline" size={20} color={colors.primary} />
              <Text style={[styles.waitingText, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
                {t('tutor.studentSolve.waitingForReview')}
              </Text>
            </View>
          ) : null}
          {isGraded && submission ? (
            <View
              style={[
                styles.gradedResultCard,
                { borderColor: colors.success, backgroundColor: `${colors.success}14` },
              ]}
            >
              <View style={[styles.gradedHeaderRow, isHebrewUi && styles.rtlRow]}>
                <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                <Text style={[styles.gradedTitle, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
                  {t('tutor.studentSolve.exerciseGraded')}
                </Text>
              </View>
              <Text style={[styles.gradedMetaLine, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
                {t('tutor.submissionsList.gradeLabel')}: {formatGradeDisplay(submission.grade)}
              </Text>
              {String(submission.feedback ?? '').trim() ? (
                <View style={styles.gradedFeedbackBlock}>
                  <Text style={[styles.gradedFeedbackLabel, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
                    {t('tutor.submissionReview.feedback')}
                  </Text>
                  <Text style={[styles.gradedFeedbackBody, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
                    {String(submission.feedback).trim()}
                  </Text>
                </View>
              ) : null}
              <Text style={[styles.gradedDateLine, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
                {t('tutor.studentSolve.gradedOn', {
                  date: formatTimestampField(submission.gradedAt, i18n.language),
                })}
              </Text>
            </View>
          ) : null}
        </AppCard>

        <AppCard style={styles.sectionCard}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
            {t('tutor.studentSolve.instructions')}
          </Text>
          <Text style={[styles.instructionsBody, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
            {exercise.instructions || '—'}
          </Text>
        </AppCard>

        <AppCard style={styles.sectionCard}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
            {t('tutor.studentSolve.questions')}
          </Text>
          <Text style={[styles.typeHint, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
            {questionTypeLabel(exercise.questionType)}
          </Text>
          {exercise.questions.map((q, index) => (
            <View key={q.id} style={[styles.questionBlock, { borderTopColor: colors.border }]}>
              <Text style={[styles.questionTitle, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
                {t('tutor.studentSolve.question')} {index + 1}
              </Text>
              <Text style={[styles.questionText, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
                {q.text}
              </Text>
              {exercise.questionType === 'multiple_choice' && q.options && q.options.length > 0 ? (
                <Text style={[styles.chooseHint, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
                  {t('tutor.studentSolve.chooseAnswer')}
                </Text>
              ) : null}
              {readOnlyAnswers ? (
                <Text style={[styles.answerSectionLabel, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
                  {t('tutor.studentSolve.yourAnswer')}
                </Text>
              ) : null}
              {renderQuestionInput(q)}
              {isGraded ? (
                <View
                  style={[
                    styles.correctAnswerBlock,
                    { borderColor: colors.border, backgroundColor: colors.surfaceMuted },
                  ]}
                >
                  <Text style={[styles.correctAnswerLabel, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
                    {t('tutor.submissionReview.correctAnswer')}
                  </Text>
                  <Text style={[styles.correctAnswerValue, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
                    {exerciseWithSolutions
                      ? formatAnswerForStudentView(
                          exercise.questionType,
                          exerciseWithSolutions.questions.find((sq) => sq.id === q.id)?.correctAnswer ?? '',
                          t,
                        )
                      : '—'}
                  </Text>
                </View>
              ) : null}
            </View>
          ))}
        </AppCard>

        {!hasSubmission ? (
          <PrimaryButton label={t('tutor.studentSolve.submitSolution')} onPress={() => void handleSubmit()} loading={submitting} />
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}

function makeStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    centered: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
    },
    scrollContent: {
      paddingHorizontal: layout.screenPadding,
      paddingBottom: spacing.xxl,
      gap: spacing.md,
    },
    heroCard: {
      padding: spacing.lg,
    },
    title: {
      ...typography.h2,
      marginBottom: spacing.xs,
    },
    metaLine: {
      ...typography.body,
      marginBottom: 2,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    badgeText: {
      ...typography.caption,
    },
    waitingBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
    },
    waitingText: {
      ...typography.body,
      flex: 1,
    },
    gradedResultCard: {
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      gap: spacing.xs,
    },
    gradedHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    gradedTitle: {
      ...typography.body,
      fontWeight: '800',
      flex: 1,
    },
    gradedMetaLine: {
      ...typography.body,
      fontWeight: '700',
      marginTop: spacing.xs,
    },
    gradedFeedbackBlock: {
      marginTop: spacing.sm,
    },
    gradedFeedbackLabel: {
      ...typography.caption,
      fontWeight: '700',
      marginBottom: 4,
    },
    gradedFeedbackBody: {
      ...typography.body,
      lineHeight: 22,
    },
    gradedDateLine: {
      ...typography.caption,
      marginTop: spacing.sm,
    },
    answerSectionLabel: {
      ...typography.caption,
      fontWeight: '700',
      marginBottom: spacing.xs,
    },
    correctAnswerBlock: {
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
    },
    correctAnswerLabel: {
      ...typography.caption,
      fontWeight: '700',
      marginBottom: 6,
    },
    correctAnswerValue: {
      ...typography.body,
      lineHeight: 22,
      fontWeight: '600',
    },
    sectionCard: {
      padding: spacing.lg,
    },
    sectionLabel: {
      ...typography.caption,
      fontWeight: '700',
      marginBottom: spacing.sm,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    instructionsBody: {
      ...typography.body,
      lineHeight: 22,
    },
    typeHint: {
      ...typography.caption,
      marginBottom: spacing.md,
    },
    questionBlock: {
      paddingTop: spacing.md,
      marginTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    questionTitle: {
      ...typography.caption,
      fontWeight: '700',
      marginBottom: spacing.xs,
    },
    questionText: {
      ...typography.body,
      marginBottom: spacing.sm,
      lineHeight: 22,
    },
    chooseHint: {
      ...typography.caption,
      marginBottom: spacing.sm,
    },
    textInput: {
      minHeight: 100,
      borderWidth: 1,
      borderRadius: radius.md,
      padding: spacing.md,
      ...typography.body,
    },
    optionsBlock: {
      gap: spacing.sm,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
    },
    optionText: {
      ...typography.body,
      flex: 1,
      paddingEnd: spacing.sm,
    },
    optionRadio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.border,
    },
    tfRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    tfButton: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      alignItems: 'center',
    },
    tfButtonText: {
      ...typography.body,
      fontWeight: '600',
    },
    rtlText: {
      writingDirection: 'rtl',
    },
  });
}
