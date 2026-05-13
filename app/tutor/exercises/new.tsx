import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppHeader } from '@/frontend/components/ui/AppHeader';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { PrimaryButton } from '@/frontend/components/ui/PrimaryButton';
import { layout, radius, spacing, typography } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { auth } from '@/lib/firebaseConfig';
import {
  createTutorExercise,
  fetchTutorApprovedCourses,
  fetchTutorDisplayName,
} from '@/lib/tutorExerciseService';
import type { TutorApprovedCourseRef, TutorExerciseQuestionType } from '@/shared/types/tutorExercise';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

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

export default function TutorExerciseNewScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);
  const isHebrewUi = i18n.language === 'he';
  const textAlign = isHebrewUi ? 'right' : 'left';

  const [loadingInit, setLoadingInit] = useState(true);
  const [saving, setSaving] = useState(false);
  const [courses, setCourses] = useState<TutorApprovedCourseRef[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [showCoursePicker, setShowCoursePicker] = useState(false);
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [questionType, setQuestionType] = useState<TutorExerciseQuestionType>('open_text');
  const [questions, setQuestions] = useState<LocalQuestion[]>([emptyQuestion()]);

  const loadCourses = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setCourses([]);
      setLoadingInit(false);
      return;
    }
    setLoadingInit(true);
    try {
      const list = await fetchTutorApprovedCourses(user.uid);
      setCourses(list);
      if (list.length === 1) setSelectedCourseId(list[0].courseId);
    } finally {
      setLoadingInit(false);
    }
  }, []);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  const selectedCourse = useMemo(
    () => courses.find((c) => c.courseId === selectedCourseId),
    [courses, selectedCourseId],
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

  const validatePublish = (): boolean => {
    if (!selectedCourseId) {
      Alert.alert('', t('tutor.exercises.errorSelectCourse'));
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

  const validateDraft = (): boolean => {
    if (!selectedCourseId) {
      Alert.alert('', t('tutor.exercises.errorSelectCourse'));
      return false;
    }
    return true;
  };

  const buildPayloadQuestions = () => {
    return questions.map((q) => {
      const trimmedOpts =
        questionType === 'multiple_choice'
          ? q.options.map((o) => o.trim()).filter(Boolean)
          : [];
      return {
        id: q.id,
        text: q.text.trim(),
        correctAnswer: q.correctAnswer.trim(),
        ...(trimmedOpts.length > 0 ? { options: trimmedOpts } : {}),
      };
    });
  };

  const save = async (status: 'draft' | 'published') => {
    const user = auth.currentUser;
    if (!user || !selectedCourse) return;
    if (status === 'published') {
      if (!validatePublish()) return;
    } else {
      if (!validateDraft()) return;
    }
    setSaving(true);
    try {
      const tutorName = (await fetchTutorDisplayName(user.uid)) || user.email || 'Tutor';
      await createTutorExercise({
        courseId: selectedCourse.courseId,
        courseName: selectedCourse.courseName || selectedCourse.courseId,
        tutorUid: user.uid,
        tutorName,
        title: title.trim(),
        instructions: instructions.trim(),
        questionType,
        questions: buildPayloadQuestions(),
        status,
      });
      Alert.alert('', status === 'published' ? t('tutor.exercises.successPublished') : t('tutor.exercises.successSaved'), [
        { text: 'OK', onPress: () => router.replace('/tutor/exercises' as any) },
      ]);
    } catch (e) {
      console.log('create tutor exercise error', e);
      Alert.alert('', t('tutor.exercises.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const typeButtons: { key: TutorExerciseQuestionType; label: string }[] = [
    { key: 'open_text', label: t('tutor.exercises.typeOpenText') },
    { key: 'multiple_choice', label: t('tutor.exercises.typeMultipleChoice') },
    { key: 'true_false', label: t('tutor.exercises.typeTrueFalse') },
  ];

  if (loadingInit) {
    return (
      <AppScreen>
        <AppHeader title={t('tutor.exercises.createExercise')} onBack={() => router.back()} />
        <View style={styles.centered}>
          <Text style={{ color: colors.textSecondary }}>{t('common.loading')}</Text>
        </View>
      </AppScreen>
    );
  }

  if (courses.length === 0) {
    return (
      <AppScreen>
        <AppHeader title={t('tutor.exercises.createExercise')} onBack={() => router.back()} />
        <View style={styles.centered}>
          <Text style={[styles.muted, isHebrewUi && styles.rtl]}>{t('tutor.exercises.notApprovedSubtitle')}</Text>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <AppHeader title={t('tutor.exercises.createExercise')} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={[styles.label, { color: colors.textSecondary }, isHebrewUi && styles.rtl]}>{t('tutor.exercises.course')}</Text>
        <AppCard style={styles.pickerCard}>
          <TouchableOpacity style={styles.pickerInner} onPress={() => setShowCoursePicker(true)}>
            <Ionicons name="book-outline" size={18} color={colors.textPrimary} />
            <Text style={[styles.pickerText, { color: colors.textPrimary }, isHebrewUi && styles.rtl]} numberOfLines={2}>
              {selectedCourse ? selectedCourse.courseName : t('tutor.exercises.selectCourse')}
            </Text>
            <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </AppCard>

        <Modal visible={showCoursePicker} transparent animationType="fade" onRequestClose={() => setShowCoursePicker(false)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCoursePicker(false)}>
            <View style={styles.modalBox}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t('tutor.exercises.selectCourse')}</Text>
                <TouchableOpacity onPress={() => setShowCoursePicker(false)}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView>
                {courses.map((c) => (
                  <TouchableOpacity
                    key={c.courseId}
                    style={styles.modalRow}
                    onPress={() => {
                      setSelectedCourseId(c.courseId);
                      setShowCoursePicker(false);
                    }}
                  >
                    <Text style={[{ color: colors.textPrimary }, selectedCourseId === c.courseId && { fontWeight: '700', color: colors.primary }]}>
                      {c.courseName}
                    </Text>
                    {selectedCourseId === c.courseId ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

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

        <Text style={[styles.label, { color: colors.textSecondary }, isHebrewUi && styles.rtl]}>{t('tutor.exercises.questionType')}</Text>
        <View style={styles.typeRow}>
          {typeButtons.map((tb) => {
            const on = questionType === tb.key;
            return (
              <TouchableOpacity
                key={tb.key}
                style={[
                  styles.typeChip,
                  {
                    borderColor: on ? colors.primary : colors.border,
                    backgroundColor: on ? `${colors.primary}14` : colors.surface,
                  },
                ]}
                onPress={() => setQuestionType(tb.key)}
              >
                <Text style={{ color: on ? colors.primary : colors.textSecondary, ...typography.caption, fontWeight: '700' }}>{tb.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

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
                  <Text style={{ color: q.correctAnswer === 'true' ? colors.primary : colors.textPrimary }}>{t('tutor.exercises.trueValue')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.tfBtn,
                    { borderColor: colors.border },
                    q.correctAnswer === 'false' && { borderColor: colors.primary, backgroundColor: `${colors.primary}12` },
                  ]}
                  onPress={() => setQuestionField(q.id, { correctAnswer: 'false' })}
                >
                  <Text style={{ color: q.correctAnswer === 'false' ? colors.primary : colors.textPrimary }}>{t('tutor.exercises.falseValue')}</Text>
                </TouchableOpacity>
              </View>
            ) : questionType === 'multiple_choice' ? (
              <>
                {[0, 1, 2, 3].map((i) => (
                  <TextInput
                    key={i}
                    style={[
                      styles.input,
                      { marginTop: spacing.xs, color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceMuted, textAlign },
                    ]}
                    placeholder={`${t('tutor.exercises.option')} ${i + 1}`}
                    placeholderTextColor={colors.textSecondary}
                    value={q.options[i as 0 | 1 | 2 | 3]}
                    onChangeText={(v) => setQuestionOption(q.id, i as 0 | 1 | 2 | 3, v)}
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
          <PrimaryButton
            label={t('tutor.exercises.saveDraft')}
            onPress={() => void save('draft')}
            loading={saving}
            variant="secondary"
            style={styles.actionBtn}
          />
          <PrimaryButton label={t('tutor.exercises.publish')} onPress={() => void save('published')} loading={saving} style={styles.actionBtn} />
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
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    muted: {
      ...typography.body,
      textAlign: 'center',
      color: colors.textSecondary,
    },
    rtl: {
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    label: {
      ...typography.caption,
      fontWeight: '700',
      marginBottom: spacing.xs,
      marginTop: spacing.sm,
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
    pickerCard: {
      padding: 0,
      overflow: 'hidden',
    },
    pickerInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
    },
    pickerText: {
      flex: 1,
      ...typography.body,
    },
    typeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    typeChip: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: radius.pill,
      borderWidth: 1,
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
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    modalBox: {
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
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      ...typography.h3,
    },
    modalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
  });
