import { auth, db } from '@/lib/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Stat = {
  totalCourses: number;
  totalSessions: number;
  avgScore: number;
  bestScore: number;
  recentScores: number[];
};

export default function CourseStatsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stat>({
    totalCourses: 0,
    totalSessions: 0,
    avgScore: 0,
    bestScore: 0,
    recentScores: [],
  });

  useEffect(() => {
    const load = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const [coursesSnap, resultsSnap] = await Promise.all([
          getDocs(query(collection(db, 'courses'), where('ownerUid', '==', user.uid))),
          getDocs(query(collection(db, 'practiceResults'), where('userId', '==', user.uid))),
        ]);
        const totalCourses = coursesSnap.size;
        const results = resultsSnap.docs.map((d) => d.data() as any);
        const scores = results
          .map((r) => Number(r.scorePercent ?? r.score ?? 0))
          .filter((v) => Number.isFinite(v) && v >= 0);
        const totalSessions = scores.length;
        const avgScore = totalSessions ? Math.round(scores.reduce((a, b) => a + b, 0) / totalSessions) : 0;
        const bestScore = totalSessions ? Math.max(...scores) : 0;
        const recentScores = [...scores].slice(-7);
        setStats({ totalCourses, totalSessions, avgScore, bestScore, recentScores });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('courses.hub.statisticsTitle')}</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#047857" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.grid}>
            <View style={styles.card}>
              <Text style={styles.value}>{stats.totalCourses}</Text>
              <Text style={styles.label}>{t('courses.hub.totalCourses')}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.value}>{stats.totalSessions}</Text>
              <Text style={styles.label}>{t('courses.hub.totalSessions')}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.value}>{stats.avgScore}%</Text>
              <Text style={styles.label}>{t('courses.hub.averageScore')}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.value}>{stats.bestScore}%</Text>
              <Text style={styles.label}>{t('courses.hub.bestScore')}</Text>
            </View>
          </View>
          <View style={styles.trendCard}>
            <Text style={styles.trendTitle}>{t('courses.hub.recentTrend')}</Text>
            {stats.recentScores.length > 0 ? (
              <>
                <View style={styles.trendBarsRow}>
                  {stats.recentScores.map((score, index) => (
                    <View key={`${score}-${index}`} style={styles.trendBarWrap}>
                      <View style={[styles.trendBar, { height: Math.max(10, Math.min(100, score)) }]} />
                      <Text style={styles.trendBarLabel}>{Math.round(score)}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.trendHint}>{t('courses.hub.recentTrendHint')}</Text>
              </>
            ) : (
              <Text style={styles.trendEmpty}>{t('courses.hub.noSessionsYet')}</Text>
            )}
          </View>

          <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/ai-practice-setup' as any)}>
            <Ionicons name="flask-outline" size={18} color="#fff" />
            <Text style={styles.actionTxt}>{t('courses.hub.startPractice')}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    backgroundColor: '#fff',
    paddingTop: 58,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: { color: '#111827', fontSize: 20, fontWeight: '700' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 14, paddingBottom: 28 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  card: {
    width: '48.5%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  value: { color: '#047857', fontSize: 24, fontWeight: '800' },
  label: { marginTop: 4, color: '#374151', fontSize: 13, fontWeight: '600' },
  trendCard: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    padding: 14,
  },
  trendTitle: { color: '#111827', fontSize: 15, fontWeight: '700' },
  trendBarsRow: {
    marginTop: 12,
    height: 120,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 6,
  },
  trendBarWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  trendBar: {
    width: '100%',
    borderRadius: 8,
    backgroundColor: '#10b981',
    minHeight: 10,
  },
  trendBarLabel: { marginTop: 5, color: '#6b7280', fontSize: 10, fontWeight: '600' },
  trendHint: { marginTop: 10, color: '#6b7280', fontSize: 12 },
  trendEmpty: { marginTop: 8, color: '#9ca3af', fontSize: 13 },
  actionBtn: {
    marginTop: 18,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#047857',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionTxt: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

