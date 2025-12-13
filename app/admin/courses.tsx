// app/admin/courses.tsx
import { db } from '@/lib/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

type CourseItem = {
  id: string;
  name: string;
  description?: string;
  institution?: string;
  ownerUid: string;
  ownerName?: string;
};

export default function AdminCoursesManagementScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<CourseItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadCourses();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = courses.filter(
        (course) =>
          course.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (course.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (course.ownerName || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredCourses(filtered);
    } else {
      setFilteredCourses(courses);
    }
  }, [searchQuery, courses]);

  const loadCourses = async () => {
    try {
      setLoading(true);
      const coursesRef = collection(db, 'courses');
      const snapshot = await getDocs(coursesRef);

      const list: CourseItem[] = [];
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data() as any;
        
        // Try to get owner name
        let ownerName = t('admin.unknown');
        try {
          const ownerDocSnap = await getDoc(doc(db, 'users', data.ownerUid));
          if (ownerDocSnap.exists()) {
            const ownerData = ownerDocSnap.data();
            ownerName = ownerData.fullName || ownerData.username || t('admin.unknown');
          }
        } catch (err) {
          console.log('Error loading owner name:', err);
        }

        list.push({
          id: docSnap.id,
          name: data.name,
          description: data.description,
          institution: data.institution,
          ownerUid: data.ownerUid,
          ownerName,
        });
      }

      setCourses(list);
      setFilteredCourses(list);
    } catch (err) {
      console.log('Error loading courses:', err);
      Alert.alert(t('common.error'), t('admin.failedToLoadCourses'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCourse = (courseId: string, courseName: string) => {
    Alert.alert(
      t('admin.deleteCourse'),
      t('admin.deleteCourseConfirm', { courseName }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingId(courseId);
              await deleteDoc(doc(db, 'courses', courseId));
              await loadCourses();
            } catch (err) {
              console.log('Delete course error:', err);
              Alert.alert(t('common.error'), t('admin.failedToDeleteCourse'));
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const renderCourse = ({ item }: { item: CourseItem }) => (
    <View style={styles.card}>
      <View style={styles.courseHeader}>
        <View style={styles.courseIconContainer}>
          <Ionicons name="book" size={24} color={ACCENT_GREEN} />
        </View>
        <View style={styles.courseInfo}>
          <Text style={styles.courseName}>{item.name}</Text>
          {item.description && (
            <Text style={styles.courseDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.courseMetaContainer}>
        {item.institution && (
          <View style={styles.metaTag}>
            <Ionicons name="business-outline" size={12} color="#6b7280" />
            <Text style={styles.metaTagText}>{item.institution}</Text>
          </View>
        )}
        <View style={styles.metaTag}>
          <Ionicons name="person-outline" size={12} color="#6b7280" />
          <Text style={styles.metaTagText}>{item.ownerName}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.deleteButton, deletingId === item.id && styles.deleteButtonDisabled]}
        onPress={() => handleDeleteCourse(item.id, item.name)}
        disabled={deletingId === item.id}
      >
        {deletingId === item.id ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <>
            <Ionicons name="trash-outline" size={18} color="#ffffff" />
            <Text style={styles.deleteButtonText}>{t('admin.deleteCourse')}</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButtonHeader}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Ionicons name="library" size={32} color="#ffffff" />
          <Text style={styles.headerTitle}>{t('admin.courseManagement')}</Text>
          <Text style={styles.headerSubtitle}>
            {t('admin.courseManagementDescription')}
          </Text>
        </View>

        {/* Search Box */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={20} color="#6b7280" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('admin.searchCoursesPlaceholder')}
              placeholderTextColor="#6b7280"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#6b7280" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Results Count */}
        {!loading && filteredCourses.length > 0 && (
          <Text style={styles.resultsCount}>
            {filteredCourses.length === 1
              ? t('admin.courseFound', { count: filteredCourses.length })
              : t('admin.coursesFound', { count: filteredCourses.length })}
          </Text>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={PRIMARY_GREEN} />
            <Text style={styles.loadingText}>{t('admin.loadingCourses')}</Text>
          </View>
        ) : filteredCourses.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name={searchQuery ? "search-outline" : "book-outline"}
              size={64}
              color="#6b7280"
            />
            <Text style={styles.emptyTitle}>
              {searchQuery ? t('admin.noCoursesFound') : t('admin.noCoursesInSystem')}
            </Text>
            <Text style={styles.emptyText}>
              {searchQuery
                ? t('admin.tryAdjustingSearch')
                : t('admin.coursesWillAppear')}
            </Text>
          </View>
        ) : (
          <View style={styles.coursesList}>
            {filteredCourses.map((item) => (
              <View key={item.id}>{renderCourse({ item })}</View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const PRIMARY_GREEN = '#047857';
const ACCENT_GREEN = '#047857';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    backgroundColor: PRIMARY_GREEN,
    paddingTop: 60,
    paddingBottom: 30,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: -30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  backButtonHeader: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 10,
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#ffffff',
    opacity: 0.9,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#374151',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  resultsCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    marginTop: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#6b7280',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    marginTop: 20,
    marginHorizontal: 20,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#374151',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  coursesList: {
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  courseHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  courseIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  courseInfo: {
    flex: 1,
  },
  courseName: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  courseDescription: {
    color: '#6b7280',
    fontSize: 13,
    lineHeight: 18,
  },
  courseMetaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  metaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  metaTagText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 6,
    fontWeight: '500',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  deleteButtonDisabled: {
    opacity: 0.7,
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});

