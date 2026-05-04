// app/ai-practice-setup.tsx
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
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [practiceType, setPracticeType] = useState<PracticeType>('mixed');
  const [practiceLanguage, setPracticeLanguage] = useState<PracticeLanguage>('hebrew');
  const [numQuestions, setNumQuestions] = useState<number>(10);
  const [adaptiveMode, setAdaptiveMode] = useState<boolean>(true);
  const [examMode, setExamMode] = useState<boolean>(false);
  const [examDurationMin, setExamDurationMin] = useState<number>(30);
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
          90000,
          'Question generation'
        );
      } catch (slowOrFailedError) {
        console.warn('⚠️ Full AI generation failed, retrying once before fast mode:', slowOrFailedError);
        try {
          setGenerationStage(t('practice.setup.generatingQuestions'));
          questions = await withTimeout(
            generatePracticeQuestions(
              selectedCourseId,
              selectedCourse.name,
              practiceType,
              numQuestions,
              practiceLanguage
            ),
            90000,
            'Question generation retry'
          );
        } catch (retryError) {
          console.warn('⚡ Switching to fast generation mode:', retryError);
          setGenerationStage(t('practice.setup.switchingFastMode'));
          questions = await withTimeout(
            generatePracticeQuestionsFast(
              selectedCourseId,
              selectedCourse.name,
              practiceType,
              numQuestions,
              practiceLanguage
            ),
            5000,
            'Fast generation'
          );
          Alert.alert(
            t('common.error'),
            t('practice.setup.fastModeNotice')
          );
        }
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
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color="#047857" size="large" />
      </View>
    );
  }

  if (courses.length === 0) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.emptyText}>
          {t('practice.setup.noCoursesFound')}
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.back()}
        >
          <Text style={styles.buttonText}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const canGenerate =
    !generating &&
    !checkingSelectedCourseFiles &&
    !!selectedCourseId &&
    selectedCourseFileCount > 0;

  return (
    <View style={styles.container}>
      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Ionicons name="sparkles" size={32} color="#ffffff" />
          <Text style={styles.headerTitle}>{t('practice.setup.title')}</Text>
          <Text style={styles.headerSubtitle}>
            {t('practice.setup.subtitle')}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

      <View style={styles.card}>
        <Text style={styles.label}>{t('practice.setup.selectCourse')}</Text>
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

        <Text style={styles.label}>{t('practice.setup.practiceType')}</Text>
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

        <Text style={styles.label}>{t('practice.setup.numQuestions')}</Text>
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

        <Text style={styles.label}>{t('practice.setup.practiceLanguage')}</Text>
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

        <Text style={styles.label}>{t('practice.setup.adaptivePractice')}</Text>
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

        <Text style={styles.label}>Exam Simulator</Text>
        <View style={styles.optionsContainer}>
          <TouchableOpacity
            style={[styles.optionButton, examMode && styles.optionButtonSelected]}
            onPress={() => setExamMode(true)}
          >
            <Text style={[styles.optionText, examMode && styles.optionTextSelected]}>ON - Timed pressure mode</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.optionButton, !examMode && styles.optionButtonSelected]}
            onPress={() => setExamMode(false)}
          >
            <Text style={[styles.optionText, !examMode && styles.optionTextSelected]}>OFF - Regular mode</Text>
          </TouchableOpacity>
        </View>

        {examMode && (
          <>
            <Text style={styles.label}>Exam Duration (minutes)</Text>
            <View style={styles.optionsContainer}>
              {[15, 30, 45, 60].map((mins) => (
                <TouchableOpacity
                  key={mins}
                  style={[styles.optionButton, examDurationMin === mins && styles.optionButtonSelected]}
                  onPress={() => setExamDurationMin(mins)}
                >
                  <Text style={[styles.optionText, examDurationMin === mins && styles.optionTextSelected]}>{mins}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <TouchableOpacity
          style={[styles.button, styles.primaryButton, !canGenerate && styles.buttonDisabled]}
          onPress={handleGenerate}
          disabled={!canGenerate}
        >
          {generating ? (
            <>
              <ActivityIndicator color="#ffffff" size="small" style={{ marginRight: 8 }} />
              <Text style={styles.buttonText}>
                {generationStage || `${t('common.loading')}...`} ({t('practice.setup.optimized')})
              </Text>
            </>
          ) : (
            <Text style={styles.buttonText}>{t('practice.setup.generatePractice')}</Text>
          )}
        </TouchableOpacity>
      </View>
      </ScrollView>
    </View>
  );
}

const PRIMARY_GREEN = '#047857';
const ACCENT_GREEN = '#047857';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: PRIMARY_GREEN,
    paddingTop: 60,
    paddingBottom: 30,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: -30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    alignItems: 'center',
    marginTop: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 10,
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#ffffff',
    opacity: 0.9,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#374151',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  label: {
    fontSize: 13,
    color: '#374151',
    marginTop: 12,
    marginBottom: 6,
    fontWeight: '500',
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
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
  },
  optionButtonSelected: {
    backgroundColor: '#dbeafe',
    borderColor: ACCENT_GREEN,
  },
  optionText: {
    fontSize: 14,
    color: '#111827',
  },
  optionTextSelected: {
    color: ACCENT_GREEN,
    fontWeight: '600',
  },
  button: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: ACCENT_GREEN,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  helperMuted: {
    marginTop: 2,
    marginBottom: 8,
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  helperError: {
    marginTop: 2,
    marginBottom: 8,
    fontSize: 12,
    color: '#b91c1c',
    fontWeight: '600',
  },
  helperOk: {
    marginTop: 2,
    marginBottom: 8,
    fontSize: 12,
    color: '#047857',
    fontWeight: '600',
  },
});

