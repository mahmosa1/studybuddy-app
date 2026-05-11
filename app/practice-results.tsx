// app/practice-results.tsx
import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppHeader } from '@/frontend/components/ui/AppHeader';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { PrimaryButton } from '@/frontend/components/ui/PrimaryButton';
import { StatCard } from '@/frontend/components/ui/StatCard';
import { iconContainer, layout, radius, spacing, typography, ThemeColors } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { db } from '@/lib/firebaseConfig';
import { getPracticeHistory, getProgressDashboard, ProgressDashboard } from '@/lib/practiceService';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function PracticeResultsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);
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

  useEffect(() => {
    const loadLanguageAndTopics = async () => {
      const currentLanguage: 'hebrew' | 'english' = language;

      if (!params.sessionId) {
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
          const isHebrew = currentLanguage === 'hebrew';
          setWeakTopics([isHebrew ? 'סקור את התשובות הלא נכונות כדי לזהות אזורים חלשים.' : 'Review the incorrect answers to identify weak areas.']);
        }
      } catch (error) {
        console.error('Error loading weak topics:', error);
        const isHebrew = currentLanguage === 'hebrew';
        setWeakTopics([isHebrew ? 'סקור את התשובות הלא נכונות כדי לזהות אזורים חלשים.' : 'Review the incorrect answers to identify weak areas.']);
      }
    };

    loadLanguageAndTopics();
  }, [params.sessionId, score, language]);

  const getScoreColor = () => {
    if (score >= 80) return colors.primary;
    if (score >= 60) return colors.warning;
    return colors.danger;
  };

  const getScoreMessage = () => {
    if (score >= 80) return t.excellent;
    if (score >= 60) return t.good;
    return t.keepStudying;
  };

  const navigateBack = () => {
    if (params.courseId) {
      router.replace(`/course/${params.courseId}` as any);
    } else {
      router.replace('/(tabs)/courses' as any);
    }
  };

  return (
    <AppScreen>
      <AppHeader title={t.headerTitle} onBack={navigateBack} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroWrap}>
          <View style={styles.heroGlowPrimary} />
          <View style={styles.heroGlowAccent} />
          <View style={styles.heroBadge}>
            <Ionicons name="stats-chart-outline" size={14} color={colors.accent} />
            <Text style={styles.heroBadgeText}>{t.headerTitle}</Text>
          </View>
          <Text style={styles.heroCourseName} numberOfLines={2}>
            {courseName}
          </Text>
        </View>

        <AppCard style={styles.scoreCard}>
          <View style={[styles.accentLine, { backgroundColor: colors.primary }]} />
          <Text style={styles.scoreLabel}>{t.yourScore}</Text>
          <Text style={[styles.scoreValue, { color: getScoreColor() }]}>
            {score}%
          </Text>
          <Text style={styles.scoreMessage}>{getScoreMessage()}</Text>
        </AppCard>

        <AppCard style={styles.sectionCard}>
          <View style={[styles.accentLine, { backgroundColor: colors.primary }]} />
          <Text style={styles.cardTitle}>{t.summary}</Text>
          <View style={styles.statRow}>
            <StatCard value={correctAnswers} label={t.correct} style={styles.statCell} />
            <StatCard value={incorrectAnswers} label={t.incorrect} style={styles.statCell} />
            <StatCard value={totalQuestions} label={t.total} style={styles.statCell} />
          </View>
        </AppCard>

        <AppCard style={styles.sectionCard}>
          <View style={[styles.accentLine, { backgroundColor: colors.warning }]} />
          <View style={styles.sectionHeader}>
            <View style={styles.iconBadge}>
              <Ionicons name="alert-circle" size={18} color={colors.warning} />
            </View>
            <Text style={styles.cardTitleFlat}>{t.topicsToImprove}</Text>
          </View>
          <Text style={styles.sectionDescription}>{t.topicsDescription}</Text>
          <View style={styles.topicsList}>
            {weakTopics.map((topic, index) => (
              <View key={index} style={styles.topicItem}>
                <View style={styles.topicIconWrap}>
                  <Ionicons name="bookmark-outline" size={16} color={colors.textSecondary} />
                </View>
                <Text style={styles.topicText}>{topic}</Text>
              </View>
            ))}
          </View>
        </AppCard>

        {dashboard && (
          <AppCard style={styles.sectionCard}>
            <View style={[styles.accentLine, { backgroundColor: colors.accent }]} />
            <Text style={styles.cardTitle}>Progress Dashboard</Text>

            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Ionicons name="speedometer-outline" size={22} color={colors.primary} />
                <Text style={styles.summaryNumber}>{dashboard.readinessScore}%</Text>
                <Text style={styles.summaryLabel}>Exam Readiness</Text>
              </View>
              <View style={styles.summaryItem}>
                <Ionicons
                  name={dashboard.trendDelta >= 0 ? 'trending-up-outline' : 'trending-down-outline'}
                  size={22}
                  color={dashboard.trendDelta >= 0 ? colors.primary : colors.danger}
                />
                <Text style={styles.summaryNumber}>
                  {dashboard.trendDelta >= 0 ? '+' : ''}
                  {dashboard.trendDelta}
                </Text>
                <Text style={styles.summaryLabel}>Trend</Text>
              </View>
              <View style={styles.summaryItem}>
                <Ionicons name="podium-outline" size={22} color={colors.accent} />
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
                      <View
                        style={[
                          styles.chartBar,
                          {
                            height: Math.max(8, value),
                            backgroundColor: value >= 70 ? colors.primary : colors.warning,
                          },
                        ]}
                      />
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
                            backgroundColor: topic.accuracy >= 70 ? colors.primary : colors.danger,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.topicAccuracyValue}>{topic.accuracy}%</Text>
                  </View>
                ))}
              </View>
            )}
          </AppCard>
        )}

        <View style={styles.actionsContainer}>
          <PrimaryButton
            label={t.practiceAgain}
            onPress={() => {
              router.push({
                pathname: '/ai-practice-setup' as any,
                params: {
                  courseId: params.courseId || '',
                  courseName: courseName,
                },
              });
            }}
          />
          <PrimaryButton
            label={t.backToCourse}
            variant="secondary"
            onPress={navigateBack}
          />
        </View>
      </ScrollView>
    </AppScreen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scrollContent: {
      paddingHorizontal: layout.screenPadding,
      paddingTop: spacing.sm,
      paddingBottom: 40,
    },
    heroWrap: {
      position: 'relative',
      overflow: 'hidden',
      padding: spacing.md,
      marginBottom: spacing.md,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    heroGlowPrimary: {
      position: 'absolute',
      width: 160,
      height: 160,
      borderRadius: 80,
      top: -100,
      right: -50,
      backgroundColor: colors.primary,
      opacity: 0.08,
    },
    heroGlowAccent: {
      position: 'absolute',
      width: 110,
      height: 110,
      borderRadius: 55,
      bottom: -60,
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
    heroCourseName: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: '700',
    },
    accentLine: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 2,
      opacity: 0.45,
    },
    scoreCard: {
      padding: spacing.lg,
      marginBottom: spacing.sm,
      alignItems: 'center',
      position: 'relative',
      overflow: 'hidden',
    },
    scoreLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: spacing.sm,
    },
    scoreValue: {
      fontSize: 52,
      fontWeight: '800',
      marginBottom: spacing.sm,
    },
    scoreMessage: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
      textAlign: 'center',
    },
    sectionCard: {
      padding: spacing.md,
      marginBottom: spacing.sm,
      position: 'relative',
      overflow: 'hidden',
    },
    cardTitle: {
      ...typography.h3,
      color: colors.textPrimary,
      marginBottom: spacing.md,
    },
    cardTitleFlat: {
      ...typography.h3,
      color: colors.textPrimary,
      flex: 1,
    },
    statRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    statCell: {
      width: '30%',
      minWidth: 88,
      flexGrow: 1,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
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
    sectionDescription: {
      ...typography.body,
      color: colors.textSecondary,
      marginBottom: spacing.md,
    },
    topicsList: {
      gap: spacing.sm,
    },
    topicItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    topicIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    topicText: {
      flex: 1,
      ...typography.body,
      color: colors.textPrimary,
      fontWeight: '500',
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    summaryItem: {
      alignItems: 'center',
      gap: spacing.xs,
      minWidth: 88,
    },
    summaryNumber: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    summaryLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    trendChartWrap: {
      marginTop: spacing.md,
    },
    chartTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: spacing.sm,
    },
    chartBars: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      height: 120,
      paddingHorizontal: 4,
      gap: 4,
    },
    chartBarContainer: {
      alignItems: 'center',
      flex: 1,
      maxWidth: 40,
    },
    chartBar: {
      width: '100%',
      maxWidth: 22,
      borderRadius: radius.sm,
    },
    chartLabel: {
      marginTop: 4,
      fontSize: 10,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    topicAccuracyWrap: {
      marginTop: spacing.md,
      gap: spacing.sm,
    },
    topicAccuracyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    topicAccuracyName: {
      width: 90,
      fontSize: 12,
      color: colors.textPrimary,
    },
    topicAccuracyTrack: {
      flex: 1,
      height: 8,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceElevated,
      overflow: 'hidden',
    },
    topicAccuracyFill: {
      height: '100%',
    },
    topicAccuracyValue: {
      width: 36,
      textAlign: 'right',
      fontSize: 12,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    actionsContainer: {
      marginTop: spacing.md,
      paddingBottom: spacing.lg,
      gap: spacing.sm,
    },
  });
