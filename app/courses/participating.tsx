import { auth, db } from '@/lib/firebaseConfig';
import { useUser } from '@/lib/UserContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, onSnapshot } from 'firebase/firestore';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type ParticipatingCourse = {
  id: string;
  name: string;
  lecturer: string;
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

  React.useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setCourses([]);
      return;
    }
    const unsub = onSnapshot(collection(db, 'courses'), (snap) => {
      const list: ParticipatingCourse[] = snap.docs
        .map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data?.name || 'Course',
            lecturer: data?.lecturer || data?.ownerName || '',
            ownerUid: data?.ownerUid || '',
          } as ParticipatingCourseRaw;
        })
        .filter((c) => !!c.ownerUid && c.ownerUid !== user.uid)
        .map((c) => ({
          id: c.id,
          name: c.name,
          lecturer: c.lecturer || t('courses.hub.unknownLecturer'),
        }));
      setCourses(list);
    });
    return unsub;
  }, [t]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) => c.name.toLowerCase().includes(q) || c.lecturer.toLowerCase().includes(q));
  }, [courses, search]);

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
                <Text style={styles.meta}>{course.lecturer}</Text>
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
  content: { paddingHorizontal: 14, paddingBottom: 30 },
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
});

