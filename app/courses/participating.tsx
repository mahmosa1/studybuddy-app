import { auth, db } from '@/lib/firebaseConfig';
import { useUser } from '@/lib/UserContext';
import { fetchTutorSupportRequestsForStudent } from '@/lib/tutorSupportRequestService';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, onSnapshot } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView } from 'react-native';

type ParticipationSource = 'lecturer' | 'tutor';

type ParticipatingCourse = {
  id: string;
  name: string;
  lecturer: string;
  tutorName?: string;
  sources: ParticipationSource[];
};

type ParticipatingCourseRaw = ParticipatingCourse & {
  ownerUid: string;
};

export default function ParticipatingCoursesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { role } = useUser();
  const [search, setSearch] = useState('');
  const [courses, setCourses] = useState<ParticipatingCourse[]>([]);
  const [sourceFilter, setSourceFilter] = useState<'all' | ParticipationSource>('all');

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setCourses([]);
      return;
    }

    const applyMergedCourses = async (snap: any) => {
      const lecturerCourses: ParticipatingCourse[] = snap.docs
        .map((d: any) => {
          const data = d.data() as any;
          const membershipCandidates = [
            data?.participantUids,
            data?.participants,
            data?.enrolledStudentUids,
            data?.studentUids,
            data?.sharedWithUids,
            data?.sharedWith,
          ];
          const isParticipatingViaLecturer = membershipCandidates.some(
            (field) => Array.isArray(field) && field.map((x: any) => String(x)).includes(user.uid)
          );
          return {
            id: d.id,
            name: data?.name || 'Course',
            lecturer: data?.lecturer || data?.ownerName || '',
            ownerUid: data?.ownerUid || '',
            isParticipatingViaLecturer,
          } as ParticipatingCourseRaw;
        })
        // IMPORTANT: show lecturer courses only when student is explicitly enrolled/participating.
        .filter((c: any) => !!c.ownerUid && c.ownerUid !== user.uid && c.isParticipatingViaLecturer)
        .map((c) => ({
          id: c.id,
          name: c.name,
          lecturer: c.lecturer || t('courses.hub.unknownLecturer'),
          sources: ['lecturer'] as ParticipationSource[],
        }));

      const byCourseId = new Map<string, ParticipatingCourse>();
      lecturerCourses.forEach((course) => {
        byCourseId.set(course.id, course);
      });

      try {
        const tutorRequests = await fetchTutorSupportRequestsForStudent(user.uid);
        const acceptedTutorCourses = tutorRequests.filter((r) => r.status === 'accepted');
        acceptedTutorCourses.forEach((req) => {
          const existing = byCourseId.get(req.courseId);
          if (existing) {
            if (!existing.sources.includes('tutor')) {
              existing.sources = [...existing.sources, 'tutor'];
            }
            if (!existing.tutorName && req.tutorName) {
              existing.tutorName = req.tutorName;
            }
          } else {
            byCourseId.set(req.courseId, {
              id: req.courseId,
              name: req.courseName || 'Course',
              lecturer: t('courses.hub.unknownLecturer'),
              tutorName: req.tutorName || '',
              sources: ['tutor'],
            });
          }
        });
      } catch (error) {
        console.log('Failed loading tutor-participation courses:', error);
      }

      setCourses(Array.from(byCourseId.values()));
    };

    const unsub = onSnapshot(collection(db, 'courses'), (snap) => {
      applyMergedCourses(snap);
    });
    return unsub;
  }, [t]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const bySource = sourceFilter === 'all'
      ? courses
      : courses.filter((c) => c.sources.includes(sourceFilter));
    if (!q) return bySource;
    return bySource.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      c.lecturer.toLowerCase().includes(q) ||
      (c.tutorName || '').toLowerCase().includes(q)
    );
  }, [courses, search, sourceFilter]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('courses.hub.participatingTitle')}</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color="#6b7280" />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={t('search.searchPlaceholder')}
          placeholderTextColor="#9ca3af"
        />
      </View>
      <View style={styles.filtersRow}>
        <TouchableOpacity
          style={[styles.filterChip, sourceFilter === 'all' && styles.filterChipActive]}
          onPress={() => setSourceFilter('all')}
        >
          <Text style={[styles.filterChipText, sourceFilter === 'all' && styles.filterChipTextActive]}>
            {t('courses.hub.participatingFilterAll')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, sourceFilter === 'lecturer' && styles.filterChipActive]}
          onPress={() => setSourceFilter('lecturer')}
        >
          <Text style={[styles.filterChipText, sourceFilter === 'lecturer' && styles.filterChipTextActive]}>
            {t('courses.hub.participatingFilterLecturer')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, sourceFilter === 'tutor' && styles.filterChipActive]}
          onPress={() => setSourceFilter('tutor')}
        >
          <Text style={[styles.filterChipText, sourceFilter === 'tutor' && styles.filterChipTextActive]}>
            {t('courses.hub.participatingFilterTutor')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="people-outline" size={36} color="#9ca3af" />
            <Text style={styles.emptyTitle}>{t('courses.hub.participatingEmptyTitle')}</Text>
            <Text style={styles.emptyText}>{t('courses.hub.participatingEmptySubtitle')}</Text>
          </View>
        ) : (
          filtered.map((course) => (
            <TouchableOpacity
              key={course.id}
              style={styles.card}
              activeOpacity={0.8}
              onPress={() => {
                if (role === 'lecturer') {
                  router.push({ pathname: '/lecturer-course/[courseId]' as any, params: { courseId: course.id, name: course.name } });
                  return;
                }
                router.push({ pathname: '/course/[courseId]' as any, params: { courseId: course.id, name: course.name } });
              }}
            >
              <View style={styles.iconWrap}>
                <Ionicons name="book-outline" size={18} color="#047857" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{course.name}</Text>
                {course.sources.includes('lecturer') ? (
                  <Text style={styles.meta}>{course.lecturer}</Text>
                ) : null}
                <View style={styles.sourceRow}>
                  {course.sources.includes('lecturer') ? (
                    <View style={styles.sourceBadge}>
                      <Text style={styles.sourceBadgeText}>{t('courses.hub.participatingSourceLecturer')}</Text>
                    </View>
                  ) : null}
                  {course.sources.includes('tutor') ? (
                    <View style={[styles.sourceBadge, styles.sourceBadgeTutor]}>
                      <Text style={styles.sourceBadgeText}>{t('courses.hub.participatingSourceTutor')}</Text>
                    </View>
                  ) : null}
                </View>
                {course.sources.includes('tutor') && course.tutorName ? (
                  <Text style={styles.meta}>{t('courses.hub.participatingTutorName', { name: course.tutorName })}</Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
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
  searchRow: {
    margin: 14,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: { flex: 1, color: '#111827', fontSize: 14 },
  filtersRow: {
    marginHorizontal: 14,
    marginBottom: 6,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  filterChip: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 6,
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  filterChipText: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  content: { paddingHorizontal: 14, paddingBottom: 30, paddingTop: 6 },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 70 },
  emptyTitle: { marginTop: 8, color: '#111827', fontSize: 16, fontWeight: '700' },
  emptyText: { marginTop: 4, color: '#6b7280', fontSize: 13, textAlign: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { color: '#111827', fontSize: 16, fontWeight: '700' },
  meta: { marginTop: 2, color: '#6b7280', fontSize: 12 },
  sourceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  sourceBadge: {
    borderRadius: 999,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sourceBadgeTutor: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  sourceBadgeText: {
    color: '#047857',
    fontSize: 11,
    fontWeight: '700',
  },
});

