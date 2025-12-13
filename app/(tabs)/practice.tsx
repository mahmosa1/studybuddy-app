// app/(tabs)/practice.tsx
import { auth, db } from '@/lib/firebaseConfig';
import { useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type PracticeSession = {
  id: string;
  courseName: string;
  courseId: string;
  practiceType: string;
  numQuestions: number;
  score: number;
  totalQuestions: number;
  completedAt: any;
  date: string;
};

export default function PracticeScreen() {
  const router = useRouter();
  const [practiceSessions, setPracticeSessions] = useState<PracticeSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPractices: 0,
    averageScore: 0,
    bestScore: 0,
  });

  useEffect(() => {
    loadPracticeData();
  }, []);

  const loadPracticeData = async () => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Mock practice data - replace with real Firestore query later
      // For now, we'll create sample data structure
      const mockSessions: PracticeSession[] = [
        {
          id: '1',
          courseName: 'Linear Algebra',
          courseId: 'course1',
          practiceType: 'Mixed',
          numQuestions: 10,
          score: 8,
          totalQuestions: 10,
          completedAt: new Date(),
          date: new Date().toLocaleDateString(),
        },
        {
          id: '2',
          courseName: 'Calculus',
          courseId: 'course2',
          practiceType: 'True/False',
          numQuestions: 20,
          score: 15,
          totalQuestions: 20,
          completedAt: new Date(Date.now() - 86400000),
          date: new Date(Date.now() - 86400000).toLocaleDateString(),
        },
        {
          id: '3',
          courseName: 'Data Structures',
          courseId: 'course3',
          practiceType: 'Open Questions',
          numQuestions: 5,
          score: 4,
          totalQuestions: 5,
          completedAt: new Date(Date.now() - 172800000),
          date: new Date(Date.now() - 172800000).toLocaleDateString(),
        },
      ];

      setPracticeSessions(mockSessions);

      // Calculate stats
      const total = mockSessions.length;
      const avgScore =
        mockSessions.reduce((sum, s) => sum + (s.score / s.totalQuestions) * 100, 0) / total;
      const bestScore = Math.max(
        ...mockSessions.map((s) => (s.score / s.totalQuestions) * 100)
      );

      setStats({
        totalPractices: total,
        averageScore: Math.round(avgScore),
        bestScore: Math.round(bestScore),
      });
    } catch (err) {
      console.log('Error loading practice data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number, total: number) => {
    const percentage = (score / total) * 100;
    if (percentage >= 80) return '#22c55e'; // green
    if (percentage >= 60) return '#047857'; // green
    return '#ef4444'; // red
  };

  const renderPracticeRow = ({ item }: { item: PracticeSession }) => {
    const percentage = Math.round((item.score / item.totalQuestions) * 100);
    const scoreColor = getScoreColor(item.score, item.totalQuestions);

    return (
      <View style={styles.tableRow}>
        <View style={styles.tableCell}>
          <Text style={styles.cellText} numberOfLines={1}>
            {item.courseName}
          </Text>
        </View>
        <View style={styles.tableCell}>
          <Text style={styles.cellText}>{item.practiceType}</Text>
        </View>
        <View style={styles.tableCell}>
          <Text style={styles.cellText}>{item.numQuestions}</Text>
        </View>
        <View style={styles.tableCell}>
          <View style={[styles.scoreBadge, { backgroundColor: scoreColor + '20' }]}>
            <Text style={[styles.scoreText, { color: scoreColor }]}>
              {item.score}/{item.totalQuestions}
            </Text>
          </View>
        </View>
        <View style={styles.tableCell}>
          <Text style={[styles.percentageText, { color: scoreColor }]}>
            {percentage}%
          </Text>
        </View>
        <View style={styles.tableCell}>
          <Text style={styles.dateText}>{item.date}</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color="#047857" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Practice History</Text>
          <Text style={styles.subtitle}>
            Track your AI practice sessions and improve your scores
          </Text>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.totalPractices}</Text>
            <Text style={styles.statLabel}>Total Practices</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.averageScore}%</Text>
            <Text style={styles.statLabel}>Average Score</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{stats.bestScore}%</Text>
            <Text style={styles.statLabel}>Best Score</Text>
          </View>
        </View>

        {/* Quick Action */}
        <TouchableOpacity
          style={styles.startPracticeButton}
          onPress={() => router.push('/ai-practice-setup' as any)}
        >
          <Text style={styles.startPracticeButtonText}>Start New Practice</Text>
        </TouchableOpacity>

        {/* Practice Table */}
        {practiceSessions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No practice sessions yet</Text>
            <Text style={styles.emptyText}>
              Start your first AI practice session to see your progress here
            </Text>
          </View>
        ) : (
          <View style={styles.tableContainer}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={styles.headerText}>Course</Text>
              <Text style={styles.headerText}>Type</Text>
              <Text style={styles.headerText}>Q's</Text>
              <Text style={styles.headerText}>Score</Text>
              <Text style={styles.headerText}>%</Text>
              <Text style={styles.headerText}>Date</Text>
            </View>

            {/* Table Body */}
            <FlatList
              data={practiceSessions}
              keyExtractor={(item) => item.id}
              renderItem={renderPracticeRow}
              scrollEnabled={false}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

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
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#047857',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  startPracticeButton: {
    backgroundColor: '#047857',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#047857',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  startPracticeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  tableContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#374151',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#047857',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  headerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  tableCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellText: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
  },
  scoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '700',
  },
  percentageText: {
    fontSize: 14,
    fontWeight: '700',
  },
  dateText: {
    fontSize: 11,
    color: '#6b7280',
  },
  emptyState: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});

