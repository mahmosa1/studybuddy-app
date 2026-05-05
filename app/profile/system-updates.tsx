// app/profile/system-updates.tsx — System / tutor approval updates with received time
import { auth, db } from '@/lib/firebaseConfig';
import {
  addDismissedSystemUpdateKey,
  buildSystemUpdatesSignature,
  getDismissedSystemUpdateKeys,
  setTutorUpdatesSeenSignature,
} from '@/lib/profileSystemUpdates';
import {
  fetchTutorSupportRequestsForStudent,
  fetchTutorSupportRequestsForTutor,
  reviewTutorSupportRequest,
  TutorSupportRequestDoc,
} from '@/lib/tutorSupportRequestService';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';

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
  const [tutorRequests, setTutorRequests] = useState<TutorSupportRequestDoc[]>([]);
  const [studentDecisionRequests, setStudentDecisionRequests] = useState<TutorSupportRequestDoc[]>([]);
  const [dismissedKeys, setDismissedKeys] = useState<string[]>([]);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);

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
          const allTutorRequests = await fetchTutorSupportRequestsForTutor(user.uid);
          const pendingRequests = allTutorRequests.filter((r) => r.status === 'pending');
          const allStudentRequests = await fetchTutorSupportRequestsForStudent(user.uid);
          const studentDecisions = allStudentRequests.filter((r) => r.status !== 'pending');
          const dismissed = await getDismissedSystemUpdateKeys(user.uid);
          if (!cancelled) {
            setItems(list);
            setTutorRequests(allTutorRequests);
            setStudentDecisionRequests(studentDecisions);
            setDismissedKeys(dismissed);
            await setTutorUpdatesSeenSignature(
              user.uid,
              buildSystemUpdatesSignature({
                courses: list,
                tutorRequests: pendingRequests.map((r) => ({
                  id: r.id,
                  createdAtMs: (r.createdAt as any)?.toMillis?.() ?? 0,
                })),
                studentDecisionRequests: studentDecisions.map((r) => ({
                  id: r.id,
                  createdAtMs: (r.reviewedAt as any)?.toMillis?.() ?? (r.createdAt as any)?.toMillis?.() ?? 0,
                })),
              }),
            );
          }
        } catch (e) {
          console.log('system-updates load error:', e);
          if (!cancelled) {
            setItems([]);
            setTutorRequests([]);
            setStudentDecisionRequests([]);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const handleReviewRequest = async (requestId: string, decision: 'accepted' | 'rejected') => {
    try {
      setUpdatingRequestId(requestId);
      await reviewTutorSupportRequest(requestId, decision);
      const nextRequests = tutorRequests.map((r) =>
        r.id === requestId ? { ...r, status: decision } : r,
      );
      setTutorRequests(nextRequests);
      const uid = auth.currentUser?.uid;
      if (uid) {
        await setTutorUpdatesSeenSignature(
          uid,
          buildSystemUpdatesSignature({
            courses: items,
            tutorRequests: nextRequests
              .filter((r) => r.status === 'pending')
              .map((r) => ({
              id: r.id,
              createdAtMs: (r.createdAt as any)?.toMillis?.() ?? 0,
            })),
            studentDecisionRequests: studentDecisionRequests.map((r) => ({
              id: r.id,
              createdAtMs: (r.reviewedAt as any)?.toMillis?.() ?? (r.createdAt as any)?.toMillis?.() ?? 0,
            })),
          }),
        );
      }
      Alert.alert(
        t('common.success'),
        decision === 'accepted' ? t('profile.tutorRequestAccepted') : t('profile.tutorRequestRejected'),
      );
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message || t('profile.tutorRequestActionFailed'));
    } finally {
      setUpdatingRequestId(null);
    }
  };

  const visibleTutorRequests = tutorRequests.filter((req) => !dismissedKeys.includes(`request:${req.id}`));
  const visibleTutorApprovals = items.filter(
    (c) => !dismissedKeys.includes(`approved:${c.courseId}:${c.approvedAt ?? ''}`),
  );
  const visibleStudentDecisionRequests = studentDecisionRequests.filter(
    (r) => !dismissedKeys.includes(`student-request:${r.id}`),
  );

  const dismissUpdate = async (key: string) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setDismissedKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
    await addDismissedSystemUpdateKey(uid, key);
  };

  const renderDeleteAction = (updateKey: string) => (
    <TouchableOpacity style={styles.deleteAction} onPress={() => dismissUpdate(updateKey)}>
      <Ionicons name="trash-outline" size={18} color="#ffffff" />
      <Text style={styles.deleteActionText}>{t('common.delete')}</Text>
    </TouchableOpacity>
  );

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
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
          {visibleTutorApprovals.length === 0 &&
          visibleTutorRequests.length === 0 &&
          visibleStudentDecisionRequests.length === 0 ? (
            <Text style={[styles.empty, isHebrewUi && styles.rtlText]}>{t('profile.systemUpdatesEmpty')}</Text>
          ) : (
            <>
              {visibleTutorRequests.map((req) => {
                const requestCreatedAtMs = (req.createdAt as any)?.toMillis?.() ?? 0;
                const requestWhen = requestCreatedAtMs
                  ? formatReceivedAt(new Date(requestCreatedAtMs).toISOString(), i18n.language)
                  : '—';
                const busy = updatingRequestId === req.id;
                const pending = req.status === 'pending';
                return (
                  <Swipeable
                    key={req.id}
                    overshootRight={false}
                    renderRightActions={() => renderDeleteAction(`request:${req.id}`)}
                  >
                    <View style={styles.card}>
                      <View style={styles.cardHeader}>
                        <TouchableOpacity
                          onPress={() => router.push(`/user-profile/${req.studentUid}` as any)}
                          activeOpacity={0.8}
                        >
                          {req.studentAvatarUrl ? (
                            <Image source={{ uri: req.studentAvatarUrl }} style={styles.requestAvatar} />
                          ) : (
                            <View style={styles.requestAvatarFallback}>
                              <Ionicons name="person-outline" size={18} color={ACCENT} />
                            </View>
                          )}
                        </TouchableOpacity>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.cardTitle, isHebrewUi && styles.rtlText]} numberOfLines={3}>
                            {pending
                              ? t('profile.systemUpdateTutorRequestLine', {
                                  studentName: req.studentName || t('auth.student'),
                                  courseName: req.courseName,
                                })
                              : req.status === 'accepted'
                              ? t('profile.systemUpdateTutorRequestAcceptedLine', {
                                  studentName: req.studentName || t('auth.student'),
                                  courseName: req.courseName,
                                })
                              : t('profile.systemUpdateTutorRequestRejectedLine', {
                                  studentName: req.studentName || t('auth.student'),
                                  courseName: req.courseName,
                                })}
                          </Text>
                          <Text style={[styles.cardMeta, isHebrewUi && styles.rtlText]}>
                            {t('profile.systemUpdateReceivedAt', { when: requestWhen })}
                          </Text>
                        </View>
                      </View>
                      {pending ? (
                        <View style={styles.requestActions}>
                          <TouchableOpacity
                            style={[styles.requestBtn, styles.acceptBtn, busy && styles.requestBtnDisabled]}
                            disabled={busy}
                            onPress={() => handleReviewRequest(req.id, 'accepted')}
                          >
                            <Text style={styles.requestBtnText}>{t('profile.accept')}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.requestBtn, styles.rejectBtn, busy && styles.requestBtnDisabled]}
                            disabled={busy}
                            onPress={() => handleReviewRequest(req.id, 'rejected')}
                          >
                            <Text style={styles.requestBtnText}>{t('profile.reject')}</Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </View>
                  </Swipeable>
                );
              })}
              {visibleTutorApprovals.map((c) => (
                <Swipeable
                  key={`${c.courseId}:${c.approvedAt ?? ''}`}
                  overshootRight={false}
                  renderRightActions={() => renderDeleteAction(`approved:${c.courseId}:${c.approvedAt ?? ''}`)}
                >
                  <View style={styles.card}>
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
                </Swipeable>
              ))}
              {visibleStudentDecisionRequests.map((req) => {
                const whenMs = (req.reviewedAt as any)?.toMillis?.() ?? (req.createdAt as any)?.toMillis?.() ?? 0;
                const when = whenMs ? formatReceivedAt(new Date(whenMs).toISOString(), i18n.language) : '—';
                return (
                  <Swipeable
                    key={`student-${req.id}`}
                    overshootRight={false}
                    renderRightActions={() => renderDeleteAction(`student-request:${req.id}`)}
                  >
                    <View style={styles.card}>
                      <View style={styles.cardHeader}>
                        <Ionicons
                          name={req.status === 'accepted' ? 'checkmark-circle-outline' : 'close-circle-outline'}
                          size={22}
                          color={req.status === 'accepted' ? '#059669' : '#ef4444'}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.cardTitle, isHebrewUi && styles.rtlText]} numberOfLines={3}>
                            {req.status === 'accepted'
                              ? t('profile.systemUpdateForStudentAcceptedLine', {
                                  tutorName: req.tutorName || t('search.tutorLabel'),
                                  courseName: req.courseName,
                                })
                              : t('profile.systemUpdateForStudentRejectedLine', {
                                  tutorName: req.tutorName || t('search.tutorLabel'),
                                  courseName: req.courseName,
                                })}
                          </Text>
                          <Text style={[styles.cardMeta, isHebrewUi && styles.rtlText]}>
                            {t('profile.systemUpdateReceivedAt', { when })}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </Swipeable>
                );
              })}
            </>
          )}
        </ScrollView>
      )}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: { flex: 1 },
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
  requestAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  requestAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  requestBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  acceptBtn: {
    backgroundColor: '#059669',
  },
  rejectBtn: {
    backgroundColor: '#ef4444',
  },
  requestBtnDisabled: {
    opacity: 0.6,
  },
  requestBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  deleteAction: {
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 12,
    width: 86,
    gap: 6,
  },
  deleteActionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
