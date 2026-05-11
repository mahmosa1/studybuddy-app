// app/ai-practice-setup.tsx
import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppHeader } from '@/frontend/components/ui/AppHeader';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { EmptyState } from '@/frontend/components/ui/EmptyState';
import { LoadingState } from '@/frontend/components/ui/LoadingState';
import { PrimaryButton } from '@/frontend/components/ui/PrimaryButton';
import { SectionTitle } from '@/frontend/components/ui/SectionTitle';
import { layout, radius, spacing, typography } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { auth, db } from '@/lib/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Course = {
  id: string;
  name: string;
};

type PracticeType = 'true-false' | 'open-questions' | 'mixed';
type PracticeLanguage = 'hebrew' | 'english';

export default function AIPracticeSetupScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [practiceType, setPracticeType] = useState<PracticeType>('mixed');
  const [practiceLanguage, setPracticeLanguage] = useState<PracticeLanguage>('hebrew');
  const [numQuestions, setNumQuestions] = useState<number>(10);
  const [adaptiveMode, setAdaptiveMode] = useState<boolean>(true);
  const [examMode, setExamMode] = useState<boolean>(false);
  const [examDurationMin, setExamDurationMin] = useState<number>(30);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [selectedCourseFileCount, setSelectedCourseFileCount] = useState(0);
  const [checkingSelectedCourseFiles, setCheckingSelectedCourseFiles] = useState(false);

  useEffect(() => {
    const loadCourses = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const coursesQuery = query(
          collection(db, 'courses'),
          where('ownerUid', '==', user.uid)
        );
        const coursesSnap = await getDocs(coursesQuery);
        const coursesList: Course[] = [];
        coursesSnap.forEach((doc) => {
          coursesList.push({
            id: doc.id,
            name: doc.data().name || 'Course',
          });
        });
        setCourses(coursesList);
        if (coursesList.length > 0) {
          setSelectedCourseId(coursesList[0].id);
        }
      } catch (err) {
        console.log('Error loading courses:', err);
        Alert.alert('Error', 'Failed to load courses');
      } finally {
        setLoading(false);
      }
    };

    loadCourses();
  }, []);

  useEffect(() => {
    const loadSelectedCourseFileCount = async () => {
      if (!selectedCourseId) {
        setSelectedCourseFileCount(0);
        return;
      }
      try {
        setCheckingSelectedCourseFiles(true);
        const filesSnap = await getDocs(
          query(collection(db, 'courseFiles'), where('courseId', '==', selectedCourseId))
        );
        setSelectedCourseFileCount(filesSnap.size);
      } catch (error) {
        console.log('Error checking selected course files:', error);
        setSelectedCourseFileCount(0);
      } finally {
        setCheckingSelectedCourseFiles(false);
      }
    };
    loadSelectedCourseFileCount();
  }, [selectedCourseId]);

  const [generating, setGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState<string>('');
  const totalSteps = 6;

  const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  };

  const handleGenerate = async () => {
    if (!selectedCourseId) {
      Alert.alert(t('common.error'), t('practice.setup.selectCourseError'));
      return;
    }

    const selectedCourse = courses.find((c) => c.id === selectedCourseId);
    if (!selectedCourse) {
      Alert.alert(t('common.error'), t('practice.setup.courseNotFound'));
      return;
    }
    if (selectedCourseFileCount <= 0) {
      Alert.alert(t('common.error'), t('practice.setup.noFilesForSelectedCourse'));
      return;
    }

    try {
      setGenerating(true);
      setGenerationStage(t('practice.setup.generatingQuestions'));
      
      // Import the AI service
      const { generatePracticeQuestions, generatePracticeQuestionsFast } = await import('@/lib/aiService');
      const { savePracticeSession } = await import('@/lib/practiceService');
      
      // Generate questions using AI
      let questions;
      try {
        questions = await withTimeout(
          generatePracticeQuestions(
            selectedCourseId,
            selectedCourse.name,
            practiceType,
            numQuestions,
            practiceLanguage
          ),
          50000,
          'Question generation'
        );
      } catch (slowOrFailedError) {
        console.warn('⚡ Switching to fast generation mode:', slowOrFailedError);
        setGenerationStage(t('practice.setup.switchingFastMode'));
        questions = await withTimeout(
          generatePracticeQuestionsFast(
            selectedCourseId,
            selectedCourse.name,
            practiceType,
            numQuestions,
            practiceLanguage
          ),
          22000,
          'Fast generation'
        );
        Alert.alert(
          t('common.error'),
          t('practice.setup.fastModeNotice')
        );
      }

      if (!questions || questions.length === 0) {
        Alert.alert(
          t('common.error'),
          t('practice.setup.failedToGenerateQuestions')
        );
        return;
      }

      const allFallback = questions.every((q: any) => q?.source === 'fallback');
      const generationMode: 'ai' | 'fallback' = allFallback ? 'fallback' : 'ai';

      // Save the practice session
      let sessionId: string;
      try {
        setGenerationStage(t('practice.setup.savingSession'));
        sessionId = await withTimeout(
          savePracticeSession(
            selectedCourseId,
            selectedCourse.name,
            practiceType,
            numQuestions,
            questions,
            practiceLanguage,
            adaptiveMode,
            generationMode
          ),
          15000,
          'Session save'
        );
      } catch (saveError: any) {
        console.error('Error saving session:', saveError);
        Alert.alert(
          t('common.error'),
          t('practice.setup.failedToSaveSession')
        );
        return;
      }

      if (!sessionId) {
        Alert.alert(
          t('common.error'),
          t('practice.setup.failedToCreateSession')
        );
        return;
      }

      // Navigate to practice test screen with questions
      router.push({
        pathname: '/ai-practice-test' as any,
        params: {
          sessionId: sessionId,
          courseId: selectedCourseId,
          courseName: selectedCourse.name,
          practiceType: practiceType,
          numQuestions: numQuestions.toString(),
          language: practiceLanguage,
          adaptiveMode: adaptiveMode ? 'true' : 'false',
          examMode: examMode ? 'true' : 'false',
          examDurationMin: String(examDurationMin),
        },
      });
    } catch (error: any) {
      console.error('Error generating practice:', error);
      Alert.alert(
        t('common.error'),
        error.message || t('practice.setup.failedToGenerateQuestionsGeneric')
      );
    } finally {
      setGenerating(false);
      setGenerationStage('');
    }
  };

  if (loading) {
    return (
      <AppScreen>
        <AppHeader title={t('practice.setup.title')} onBack={() => router.back()} />
        <LoadingState label={t('common.loading')} />
      </AppScreen>
    );
  }

  if (courses.length === 0) {
    return (
      <AppScreen>
        <AppHeader title={t('practice.setup.title')} onBack={() => router.back()} />
        <View style={styles.emptyWrap}>
          <EmptyState
            title={t('practice.setup.noCoursesFound')}
            subtitle={t('practice.setup.subtitle')}
          />
          <PrimaryButton
            label={t('common.back')}
            onPress={() => router.back()}
            style={styles.emptyBtn}
          />
        </View>
      </AppScreen>
    );
  }

  const canGenerate =
    !generating &&
    !checkingSelectedCourseFiles &&
    !!selectedCourseId &&
    selectedCourseFileCount > 0;

  const canContinueCurrentStep = (() => {
    if (currentStep === 1) return !!selectedCourseId && selectedCourseFileCount > 0;
    return true;
  })();

  const handleNextStep = () => {
    if (!canContinueCurrentStep) {
      if (currentStep === 1) {
        Alert.alert(t('common.error'), t('practice.setup.noFilesForSelectedCourse'));
      }
      return;
    }
    setCurrentStep((prev) => Math.min(totalSteps, prev + 1));
  };

  const handlePrevStep = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  return (
    <AppScreen>
      <AppHeader title={t('practice.setup.title')} onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroWrap}>
          <View style={styles.heroGlowPrimary} />
          <View style={styles.heroGlowAccent} />
          <View style={styles.heroBadge}>
            <Ionicons name="sparkles-outline" size={14} color={colors.accent} />
            <Text style={styles.heroBadgeText}>{t('courses.hub.aiPracticeTitle')}</Text>
          </View>
          <SectionTitle title={t('practice.setup.title')} subtitle={t('practice.setup.subtitle')} />
        </View>

        <AppCard style={styles.card}>
          <View style={styles.cardAccentBar} />
          <Text style={styles.stepCounter}>
            {t('practice.setup.stepOf', { current: currentStep, total: totalSteps })}
          </Text>
          <Text style={styles.stepTitle}>
            {currentStep === 1
              ? t('practice.setup.selectCourse')
              : currentStep === 2
              ? t('practice.setup.practiceType')
              : currentStep === 3
              ? t('practice.setup.numQuestions')
              : currentStep === 4
              ? t('practice.setup.practiceLanguage')
              : currentStep === 5
              ? t('practice.setup.adaptivePractice')
              : t('practice.setup.examSimulator')}
          </Text>

          {currentStep === 1 ? (
            <>
              <View style={styles.optionsContainer}>
                {courses.map((course) => (
                  <TouchableOpacity
                    key={course.id}
                    style={[
                      styles.optionButton,
                      selectedCourseId === course.id && styles.optionButtonSelected,
                    ]}
                    onPress={() => setSelectedCourseId(course.id)}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        selectedCourseId === course.id && styles.optionTextSelected,
                      ]}
                    >
                      {course.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {checkingSelectedCourseFiles ? (
                <Text style={styles.helperMuted}>{t('practice.setup.checkingCourseFiles')}</Text>
              ) : selectedCourseId && selectedCourseFileCount <= 0 ? (
                <Text style={styles.helperError}>{t('practice.setup.noFilesForSelectedCourse')}</Text>
              ) : selectedCourseId ? (
                <Text style={styles.helperOk}>
                  {t('practice.setup.courseFilesReady', { count: selectedCourseFileCount })}
                </Text>
              ) : null}
            </>
          ) : null}

          {currentStep === 2 ? (
          <View style={styles.optionsContainer}>
            {[
              { label: t('practice.setup.trueFalse'), value: 'true-false' },
              { label: t('practice.setup.openQuestions'), value: 'open-questions' },
              { label: t('practice.setup.mixed'), value: 'mixed' },
            ].map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[
                  styles.optionButton,
                  practiceType === type.value && styles.optionButtonSelected,
                ]}
                onPress={() => setPracticeType(type.value as PracticeType)}
              >
                <Text
                  style={[
                    styles.optionText,
                    practiceType === type.value && styles.optionTextSelected,
                  ]}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          ) : null}

          {currentStep === 3 ? (
          <View style={styles.optionsContainer}>
            {[5, 10, 20, 30].map((num) => (
              <TouchableOpacity
                key={num}
                style={[
                  styles.optionButton,
                  numQuestions === num && styles.optionButtonSelected,
                ]}
                onPress={() => setNumQuestions(num)}
              >
                <Text
                  style={[
                    styles.optionText,
                    numQuestions === num && styles.optionTextSelected,
                  ]}
                >
                  {num}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          ) : null}

          {currentStep === 4 ? (
          <View style={styles.optionsContainer}>
            {[
              { label: t('profile.hebrew'), value: 'hebrew' as PracticeLanguage },
              { label: t('profile.english'), value: 'english' as PracticeLanguage },
            ].map((lang) => (
              <TouchableOpacity
                key={lang.value}
                style={[
                  styles.optionButton,
                  practiceLanguage === lang.value && styles.optionButtonSelected,
                ]}
                onPress={() => setPracticeLanguage(lang.value)}
              >
                <Text
                  style={[
                    styles.optionText,
                    practiceLanguage === lang.value && styles.optionTextSelected,
                  ]}
                >
                  {lang.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          ) : null}

          {currentStep === 5 ? (
          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={[styles.optionButton, adaptiveMode && styles.optionButtonSelected]}
              onPress={() => setAdaptiveMode(true)}
            >
              <Text style={[styles.optionText, adaptiveMode && styles.optionTextSelected]}>
                {t('practice.setup.adaptiveOn')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.optionButton, !adaptiveMode && styles.optionButtonSelected]}
              onPress={() => setAdaptiveMode(false)}
            >
              <Text style={[styles.optionText, !adaptiveMode && styles.optionTextSelected]}>
                {t('practice.setup.adaptiveOff')}
              </Text>
            </TouchableOpacity>
          </View>
          ) : null}

          {currentStep === 6 ? (
          <>
            <View style={styles.optionsContainer}>
              <TouchableOpacity
                style={[styles.optionButton, examMode && styles.optionButtonSelected]}
                onPress={() => setExamMode(true)}
              >
                <Text style={[styles.optionText, examMode && styles.optionTextSelected]}>
                  {t('practice.setup.examOn')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.optionButton, !examMode && styles.optionButtonSelected]}
                onPress={() => setExamMode(false)}
              >
                <Text style={[styles.optionText, !examMode && styles.optionTextSelected]}>
                  {t('practice.setup.examOff')}
                </Text>
              </TouchableOpacity>
            </View>
            {examMode ? (
              <>
                <Text style={styles.label}>{t('practice.setup.examDuration')}</Text>
                <View style={styles.optionsContainer}>
                  {[15, 30, 45, 60].map((mins) => (
                    <TouchableOpacity
                      key={mins}
                      style={[styles.optionButton, examDurationMin === mins && styles.optionButtonSelected]}
                      onPress={() => setExamDurationMin(mins)}
                    >
                      <Text style={[styles.optionText, examDurationMin === mins && styles.optionTextSelected]}>
                        {mins}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : null}
          </>
          ) : null}

          <View style={styles.stepActionsRow}>
            {currentStep > 1 ? (
              <PrimaryButton
                label={t('practice.setup.backStep')}
                variant="secondary"
                onPress={handlePrevStep}
                style={styles.actionBtn}
              />
            ) : <View style={styles.stepActionSpacer} />}

            {currentStep < totalSteps ? (
              <PrimaryButton
                label={t('practice.setup.nextStep')}
                onPress={handleNextStep}
                disabled={!canContinueCurrentStep}
                style={styles.actionBtn}
              />
            ) : (
              <PrimaryButton
                label={generating
                  ? `${generationStage || `${t('common.loading')}...`} (${t('practice.setup.optimized')})`
                  : t('practice.setup.generatePractice')}
                onPress={handleGenerate}
                disabled={!canGenerate}
                loading={generating}
                style={styles.actionBtn}
              />
            )}
          </View>
          {currentStep < totalSteps ? (
            <Text style={styles.stepHint}>
              {t('practice.setup.stepHint')}
            </Text>
          ) : null}
        </AppCard>
      </ScrollView>
    </AppScreen>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  scrollContent: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: 40,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: layout.screenPadding,
  },
  emptyBtn: {
    marginTop: spacing.md,
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
    width: 165,
    height: 165,
    borderRadius: 83,
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
  card: {
    padding: spacing.md,
    borderRadius: radius.lg,
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
  label: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 10,
    marginBottom: 6,
    fontWeight: '600',
  },
  stepCounter: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '700',
    marginBottom: 6,
  },
  stepTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  optionButton: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  optionButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  optionTextSelected: {
    color: colors.textOnPrimary,
    fontWeight: '700',
  },
  stepActionsRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  stepActionSpacer: {
    flex: 1,
  },
  actionBtn: {
    flex: 1,
  },
  stepHint: {
    marginTop: 10,
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
  helperMuted: {
    marginTop: 2,
    marginBottom: 8,
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  helperError: {
    marginTop: 2,
    marginBottom: 8,
    fontSize: 12,
    color: colors.danger,
    fontWeight: '600',
  },
  helperOk: {
    marginTop: 2,
    marginBottom: 8,
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
});

