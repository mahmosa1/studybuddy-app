// app/profile/system-updates.tsx — System / tutor approval updates with received time
import { auth, db } from '@/lib/firebaseConfig';
import {
  buildTutorUpdatesSignature,
  setTutorUpdatesSeenSignature,
} from '@/lib/profileSystemUpdates';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TutorRow = { courseId: string; courseName: string; approvedAt?: string };

const ACCENT = '#047857';

function formatReceivedAt(iso: string | undefined, lang: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const locale = lang === 'he' ? 'he-IL' : 'en-US';
  return d.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function SystemUpdatesScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const isHebrewUi = i18n.language === 'he';

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<TutorRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const user = auth.currentUser;
        if (!user) {
          setLoading(false);
          return;
        }
        setLoading(true);
        try {
          const snap = await getDoc(doc(db, 'users', user.uid));
          let list: TutorRow[] = [];
          if (snap.exists()) {
            const data = snap.data() as any;
            const raw = Array.isArray(data.tutorApprovedCourses) ? data.tutorApprovedCourses : [];
            list = raw
              .filter((e: any) => e && e.courseId)
              .map((e: any) => ({
                courseId: String(e.courseId),
                courseName: String(e.courseName || 'Course'),
                approvedAt: e.approvedAt != null ? String(e.approvedAt) : undefined,
              }));
          }
          if (!cancelled) {
            setItems(list);
            await setTutorUpdatesSeenSignature(user.uid, buildTutorUpdatesSignature(list));
          }
        } catch (e) {
          console.log('system-updates load error:', e);
          if (!cancelled) setItems([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

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
        <Text style={[styles.title, isHebrewUi && styles.rtlText]}>{t('profile.systemUpdatesTitle')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={ACCENT} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {items.length === 0 ? (
            <Text style={[styles.empty, isHebrewUi && styles.rtlText]}>{t('profile.systemUpdatesEmpty')}</Text>
          ) : (
            items.map((c) => (
              <View key={c.courseId} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="ribbon-outline" size={22} color={ACCENT} />
                  <Text style={[styles.cardTitle, isHebrewUi && styles.rtlText]} numberOfLines={3}>
                    {t('profile.systemUpdateTutorLine', { courseName: c.courseName })}
                  </Text>
                </View>
                <Text style={[styles.cardMeta, isHebrewUi && styles.rtlText]}>
                  {t('profile.systemUpdateReceivedAt', {
                    when: formatReceivedAt(c.approvedAt, i18n.language),
                  })}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
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
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
  },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  empty: { fontSize: 15, color: '#6b7280', lineHeight: 22 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
    width: '100%',
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 22,
  },
  cardMeta: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
});
