// app/ai-practice-test.tsx
import { evaluateOpenAnswer, PracticeQuestion } from '@/lib/aiService';
import { db } from '@/lib/firebaseConfig';
import { PracticeAnswer, savePracticeResults } from '@/lib/practiceService';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

type Question = PracticeQuestion & {
  userAnswer?: string;
};

export default function AIPracticeTestScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    sessionId?: string;
    courseId?: string;
    courseName?: string;
    practiceType?: string;
    numQuestions?: string;
    language?: string;
    adaptiveMode?: string;
    examMode?: string;
    examDurationMin?: string;
  }>();

  const courseName = params.courseName || 'Course';
  const sessionId = params.sessionId;
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [answers, setAnswers] = useState<PracticeAnswer[]>([]);
  const [language, setLanguage] = useState<'hebrew' | 'english'>('hebrew');
  const [adaptiveMode, setAdaptiveMode] = useState(false);
  const [examMode, setExamMode] = useState(false);
  const [timeLeftSec, setTimeLeftSec] = useState(0);
  const [adaptiveOrder, setAdaptiveOrder] = useState<number[]>([]);
  const [adaptiveStep, setAdaptiveStep] = useState(0);
  const [linearStep, setLinearStep] = useState(0);
  const [generationMode, setGenerationMode] = useState<'ai' | 'fallback'>('ai');

  // Load questions from session
  useEffect(() => {
    const loadQuestions = async () => {
      if (!sessionId) {
        // Fallback: use mock questions if no session
        Alert.alert('Error', 'Session ID missing');
        setLoading(false);
        return;
      }

      try {
        const sessionDoc = await getDoc(doc(db, 'practiceSessions', sessionId));
        if (!sessionDoc.exists()) {
          Alert.alert('Error', 'Practice session not found');
          setLoading(false);
          return;
        }

        const sessionData = sessionDoc.data();
        const loadedQuestions = (sessionData.questions || []) as PracticeQuestion[];
        const sessionGenerationMode =
          sessionData.generationMode === 'fallback' ||
          loadedQuestions.every((q: any) => q?.source === 'fallback')
            ? 'fallback'
            : 'ai';
        setGenerationMode(sessionGenerationMode);
        
        // Get language from session or params
        const sessionLanguage = sessionData.language || params.language || 'hebrew';
        setLanguage(sessionLanguage === 'english' ? 'english' : 'hebrew');
        const sessionAdaptive = Boolean(
          sessionData.adaptiveMode === true || params.adaptiveMode === 'true'
        );
        setAdaptiveMode(sessionAdaptive);
        const sessionExamMode = Boolean(params.examMode === 'true');
        setExamMode(sessionExamMode);
        const durationMin = Number(params.examDurationMin || '30');
        setTimeLeftSec(Math.max(60, durationMin * 60));
        
        const preparedQuestions = loadedQuestions.map((q) => ({ ...q, userAnswer: undefined }));
        setQuestions(preparedQuestions);
        setAdaptiveOrder(preparedQuestions.map((_, index) => index));
      } catch (error) {
        console.error('Error loading questions:', error);
        Alert.alert('Error', 'Failed to load practice questions');
      } finally {
        setLoading(false);
      }
    };

    loadQuestions();
  }, [sessionId]);

  useEffect(() => {
    if (!examMode || submitted || loading) return;
    if (timeLeftSec <= 0) {
      handleSubmit();
      return;
    }
    const timer = setInterval(() => setTimeLeftSec((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [examMode, timeLeftSec, submitted, loading]);

  const handleAnswerChange = (questionId: string, answer: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId ? { ...q, userAnswer: answer } : q
      )
    );
  };

  const estimateDifficulty = (question: Question): number => {
    if (question.type === 'open') return 3;
    if (question.type === 'multiple-choice') return 2;
    return 1;
  };

  const advanceAdaptive = () => {
    if (!adaptiveMode) return;
    const currentIdx = adaptiveOrder[adaptiveStep];
    const currentQuestion = questions[currentIdx];
    if (!currentQuestion) return;

    const userAnswer = currentQuestion.userAnswer?.trim();
    if (!userAnswer) {
      Alert.alert('Please answer the current question first.');
      return;
    }

    let isCorrect = false;
    if (currentQuestion.type === 'open') {
      isCorrect = userAnswer.length >= Math.max(20, (currentQuestion.correctAnswer || '').length * 0.35);
    } else {
      const normalizedUser = userAnswer.toLowerCase();
      const normalizedCorrect = (currentQuestion.correctAnswer || '').toLowerCase();
      isCorrect = normalizedUser === normalizedCorrect;
    }

    if (adaptiveStep >= questions.length - 1) {
      handleSubmit();
      return;
    }

    const visited = new Set(adaptiveOrder.slice(0, adaptiveStep + 1));
    const remaining = questions
      .map((q, idx) => ({ idx, q }))
      .filter(({ idx }) => !visited.has(idx));

    if (remaining.length === 0) {
      handleSubmit();
      return;
    }

    const sorted = remaining.sort((a, b) => estimateDifficulty(a.q) - estimateDifficulty(b.q));
    const nextIdx = isCorrect ? sorted[sorted.length - 1].idx : sorted[0].idx;
    const nextOrder = [...adaptiveOrder];
    nextOrder[adaptiveStep + 1] = nextIdx;
    setAdaptiveOrder(nextOrder);
    setAdaptiveStep((prev) => prev + 1);
  };

  const advanceLinear = () => {
    const question = questions[linearStep];
    if (!question) return;
    if (!question.userAnswer || question.userAnswer.trim().length === 0) {
      Alert.alert('Please answer the current question first.');
      return;
    }
    if (linearStep >= questions.length - 1) {
      handleSubmit();
      return;
    }
    setLinearStep((prev) => prev + 1);
  };

  const handleSubmit = async () => {
    if (!sessionId) {
      Alert.alert('Error', 'Session ID missing. Please start a new practice session.');
      return;
    }

    if (questions.length === 0) {
      Alert.alert('Error', 'No questions found. Please start a new practice session.');
      return;
    }

    try {
      setSubmitting(true);
      setSubmitted(true);

      // Evaluate answers
      const answers: PracticeAnswer[] = [];
      let correctCount = 0;

      for (const question of questions) {
        let isCorrect = false;
        let answerScore: number | undefined = undefined;

        if (question.type === 'true-false' || question.type === 'multiple-choice') {
          // Direct comparison for true/false and multiple choice
          // Support both English and Hebrew
          const userAns = question.userAnswer?.trim().toLowerCase() || '';
          const correctAns = question.correctAnswer?.trim().toLowerCase() || '';
          
          // Normalize Hebrew/English true-false answers
          let normalizedUserAns = userAns;
          let normalizedCorrectAns = correctAns;
          
          if (question.type === 'true-false') {
            // Map Hebrew to English for comparison
            if (userAns === 'נכון' || userAns === 'true') normalizedUserAns = 'true';
            if (userAns === 'לא נכון' || userAns === 'false') normalizedUserAns = 'false';
            if (correctAns === 'נכון' || correctAns === 'true') normalizedCorrectAns = 'true';
            if (correctAns === 'לא נכון' || correctAns === 'false') normalizedCorrectAns = 'false';
          }
          
          isCorrect = normalizedUserAns === normalizedCorrectAns;
          if (isCorrect) correctCount++;
        } else if (question.type === 'open') {
          // Evaluate open-ended questions
          if (question.userAnswer && question.userAnswer.trim().length > 0) {
            try {
              const evaluation = await evaluateOpenAnswer(
                question.question,
                question.userAnswer,
                question.correctAnswer || ''
              );
              answerScore = evaluation.score;
              isCorrect = answerScore >= 70; // Consider 70%+ as correct
              if (isCorrect) correctCount++;
            } catch (evalError) {
              // If evaluation fails, mark as answered but not correct
              console.log('Error evaluating open answer:', evalError);
              isCorrect = false;
              answerScore = 0; // Set to 0 instead of undefined
            }
          }
        }

        // Create answer object - ensure no undefined values
        const answer: PracticeAnswer = {
          questionId: question.id || '',
          userAnswer: question.userAnswer || '',
          isCorrect: isCorrect,
          questionText: question.question || '',
          topic: question.topic || '',
          mistakeType: isCorrect
            ? undefined
            : question.type === 'open'
              ? 'conceptual'
              : (question.userAnswer || '').trim().length === 0
                ? 'incomplete'
                : 'careless',
        };
        
        // Only add score if it's a number (for open questions)
        if (answerScore !== undefined && answerScore !== null && typeof answerScore === 'number') {
          answer.score = answerScore;
        }
        
        answers.push(answer);
      }

      // Calculate score
      const percentage = Math.round((correctCount / questions.length) * 100);
      setScore(percentage);
      setAnswers(answers);

      // Save results to Firestore
      try {
        console.log('💾 Attempting to save practice results...');
        await savePracticeResults(sessionId, answers, percentage);
        console.log('✅ Practice results saved successfully');
      } catch (saveError: any) {
        console.error('❌ Error saving results:', saveError);
        console.error('Error code:', saveError.code);
        console.error('Error message:', saveError.message);
        
        // Show more detailed error message
        const errorMessage = saveError.message || saveError.toString();
        Alert.alert(
          'Warning',
          `Results could not be saved: ${errorMessage}\n\nYou can still view your score, but it won't be saved to your practice history.`,
          [{ text: 'OK' }]
        );
      }

      // Show review screen instead of navigating immediately
      setShowReview(true);
    } catch (error: any) {
      console.error('Error submitting practice:', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to submit practice. Please try again.'
      );
      setSubmitting(false);
      setSubmitted(false);
    }
  };

  const getQuestionAnswer = (questionId: string): PracticeAnswer | undefined => {
    return answers.find(a => a.questionId === questionId);
  };

  const isQuestionCorrect = (question: Question): boolean => {
    const answer = getQuestionAnswer(question.id);
    return answer?.isCorrect || false;
  };

  const renderQuestion = (question: Question, index: number) => {
    const isCorrect = isQuestionCorrect(question);
    const answer = getQuestionAnswer(question.id);
    
    if (showReview) {
      // Show all questions with correct/incorrect indicators in review mode
      return (
        <View
          key={question.id}
          style={[
            styles.questionCard,
            isCorrect ? styles.correctCard : styles.incorrectCard,
          ]}
        >
          <View style={styles.questionHeader}>
            <Text style={styles.questionNumber}>Question {index + 1}</Text>
            {isCorrect ? (
              <View style={styles.correctBadge}>
                <Ionicons name="checkmark-circle" size={20} color={ACCENT_GREEN} />
                <Text style={styles.correctBadgeText}>Correct</Text>
              </View>
            ) : (
              <View style={styles.incorrectBadge}>
                <Ionicons name="close-circle" size={20} color="#ef4444" />
                <Text style={styles.incorrectBadgeText}>Incorrect</Text>
              </View>
            )}
          </View>
          <Text style={styles.questionText}>{question.question}</Text>

          {question.type === 'true-false' && (() => {
            // Detect language from correct answer
            const isHebrew = question.correctAnswer === 'נכון' || question.correctAnswer === 'לא נכון';
            const trueLabel = isHebrew ? 'נכון' : 'True';
            const falseLabel = isHebrew ? 'לא נכון' : 'False';
            const userSelectedTrue = question.userAnswer === 'True' || question.userAnswer === 'נכון';
            const userSelectedFalse = question.userAnswer === 'False' || question.userAnswer === 'לא נכון';
            const correctIsTrue = question.correctAnswer === 'True' || question.correctAnswer === 'נכון';
            const correctIsFalse = question.correctAnswer === 'False' || question.correctAnswer === 'לא נכון';
            
            return (
              <View style={styles.optionsContainer}>
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    userSelectedTrue && styles.selectedOption,
                    correctIsTrue && styles.correctOption,
                  ]}
                  disabled
                >
                  <Text
                    style={[
                      styles.optionText,
                      userSelectedTrue && styles.selectedOptionText,
                      correctIsTrue && styles.correctOptionText,
                    ]}
                  >
                    {trueLabel}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    userSelectedFalse && styles.selectedOption,
                    correctIsFalse && styles.correctOption,
                  ]}
                  disabled
                >
                  <Text
                    style={[
                      styles.optionText,
                      userSelectedFalse && styles.selectedOptionText,
                      correctIsFalse && styles.correctOptionText,
                    ]}
                  >
                    {falseLabel}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })()}

          {question.type === 'multiple-choice' && question.options && (
            <View style={styles.optionsContainer}>
              {question.options.map((option, optIndex) => (
                <TouchableOpacity
                  key={optIndex}
                  style={[
                    styles.optionButton,
                    question.userAnswer === option && styles.selectedOption,
                    question.correctAnswer === option && styles.correctOption,
                  ]}
                  disabled
                >
                  <Text
                    style={[
                      styles.optionText,
                      question.userAnswer === option && styles.selectedOptionText,
                      question.correctAnswer === option && styles.correctOptionText,
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {question.type === 'open' && (
            <>
              <Text style={styles.answerLabel}>Your answer:</Text>
              <TextInput
                style={[styles.textInput, styles.disabledInput]}
                value={question.userAnswer || ''}
                placeholder="Your answer..."
                multiline
                editable={false}
              />
              <Text style={styles.answerLabel}>Correct answer:</Text>
              <TextInput
                style={[styles.textInput, styles.disabledInput, styles.correctAnswerInput]}
                value={question.correctAnswer || ''}
                placeholder="Correct answer..."
                multiline
                editable={false}
              />
            </>
          )}

          {!isCorrect && (
            <View style={styles.feedbackContainer}>
              <Text style={styles.feedbackText}>
                Your answer: {question.userAnswer || 'Not answered'}
              </Text>
              <Text style={styles.correctAnswerText}>
                Correct answer: {question.correctAnswer}
              </Text>
            </View>
          )}
        </View>
      );
    }

    return (
      <View key={question.id} style={styles.questionCard}>
        <Text style={styles.questionNumber}>Question {index + 1}</Text>
        <Text style={styles.questionText}>{question.question}</Text>

        {question.type === 'true-false' && (() => {
          // Detect language from question text (if Hebrew characters present) or default to Hebrew
          const isHebrew = /[\u0590-\u05FF]/.test(question.question);
          const trueLabel = isHebrew ? 'נכון' : 'True';
          const falseLabel = isHebrew ? 'לא נכון' : 'False';
          const trueValue = isHebrew ? 'נכון' : 'True';
          const falseValue = isHebrew ? 'לא נכון' : 'False';
          const userSelectedTrue = question.userAnswer === 'True' || question.userAnswer === 'נכון';
          const userSelectedFalse = question.userAnswer === 'False' || question.userAnswer === 'לא נכון';
          
          return (
            <View style={styles.optionsContainer}>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  userSelectedTrue && styles.selectedOption,
                ]}
                onPress={() => handleAnswerChange(question.id, trueValue)}
              >
                <Text
                  style={[
                    styles.optionText,
                    userSelectedTrue && styles.selectedOptionText,
                  ]}
                >
                  {trueLabel}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  userSelectedFalse && styles.selectedOption,
                ]}
                onPress={() => handleAnswerChange(question.id, falseValue)}
              >
                <Text
                  style={[
                    styles.optionText,
                    userSelectedFalse && styles.selectedOptionText,
                  ]}
                >
                  {falseLabel}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })()}

        {question.type === 'multiple-choice' && question.options && (
          <View style={styles.optionsContainer}>
            {question.options.map((option, optIndex) => (
              <TouchableOpacity
                key={optIndex}
                style={[
                  styles.optionButton,
                  question.userAnswer === option && styles.selectedOption,
                ]}
                onPress={() => handleAnswerChange(question.id, option)}
              >
                <Text
                  style={[
                    styles.optionText,
                    question.userAnswer === option && styles.selectedOptionText,
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {question.type === 'open' && (
          <TextInput
            style={styles.textInput}
            value={question.userAnswer || ''}
            onChangeText={(text) => handleAnswerChange(question.id, text)}
            placeholder="Type your answer here..."
            multiline
            numberOfLines={4}
            editable={!submitted}
          />
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={ACCENT_GREEN} />
        <Text style={styles.loadingText}>Loading practice questions...</Text>
      </View>
    );
  }

  if (questions.length === 0) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.emptyText}>No questions found</Text>
        <TouchableOpacity
          style={styles.backToCourseButton}
          onPress={() => {
            if (params.courseId) {
              router.replace(`/course/${params.courseId}` as any);
            } else {
              router.replace('/(tabs)/courses' as any);
            }
          }}
        >
          <Text style={styles.backToCourseButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (showReview) {
    // Review screen - show all answers
    const correctCount = answers.filter(a => a.isCorrect).length;
    
    return (
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Review Your Answers</Text>
          <Text style={styles.subtitle}>Course: {courseName}</Text>

          {score !== null && (
            <View style={styles.resultCard}>
              <Text style={styles.resultTitle}>Your Score</Text>
              <Text style={styles.scoreText}>{score}%</Text>
              <Text style={styles.resultSubtitle}>
                {correctCount} out of {questions.length} questions correct
              </Text>
            </View>
          )}

          {questions.map((q, index) => renderQuestion(q, index))}

          <View style={styles.reviewActions}>
            <TouchableOpacity
              style={styles.viewResultsButton}
              onPress={() => {
                // Use replace to remove review screen from navigation stack
                // So navigation flow is cleaner
                router.replace({
                  pathname: '/practice-results' as any,
                  params: {
                    sessionId: sessionId || '',
                    courseId: params.courseId || '',
                    courseName: courseName,
                    score: score?.toString() || '0',
                    totalQuestions: questions.length.toString(),
                    correctAnswers: correctCount.toString(),
                    language: language,
                  },
                });
              }}
            >
              <Ionicons name="stats-chart" size={20} color="#ffffff" />
              <Text style={styles.viewResultsButtonText}>View Results</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.backToCourseButton}
              onPress={() => {
                if (params.courseId) {
                  router.replace(`/course/${params.courseId}` as any);
                } else {
                  router.replace('/(tabs)/courses' as any);
                }
              }}
            >
              <Text style={styles.backToCourseButtonText}>Back to Course</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>AI Practice Test</Text>
        <View style={generationMode === 'ai' ? styles.modeBadgeAI : styles.modeBadgeFallback}>
          <Ionicons
            name={generationMode === 'ai' ? 'shield-checkmark-outline' : 'flash-outline'}
            size={14}
            color={generationMode === 'ai' ? '#065f46' : '#9a3412'}
          />
          <Text style={generationMode === 'ai' ? styles.modeBadgeAITxt : styles.modeBadgeFallbackTxt}>
            {generationMode === 'ai' ? 'AI Verified Questions' : 'Quick Fallback Questions'}
          </Text>
        </View>
        <Text style={styles.subtitle}>Course: {courseName}</Text>
        {examMode && (
          <View style={styles.examTimerBox}>
            <Ionicons name="timer-outline" size={16} color="#ef4444" />
            <Text style={styles.examTimerText}>
              Time left: {Math.floor(timeLeftSec / 60)}:{String(Math.max(0, timeLeftSec % 60)).padStart(2, '0')}
            </Text>
          </View>
        )}

        {submitted && score !== null && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Test Results</Text>
            <Text style={styles.scoreText}>{score}%</Text>
            <Text style={styles.resultSubtitle}>
              {score >= 70
                ? 'Great job! Keep practicing!'
                : score >= 50
                ? 'Good effort! Review the incorrect answers.'
                : 'Keep studying! Review the material and try again.'}
            </Text>
          </View>
        )}

        <>
          <View style={styles.adaptiveHeader}>
            <Ionicons name="list-outline" size={16} color={ACCENT_GREEN} />
            <Text style={styles.adaptiveHeaderText}>
              {adaptiveMode ? 'Adaptive' : 'Step-by-step'}: {(adaptiveMode ? adaptiveStep : linearStep) + 1}/{questions.length}
            </Text>
          </View>
          {adaptiveMode
            ? questions[adaptiveOrder[adaptiveStep]] &&
              renderQuestion(questions[adaptiveOrder[adaptiveStep]], adaptiveStep)
            : questions[linearStep] && renderQuestion(questions[linearStep], linearStep)}
        </>

        {!submitted && (
          adaptiveMode ? (
            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.buttonDisabled]}
              onPress={advanceAdaptive}
              disabled={submitting}
            >
              <Text style={styles.submitButtonText}>
                {adaptiveStep === questions.length - 1 ? 'Submit' : 'Next Adaptive Question'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.buttonDisabled]}
              onPress={advanceLinear}
              disabled={submitting}
            >
              <Text style={styles.submitButtonText}>
                {linearStep === questions.length - 1 ? 'Submit' : 'Next Question'}
              </Text>
            </TouchableOpacity>
          )
        )}
      </ScrollView>
    </View>
  );
}

const ACCENT_GREEN = '#047857';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 24,
  },
  modeBadgeAI: {
    alignSelf: 'center',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  modeBadgeAITxt: { color: '#065f46', fontSize: 12, fontWeight: '700' },
  modeBadgeFallback: {
    alignSelf: 'center',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fdba74',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  modeBadgeFallbackTxt: { color: '#9a3412', fontSize: 12, fontWeight: '700' },
  resultCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  scoreText: {
    fontSize: 48,
    fontWeight: '700',
    color: ACCENT_GREEN,
    marginBottom: 8,
  },
  resultSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  questionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  correctCard: {
    borderColor: ACCENT_GREEN,
    backgroundColor: '#f0fdf4',
    borderWidth: 2,
  },
  incorrectCard: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
    borderWidth: 2,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  correctBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  correctBadgeText: {
    color: ACCENT_GREEN,
    fontSize: 12,
    fontWeight: '600',
  },
  incorrectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  incorrectBadgeText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
  },
  answerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    marginTop: 8,
    marginBottom: 4,
  },
  correctAnswerInput: {
    backgroundColor: '#dcfce7',
    borderColor: ACCENT_GREEN,
  },
  feedbackContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  questionNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: ACCENT_GREEN,
    marginBottom: 8,
  },
  questionText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 12,
  },
  optionsContainer: {
    gap: 8,
  },
  optionButton: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  selectedOption: {
    backgroundColor: '#dbeafe',
    borderColor: '#047857',
  },
  correctOption: {
    backgroundColor: '#dcfce7',
    borderColor: '#22c55e',
  },
  optionText: {
    fontSize: 14,
    color: '#111827',
  },
  selectedOptionText: {
    color: ACCENT_GREEN,
    fontWeight: '600',
  },
  correctOptionText: {
    color: '#22c55e',
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#374151',
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 14,
    color: '#111827',
  },
  disabledInput: {
    backgroundColor: '#ffffff',
    color: '#111827',
    borderColor: '#d1d5db',
  },
  feedbackText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
  },
  correctAnswerText: {
    fontSize: 12,
    color: '#22c55e',
    fontWeight: '600',
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: ACCENT_GREEN,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  adaptiveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
  },
  adaptiveHeaderText: {
    color: '#047857',
    fontSize: 13,
    fontWeight: '700',
  },
  examTimerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  examTimerText: {
    color: '#b91c1c',
    fontSize: 13,
    fontWeight: '700',
  },
  reviewActions: {
    marginTop: 24,
    gap: 12,
  },
  viewResultsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ACCENT_GREEN,
    paddingVertical: 14,
    borderRadius: 999,
    shadowColor: ACCENT_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  viewResultsButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  backToCourseButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  backToCourseButtonText: {
    color: '#4b5563',
    fontSize: 16,
    fontWeight: '600',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#6b7280',
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

