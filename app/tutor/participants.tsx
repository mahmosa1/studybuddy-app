import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppChip } from '@/frontend/components/ui/AppChip';
import { AppHeader } from '@/frontend/components/ui/AppHeader';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { EmptyState } from '@/frontend/components/ui/EmptyState';
import { LoadingState } from '@/frontend/components/ui/LoadingState';
import { StatCard } from '@/frontend/components/ui/StatCard';
import { iconContainer, layout, radius, spacing, typography } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
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

type ParticipantItem = {
  requestId: string;
  studentUid: string;
  studentName: string;
  studentAvatarUrl?: string;
  courseId: string;
  courseName: string;
  joinedAtMs: number;
};

function formatJoinedAt(ms: number, lang: string): string {
  if (!ms) return '—';
  const locale = lang === 'he' ? 'he-IL' : 'en-US';
  return new Date(ms).toLocaleDateString(locale, { dateStyle: 'medium' });
}

export default function TutorParticipantsScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);
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
    <AppScreen>
      <AppHeader title={t('tutor.hub.participantsTitle')} onBack={() => router.back()} />

      {loading ? (
        <LoadingState label={t('common.loading')} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heroWrap}>
            <View style={styles.heroGlowPrimary} />
            <View style={styles.heroGlowAccent} />
            <View style={styles.heroBadge}>
              <Ionicons name="people-outline" size={14} color={colors.primary} />
              <Text style={styles.heroBadgeText}>{t('tutor.hub.participantsTitle')}</Text>
            </View>
            <Text style={[styles.heroTitle, isHebrewUi && styles.rtlText]}>{t('tutor.hub.participantsTitle')}</Text>
            <Text style={[styles.heroSubtitle, isHebrewUi && styles.rtlText]}>{t('tutor.hub.participantsSubtitle')}</Text>
          </View>

          <View style={styles.statsRow}>
            <StatCard value={courseParticipants.length} label={t('tutor.hub.totalParticipations')} style={styles.statCard} />
            <StatCard value={uniqueStudentsCount} label={t('tutor.hub.totalStudents')} style={styles.statCard} />
            <StatCard value={uniqueCoursesCount} label={t('tutor.hub.totalCourses')} style={styles.statCard} />
          </View>

          <AppCard style={styles.courseSelectCard}>
            <TouchableOpacity style={styles.courseSelectBtn} onPress={() => setShowCoursePicker(true)}>
              <View style={styles.iconBadge}>
                <Ionicons name="book-outline" size={18} color={colors.textPrimary} />
              </View>
              <Text style={[styles.courseSelectText, isHebrewUi && styles.rtlText]}>
                {selectedCourseId
                  ? courseOptions.find((c) => c.id === selectedCourseId)?.name || t('tutor.selectCourse')
                  : t('tutor.hub.selectCourseFirst')}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </AppCard>

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
                        <Ionicons name="checkmark" size={20} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableOpacity>
          </Modal>

          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, isHebrewUi && styles.rtlText]}
              placeholder={t('tutor.hub.participantsSearchPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={query}
              onChangeText={setQuery}
              editable={!!selectedCourseId}
            />
          </View>

          {!selectedCourseId ? (
            <EmptyState title={t('tutor.hub.selectCourseFirst')} subtitle={t('tutor.selectCourse')} />
          ) : filtered.length === 0 ? (
            <EmptyState
              title={courseParticipants.length === 0 ? t('tutor.hub.noParticipantsYet') : t('search.noResults')}
              subtitle={t('tutor.hub.participantsSearchPlaceholder')}
            />
          ) : (
            filtered.map((p) => (
              <AppCard key={p.requestId} style={styles.card}>
                <View style={styles.cardAccentBar} />
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
                    <Ionicons name="person-outline" size={15} color={colors.textPrimary} />
                    <Text style={styles.profileBtnText}>{t('profile.title')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.chatBtn]}
                    onPress={() => openDirectChat(p.studentUid, p.studentName)}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.textOnPrimary} />
                    <Text style={styles.chatBtnText}>{t('search.sendInAppMessage')}</Text>
                  </TouchableOpacity>
                </View>
              </AppCard>
            ))
          )}
        </ScrollView>
      )}
    </AppScreen>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  content: { paddingHorizontal: layout.screenPadding, paddingTop: spacing.sm, gap: spacing.sm, paddingBottom: 34 },
  heroWrap: {
    position: 'relative',
    overflow: 'hidden',
    padding: spacing.md,
    borderRadius: radius.lg,
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
    width: 120,
    height: 120,
    borderRadius: 60,
    bottom: -70,
    left: -30,
    backgroundColor: colors.accent,
    opacity: 0.08,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
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
  heroTitle: { ...typography.h3, color: colors.textPrimary },
  heroSubtitle: { marginTop: spacing.xs, color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex: 1,
    width: '31.8%',
  },
  courseSelectCard: {
    padding: spacing.sm,
  },
  courseSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  iconBadge: {
    width: iconContainer.size,
    height: iconContainer.size,
    borderRadius: iconContainer.radius,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseSelectText: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.surface,
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
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
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
    borderBottomColor: colors.border,
  },
  listOptionButtonSelected: {
    backgroundColor: colors.surfaceElevated,
  },
  listOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  listOptionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  card: {
    padding: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  cardAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.primary,
    opacity: 0.35,
  },
  headerRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarText: { color: colors.primary, fontWeight: '800', fontSize: 16 },
  name: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  meta: { marginTop: 2, fontSize: 12, color: colors.textSecondary },
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chatBtn: { backgroundColor: colors.primary },
  profileBtnText: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  chatBtnText: { color: colors.textOnPrimary, fontSize: 13, fontWeight: '700' },
});
