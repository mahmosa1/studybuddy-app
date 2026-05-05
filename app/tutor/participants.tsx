import { auth, db } from '@/lib/firebaseConfig';
import { fetchTutorSupportRequestsForTutor, TutorSupportRequestDoc } from '@/lib/tutorSupportRequestService';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ParticipantItem = {
  requestId: string;
  studentUid: string;
  studentName: string;
  studentAvatarUrl?: string;
  courseId: string;
  courseName: string;
  joinedAtMs: number;
};

const ACCENT = '#047857';

function formatJoinedAt(ms: number, lang: string): string {
  if (!ms) return '—';
  const locale = lang === 'he' ? 'he-IL' : 'en-US';
  return new Date(ms).toLocaleDateString(locale, { dateStyle: 'medium' });
}

export default function TutorParticipantsScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const isHebrewUi = i18n.language === 'he';

  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<ParticipantItem[]>([]);
  const [query, setQuery] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [showCoursePicker, setShowCoursePicker] = useState(false);

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
          const reqs = await fetchTutorSupportRequestsForTutor(user.uid);
          const accepted = reqs.filter((r) => r.status === 'accepted');
          const byStudentAndCourse = new Map<string, ParticipantItem>();
          accepted.forEach((r) => {
            const joinedAtMs = (r.reviewedAt as any)?.toMillis?.() ?? (r.createdAt as any)?.toMillis?.() ?? 0;
            const item: ParticipantItem = {
            requestId: r.id,
            studentUid: r.studentUid,
            studentName: r.studentName || t('auth.student'),
            studentAvatarUrl: r.studentAvatarUrl || '',
            courseId: r.courseId,
            courseName: r.courseName,
              joinedAtMs,
            };
            const key = `${item.studentUid}__${item.courseId}`;
            const prev = byStudentAndCourse.get(key);
            if (!prev || item.joinedAtMs >= prev.joinedAtMs) byStudentAndCourse.set(key, item);
          });
          const next: ParticipantItem[] = Array.from(byStudentAndCourse.values());
          next.sort((a, b) => b.joinedAtMs - a.joinedAtMs);
          if (!cancelled) {
            setParticipants(next);
            setSelectedCourseId((prev) => {
              if (prev && next.some((n) => n.courseId === prev)) return prev;
              return '';
            });
          }
        } catch (e) {
          console.log('tutor participants load error:', e);
          if (!cancelled) setParticipants([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [t]),
  );

  const courseOptions = useMemo(() => {
    const byId = new Map<string, string>();
    participants.forEach((p) => {
      if (!byId.has(p.courseId)) byId.set(p.courseId, p.courseName);
    });
    return Array.from(byId.entries()).map(([id, name]) => ({ id, name }));
  }, [participants]);

  const courseParticipants = useMemo(() => {
    if (!selectedCourseId) return [];
    return participants.filter((p) => p.courseId === selectedCourseId);
  }, [participants, selectedCourseId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return courseParticipants;
    return courseParticipants.filter(
      (p) => p.studentName.toLowerCase().includes(q) || p.courseName.toLowerCase().includes(q),
    );
  }, [courseParticipants, query]);

  const uniqueStudentsCount = useMemo(
    () => new Set(courseParticipants.map((p) => p.studentUid)).size,
    [courseParticipants],
  );
  const uniqueCoursesCount = useMemo(
    () => new Set(participants.map((p) => p.courseId)).size,
    [participants],
  );

  const openDirectChat = async (targetUid: string, targetName: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    try {
      const sorted = [currentUser.uid, targetUid].sort();
      const chatId = `direct_${sorted[0]}_${sorted[1]}`;
      const threadRef = doc(db, 'chatThreads', chatId);
      const existing = await getDoc(threadRef);
      if (!existing.exists()) {
        await setDoc(threadRef, {
          type: 'direct',
          title: targetName || 'Chat',
          members: sorted,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastMessage: '',
          unreadCountBy: {
            [sorted[0]]: 0,
            [sorted[1]]: 0,
          },
        });
      }
      router.push(`/chat/${chatId}` as any);
    } catch (e) {
      console.log('open direct chat error', e);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={[styles.title, isHebrewUi && styles.rtlText]}>{t('tutor.hub.participantsTitle')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={ACCENT} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{courseParticipants.length}</Text>
              <Text style={[styles.statLabel, isHebrewUi && styles.rtlText]}>{t('tutor.hub.totalParticipations')}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{uniqueStudentsCount}</Text>
              <Text style={[styles.statLabel, isHebrewUi && styles.rtlText]}>{t('tutor.hub.totalStudents')}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{uniqueCoursesCount}</Text>
              <Text style={[styles.statLabel, isHebrewUi && styles.rtlText]}>{t('tutor.hub.totalCourses')}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.courseSelectBtn} onPress={() => setShowCoursePicker(true)}>
            <Ionicons name="book-outline" size={18} color={ACCENT} />
            <Text style={[styles.courseSelectText, isHebrewUi && styles.rtlText]}>
              {selectedCourseId
                ? courseOptions.find((c) => c.id === selectedCourseId)?.name || t('tutor.selectCourse')
                : t('tutor.hub.selectCourseFirst')}
            </Text>
            <Ionicons name="chevron-down" size={18} color="#6b7280" />
          </TouchableOpacity>

          <Modal
            visible={showCoursePicker}
            transparent
            animationType="fade"
            onRequestClose={() => setShowCoursePicker(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setShowCoursePicker(false)}
            >
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{t('tutor.selectCourse')}</Text>
                  <TouchableOpacity onPress={() => setShowCoursePicker(false)}>
                    <Ionicons name="close" size={24} color="#6b7280" />
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.optionsList}>
                  {courseOptions.map((course) => (
                    <TouchableOpacity
                      key={course.id}
                      style={[
                        styles.listOptionButton,
                        selectedCourseId === course.id && styles.listOptionButtonSelected,
                      ]}
                      onPress={() => {
                        setSelectedCourseId(course.id);
                        setShowCoursePicker(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.listOptionText,
                          selectedCourseId === course.id && styles.listOptionTextSelected,
                        ]}
                      >
                        {course.name}
                      </Text>
                      {selectedCourseId === course.id && (
                        <Ionicons name="checkmark" size={20} color={ACCENT} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableOpacity>
          </Modal>

          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color="#6b7280" />
            <TextInput
              style={[styles.searchInput, isHebrewUi && styles.rtlText]}
              placeholder={t('tutor.hub.participantsSearchPlaceholder')}
              placeholderTextColor="#9ca3af"
              value={query}
              onChangeText={setQuery}
              editable={!!selectedCourseId}
            />
          </View>

          {!selectedCourseId ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="funnel-outline" size={50} color="#9ca3af" />
              <Text style={[styles.emptyTitle, isHebrewUi && styles.rtlText]}>
                {t('tutor.hub.selectCourseFirst')}
              </Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="people-outline" size={50} color="#9ca3af" />
              <Text style={[styles.emptyTitle, isHebrewUi && styles.rtlText]}>
                {courseParticipants.length === 0
                  ? t('tutor.hub.noParticipantsYet')
                  : t('search.noResults')}
              </Text>
            </View>
          ) : (
            filtered.map((p) => (
              <View key={p.requestId} style={styles.card}>
                <View style={styles.headerRow}>
                  {p.studentAvatarUrl ? (
                    <Image source={{ uri: p.studentAvatarUrl }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarText}>{p.studentName[0]?.toUpperCase() || 'S'}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, isHebrewUi && styles.rtlText]}>{p.studentName}</Text>
                    <Text style={[styles.meta, isHebrewUi && styles.rtlText]}>
                      {t('tutor.hub.joinedOn', { date: formatJoinedAt(p.joinedAtMs, i18n.language) })}
                    </Text>
                  </View>
                </View>

                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.profileBtn]}
                    onPress={() => router.push(`/user-profile/${p.studentUid}` as any)}
                  >
                    <Ionicons name="person-outline" size={15} color={ACCENT} />
                    <Text style={styles.profileBtnText}>{t('profile.title')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.chatBtn]}
                    onPress={() => openDirectChat(p.studentUid, p.studentName)}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={15} color="#ffffff" />
                    <Text style={styles.chatBtnText}>{t('search.sendInAppMessage')}</Text>
                  </TouchableOpacity>
                </View>
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
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 19, fontWeight: '800', color: '#111827' },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 12, paddingBottom: 34 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 10,
    alignItems: 'center',
  },
  statNumber: { fontSize: 20, fontWeight: '800', color: '#047857' },
  statLabel: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  courseSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  courseSelectText: {
    flex: 1,
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#111827' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    width: '85%',
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  optionsList: {
    maxHeight: 300,
  },
  listOptionButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  listOptionButtonSelected: {
    backgroundColor: '#f0fdf4',
  },
  listOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  listOptionTextSelected: {
    color: ACCENT,
    fontWeight: '600',
  },
  emptyWrap: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#374151' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
  },
  headerRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: '#d1fae5' },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  avatarText: { color: '#047857', fontWeight: '800', fontSize: 16 },
  name: { fontSize: 16, fontWeight: '700', color: '#111827' },
  meta: { marginTop: 2, fontSize: 12, color: '#6b7280' },
  actionsRow: { marginTop: 12, flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  profileBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  chatBtn: { backgroundColor: '#047857' },
  profileBtnText: { color: '#047857', fontSize: 13, fontWeight: '700' },
  chatBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
});
