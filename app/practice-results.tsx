// app/practice-results.tsx
import { db } from '@/lib/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

const PRIMARY_GREEN = '#047857';
const ACCENT_GREEN = '#10b981';

export default function PracticeResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    sessionId?: string;
    courseId?: string;
    courseName?: string;
    score?: string;
    totalQuestions?: string;
    correctAnswers?: string;
  }>();

  const courseName = params.courseName || 'Course';
  const score = parseInt(params.score || '0', 10);
  const totalQuestions = parseInt(params.totalQuestions || '10', 10);
  const correctAnswers = parseInt(params.correctAnswers || '0', 10);
  const incorrectAnswers = totalQuestions - correctAnswers;
  
  const [weakTopics, setWeakTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Load weak topics from practice results
  useEffect(() => {
    const loadWeakTopics = async () => {
      if (!params.sessionId) {
        // Fallback to mock topics if no session
        if (score >= 80) {
          setWeakTopics(['All topics mastered! Keep practicing to maintain your knowledge.']);
        } else if (score >= 60) {
          setWeakTopics(['Integration by Parts', 'Time Complexity Analysis']);
        } else {
          setWeakTopics([
            'Integration by Parts',
            'Eigenvalues and Eigenvectors',
            'Time Complexity',
            'Binary Tree Traversal',
            'Dynamic Programming',
          ]);
        }
        setLoading(false);
        return;
      }

      try {
        // Get practice results from Firestore
        const resultsRef = collection(db, 'practiceResults');
        const q = query(
          resultsRef,
          where('sessionId', '==', params.sessionId)
        );
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          const resultData = snapshot.docs[0].data();
          const topics = resultData.weakTopics || [];
          
          if (topics.length === 0) {
            // Fallback if no weak topics
            if (score >= 80) {
              setWeakTopics(['All topics mastered! Keep practicing to maintain your knowledge.']);
            } else {
              setWeakTopics(['Review the incorrect answers to identify weak areas.']);
            }
          } else {
            setWeakTopics(topics);
          }
        } else {
          // Fallback
          setWeakTopics(['Review the incorrect answers to identify weak areas.']);
        }
      } catch (error) {
        console.error('Error loading weak topics:', error);
        // Fallback
        setWeakTopics(['Review the incorrect answers to identify weak areas.']);
      } finally {
        setLoading(false);
      }
    };

    loadWeakTopics();
  }, [params.sessionId, score]);

  const getScoreColor = () => {
    if (score >= 80) return ACCENT_GREEN;
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const getScoreMessage = () => {
    if (score >= 80) return 'Excellent work!';
    if (score >= 60) return 'Good effort!';
    return 'Keep studying!';
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Practice Results</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Score Card */}
        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>Your Score</Text>
          <Text style={[styles.scoreValue, { color: getScoreColor() }]}>
            {score}%
          </Text>
          <Text style={styles.scoreMessage}>{getScoreMessage()}</Text>
        </View>

        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.cardTitle}>Summary</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Ionicons name="checkmark-circle" size={24} color={ACCENT_GREEN} />
              <Text style={styles.summaryNumber}>{correctAnswers}</Text>
              <Text style={styles.summaryLabel}>Correct</Text>
            </View>
            <View style={styles.summaryItem}>
              <Ionicons name="close-circle" size={24} color="#ef4444" />
              <Text style={styles.summaryNumber}>{incorrectAnswers}</Text>
              <Text style={styles.summaryLabel}>Incorrect</Text>
            </View>
            <View style={styles.summaryItem}>
              <Ionicons name="document-text" size={24} color={PRIMARY_GREEN} />
              <Text style={styles.summaryNumber}>{totalQuestions}</Text>
              <Text style={styles.summaryLabel}>Total</Text>
            </View>
          </View>
        </View>

        {/* Weak Topics Section */}
        <View style={styles.weakTopicsCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="alert-circle" size={24} color="#f59e0b" />
            <Text style={styles.sectionTitle}>Topics to Improve</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Based on your performance, focus on these topics for better results:
          </Text>
          <View style={styles.topicsList}>
            {weakTopics.map((topic, index) => (
              <View key={index} style={styles.topicItem}>
                <Ionicons name="bookmark-outline" size={18} color={PRIMARY_GREEN} />
                <Text style={styles.topicText}>{topic}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              // Mock: navigate to practice these topics
              router.push({
                pathname: '/ai-practice-setup' as any,
                params: {
                  courseId: params.courseId || '',
                  courseName: courseName,
                },
              });
            }}
          >
            <Ionicons name="refresh" size={20} color="#ffffff" />
            <Text style={styles.primaryButtonText}>Practice These Topics Again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              if (params.courseId) {
                router.push(`/course/${params.courseId}` as any);
              } else {
                router.push('/(tabs)/courses' as any);
              }
            }}
          >
            <Text style={styles.secondaryButtonText}>Back to Course</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  content: {
    flex: 1,
  },
  scoreCard: {
    backgroundColor: '#ffffff',
    margin: 20,
    padding: 32,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  scoreLabel: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 64,
    fontWeight: '700',
    marginBottom: 8,
  },
  scoreMessage: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
    gap: 8,
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  weakTopicsCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  topicsList: {
    gap: 12,
  },
  topicItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: PRIMARY_GREEN,
  },
  topicText: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  actionsContainer: {
    padding: 20,
    paddingBottom: 40,
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: PRIMARY_GREEN,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: PRIMARY_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  secondaryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
});

