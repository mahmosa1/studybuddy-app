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
  getTutorExerciseById,
  listSubmissionsForExercise,
  publishTutorExercise,
  updateTutorExercise,
  type TutorExerciseContentPatch,
  type TutorExerciseDoc,
  type TutorExerciseSubmissionDoc,
} from '@/lib/tutorExerciseService';
import type { TutorExerciseQuestion, TutorExerciseQuestionType } from '@/shared/types/tutorExercise';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type LocalQuestion = {
  id: string;
  text: string;
  correctAnswer: string;
  options: [string, string, string, string];
};

function newQuestionId(): string {
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function emptyQuestion(): LocalQuestion {
  return { id: newQuestionId(), text: '', correctAnswer: '', options: ['', '', '', ''] };
}

function docQuestionsToLocal(questions: TutorExerciseQuestion[], questionType: TutorExerciseQuestionType): LocalQuestion[] {
  if (questions.length === 0) return [emptyQuestion()];
  return questions.map((q) => {
    const base = q.options && q.options.length > 0 ? [...q.options] : ['', '', '', ''];
    while (base.length < 4) base.push('');
    return {
      id: q.id || newQuestionId(),
      text: q.text,
      correctAnswer: q.correctAnswer,
      options: [base[0] || '', base[1] || '', base[2] || '', base[3] || ''] as LocalQuestion['options'],
    };
  });
}

function localsToFirestoreQuestions(
  locals: LocalQuestion[],
  questionType: TutorExerciseQuestionType,
): TutorExerciseQuestion[] {
  return locals.map((q) => {
    const trimmedOpts =
      questionType === 'multiple_choice' ? q.options.map((o) => o.trim()).filter(Boolean) : [];
    return {
      id: q.id,
      text: q.text.trim(),
      correctAnswer: q.correctAnswer.trim(),
      ...(trimmedOpts.length > 0 ? { options: trimmedOpts } : {}),
    };
  });
}

function questionTypeLabel(type: TutorExerciseQuestionType, t: (k: string) => string): string {
  if (type === 'multiple_choice') return t('tutor.exercises.typeMultipleChoice');
  if (type === 'true_false') return t('tutor.exercises.typeTrueFalse');
  return t('tutor.exercises.typeOpenText');
}

export default function TutorExerciseDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ exerciseId: string | string[] }>();
  const rawId = params.exerciseId;
  const exerciseId = Array.isArray(rawId) ? rawId[0] : rawId;

  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);
  const isHebrewUi = i18n.language === 'he';
  const textAlign = isHebrewUi ? 'right' : 'left';

  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'not_found' | 'forbidden'>('loading');
  const [exercise, setExercise] = useState<TutorExerciseDoc | null>(null);
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [questionType, setQuestionType] = useState<TutorExerciseQuestionType>('open_text');
  const [questions, setQuestions] = useState<LocalQuestion[]>([emptyQuestion()]);
  const [saving, setSaving] = useState(false);
  const [submissions, setSubmissions] = useState<TutorExerciseSubmissionDoc[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!exerciseId) {
      setLoadState('not_found');
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      setLoadState('forbidden');
      return;
    }
    setLoadState('loading');
    try {
      const doc = await getTutorExerciseById(exerciseId);
      if (!doc) {
        setExercise(null);
        setLoadState('not_found');
        return;
      }
      if (doc.tutorUid !== user.uid) {
        setExercise(null);
        setLoadState('forbidden');
        return;
      }
      setExercise(doc);
      setTitle(doc.title);
      setInstructions(doc.instructions);
      setQuestionType(doc.questionType);
      setQuestions(docQuestionsToLocal(doc.questions, doc.questionType));
      setLoadState('ready');
    } catch (e) {
      console.log('tutor exercise detail load error:', e);
      setLoadState('not_found');
    }
  }, [exerciseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshSubmissions = useCallback(async () => {
    if (!exerciseId) return;
    const user = auth.currentUser;
    if (!user) return;
    setSubmissionsLoading(true);
    try {
      const list = await listSubmissionsForExercise(exerciseId, user.uid);
      setSubmissions(list);
    } catch (e) {
      console.log('list submissions error', e);
      setSubmissions([]);
    } finally {
      setSubmissionsLoading(false);
    }
  }, [exerciseId]);

  useFocusEffect(
    useCallback(() => {
      if (loadState !== 'ready' || !exerciseId) return;
      void refreshSubmissions();
    }, [loadState, exerciseId, refreshSubmissions]),
  );

  const setQuestionField = (id: string, patch: Partial<Pick<LocalQuestion, 'text' | 'correctAnswer'>>) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  };

  const setQuestionOption = (qid: string, index: 0 | 1 | 2 | 3, value: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qid) return q;
        const next = [...q.options] as [string, string, string, string];
        next[index] = value;
        return { ...q, options: next };
      }),
    );
  };

  const addQuestion = () => setQuestions((prev) => [...prev, emptyQuestion()]);
  const removeQuestion = (id: string) =>
    setQuestions((prev) => (prev.length <= 1 ? prev : prev.filter((q) => q.id !== id)));

  const buildPatch = (): TutorExerciseContentPatch => ({
    title: title.trim(),
    instructions: instructions.trim(),
    questions: localsToFirestoreQuestions(questions, questionType),
  });

  const validatePublish = (): boolean => {
    if (!exercise?.courseId?.trim()) {
      Alert.alert('', t('tutor.exercises.errorMissingCourse'));
      return false;
    }
    if (!title.trim()) {
      Alert.alert('', t('tutor.exercises.errorRequiredFields'));
      return false;
    }
    if (questions.length === 0) {
      Alert.alert('', t('tutor.exercises.errorMinQuestions'));
      return false;
    }
    for (const q of questions) {
      if (!q.text.trim()) {
        Alert.alert('', t('tutor.exercises.errorRequiredFields'));
        return false;
      }
      if (questionType === 'true_false') {
        if (q.correctAnswer !== 'true' && q.correctAnswer !== 'false') {
          Alert.alert('', t('tutor.exercises.errorRequiredFields'));
          return false;
        }
      } else if (!q.correctAnswer.trim()) {
        Alert.alert('', t('tutor.exercises.errorRequiredFields'));
        return false;
      }
    }
    return true;
  };

  const onSaveChanges = async () => {
    if (!exerciseId || !exercise) return;
    setSaving(true);
    try {
      await updateTutorExercise(exerciseId, buildPatch());
      Alert.alert('', t('tutor.exercises.changesSaved'), [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e) {
      console.log('update tutor exercise error', e);
      Alert.alert('', t('tutor.exercises.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const onPublish = async () => {
    if (!exerciseId || !exercise || exercise.status !== 'draft') return;
    if (!validatePublish()) return;
    setSaving(true);
    try {
      await publishTutorExercise(exerciseId, buildPatch());
      Alert.alert('', t('tutor.exercises.successPublished'), [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e) {
      console.log('publish tutor exercise error', e);
      Alert.alert('', t('tutor.exercises.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loadState === 'loading' || loadState === 'not_found' || loadState === 'forbidden') {
    return (
      <AppScreen>
        <AppHeader title={t('tutor.exercises.editExercise')} onBack={() => router.back()} />
        {loadState === 'loading' ? (
          <LoadingState label={t('common.loading')} />
        ) : loadState === 'forbidden' ? (
          <EmptyState title={t('tutor.exercises.accessDeniedTitle')} subtitle={t('tutor.exercises.accessDeniedSubtitle')} />
        ) : (
          <EmptyState title={t('tutor.exercises.notFoundTitle')} subtitle={t('tutor.exercises.notFoundSubtitle')} />
        )}
      </AppScreen>
    );
  }

  const isDraft = exercise!.status === 'draft';
  const submissionTotal = submissions.length;
  const submissionPending = submissions.filter((s) => s.status === 'submitted').length;
  const submissionGraded = submissions.filter((s) => s.status === 'graded').length;

  return (
    <AppScreen>
      <AppHeader title={t('tutor.exercises.editExercise')} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: isDraft ? colors.surfaceMuted : `${colors.primary}18`,
                borderColor: isDraft ? colors.border : colors.primary,
              },
            ]}
          >
            <Text style={[styles.statusPillText, { color: isDraft ? colors.textSecondary : colors.primary }]}>
              {isDraft ? t('tutor.exercises.draft') : t('tutor.exercises.published')}
            </Text>
          </View>
        </View>

        <AppCard style={[styles.submissionsCard, { borderColor: colors.border }]}>
          <View style={styles.submissionsCardHeader}>
            <View style={styles.submissionsIconWrap}>
              <Ionicons name="folder-outline" size={20} color={colors.textPrimary} />
            </View>
            <Text style={[styles.submissionsTitle, { color: colors.textPrimary }, isHebrewUi && styles.rtl]}>
              {t('tutor.submissionsList.title')}
            </Text>
          </View>
          {submissionsLoading ? (
            <Text style={[styles.submissionsMeta, { color: colors.textSecondary }, isHebrewUi && styles.rtl]}>
              {t('common.loading')}
            </Text>
          ) : (
            <Text style={[styles.submissionsMeta, { color: colors.textSecondary }, isHebrewUi && styles.rtl]}>
              {t('tutor.submissionsList.onExerciseSummary', {
                total: submissionTotal,
                pending: submissionPending,
                graded: submissionGraded,
              })}
            </Text>
          )}
          <PrimaryButton
            label={t('tutor.submissionsList.viewSubmissions')}
            onPress={() => exerciseId && router.push(`/tutor/exercises/${exerciseId}/submissions` as any)}
            style={styles.submissionsButton}
          />
        </AppCard>

        <Text style={[styles.label, { color: colors.textSecondary }, isHebrewUi && styles.rtl]}>{t('tutor.exercises.course')}</Text>
        <AppCard style={styles.readonlyCard}>
          <Text style={[{ color: colors.textPrimary }, isHebrewUi && styles.rtl]}>{exercise!.courseName || exercise!.courseId}</Text>
        </AppCard>

        <Text style={[styles.label, { color: colors.textSecondary }, isHebrewUi && styles.rtl]}>{t('tutor.exercises.questionType')}</Text>
        <AppCard style={styles.readonlyCard}>
          <Text style={[{ color: colors.textPrimary }, isHebrewUi && styles.rtl]}>{questionTypeLabel(questionType, t)}</Text>
        </AppCard>

        <Text style={[styles.label, { color: colors.textSecondary }, isHebrewUi && styles.rtl]}>{t('tutor.exercises.fieldTitle')}</Text>
        <TextInput
          style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceMuted, textAlign }]}
          placeholder={t('tutor.exercises.fieldTitle')}
          placeholderTextColor={colors.textSecondary}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={[styles.label, { color: colors.textSecondary }, isHebrewUi && styles.rtl]}>{t('tutor.exercises.instructions')}</Text>
        <TextInput
          style={[
            styles.input,
            styles.textArea,
            { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceMuted, textAlign },
          ]}
          placeholder={t('tutor.exercises.instructions')}
          placeholderTextColor={colors.textSecondary}
          value={instructions}
          onChangeText={setInstructions}
          multiline
        />

        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }, isHebrewUi && styles.rtl]}>{t('tutor.exercises.questions')}</Text>
          <TouchableOpacity onPress={addQuestion} style={styles.addLink}>
            <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
            <Text style={{ color: colors.primary, ...typography.caption, fontWeight: '700' }}>{t('tutor.exercises.addQuestion')}</Text>
          </TouchableOpacity>
        </View>

        {questions.map((q, index) => (
          <AppCard key={q.id} style={styles.qCard}>
            <View style={styles.qCardHeader}>
              <Text style={[{ color: colors.textPrimary }, isHebrewUi && styles.rtl]}>
                {t('tutor.exercises.question')} {index + 1}
              </Text>
              {questions.length > 1 ? (
                <TouchableOpacity onPress={() => removeQuestion(q.id)}>
                  <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>
            <TextInput
              style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceMuted, textAlign }]}
              placeholder={t('tutor.exercises.question')}
              placeholderTextColor={colors.textSecondary}
              value={q.text}
              onChangeText={(v) => setQuestionField(q.id, { text: v })}
              multiline
            />

            {questionType === 'true_false' ? (
              <View style={styles.tfRow}>
                <TouchableOpacity
                  style={[
                    styles.tfBtn,
                    { borderColor: colors.border },
                    q.correctAnswer === 'true' && { borderColor: colors.primary, backgroundColor: `${colors.primary}12` },
                  ]}
                  onPress={() => setQuestionField(q.id, { correctAnswer: 'true' })}
                >
                  <Text style={{ color: q.correctAnswer === 'true' ? colors.primary : colors.textPrimary }}>
                    {t('tutor.exercises.trueValue')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.tfBtn,
                    { borderColor: colors.border },
                    q.correctAnswer === 'false' && { borderColor: colors.primary, backgroundColor: `${colors.primary}12` },
                  ]}
                  onPress={() => setQuestionField(q.id, { correctAnswer: 'false' })}
                >
                  <Text style={{ color: q.correctAnswer === 'false' ? colors.primary : colors.textPrimary }}>
                    {t('tutor.exercises.falseValue')}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : questionType === 'multiple_choice' ? (
              <>
                {([0, 1, 2, 3] as const).map((i) => (
                  <TextInput
                    key={i}
                    style={[
                      styles.input,
                      { marginTop: spacing.xs, color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceMuted, textAlign },
                    ]}
                    placeholder={`${t('tutor.exercises.option')} ${i + 1}`}
                    placeholderTextColor={colors.textSecondary}
                    value={q.options[i]}
                    onChangeText={(v) => setQuestionOption(q.id, i, v)}
                  />
                ))}
                <Text style={[styles.miniLabel, { color: colors.textSecondary }, isHebrewUi && styles.rtl]}>
                  {t('tutor.exercises.correctAnswer')}
                </Text>
                <TextInput
                  style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceMuted, textAlign }]}
                  placeholder={t('tutor.exercises.correctAnswer')}
                  placeholderTextColor={colors.textSecondary}
                  value={q.correctAnswer}
                  onChangeText={(v) => setQuestionField(q.id, { correctAnswer: v })}
                />
              </>
            ) : (
              <>
                <Text style={[styles.miniLabel, { color: colors.textSecondary }, isHebrewUi && styles.rtl]}>
                  {t('tutor.exercises.correctAnswer')}
                </Text>
                <TextInput
                  style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceMuted, textAlign }]}
                  placeholder={t('tutor.exercises.correctAnswer')}
                  placeholderTextColor={colors.textSecondary}
                  value={q.correctAnswer}
                  onChangeText={(v) => setQuestionField(q.id, { correctAnswer: v })}
                />
              </>
            )}
          </AppCard>
        ))}

        <View style={styles.actions}>
          <PrimaryButton label={t('tutor.exercises.saveChanges')} onPress={() => void onSaveChanges()} loading={saving} style={styles.actionBtn} />
          {isDraft ? (
            <PrimaryButton label={t('tutor.exercises.publish')} onPress={() => void onPublish()} loading={saving} style={styles.actionBtn} />
          ) : null}
        </View>
      </ScrollView>
    </AppScreen>
  );
}

const makeStyles = (colors: any) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: layout.screenPadding,
      paddingBottom: 40,
      paddingTop: spacing.sm,
    },
    statusRow: {
      marginBottom: spacing.md,
    },
    statusPill: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: radius.pill,
      borderWidth: 1,
    },
    statusPillText: {
      ...typography.caption,
      fontWeight: '700',
    },
    label: {
      ...typography.caption,
      fontWeight: '700',
      marginBottom: spacing.xs,
      marginTop: spacing.sm,
    },
    rtl: {
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    readonlyCard: {
      padding: spacing.md,
    },
    input: {
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      ...typography.body,
    },
    textArea: {
      minHeight: 88,
      textAlignVertical: 'top',
    },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    sectionTitle: {
      ...typography.h3,
    },
    addLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    qCard: {
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    qCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    miniLabel: {
      ...typography.caption,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },
    tfRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    tfBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: radius.md,
      borderWidth: 1,
      alignItems: 'center',
    },
    actions: {
      marginTop: spacing.lg,
      gap: spacing.sm,
    },
    actionBtn: {
      width: '100%',
    },
    submissionsCard: {
      padding: spacing.md,
      marginBottom: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
    },
    submissionsCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    submissionsIconWrap: {
      width: 36,
      height: 36,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
    },
    submissionsTitle: {
      ...typography.h3,
      flex: 1,
    },
    submissionsMeta: {
      ...typography.caption,
      marginBottom: spacing.md,
      lineHeight: 18,
    },
    submissionsButton: {
      marginTop: spacing.xs,
    },
  });
