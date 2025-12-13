// app/ai-practice-test.tsx
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type Question = {
  id: string;
  question: string;
  type: 'true-false' | 'open' | 'multiple-choice';
  options?: string[];
  correctAnswer?: string;
  userAnswer?: string;
};

// Mock AI-generated questions - replace with real AI integration later
const generateMockQuestions = (
  courseName: string,
  practiceType: string,
  numQuestions: number
): Question[] => {
  const questions: Question[] = [];
  const types = practiceType === 'mixed' 
    ? ['true-false', 'open', 'multiple-choice']
    : practiceType === 'true-false'
    ? ['true-false']
    : ['open'];

  for (let i = 0; i < numQuestions; i++) {
    const type = types[i % types.length] as Question['type'];
    const qNum = i + 1;

    if (type === 'true-false') {
      questions.push({
        id: `q${qNum}`,
        question: `${courseName} - Question ${qNum}: This is a true/false question about ${courseName}. The answer is ${i % 2 === 0 ? 'True' : 'False'}.`,
        type: 'true-false',
        correctAnswer: i % 2 === 0 ? 'True' : 'False',
      });
    } else if (type === 'open') {
      questions.push({
        id: `q${qNum}`,
        question: `${courseName} - Question ${qNum}: Explain a key concept from ${courseName} in your own words.`,
        type: 'open',
        correctAnswer: 'Sample answer (AI will evaluate this later)',
      });
    } else {
      questions.push({
        id: `q${qNum}`,
        question: `${courseName} - Question ${qNum}: What is the main topic of ${courseName}?`,
        type: 'multiple-choice',
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: 'Option A',
      });
    }
  }

  return questions;
};

export default function AIPracticeTestScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    courseId?: string;
    courseName?: string;
    practiceType?: string;
    numQuestions?: string;
  }>();

  const courseName = params.courseName || 'Course';
  const practiceType = params.practiceType || 'mixed';
  const numQuestions = parseInt(params.numQuestions || '10', 10);

  const [questions, setQuestions] = useState<Question[]>(() =>
    generateMockQuestions(courseName, practiceType, numQuestions)
  );
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);

  const handleAnswerChange = (questionId: string, answer: string) => {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId ? { ...q, userAnswer: answer } : q
      )
    );
  };

  const handleSubmit = () => {
    // Mock scoring - replace with real AI evaluation later
    let correct = 0;
    questions.forEach((q) => {
      if (q.type === 'true-false' || q.type === 'multiple-choice') {
        if (q.userAnswer === q.correctAnswer) {
          correct++;
        }
      } else {
        // For open questions, just mark as answered (AI will evaluate later)
        if (q.userAnswer && q.userAnswer.trim().length > 0) {
          correct++;
        }
      }
    });

    const percentage = Math.round((correct / questions.length) * 100);
    setScore(percentage);
    setSubmitted(true);
    
    // Navigate to results screen after a brief delay
    setTimeout(() => {
      router.push({
        pathname: '/practice-results' as any,
        params: {
          courseId: params.courseId || '',
          courseName: courseName,
          score: percentage.toString(),
          totalQuestions: questions.length.toString(),
          correctAnswers: correct.toString(),
        },
      });
    }, 1500);
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
            style={styles.submitButton}
            onPress={handleSubmit}
          >
            <Text style={styles.submitButtonText}>Submit</Text>
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
});

