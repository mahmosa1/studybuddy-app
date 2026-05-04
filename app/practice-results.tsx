// app/practice-results.tsx
import { db } from '@/lib/firebaseConfig';
import { getPracticeHistory, getProgressDashboard, ProgressDashboard } from '@/lib/practiceService';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
    language?: string;
  }>();

  const courseName = params.courseName || 'Course';
  const score = parseInt(params.score || '0', 10);
  const totalQuestions = parseInt(params.totalQuestions || '10', 10);
  const correctAnswers = parseInt(params.correctAnswers || '0', 10);
  const incorrectAnswers = totalQuestions - correctAnswers;
  const { i18n } = useTranslation();
  const language: 'hebrew' | 'english' = i18n.language === 'he' ? 'hebrew' : 'english';
  
  const [weakTopics, setWeakTopics] = useState<string[]>([]);
  const [dashboard, setDashboard] = useState<ProgressDashboard | null>(null);
  const [historyScores, setHistoryScores] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Language-specific text
  const texts = {
    hebrew: {
      headerTitle: 'תוצאות תרגול',
      yourScore: 'הציון שלך',
      summary: 'סיכום',
      correct: 'נכון',
      incorrect: 'לא נכון',
      total: 'סה"כ',
      topicsToImprove: 'נושאים לשיפור',
      topicsDescription: 'על פי הביצועים שלך, התמקד בנושאים הבאים לתוצאות טובות יותר:',
      practiceAgain: 'תרגל נושאים אלה שוב',
      backToCourse: 'חזור לקורס',
      excellent: 'עבודה מצוינת!',
      good: 'עבודה טובה!',
      keepStudying: 'המשך ללמוד!',
      allTopicsMastered: 'כל הנושאים נלמדו! המשך לתרגל כדי לשמור על הידע שלך.',
      reviewIncorrect: 'סקור את התשובות הלא נכונות כדי לזהות אזורים חלשים.',
    },
    english: {
      headerTitle: 'Practice Results',
      yourScore: 'Your Score',
      summary: 'Summary',
      correct: 'Correct',
      incorrect: 'Incorrect',
      total: 'Total',
      topicsToImprove: 'Topics to Improve',
      topicsDescription: 'Based on your performance, focus on these topics for better results:',
      practiceAgain: 'Practice These Topics Again',
      backToCourse: 'Back to Course',
      excellent: 'Excellent work!',
      good: 'Good effort!',
      keepStudying: 'Keep studying!',
      allTopicsMastered: 'All topics mastered! Keep practicing to maintain your knowledge.',
      reviewIncorrect: 'Review the incorrect answers to identify weak areas.',
    },
  };
  
  const t = texts[language];

  // Load language from session and weak topics
  useEffect(() => {
    const loadLanguageAndTopics = async () => {
      // UI language follows current app language selection.
      const currentLanguage: 'hebrew' | 'english' = language;
      
      // Load weak topics
      if (!params.sessionId) {
        // Fallback to mock topics if no session
        const isHebrew = currentLanguage === 'hebrew';
        if (score >= 80) {
          setWeakTopics([isHebrew ? 'כל הנושאים נלמדו! המשך לתרגל כדי לשמור על הידע שלך.' : 'All topics mastered! Keep practicing to maintain your knowledge.']);
        } else if (score >= 60) {
          setWeakTopics(isHebrew 
            ? ['אינטגרציה בחלקים', 'ניתוח מורכבות זמן']
            : ['Integration by Parts', 'Time Complexity Analysis']);
        } else {
          setWeakTopics(isHebrew
            ? [
                'אינטגרציה בחלקים',
                'ערכים עצמיים ווקטורים עצמיים',
                'מורכבות זמן',
                'מעבר על עץ בינארי',
                'תכנות דינמי',
              ]
            : [
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
        if (params.courseId) {
          const [dashData, history] = await Promise.all([
            getProgressDashboard(params.courseId),
            getPracticeHistory(params.courseId),
          ]);
          setDashboard(dashData);
          setHistoryScores(history.slice(0, 6).reverse().map((item) => item.score));
        }

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
            const isHebrew = currentLanguage === 'hebrew';
            if (score >= 80) {
              setWeakTopics([isHebrew ? 'כל הנושאים נלמדו! המשך לתרגל כדי לשמור על הידע שלך.' : 'All topics mastered! Keep practicing to maintain your knowledge.']);
            } else {
              setWeakTopics([isHebrew ? 'סקור את התשובות הלא נכונות כדי לזהות אזורים חלשים.' : 'Review the incorrect answers to identify weak areas.']);
            }
          } else {
            setWeakTopics(topics);
          }
        } else {
          // Fallback
          const isHebrew = currentLanguage === 'hebrew';
          setWeakTopics([isHebrew ? 'סקור את התשובות הלא נכונות כדי לזהות אזורים חלשים.' : 'Review the incorrect answers to identify weak areas.']);
        }
      } catch (error) {
        console.error('Error loading weak topics:', error);
        // Fallback
        const isHebrew = currentLanguage === 'hebrew';
        setWeakTopics([isHebrew ? 'סקור את התשובות הלא נכונות כדי לזהות אזורים חלשים.' : 'Review the incorrect answers to identify weak areas.']);
      } finally {
        setLoading(false);
      }
    };

    loadLanguageAndTopics();
  }, [params.sessionId, score, language]);

  const getScoreColor = () => {
    if (score >= 80) return ACCENT_GREEN;
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const getScoreMessage = () => {
    if (score >= 80) return t.excellent;
    if (score >= 60) return t.good;
    return t.keepStudying;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          // Navigate back to course or courses page, not to review
          if (params.courseId) {
            router.replace(`/course/${params.courseId}` as any);
          } else {
            router.replace('/(tabs)/courses' as any);
          }
        }}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t.headerTitle}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Score Card */}
        <View style={styles.scoreCard}>
          <Text style={styles.scoreLabel}>{t.yourScore}</Text>
          <Text style={[styles.scoreValue, { color: getScoreColor() }]}>
            {score}%
          </Text>
          <Text style={styles.scoreMessage}>{getScoreMessage()}</Text>
        </View>

        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.cardTitle}>{t.summary}</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Ionicons name="checkmark-circle" size={24} color={ACCENT_GREEN} />
              <Text style={styles.summaryNumber}>{correctAnswers}</Text>
              <Text style={styles.summaryLabel}>{t.correct}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Ionicons name="close-circle" size={24} color="#ef4444" />
              <Text style={styles.summaryNumber}>{incorrectAnswers}</Text>
              <Text style={styles.summaryLabel}>{t.incorrect}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Ionicons name="document-text" size={24} color={PRIMARY_GREEN} />
              <Text style={styles.summaryNumber}>{totalQuestions}</Text>
              <Text style={styles.summaryLabel}>{t.total}</Text>
            </View>
          </View>
        </View>

        {/* Weak Topics Section */}
        <View style={styles.weakTopicsCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="alert-circle" size={24} color="#f59e0b" />
            <Text style={styles.sectionTitle}>{t.topicsToImprove}</Text>
          </View>
          <Text style={styles.sectionDescription}>
            {t.topicsDescription}
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

        {/* Real Progress Dashboard */}
        {dashboard && (
          <View style={styles.summaryCard}>
            <Text style={styles.cardTitle}>Progress Dashboard</Text>

            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Ionicons name="speedometer-outline" size={22} color={PRIMARY_GREEN} />
                <Text style={styles.summaryNumber}>{dashboard.readinessScore}%</Text>
                <Text style={styles.summaryLabel}>Exam Readiness</Text>
              </View>
              <View style={styles.summaryItem}>
                <Ionicons
                  name={dashboard.trendDelta >= 0 ? 'trending-up-outline' : 'trending-down-outline'}
                  size={22}
                  color={dashboard.trendDelta >= 0 ? ACCENT_GREEN : '#ef4444'}
                />
                <Text style={styles.summaryNumber}>
                  {dashboard.trendDelta >= 0 ? '+' : ''}
                  {dashboard.trendDelta}
                </Text>
                <Text style={styles.summaryLabel}>Trend</Text>
              </View>
              <View style={styles.summaryItem}>
                <Ionicons name="podium-outline" size={22} color="#3b82f6" />
                <Text style={styles.summaryNumber}>{dashboard.courseRankingPercentile}%</Text>
                <Text style={styles.summaryLabel}>Course Ranking</Text>
              </View>
            </View>

            {historyScores.length > 0 && (
              <View style={styles.trendChartWrap}>
                <Text style={styles.chartTitle}>Score Improvement</Text>
                <View style={styles.chartBars}>
                  {historyScores.map((value, idx) => (
                    <View key={`${idx}-${value}`} style={styles.chartBarContainer}>
                      <View style={[styles.chartBar, { height: Math.max(8, value), backgroundColor: value >= 70 ? ACCENT_GREEN : '#f59e0b' }]} />
                      <Text style={styles.chartLabel}>{value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {dashboard.topicPerformance.length > 0 && (
              <View style={styles.topicAccuracyWrap}>
                <Text style={styles.chartTitle}>Accuracy by Topic</Text>
                {dashboard.topicPerformance.slice(0, 4).map((topic) => (
                  <View key={topic.topic} style={styles.topicAccuracyRow}>
                    <Text style={styles.topicAccuracyName}>{topic.topic}</Text>
                    <View style={styles.topicAccuracyTrack}>
                      <View
                        style={[
                          styles.topicAccuracyFill,
                          {
                            width: `${Math.max(4, topic.accuracy)}%`,
                            backgroundColor: topic.accuracy >= 70 ? ACCENT_GREEN : '#ef4444',
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.topicAccuracyValue}>{topic.accuracy}%</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

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
            <Text style={styles.primaryButtonText}>{t.practiceAgain}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              if (params.courseId) {
                // Use replace to remove practice-results from navigation stack
                // So when user presses back in course, they go to courses page, not practice-results
                router.replace(`/course/${params.courseId}` as any);
              } else {
                router.replace('/(tabs)/courses' as any);
              }
            }}
          >
            <Text style={styles.secondaryButtonText}>{t.backToCourse}</Text>
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
  trendChartWrap: {
    marginTop: 16,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 120,
    paddingHorizontal: 4,
  },
  chartBarContainer: {
    alignItems: 'center',
    width: 28,
  },
  chartBar: {
    width: 20,
    borderRadius: 8,
  },
  chartLabel: {
    marginTop: 4,
    fontSize: 11,
    color: '#6b7280',
  },
  topicAccuracyWrap: {
    marginTop: 16,
    gap: 8,
  },
  topicAccuracyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topicAccuracyName: {
    width: 90,
    fontSize: 12,
    color: '#111827',
  },
  topicAccuracyTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
  },
  topicAccuracyFill: {
    height: '100%',
  },
  topicAccuracyValue: {
    width: 34,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
});

