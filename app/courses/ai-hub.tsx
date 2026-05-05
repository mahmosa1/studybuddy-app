import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ACCENT = '#047857';

export default function CourseAiHubScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('courses.hub.aiHubTitle')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.card} onPress={() => router.push('/ai-practice-setup' as any)}>
          <View style={styles.iconWrap}>
            <Ionicons name="flask-outline" size={20} color={ACCENT} />
          </View>
          <Text style={styles.cardTitle}>{t('courses.hub.aiBuildTitle')}</Text>
          <Text style={styles.cardSubtitle}>{t('courses.hub.aiBuildSubtitle')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => router.push('/courses/statistics' as any)}>
          <View style={styles.iconWrap}>
            <Ionicons name="bar-chart-outline" size={20} color={ACCENT} />
          </View>
          <Text style={styles.cardTitle}>{t('courses.hub.aiStatsTitle')}</Text>
          <Text style={styles.cardSubtitle}>{t('courses.hub.aiStatsSubtitle')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f9fafb' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 19,
    fontWeight: '800',
    color: '#111827',
  },
  content: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
  },
  cardSubtitle: {
    marginTop: 6,
    color: '#6b7280',
    fontSize: 13,
    lineHeight: 18,
  },
});
