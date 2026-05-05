import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ACCENT = '#047857';

export default function TutorHubScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const showComingSoon = () => {
    Alert.alert(t('tutor.hub.title'), t('tutor.hub.comingSoon'));
  };

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
        <Text style={styles.title}>{t('tutor.hub.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.card} onPress={() => router.push('/tutor/participants' as any)}>
          <View style={styles.cardIconWrap}>
            <Ionicons name="people-outline" size={20} color={ACCENT} />
          </View>
          <Text style={styles.cardTitle}>{t('tutor.hub.participantsTitle')}</Text>
          <Text style={styles.cardSubtitle}>{t('tutor.hub.participantsSubtitle')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={showComingSoon}>
          <View style={styles.cardIconWrap}>
            <Ionicons name="document-text-outline" size={20} color={ACCENT} />
          </View>
          <Text style={styles.cardTitle}>{t('tutor.hub.exercisesTitle')}</Text>
          <Text style={styles.cardSubtitle}>{t('tutor.hub.exercisesSubtitle')}</Text>
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
    padding: 18,
    gap: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  cardSubtitle: {
    marginTop: 6,
    color: '#6b7280',
    fontSize: 13,
    lineHeight: 18,
  },
});
