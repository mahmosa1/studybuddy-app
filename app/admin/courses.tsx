// app/admin/courses.tsx
import { AppCard } from '@/frontend/components/ui/AppCard';
import { EmptyState } from '@/frontend/components/ui/EmptyState';
import { AppHeader } from '@/frontend/components/ui/AppHeader';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { SectionTitle } from '@/frontend/components/ui/SectionTitle';
import { spacing } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
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
  I18nManager,
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
  createdAt?: any;
};

type LocalCourseFilter = 'all' | 'withOwner' | 'withoutOwner' | 'withInstitution' | 'withoutInstitution';

export default function AdminCoursesManagementScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const isRtl = I18nManager.isRTL;
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<CourseItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<LocalCourseFilter>('all');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadCourses();
  }, []);

  useEffect(() => {
    const searchMatched = searchQuery.trim()
      ? courses.filter(
        (course) =>
          course.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (course.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (course.ownerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (course.institution || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
      : courses;

    const filterMatched = searchMatched.filter((course) => {
      const hasOwner = Boolean((course.ownerName || '').trim());
      const hasInstitution = Boolean((course.institution || '').trim());
      switch (selectedFilter) {
        case 'withOwner':
          return hasOwner;
        case 'withoutOwner':
          return !hasOwner;
        case 'withInstitution':
          return hasInstitution;
        case 'withoutInstitution':
          return !hasInstitution;
        default:
          return true;
      }
    });

    setFilteredCourses(filterMatched);
  }, [searchQuery, selectedFilter, courses]);

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
          createdAt: data.createdAt,
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
    <AppCard style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.cardAccentLine, { backgroundColor: colors.primary }]} />
      <View style={[styles.courseHeader, isRtl && styles.rtlRow]}>
        <View style={[styles.courseIconContainer, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Ionicons name="book" size={22} color={colors.primary} />
        </View>
        <View style={styles.courseInfo}>
          <Text style={[styles.courseName, { color: colors.textPrimary }, isRtl && styles.rtlText]}>{item.name}</Text>
          {item.description && (
            <Text style={[styles.courseDescription, { color: colors.textSecondary }, isRtl && styles.rtlText]} numberOfLines={2}>
              {item.description}
            </Text>
          )}
        </View>
      </View>

      <View style={[styles.courseMetaContainer, { borderTopColor: colors.border }, isRtl && styles.rtlRow]}>
        {item.institution && (
          <View style={[styles.metaTag, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }, isRtl && styles.rtlRow]}>
            <Ionicons name="business-outline" size={12} color={colors.textSecondary} />
            <Text style={[styles.metaTagText, { color: colors.textSecondary }]}>{item.institution}</Text>
          </View>
        )}
        <View style={[styles.metaTag, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }, isRtl && styles.rtlRow]}>
          <Ionicons name="person-outline" size={12} color={colors.textSecondary} />
          <Text style={[styles.metaTagText, { color: colors.textSecondary }]}>{item.ownerName}</Text>
        </View>
        {item.createdAt?.toDate?.() instanceof Date && (
          <View style={[styles.metaTag, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }, isRtl && styles.rtlRow]}>
            <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
            <Text style={[styles.metaTagText, { color: colors.textSecondary }]}>
              {item.createdAt.toDate().toLocaleDateString()}
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[
          styles.deleteButton,
          {
            backgroundColor: colors.surfaceMuted,
            borderColor: colors.danger,
          },
          deletingId === item.id && styles.deleteButtonDisabled,
        ]}
        onPress={() => handleDeleteCourse(item.id, item.name)}
        disabled={deletingId === item.id}
      >
        {deletingId === item.id ? (
          <ActivityIndicator color={colors.danger} />
        ) : (
          <>
            <Ionicons name="trash-outline" size={15} color={colors.danger} />
            <Text style={[styles.deleteButtonText, { color: colors.danger }]}>{t('admin.deleteCourse')}</Text>
          </>
        )}
      </TouchableOpacity>
    </AppCard>
  );

  const filterOptions: Array<{ key: LocalCourseFilter; label: string }> = [
    { key: 'all', label: t('admin.courseFilters.all') },
    { key: 'withOwner', label: t('admin.courseFilters.withOwner') },
    { key: 'withoutOwner', label: t('admin.courseFilters.withoutOwner') },
    { key: 'withInstitution', label: t('admin.courseFilters.withInstitution') },
    { key: 'withoutInstitution', label: t('admin.courseFilters.withoutInstitution') },
  ];

  return (
    <AppScreen>
      <AppHeader title={t('admin.courseManagement')} onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.heroGlowPrimary, { backgroundColor: colors.primary }]} />
          <View style={[styles.heroGlowAccent, { backgroundColor: colors.accent }]} />
          <View style={[styles.heroBadge, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }, isRtl && styles.rtlRow]}>
            <Ionicons name="library-outline" size={14} color={colors.primary} />
            <Text style={[styles.heroBadgeText, { color: colors.textSecondary }]}>{t('admin.courseManagement')}</Text>
          </View>
          <SectionTitle title={t('admin.courseManagement')} subtitle={t('admin.courseManagementDescription')} />
        </View>

        <AppCard style={[styles.searchPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.searchBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }, isRtl && styles.rtlRow]}>
            <Ionicons name="search-outline" size={18} color={colors.textSecondary} style={[styles.searchIcon, isRtl && styles.rtlSearchIcon]} />
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary, textAlign: isRtl ? 'right' : 'left' }]}
              placeholder={t('admin.searchCoursesPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.filterRow, isRtl && styles.rtlRow]}
            style={styles.filterScroll}
          >
            {filterOptions.map((option) => {
              const selected = option.key === selectedFilter;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: selected ? colors.primary : colors.surfaceMuted,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedFilter(option.key)}
                >
                  <Text style={[styles.filterChipText, { color: selected ? colors.textOnPrimary : colors.textPrimary }]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </AppCard>

        {/* Results Count */}
        {!loading && filteredCourses.length > 0 && (
          <Text style={[styles.resultsCount, { color: colors.textSecondary }, isRtl && styles.rtlText]}>
            {filteredCourses.length === 1
              ? t('admin.courseFound', { count: filteredCourses.length })
              : t('admin.coursesFound', { count: filteredCourses.length })}
          </Text>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t('admin.loadingCourses')}</Text>
          </View>
        ) : filteredCourses.length === 0 ? (
          <AppCard style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <EmptyState
              title={(searchQuery.trim() || selectedFilter !== 'all') ? t('admin.noCoursesFound') : t('admin.noCoursesInSystem')}
              subtitle={(searchQuery.trim() || selectedFilter !== 'all') ? t('admin.tryAdjustingSearch') : t('admin.coursesWillAppear')}
            />
          </AppCard>
        ) : (
          <View style={styles.coursesList}>
            {filteredCourses.map((item) => (
              <View key={item.id}>{renderCourse({ item })}</View>
            ))}
          </View>
        )}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  heroWrap: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  heroGlowPrimary: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    top: -72,
    right: -38,
    opacity: 0.08,
  },
  heroGlowAccent: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    bottom: -52,
    left: -26,
    opacity: 0.1,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
    marginBottom: spacing.sm,
  },
  heroBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  searchPanel: {
    marginBottom: spacing.sm,
  },
  filterScroll: {
    marginTop: 10,
  },
  filterRow: {
    gap: 8,
    paddingHorizontal: 2,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    minHeight: 46,
  },
  searchIcon: {
    marginRight: 8,
  },
  rtlSearchIcon: {
    marginRight: 0,
    marginLeft: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  resultsCount: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.sm,
    paddingHorizontal: 4,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 42,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
  },
  emptyState: {
    paddingVertical: 8,
    marginTop: spacing.sm,
  },
  coursesList: {
    gap: 10,
  },
  card: {
    overflow: 'hidden',
  },
  cardAccentLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.65,
  },
  courseHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  courseIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
  },
  courseInfo: {
    flex: 1,
  },
  courseName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  courseDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  courseMetaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  metaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
  },
  metaTagText: {
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '500',
  },
  deleteButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
    gap: 6,
    borderWidth: 1,
  },
  deleteButtonDisabled: {
    opacity: 0.7,
  },
  deleteButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  rtlRow: {
    flexDirection: 'row-reverse',
  },
  rtlText: {
    textAlign: 'right',
  },
});

