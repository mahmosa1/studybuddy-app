// app/profile/system-updates.tsx — System / tutor approval updates with received time
import { auth, db } from '@/lib/firebaseConfig';
import {
  addDismissedSystemUpdateKey,
  buildSystemUpdatesSignature,
  getDismissedSystemUpdateKeys,
  setTutorUpdatesSeenSignature,
} from '@/lib/profileSystemUpdates';
import {
  fetchStudentCourseJoinOutcomes,
  type CourseJoinRequest,
} from '@/lib/courseJoinRequestService';
import {
  fetchTutorSupportRequestsForStudent,
  fetchTutorSupportRequestsForTutor,
  reviewTutorSupportRequest,
  TutorSupportRequestDoc,
} from '@/lib/tutorSupportRequestService';
import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppHeader } from '@/frontend/components/ui/AppHeader';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { layout, spacing } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useCallback, useMemo, useState } from 'react';
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
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';

type TutorRow = { courseId: string; courseName: string; approvedAt?: string };

type SystemUpdatesMergedItem =
  | { kind: 'courseJoin'; sortMs: number; request: CourseJoinRequest; lecturerName?: string }
  | { kind: 'tutorRequest'; sortMs: number; req: TutorSupportRequestDoc }
  | { kind: 'tutorRibbon'; sortMs: number; row: TutorRow }
  | { kind: 'studentTutorDecision'; sortMs: number; req: TutorSupportRequestDoc };

const ACCENT = '#047857';

function formatReceivedAt(iso: string | undefined, lang: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const locale = lang === 'he' ? 'he-IL' : 'en-US';
  return d.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}

function parseApprovedAtMs(approvedAt: string | undefined): number {
  if (!approvedAt) return 0;
  const t = new Date(approvedAt).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function courseJoinOutcomeSortMs(request: CourseJoinRequest): number {
  if (request.status === 'approved') {
    return (
      request.approvedAt?.toMillis?.() ??
      request.updatedAt?.toMillis?.() ??
      0
    );
  }
  return request.rejectedAt?.toMillis?.() ?? request.updatedAt?.toMillis?.() ?? 0;
}

function courseJoinDismissKey(request: CourseJoinRequest): string {
  return `course-join:${request.id}:${request.status}`;
}

function buildSystemUpdatesMergedFeed(params: {
  courseJoinOutcomes: CourseJoinRequest[];
  lecturerNamesByUid: Record<string, string>;
  tutorRibbonRows: TutorRow[];
  tutorRequests: TutorSupportRequestDoc[];
  studentDecisionRequests: TutorSupportRequestDoc[];
}): SystemUpdatesMergedItem[] {
  const {
    courseJoinOutcomes,
    lecturerNamesByUid,
    tutorRibbonRows,
    tutorRequests,
    studentDecisionRequests,
  } = params;
  const items: SystemUpdatesMergedItem[] = [];

  courseJoinOutcomes.forEach((request) => {
    const lecturerName = request.lecturerUid
      ? lecturerNamesByUid[request.lecturerUid]?.trim()
      : undefined;
    items.push({
      kind: 'courseJoin',
      sortMs: courseJoinOutcomeSortMs(request),
      request,
      lecturerName: lecturerName || undefined,
    });
  });

  tutorRequests.forEach((req) => {
    items.push({
      kind: 'tutorRequest',
      sortMs: (req.createdAt as any)?.toMillis?.() ?? 0,
      req,
    });
  });

  tutorRibbonRows.forEach((row) => {
    items.push({
      kind: 'tutorRibbon',
      sortMs: parseApprovedAtMs(row.approvedAt),
      row,
    });
  });

  studentDecisionRequests.forEach((req) => {
    items.push({
      kind: 'studentTutorDecision',
      sortMs:
        (req.reviewedAt as any)?.toMillis?.() ??
        (req.createdAt as any)?.toMillis?.() ??
        0,
      req,
    });
  });

  return items.sort((a, b) => b.sortMs - a.sortMs);
}

function isMergedItemDismissed(item: SystemUpdatesMergedItem, dismissedKeys: string[]): boolean {
  if (item.kind === 'courseJoin') {
    return dismissedKeys.includes(courseJoinDismissKey(item.request));
  }
  if (item.kind === 'tutorRequest') {
    return dismissedKeys.includes(`request:${item.req.id}`);
  }
  if (item.kind === 'tutorRibbon') {
    const { row } = item;
    return dismissedKeys.includes(`approved:${row.courseId}:${row.approvedAt ?? ''}`);
  }
  return dismissedKeys.includes(`student-request:${item.req.id}`);
}

export default function SystemUpdatesScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const isHebrewUi = i18n.language === 'he';

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<TutorRow[]>([]);
  const [tutorRequests, setTutorRequests] = useState<TutorSupportRequestDoc[]>([]);
  const [studentDecisionRequests, setStudentDecisionRequests] = useState<TutorSupportRequestDoc[]>([]);
  const [courseJoinOutcomes, setCourseJoinOutcomes] = useState<CourseJoinRequest[]>([]);
  const [lecturerNamesByUid, setLecturerNamesByUid] = useState<Record<string, string>>({});
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
          const joinOutcomes = await fetchStudentCourseJoinOutcomes(user.uid);
          const lectUids = new Set<string>();
          joinOutcomes.forEach((o) => {
            if (o.lecturerUid) lectUids.add(o.lecturerUid);
          });
          const lectNames: Record<string, string> = {};
          await Promise.all(
            [...lectUids].map(async (lectUid) => {
              try {
                const u = await getDoc(doc(db, 'users', lectUid));
                if (u.exists()) {
                  const d = u.data() as any;
                  const n = String(d.fullName || d.username || '').trim();
                  if (n) lectNames[lectUid] = n;
                }
              } catch {
                // ignore name resolution failures
              }
            }),
          );
          const dismissed = await getDismissedSystemUpdateKeys(user.uid);
          if (!cancelled) {
            setItems(list);
            setTutorRequests(allTutorRequests);
            setStudentDecisionRequests(studentDecisions);
            setCourseJoinOutcomes(joinOutcomes);
            setLecturerNamesByUid(lectNames);
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
            setCourseJoinOutcomes([]);
            setLecturerNamesByUid({});
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

  const mergedFeed = useMemo(
    () =>
      buildSystemUpdatesMergedFeed({
        courseJoinOutcomes,
        lecturerNamesByUid,
        tutorRibbonRows: items,
        tutorRequests,
        studentDecisionRequests,
      }),
    [courseJoinOutcomes, lecturerNamesByUid, items, tutorRequests, studentDecisionRequests],
  );

  const visibleMergedFeed = useMemo(
    () => mergedFeed.filter((entry) => !isMergedItemDismissed(entry, dismissedKeys)),
    [mergedFeed, dismissedKeys],
  );

  const dismissUpdate = async (key: string) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setDismissedKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
    await addDismissedSystemUpdateKey(uid, key);
  };

  const courseJoinLineText = (request: CourseJoinRequest, lecturerName?: string) => {
    const courseName = request.courseName || t('lecturer.course');
    const lang = i18n.language || '';
    const isHe = lang === 'he' || lang.startsWith('he');
    if (request.status === 'approved') {
      if (isHe) {
        return lecturerName
          ? t('profile.systemUpdateCourseJoinApprovedNamedLine', { courseName, lecturerName })
          : t('profile.systemUpdateCourseJoinApprovedLine', { courseName });
      }
      return t('profile.systemUpdateCourseJoinApprovedLine', { courseName });
    }
    if (isHe) {
      return lecturerName
        ? t('profile.systemUpdateCourseJoinRejectedNamedLine', { courseName, lecturerName })
        : t('profile.systemUpdateCourseJoinRejectedLine', { courseName });
    }
    return t('profile.systemUpdateCourseJoinRejectedLine', { courseName });
  };

  const courseJoinAccessibilityLabel = (request: CourseJoinRequest, body: string) => {
    const heading =
      request.status === 'approved'
        ? t('profile.systemUpdateCourseJoinApprovedTitle')
        : t('profile.systemUpdateCourseJoinRejectedTitle');
    return `${heading}. ${body}`;
  };

  const courseJoinReceivedWhen = (request: CourseJoinRequest) => {
    const ts = request.status === 'approved' ? request.approvedAt : request.rejectedAt;
    const ms = ts?.toMillis?.() ?? request.updatedAt?.toMillis?.() ?? 0;
    return ms ? formatReceivedAt(new Date(ms).toISOString(), i18n.language) : '—';
  };

  const renderDeleteAction = (updateKey: string) => (
    <TouchableOpacity style={styles.deleteAction} onPress={() => dismissUpdate(updateKey)}>
      <Ionicons name="trash-outline" size={18} color="#ffffff" />
      <Text style={styles.deleteActionText}>{t('common.delete')}</Text>
    </TouchableOpacity>
  );

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <AppScreen>
      <AppHeader title={t('profile.systemUpdatesTitle')} onBack={() => router.back()} />
      <View style={[styles.topDecorWrap, { borderBottomColor: colors.border }]}>
        <View style={[styles.topDecorPrimary, { backgroundColor: colors.primary }]} />
        <View style={[styles.topDecorAccent, { backgroundColor: colors.accent }]} />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {visibleMergedFeed.length === 0 ? (
            <AppCard style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.emptyIconBadge, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                <Ionicons name="notifications-outline" size={24} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
                {t('profile.systemUpdatesEmpty')}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
                {t('profile.systemUpdatesTitle')}
              </Text>
            </AppCard>
          ) : (
            <>
              {visibleMergedFeed.map((entry) => {
                if (entry.kind === 'courseJoin') {
                  const { request, lecturerName } = entry;
                  const body = courseJoinLineText(request, lecturerName);
                  const updateKey = courseJoinDismissKey(request);
                  return (
                    <Swipeable
                      key={`course-join-${request.id}-${request.status}`}
                      overshootRight={false}
                      renderRightActions={() => renderDeleteAction(updateKey)}
                    >
                      <AppCard
                        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        accessibilityLabel={courseJoinAccessibilityLabel(request, body)}
                      >
                        <View style={[styles.cardHeader, isHebrewUi && styles.rtlRow]}>
                          <View
                            style={[
                              styles.statusBadge,
                              {
                                backgroundColor: colors.surfaceMuted,
                                borderColor: request.status === 'approved' ? colors.success : colors.danger,
                              },
                            ]}
                          >
                            <Ionicons
                              name={request.status === 'approved' ? 'checkmark' : 'close'}
                              size={14}
                              color={request.status === 'approved' ? colors.success : colors.danger}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.cardTitle, isHebrewUi && styles.rtlText]} numberOfLines={4}>
                              {body}
                            </Text>
                            <Text style={[styles.cardMeta, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
                              {t('profile.systemUpdateReceivedAt', { when: courseJoinReceivedWhen(request) })}
                            </Text>
                          </View>
                        </View>
                      </AppCard>
                    </Swipeable>
                  );
                }

                if (entry.kind === 'tutorRequest') {
                  const req = entry.req;
                  const requestCreatedAtMs = (req.createdAt as any)?.toMillis?.() ?? 0;
                  const requestWhen = requestCreatedAtMs
                    ? formatReceivedAt(new Date(requestCreatedAtMs).toISOString(), i18n.language)
                    : '—';
                  const busy = updatingRequestId === req.id;
                  const pending = req.status === 'pending';
                  return (
                    <Swipeable
                      key={`tutor-req-${req.id}`}
                      overshootRight={false}
                      renderRightActions={() => renderDeleteAction(`request:${req.id}`)}
                    >
                      <AppCard style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={[styles.cardHeader, isHebrewUi && styles.rtlRow]}>
                          <TouchableOpacity
                            onPress={() => router.push(`/user-profile/${req.studentUid}` as any)}
                            activeOpacity={0.8}
                          >
                            {req.studentAvatarUrl ? (
                              <Image source={{ uri: req.studentAvatarUrl }} style={styles.requestAvatar} />
                            ) : (
                              <View style={[styles.requestAvatarFallback, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                                <Ionicons name="person-outline" size={18} color={colors.primary} />
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
                            <Text style={[styles.cardMeta, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
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
                      </AppCard>
                    </Swipeable>
                  );
                }

                if (entry.kind === 'tutorRibbon') {
                  const c = entry.row;
                  return (
                    <Swipeable
                      key={`tutor-ribbon-${c.courseId}:${c.approvedAt ?? ''}`}
                      overshootRight={false}
                      renderRightActions={() =>
                        renderDeleteAction(`approved:${c.courseId}:${c.approvedAt ?? ''}`)
                      }
                    >
                      <AppCard style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <View style={[styles.cardHeader, isHebrewUi && styles.rtlRow]}>
                          <View style={[styles.statusBadge, { backgroundColor: colors.surfaceMuted, borderColor: colors.primary }]}>
                            <Ionicons name="ribbon-outline" size={14} color={colors.primary} />
                          </View>
                          <Text style={[styles.cardTitle, isHebrewUi && styles.rtlText]} numberOfLines={3}>
                            {t('profile.systemUpdateTutorLine', { courseName: c.courseName })}
                          </Text>
                        </View>
                        <Text style={[styles.cardMeta, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
                          {t('profile.systemUpdateReceivedAt', {
                            when: formatReceivedAt(c.approvedAt, i18n.language),
                          })}
                        </Text>
                      </AppCard>
                    </Swipeable>
                  );
                }

                const req = entry.req;
                const whenMs =
                  (req.reviewedAt as any)?.toMillis?.() ?? (req.createdAt as any)?.toMillis?.() ?? 0;
                const when = whenMs ? formatReceivedAt(new Date(whenMs).toISOString(), i18n.language) : '—';
                return (
                  <Swipeable
                    key={`student-tutor-${req.id}`}
                    overshootRight={false}
                    renderRightActions={() => renderDeleteAction(`student-request:${req.id}`)}
                  >
                    <AppCard style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <View style={[styles.cardHeader, isHebrewUi && styles.rtlRow]}>
                        <View
                          style={[
                            styles.statusBadge,
                            {
                              backgroundColor: colors.surfaceMuted,
                              borderColor: req.status === 'accepted' ? colors.success : colors.danger,
                            },
                          ]}
                        >
                          <Ionicons
                            name={req.status === 'accepted' ? 'checkmark' : 'close'}
                            size={14}
                            color={req.status === 'accepted' ? colors.success : colors.danger}
                          />
                        </View>
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
                          <Text style={[styles.cardMeta, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
                            {t('profile.systemUpdateReceivedAt', { when })}
                          </Text>
                        </View>
                      </View>
                    </AppCard>
                  </Swipeable>
                );
              })}
            </>
          )}
        </ScrollView>
      )}
      </AppScreen>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  gestureRoot: { flex: 1 },
  topDecorWrap: {
    position: 'relative',
    overflow: 'hidden',
    height: 26,
    marginHorizontal: layout.screenPadding,
    marginTop: -2,
    marginBottom: 2,
    borderBottomWidth: 1,
  },
  topDecorPrimary: {
    position: 'absolute',
    width: 128,
    height: 128,
    borderRadius: 64,
    top: -108,
    right: -14,
    opacity: 0.055,
  },
  topDecorAccent: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
    top: -88,
    left: -8,
    opacity: 0.07,
  },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  rtlRow: { flexDirection: 'row-reverse' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: layout.screenPadding, paddingTop: spacing.xs, paddingBottom: 40, gap: spacing.sm },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  emptyIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700' },
  emptySubtitle: { fontSize: 13, fontWeight: '500', marginTop: 6 },
  card: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
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
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 21,
  },
  cardMeta: {
    fontSize: 12.5,
    fontWeight: '500',
    marginTop: 3,
  },
  statusBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    borderWidth: 1,
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
    width: 92,
    gap: 6,
  },
  deleteActionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
