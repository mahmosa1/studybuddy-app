// app/ai-practice-test.tsx
import { evaluateOpenAnswer, PracticeQuestion } from '@/lib/aiService';
import { db } from '@/lib/firebaseConfig';
import { PracticeAnswer, savePracticeResults } from '@/lib/practiceService';
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
  }>();

  const courseName = params.courseName || 'Course';
  const sessionId = params.sessionId;
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
        
        setQuestions(loadedQuestions.map(q => ({ ...q, userAnswer: undefined })));
      } catch (error) {
        console.error('Error loading questions:', error);
        Alert.alert('Error', 'Failed to load practice questions');
      } finally {
        setLoading(false);
      }
    };

    loadQuestions();
  }, [sessionId]);

  const handleAnswerChange = (questionId: string, answer: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId ? { ...q, userAnswer: answer } : q
      )
    );
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
          const userAns = question.userAnswer?.trim().toLowerCase() || '';
          const correctAns = question.correctAnswer?.trim().toLowerCase() || '';
          isCorrect = userAns === correctAns;
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

      // Navigate to results screen
      setTimeout(() => {
        router.push({
          pathname: '/practice-results' as any,
          params: {
            sessionId: sessionId,
            courseId: params.courseId || '',
            courseName: courseName,
            score: percentage.toString(),
            totalQuestions: questions.length.toString(),
            correctAnswers: correctCount.toString(),
          },
        });
      }, 1500);
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

  const renderQuestion = (question: Question, index: number) => {
    if (submitted && question.userAnswer !== question.correctAnswer) {
      // Show incorrect answers after submission
      return (
        <View
          key={question.id}
          style={[
            styles.questionCard,
            styles.incorrectCard,
          ]}
        >
          <Text style={styles.questionNumber}>Question {index + 1}</Text>
          <Text style={styles.questionText}>{question.question}</Text>

          {question.type === 'true-false' && (
            <View style={styles.optionsContainer}>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  question.userAnswer === 'True' && styles.selectedOption,
                  question.correctAnswer === 'True' && styles.correctOption,
                ]}
                disabled
              >
                <Text
                  style={[
                    styles.optionText,
                    question.userAnswer === 'True' && styles.selectedOptionText,
                    question.correctAnswer === 'True' && styles.correctOptionText,
                  ]}
                >
                  True
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  question.userAnswer === 'False' && styles.selectedOption,
                  question.correctAnswer === 'False' && styles.correctOption,
                ]}
                disabled
              >
                <Text
                  style={[
                    styles.optionText,
                    question.userAnswer === 'False' && styles.selectedOptionText,
                    question.correctAnswer === 'False' && styles.correctOptionText,
                  ]}
                >
                  False
                </Text>
              </TouchableOpacity>
            </View>
          )}

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
            <TextInput
              style={[styles.textInput, styles.disabledInput]}
              value={question.userAnswer || ''}
              placeholder="Your answer..."
              multiline
              editable={false}
            />
          )}

          <Text style={styles.feedbackText}>
            Your answer: {question.userAnswer || 'Not answered'}
          </Text>
          <Text style={styles.correctAnswerText}>
            Correct answer: {question.correctAnswer}
          </Text>
        </View>
      );
    }

    return (
      <View key={question.id} style={styles.questionCard}>
        <Text style={styles.questionNumber}>Question {index + 1}</Text>
        <Text style={styles.questionText}>{question.question}</Text>

        {question.type === 'true-false' && (
          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={[
                styles.optionButton,
                question.userAnswer === 'True' && styles.selectedOption,
              ]}
              onPress={() => handleAnswerChange(question.id, 'True')}
            >
              <Text
                style={[
                  styles.optionText,
                  question.userAnswer === 'True' && styles.selectedOptionText,
                ]}
              >
                True
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.optionButton,
                question.userAnswer === 'False' && styles.selectedOption,
              ]}
              onPress={() => handleAnswerChange(question.id, 'False')}
            >
              <Text
                style={[
                  styles.optionText,
                  question.userAnswer === 'False' && styles.selectedOptionText,
                ]}
              >
                False
              </Text>
            </TouchableOpacity>
          </View>
        )}

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
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
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
        <Text style={styles.subtitle}>Course: {courseName}</Text>

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

        {questions.map((q, index) => renderQuestion(q, index))}

        {!submitted && (
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <ActivityIndicator color="#ffffff" size="small" style={{ marginRight: 8 }} />
                <Text style={styles.submitButtonText}>Submitting...</Text>
              </>
            ) : (
              <Text style={styles.submitButtonText}>Submit</Text>
            )}
          </TouchableOpacity>
        )}

        {submitted && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Back to Setup</Text>
          </TouchableOpacity>
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
  incorrectCard: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
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
    backgroundColor: '#374151',
    color: '#6b7280',
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
  backButton: {
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  backButtonText: {
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

