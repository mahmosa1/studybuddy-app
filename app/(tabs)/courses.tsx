// app/(tabs)/courses.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function CoursesScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Ionicons name="library-outline" size={32} color="#ffffff" />
          <Text style={styles.headerTitle}>{t('courses.hub.title')}</Text>
          <Text style={styles.headerSubtitle}>{t('courses.hub.subtitle')}</Text>
        </View>

        <View style={styles.grid}>
          <TouchableOpacity style={[styles.card, styles.cardPrimary]} onPress={() => router.push('/courses/my' as any)}>
            <View style={styles.cardIcon}>
              <Ionicons name="book-outline" size={20} color="#ffffff" />
            </View>
            <Text style={styles.cardTitle}>{t('courses.hub.myCoursesTitle')}</Text>
            <Text style={styles.cardSubtitle}>{t('courses.hub.myCoursesSubtitle')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={() => router.push('/courses/participating' as any)}>
            <View style={[styles.cardIcon, styles.cardIconSoft]}>
              <Ionicons name="people-outline" size={20} color={PRIMARY_GREEN} />
            </View>
            <Text style={styles.cardTitleDark}>{t('courses.hub.participatingTitle')}</Text>
            <Text style={styles.cardSubtitleDark}>{t('courses.hub.participatingSubtitle')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={() => router.push('/ai-practice-setup' as any)}>
            <View style={[styles.cardIcon, styles.cardIconSoft]}>
              <Ionicons name="flask-outline" size={20} color={PRIMARY_GREEN} />
            </View>
            <Text style={styles.cardTitleDark}>{t('courses.hub.aiPracticeTitle')}</Text>
            <Text style={styles.cardSubtitleDark}>{t('courses.hub.aiPracticeSubtitle')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.card} onPress={() => router.push('/courses/statistics' as any)}>
            <View style={[styles.cardIcon, styles.cardIconSoft]}>
              <Ionicons name="bar-chart-outline" size={20} color={PRIMARY_GREEN} />
            </View>
            <Text style={styles.cardTitleDark}>{t('courses.hub.statisticsTitle')}</Text>
            <Text style={styles.cardSubtitleDark}>{t('courses.hub.statisticsSubtitle')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const PRIMARY_GREEN = '#047857';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollContent: {
    paddingBottom: 30,
  },
  header: {
    backgroundColor: PRIMARY_GREEN,
    paddingTop: 64,
    paddingBottom: 34,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 10,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#ffffff',
    opacity: 0.92,
    textAlign: 'center',
    paddingHorizontal: 26,
    fontWeight: '500',
  },
  grid: {
    paddingHorizontal: 16,
    paddingTop: 18,
    gap: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardPrimary: {
    backgroundColor: PRIMARY_GREEN,
    borderColor: PRIMARY_GREEN,
  },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  cardIconSoft: {
    backgroundColor: '#ecfdf5',
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 19,
    fontWeight: '800',
  },
  cardSubtitle: {
    color: '#d1fae5',
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  cardTitleDark: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
  },
  cardSubtitleDark: {
    marginTop: 6,
    color: '#6b7280',
    fontSize: 13,
    lineHeight: 18,
  },
});

