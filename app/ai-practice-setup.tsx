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

export default function AIPracticeSetupScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [practiceType, setPracticeType] = useState<PracticeType>('mixed');
  const [numQuestions, setNumQuestions] = useState<number>(10);
  const [loading, setLoading] = useState(true);

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

  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!selectedCourseId) {
      Alert.alert(t('common.error'), t('practice.setup.selectCourseError'));
      return;
    }

    const selectedCourse = courses.find((c) => c.id === selectedCourseId);
    if (!selectedCourse) {
      Alert.alert(t('common.error'), 'Course not found');
      return;
    }

    try {
      setGenerating(true);
      
      // Import the AI service
      const { generatePracticeQuestions } = await import('@/lib/aiService');
      const { savePracticeSession } = await import('@/lib/practiceService');
      
      // Generate questions using AI
      const questions = await generatePracticeQuestions(
        selectedCourseId,
        selectedCourse.name,
        practiceType,
        numQuestions
      );

      if (!questions || questions.length === 0) {
        Alert.alert(
          t('common.error'),
          'Failed to generate questions. Please make sure the course has files uploaded and try again.'
        );
        return;
      }

      // Save the practice session
      let sessionId: string;
      try {
        sessionId = await savePracticeSession(
          selectedCourseId,
          selectedCourse.name,
          practiceType,
          numQuestions,
          questions
        );
      } catch (saveError: any) {
        console.error('Error saving session:', saveError);
        Alert.alert(
          t('common.error'),
          'Failed to save practice session. Please try again.'
        );
        return;
      }

      if (!sessionId) {
        Alert.alert(
          t('common.error'),
          'Failed to create practice session. Please try again.'
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
        },
      });
    } catch (error: any) {
      console.error('Error generating practice:', error);
      Alert.alert(
        t('common.error'),
        error.message || 'Failed to generate practice questions. Please try again.'
      );
    } finally {
      setGenerating(false);
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
          No courses found. Please add a course first.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.back()}
        >
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

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

        <TouchableOpacity
          style={[styles.button, styles.primaryButton, generating && styles.buttonDisabled]}
          onPress={handleGenerate}
          disabled={generating}
        >
          {generating ? (
            <>
              <ActivityIndicator color="#ffffff" size="small" style={{ marginRight: 8 }} />
              <Text style={styles.buttonText}>{t('common.loading')}...</Text>
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
});

