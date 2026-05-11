// app/ai-practice-test.tsx
import { evaluateOpenAnswer, PracticeQuestion } from '@/lib/aiService';
import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { EmptyState } from '@/frontend/components/ui/EmptyState';
import { LoadingState } from '@/frontend/components/ui/LoadingState';
import { PrimaryButton } from '@/frontend/components/ui/PrimaryButton';
import { iconContainer, layout, radius, spacing, typography } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { db } from '@/lib/firebaseConfig';
import { PracticeAnswer, savePracticeResults } from '@/lib/practiceService';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
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

type Question = PracticeQuestion & {
  userAnswer?: string;
};

export default function AIPracticeTestScreen() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);
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
  const appLanguage: 'hebrew' | 'english' = i18n.language === 'he' ? 'hebrew' : 'english';
  const uiText = appLanguage === 'hebrew'
    ? {
        error: 'שגיאה',
        warning: 'אזהרה',
        sessionMissing: 'מזהה הסשן חסר',
        sessionNotFound: 'סשן התרגול לא נמצא',
        loadFailed: 'טעינת שאלות התרגול נכשלה',
        answerCurrentFirst: 'נא לענות קודם על השאלה הנוכחית.',
        sessionMissingStartNew: 'מזהה הסשן חסר. יש להתחיל סשן תרגול חדש.',
        noQuestionsFoundStartNew: 'לא נמצאו שאלות. יש להתחיל סשן תרגול חדש.',
        saveWarningBody: 'לא ניתן היה לשמור את התוצאות: {{msg}}\n\nעדיין אפשר לראות את הציון, אבל הוא לא יישמר בהיסטוריית התרגול.',
        submitFailed: 'שליחת התרגול נכשלה. נסה/י שוב.',
        question: 'שאלה',
        correct: 'נכון',
        incorrect: 'לא נכון',
        yourAnswer: 'התשובה שלך:',
        yourAnswerPlaceholder: 'התשובה שלך...',
        correctAnswer: 'תשובה נכונה:',
        correctAnswerPlaceholder: 'תשובה נכונה...',
        notAnswered: 'לא נענה',
        typeYourAnswer: 'כתוב/כתבי את התשובה כאן...',
        loadingQuestions: 'טוען שאלות תרגול...',
        noQuestions: 'לא נמצאו שאלות',
        goBack: 'חזרה',
        reviewAnswers: 'סקירת תשובות',
        coursePrefix: 'קורס: {{course}}',
        yourScore: 'הציון שלך',
        outOfCorrect: '{{correct}} מתוך {{total}} תשובות נכונות',
        viewResults: 'הצג תוצאות',
        backToCourse: 'חזרה לקורס',
        practiceTitle: 'מבחן תרגול AI',
        aiVerified: 'שאלות מאומתות AI',
        fallbackQuestions: 'שאלות מהירות חלופיות',
        timeLeft: 'זמן שנותר: {{time}}',
        testResults: 'תוצאות מבחן',
        excellent: 'מעולה! המשך/י כך!',
        good: 'עבודה טובה! מומלץ לעבור על התשובות השגויות.',
        keepStudying: 'המשך/י ללמוד! עבר/י שוב על החומר ונסה/י שוב.',
        adaptiveStep: 'אדפטיבי',
        linearStep: 'שלב-שלב',
        submit: 'סיום ושליחה',
        nextAdaptive: 'לשאלה האדפטיבית הבאה',
        nextQuestion: 'לשאלה הבאה',
      }
    : {
        error: 'Error',
        warning: 'Warning',
        sessionMissing: 'Session ID missing',
        sessionNotFound: 'Practice session not found',
        loadFailed: 'Failed to load practice questions',
        answerCurrentFirst: 'Please answer the current question first.',
        sessionMissingStartNew: 'Session ID missing. Please start a new practice session.',
        noQuestionsFoundStartNew: 'No questions found. Please start a new practice session.',
        saveWarningBody: `Results could not be saved: {{msg}}\n\nYou can still view your score, but it won't be saved to your practice history.`,
        submitFailed: 'Failed to submit practice. Please try again.',
        question: 'Question',
        correct: 'Correct',
        incorrect: 'Incorrect',
        yourAnswer: 'Your answer:',
        yourAnswerPlaceholder: 'Your answer...',
        correctAnswer: 'Correct answer:',
        correctAnswerPlaceholder: 'Correct answer...',
        notAnswered: 'Not answered',
        typeYourAnswer: 'Type your answer here...',
        loadingQuestions: 'Loading practice questions...',
        noQuestions: 'No questions found',
        goBack: 'Go Back',
        reviewAnswers: 'Review Your Answers',
        coursePrefix: 'Course: {{course}}',
        yourScore: 'Your Score',
        outOfCorrect: '{{correct}} out of {{total}} questions correct',
        viewResults: 'View Results',
        backToCourse: 'Back to Course',
        practiceTitle: 'AI Practice Test',
        aiVerified: 'AI Verified Questions',
        fallbackQuestions: 'Quick Fallback Questions',
        timeLeft: 'Time left: {{time}}',
        testResults: 'Test Results',
        excellent: 'Great job! Keep practicing!',
        good: 'Good effort! Review the incorrect answers.',
        keepStudying: 'Keep studying! Review the material and try again.',
        adaptiveStep: 'Adaptive',
        linearStep: 'Step-by-step',
        submit: 'Submit',
        nextAdaptive: 'Next Adaptive Question',
        nextQuestion: 'Next Question',
      };

  const navigateBackToCourse = () => {
    if (params.courseId) {
      router.replace(`/course/${params.courseId}` as any);
    } else {
      router.replace('/(tabs)/courses' as any);
    }
  };

  // Load questions from session
  useEffect(() => {
    const loadQuestions = async () => {
      if (!sessionId) {
        // Fallback: use mock questions if no session
        Alert.alert(uiText.error, uiText.sessionMissing);
        setLoading(false);
        return;
      }

      try {
        const sessionDoc = await getDoc(doc(db, 'practiceSessions', sessionId));
        if (!sessionDoc.exists()) {
          Alert.alert(uiText.error, uiText.sessionNotFound);
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
        Alert.alert(uiText.error, uiText.loadFailed);
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
      Alert.alert(uiText.error, uiText.answerCurrentFirst);
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
      Alert.alert(uiText.error, uiText.answerCurrentFirst);
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
      Alert.alert(uiText.error, uiText.sessionMissingStartNew);
      return;
    }

    if (questions.length === 0) {
      Alert.alert(uiText.error, uiText.noQuestionsFoundStartNew);
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
          uiText.warning,
          uiText.saveWarningBody.replace('{{msg}}', errorMessage),
          [{ text: 'OK' }]
        );
      }

      // Show review screen instead of navigating immediately
      setShowReview(true);
    } catch (error: any) {
      console.error('Error submitting practice:', error);
      Alert.alert(
        uiText.error,
        error.message || uiText.submitFailed
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
        <AppCard
          key={question.id}
          style={[
            styles.questionCard,
            isCorrect ? styles.correctCard : styles.incorrectCard,
          ]}
        >
          <View style={styles.questionHeader}>
            <Text style={styles.questionNumber}>{uiText.question} {index + 1}</Text>
            {isCorrect ? (
              <View style={styles.correctBadge}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text style={styles.correctBadgeText}>{uiText.correct}</Text>
              </View>
            ) : (
              <View style={styles.incorrectBadge}>
                <Ionicons name="close-circle" size={20} color={colors.danger} />
                <Text style={styles.incorrectBadgeText}>{uiText.incorrect}</Text>
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
                    userSelectedTrue && styles.reviewSelectedOption,
                    correctIsTrue && styles.reviewCorrectOption,
                  ]}
                  disabled
                >
                  <Text
                    style={[
                      styles.optionText,
                      userSelectedTrue && styles.reviewSelectedOptionText,
                      correctIsTrue && styles.reviewCorrectOptionText,
                    ]}
                  >
                    {trueLabel}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.optionButton,
                    userSelectedFalse && styles.reviewSelectedOption,
                    correctIsFalse && styles.reviewCorrectOption,
                  ]}
                  disabled
                >
                  <Text
                    style={[
                      styles.optionText,
                      userSelectedFalse && styles.reviewSelectedOptionText,
                      correctIsFalse && styles.reviewCorrectOptionText,
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
                    question.userAnswer === option && styles.reviewSelectedOption,
                    question.correctAnswer === option && styles.reviewCorrectOption,
                  ]}
                  disabled
                >
                  <Text
                    style={[
                      styles.optionText,
                      question.userAnswer === option && styles.reviewSelectedOptionText,
                      question.correctAnswer === option && styles.reviewCorrectOptionText,
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
              <Text style={styles.answerLabel}>{uiText.yourAnswer}</Text>
              <TextInput
                style={[styles.textInput, styles.disabledInput]}
                value={question.userAnswer || ''}
                placeholder={uiText.yourAnswerPlaceholder}
                multiline
                editable={false}
              />
              <Text style={styles.answerLabel}>{uiText.correctAnswer}</Text>
              <TextInput
                style={[styles.textInput, styles.disabledInput, styles.correctAnswerInput]}
                value={question.correctAnswer || ''}
                placeholder={uiText.correctAnswerPlaceholder}
                multiline
                editable={false}
              />
            </>
          )}

          {!isCorrect && (
            <View style={styles.feedbackContainer}>
              <Text style={styles.feedbackText}>
                {uiText.yourAnswer} {question.userAnswer || uiText.notAnswered}
              </Text>
              <Text style={styles.correctAnswerText}>
                {uiText.correctAnswer} {question.correctAnswer}
              </Text>
            </View>
          )}
        </AppCard>
      );
    }

    return (
      <AppCard key={question.id} style={styles.questionCard}>
        <Text style={styles.questionNumber}>{uiText.question} {index + 1}</Text>
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
            placeholder={uiText.typeYourAnswer}
            multiline
            numberOfLines={4}
            editable={!submitted}
          />
        )}
      </AppCard>
    );
  };

  if (loading) {
    return (
      <AppScreen>
        <LoadingState label={uiText.loadingQuestions} />
      </AppScreen>
    );
  }

  if (questions.length === 0) {
    return (
      <AppScreen>
        <View style={styles.emptyWrap}>
          <EmptyState title={uiText.noQuestions} subtitle={uiText.coursePrefix.replace('{{course}}', courseName)} />
          <PrimaryButton label={uiText.goBack} variant="secondary" onPress={navigateBackToCourse} style={styles.emptyButton} />
        </View>
      </AppScreen>
    );
  }

  if (showReview) {
    // Review screen - show all answers
    const correctCount = answers.filter(a => a.isCorrect).length;
    
    return (
      <AppScreen>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.sessionWrap}>
            <View style={styles.sessionGlowPrimary} />
            <View style={styles.sessionGlowAccent} />
            <Text style={styles.title}>{uiText.reviewAnswers}</Text>
            <Text style={styles.subtitle}>{uiText.coursePrefix.replace('{{course}}', courseName)}</Text>
          </View>

          {score !== null && (
            <AppCard style={styles.resultCard}>
              <View style={styles.cardAccentBar} />
              <Text style={styles.resultTitle}>{uiText.yourScore}</Text>
              <Text style={styles.scoreText}>{score}%</Text>
              <Text style={styles.resultSubtitle}>
                {uiText.outOfCorrect
                  .replace('{{correct}}', String(correctCount))
                  .replace('{{total}}', String(questions.length))}
              </Text>
            </AppCard>
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
              <Ionicons name="stats-chart" size={20} color={colors.textOnPrimary} />
              <Text style={styles.viewResultsButtonText}>{uiText.viewResults}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.backToCourseButton}
              onPress={navigateBackToCourse}
            >
              <Text style={styles.backToCourseButtonText}>{uiText.backToCourse}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sessionWrap}>
          <View style={styles.sessionGlowPrimary} />
          <View style={styles.sessionGlowAccent} />
          <Text style={styles.title}>{uiText.practiceTitle}</Text>
          <View style={generationMode === 'ai' ? styles.modeBadgeAI : styles.modeBadgeFallback}>
            <Ionicons
              name={generationMode === 'ai' ? 'shield-checkmark-outline' : 'flash-outline'}
              size={14}
              color={generationMode === 'ai' ? colors.accent : colors.warning}
            />
            <Text style={generationMode === 'ai' ? styles.modeBadgeAITxt : styles.modeBadgeFallbackTxt}>
              {generationMode === 'ai' ? uiText.aiVerified : uiText.fallbackQuestions}
            </Text>
          </View>
          <Text style={styles.subtitle}>{uiText.coursePrefix.replace('{{course}}', courseName)}</Text>
        </View>

        {examMode && (
          <View style={styles.examTimerBox}>
            <Ionicons name="timer-outline" size={16} color={colors.danger} />
            <Text style={styles.examTimerText}>
              {uiText.timeLeft.replace(
                '{{time}}',
                `${Math.floor(timeLeftSec / 60)}:${String(Math.max(0, timeLeftSec % 60)).padStart(2, '0')}`
              )}
            </Text>
          </View>
        )}

        {submitted && score !== null && (
          <AppCard style={styles.resultCard}>
            <View style={styles.cardAccentBar} />
            <Text style={styles.resultTitle}>{uiText.testResults}</Text>
            <Text style={styles.scoreText}>{score}%</Text>
            <Text style={styles.resultSubtitle}>
              {score >= 70
                ? uiText.excellent
                : score >= 50
                ? uiText.good
                : uiText.keepStudying}
            </Text>
          </AppCard>
        )}

        <>
          <View style={styles.adaptiveHeader}>
            <View style={styles.iconBadge}>
              <Ionicons name="list-outline" size={16} color={colors.primary} />
            </View>
            <Text style={styles.adaptiveHeaderText}>
              {adaptiveMode ? uiText.adaptiveStep : uiText.linearStep}: {(adaptiveMode ? adaptiveStep : linearStep) + 1}/{questions.length}
            </Text>
          </View>
          {adaptiveMode
            ? questions[adaptiveOrder[adaptiveStep]] &&
              renderQuestion(questions[adaptiveOrder[adaptiveStep]], adaptiveStep)
            : questions[linearStep] && renderQuestion(questions[linearStep], linearStep)}
        </>

        {!submitted && (
          adaptiveMode ? (
            <PrimaryButton
              style={styles.submitButton}
              onPress={advanceAdaptive}
              disabled={submitting}
              label={adaptiveStep === questions.length - 1 ? uiText.submit : uiText.nextAdaptive}
            />
          ) : (
            <PrimaryButton
              style={styles.submitButton}
              onPress={advanceLinear}
              disabled={submitting}
              label={linearStep === questions.length - 1 ? uiText.submit : uiText.nextQuestion}
            />
          )
        )}
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
  emptyButton: {
    marginTop: spacing.md,
  },
  sessionWrap: {
    position: 'relative',
    overflow: 'hidden',
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sessionGlowPrimary: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    top: -100,
    right: -50,
    backgroundColor: colors.primary,
    opacity: 0.08,
  },
  sessionGlowAccent: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    bottom: -70,
    left: -25,
    backgroundColor: colors.accent,
    opacity: 0.08,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  modeBadgeAI: {
    alignSelf: 'center',
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  modeBadgeAITxt: { color: colors.textPrimary, fontSize: 12, fontWeight: '700' },
  modeBadgeFallback: {
    alignSelf: 'center',
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  modeBadgeFallbackTxt: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  cardAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.accent,
    opacity: 0.4,
  },
  resultCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  resultTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  scoreText: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  resultSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  questionCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  correctCard: {
    borderColor: colors.success,
    backgroundColor: colors.surface,
    borderWidth: 1,
  },
  incorrectCard: {
    borderColor: colors.dangerBorder,
    backgroundColor: colors.surface,
    borderWidth: 1,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  correctBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.success,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  correctBadgeText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '700',
  },
  incorrectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  incorrectBadgeText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '700',
  },
  answerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  correctAnswerInput: {
    backgroundColor: colors.surface,
    borderColor: colors.success,
  },
  feedbackContainer: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  questionNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  questionText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  optionsContainer: {
    gap: spacing.sm,
  },
  optionButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedOption: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  correctOption: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.success,
  },
  reviewSelectedOption: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  reviewCorrectOption: {
    backgroundColor: colors.surface,
    borderColor: colors.success,
  },
  optionText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  selectedOptionText: {
    color: colors.textOnPrimary,
    fontWeight: '700',
  },
  correctOptionText: {
    color: colors.success,
    fontWeight: '700',
  },
  reviewSelectedOptionText: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  reviewCorrectOptionText: {
    color: colors.success,
    fontWeight: '700',
  },
  textInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 100,
    textAlignVertical: 'top',
    fontSize: 14,
    color: colors.textPrimary,
  },
  disabledInput: {
    backgroundColor: colors.surfaceMuted,
    color: colors.textPrimary,
    borderColor: colors.border,
  },
  feedbackText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  correctAnswerText: {
    fontSize: 12,
    color: colors.success,
    fontWeight: '700',
    marginTop: 4,
  },
  submitButton: {
    marginTop: spacing.xs,
  },
  adaptiveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  iconBadge: {
    width: iconContainer.size,
    height: iconContainer.size,
    borderRadius: iconContainer.radius,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adaptiveHeaderText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  examTimerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.dangerSurface,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: radius.md,
    paddingVertical: 8,
    marginBottom: spacing.sm,
  },
  examTimerText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  reviewActions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  viewResultsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: radius.pill,
  },
  viewResultsButtonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  backToCourseButton: {
    backgroundColor: colors.surface,
    paddingVertical: 14,
    borderRadius: radius.pill,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  backToCourseButtonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

