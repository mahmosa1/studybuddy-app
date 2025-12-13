// app/(tabs)/courses.tsx
import { auth, db } from '@/lib/firebaseConfig';
import { supabase } from '@/lib/supabaseClient';
import { useUser } from '@/lib/UserContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type Course = {
  id: string;
  name: string;
  lecturer?: string;
  semester?: string;
  yearOfStudy?: number;
  description?: string;
  isPublic?: boolean; // For lecturers: public (read-only) or private
};

export default function CoursesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { role } = useUser();

  const [courses, setCourses] = useState<Course[]>([]);
  const [sharedCourses, setSharedCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Practice data (for students only)
  const [practiceSessions, setPracticeSessions] = useState<any[]>([]);
  const [practiceStats, setPracticeStats] = useState({
    totalPractices: 0,
    averageScore: 0,
    bestScore: 0,
  });
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null);

  // modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseName, setCourseName] = useState('');
  const [courseLecturer, setCourseLecturer] = useState('');
  const [courseSemester, setCourseSemester] = useState('');
  const [courseYear, setCourseYear] = useState('');
  const [courseDescription, setCourseDescription] = useState('');

  // load courses for logged in user
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    const coursesRef = collection(db, 'courses');
    const q = query(coursesRef, where('ownerUid', '==', user.uid));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: Course[] = [];
        snapshot.forEach((docSnap) => {
        const data = docSnap.data() as any;
        list.push({
          id: docSnap.id,
          name: data.name,
          lecturer: data.lecturer,
          semester: data.semester,
          yearOfStudy: data.yearOfStudy,
          description: data.description,
          isPublic: data.isPublic ?? false,
        });
        });
        setCourses(list);
        setLoading(false);
      },
      (err) => {
        console.log('Error loading courses:', err);
        Alert.alert('Error', 'Failed to load courses');
        setLoading(false);
      }
    );

    return unsub;
  }, []);

  // Load shared courses for students (mocked)
  useEffect(() => {
    if (role === 'student') {
      // Mock shared courses from lecturers
      const mockSharedCourses: Course[] = [
        {
          id: 'shared-1',
          name: 'Advanced Algorithms',
          lecturer: 'Dr. Smith',
          semester: 'Fall 2024',
          yearOfStudy: 3,
          description: 'Advanced algorithmic techniques and data structures.',
        },
        {
          id: 'shared-2',
          name: 'Database Systems',
          lecturer: 'Prof. Johnson',
          semester: 'Fall 2024',
          yearOfStudy: 2,
          description: 'Introduction to database design and SQL.',
        },
      ];
      setSharedCourses(mockSharedCourses);
      
      // Load practice data
      loadPracticeData();
    }
  }, [role]);

  const loadPracticeData = () => {
    // Mock practice data
    const mockSessions = [
      {
        id: '1',
        courseName: 'Linear Algebra',
        courseId: 'course1',
        practiceType: 'Mixed',
        numQuestions: 10,
        score: 8,
        totalQuestions: 10,
        date: new Date().toLocaleDateString(),
      },
      {
        id: '2',
        courseName: 'Calculus',
        courseId: 'course2',
        practiceType: 'True/False',
        numQuestions: 20,
        score: 15,
        totalQuestions: 20,
        date: new Date(Date.now() - 86400000).toLocaleDateString(),
      },
      {
        id: '3',
        courseName: 'Data Structures',
        courseId: 'course3',
        practiceType: 'Open Questions',
        numQuestions: 5,
        score: 4,
        totalQuestions: 5,
        date: new Date(Date.now() - 172800000).toLocaleDateString(),
      },
    ];

    setPracticeSessions(mockSessions);

    // Calculate stats
    const total = mockSessions.length;
    const avgScore =
      mockSessions.reduce((sum, s) => sum + (s.score / s.totalQuestions) * 100, 0) / total;
    const bestScore = Math.max(
      ...mockSessions.map((s) => (s.score / s.totalQuestions) * 100)
    );

    setPracticeStats({
      totalPractices: total,
      averageScore: Math.round(avgScore),
      bestScore: Math.round(bestScore),
    });
  };

  const openAddCourseModal = () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Error', 'You must be logged in to add a course.');
      return;
    }

    setCourseName('');
    setCourseLecturer('');
    setCourseSemester('');
    setCourseYear('');
    setCourseDescription('');
    setModalVisible(true);
  };

  const handleSaveCourse = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Error', 'You must be logged in to add a course.');
        return;
      }

      if (!courseName.trim()) {
        Alert.alert('Missing data', 'Please enter a course name.');
        return;
      }

      const coursesRef = collection(db, 'courses');

      // For lecturers, navigate to lecturer add course screen
      if (role === 'lecturer') {
        setModalVisible(false);
        router.push('/lecturer/add-course' as any);
        return;
      }

      // For students, add course directly
      await addDoc(coursesRef, {
        name: courseName.trim(),
        lecturer: courseLecturer.trim() || null,
        semester: courseSemester.trim() || null,
        yearOfStudy: courseYear ? Number(courseYear) : null,
        description: null, // Students don't have description field
        ownerUid: user.uid,
        createdAt: serverTimestamp(),
      });

      setModalVisible(false);
    } catch (err) {
      console.log('Error adding course:', err);
      Alert.alert('Error', 'Failed to add course, please try again.');
    }
  };

  // Helper function to extract path from Supabase public URL
  const getPathFromPublicUrl = (url: string): string | null => {
    try {
      const parts = url.split(
        '/storage/v1/object/public/studybuddy-files/'
      );
      if (parts.length !== 2) return null;
      return parts[1];
    } catch {
      return null;
    }
  };

  const toggleCourseSelection = (courseId: string) => {
    setSelectedCourses((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(courseId)) {
        newSet.delete(courseId);
      } else {
        newSet.add(courseId);
      }
      return newSet;
    });
  };

  const clearSelection = () => {
    setSelectedCourses(new Set());
    setIsSelectionMode(false);
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    if (isSelectionMode) {
      setSelectedCourses(new Set());
    }
  };

  const handleDeleteSelected = () => {
    if (selectedCourses.size === 0) return;

    const courseNames = courses
      .filter((c) => selectedCourses.has(c.id))
      .map((c) => c.name)
      .join(', ');

    Alert.alert(
      'Delete Courses',
      `Are you sure you want to delete ${selectedCourses.size} course(s)? This will also delete all files associated with these courses. This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const courseIds = Array.from(selectedCourses);
              setDeletingCourseId(courseIds[0]); // Show loading on first course

              for (const courseId of courseIds) {
                // 1. Get all files associated with this course
                const filesRef = collection(db, 'courseFiles');
                const filesQuery = query(filesRef, where('courseId', '==', courseId));
                const filesSnap = await getDocs(filesQuery);

                // 2. Delete all files from Supabase storage and Firestore
                const deletePromises: Promise<void>[] = [];
                filesSnap.forEach((fileDoc) => {
                  const fileData = fileDoc.data();
                  const deletePromise = (async () => {
                    // Delete from Supabase storage if URL exists
                    if (fileData.url) {
                      try {
                        const path = getPathFromPublicUrl(fileData.url);
                        if (path) {
                          const { error } = await supabase.storage
                            .from('studybuddy-files')
                            .remove([path]);
                          if (error) {
                            console.log('Supabase delete error:', error);
                          }
                        }
                      } catch (err) {
                        console.log('Error deleting file from Supabase:', err);
                      }
                    }
                    // Delete from Firestore
                    await deleteDoc(doc(db, 'courseFiles', fileDoc.id));
                  })();
                  deletePromises.push(deletePromise);
                });

                // Wait for all file deletions to complete
                await Promise.all(deletePromises);

                // 3. Delete the course itself from Firestore
                await deleteDoc(doc(db, 'courses', courseId));
              }

              clearSelection();
              Alert.alert('Success', 'Selected courses and all associated files deleted successfully.');
            } catch (err) {
              console.log('Error deleting courses:', err);
              Alert.alert('Error', 'Failed to delete courses. Please try again.');
            } finally {
              setDeletingCourseId(null);
            }
          },
        },
      ]
    );
  };

  const handleEditCourse = (course: Course) => {
    setEditingCourse(course);
    setCourseName(course.name);
    setCourseLecturer(course.lecturer || '');
    setCourseSemester(course.semester || '');
    setCourseYear(course.yearOfStudy?.toString() || '');
    setCourseDescription(course.description || '');
    setEditModalVisible(true);
    clearSelection();
  };

  const handleSaveEdit = async () => {
    if (!editingCourse) return;

    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Error', 'You must be logged in to edit a course.');
        return;
      }

      if (!courseName.trim()) {
        Alert.alert('Missing data', 'Please enter a course name.');
        return;
      }

      await updateDoc(doc(db, 'courses', editingCourse.id), {
        name: courseName.trim(),
        lecturer: courseLecturer.trim() || null,
        semester: courseSemester.trim() || null,
        yearOfStudy: courseYear ? Number(courseYear) : null,
        description: courseDescription.trim() || null,
      });

      setEditModalVisible(false);
      setEditingCourse(null);
      Alert.alert('Success', 'Course updated successfully.');
    } catch (err) {
      console.log('Error updating course:', err);
      Alert.alert('Error', 'Failed to update course, please try again.');
    }
  };

  const renderCourse = ({ item }: { item: Course }) => {
    const handleCoursePress = () => {
      // In selection mode, toggle selection instead of navigating
      if (isSelectionMode) {
        toggleCourseSelection(item.id);
        return;
      }

      // Normal mode: navigate to course
      if (role === 'lecturer') {
        router.push({
          pathname: `/lecturer/course/${item.id}` as any,
          params: { name: item.name },
        });
      } else {
        router.push({
          pathname: `/course/${item.id}` as any,
          params: { name: item.name },
        });
      }
    };

    const isSelected = selectedCourses.has(item.id);
    const isDeleting = deletingCourseId === item.id;

    return (
      <TouchableOpacity
        style={[
          styles.courseCard,
          isSelectionMode && styles.courseCardSelectionMode,
          isSelected && styles.courseCardSelected,
          isDeleting && styles.courseCardDeleting,
        ]}
        onPress={handleCoursePress}
        disabled={isDeleting}
        activeOpacity={0.7}
      >
        {isSelectionMode && (
          <View style={styles.checkboxContainer}>
            <Ionicons
              name={isSelected ? 'checkbox' : 'checkbox-outline'}
              size={28}
              color={isSelected ? ACCENT_GREEN : '#9ca3af'}
            />
          </View>
        )}
        <View style={styles.courseIconContainer}>
          <Ionicons name="book" size={24} color={ACCENT_GREEN} />
        </View>
        <View style={styles.courseContent}>
          <Text style={styles.courseTitle}>{item.name}</Text>
          {item.description && (
            <Text style={styles.courseDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}
          <View style={styles.courseMetaContainer}>
            {item.lecturer && role !== 'lecturer' && (
              <View style={styles.metaTag}>
                <Ionicons name="person-outline" size={12} color="#9ca3af" />
                <Text style={styles.metaTagText}>{item.lecturer}</Text>
              </View>
            )}
            {item.semester && (
              <View style={styles.metaTag}>
                <Ionicons name="calendar-outline" size={12} color="#9ca3af" />
                <Text style={styles.metaTagText}>{item.semester}</Text>
              </View>
            )}
            {item.yearOfStudy != null && (
              <View style={styles.metaTag}>
                <Ionicons name="school-outline" size={12} color="#9ca3af" />
                <Text style={styles.metaTagText}>Year {item.yearOfStudy}</Text>
              </View>
            )}
          </View>
        </View>
        {!isSelectionMode && (
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        )}
        {isDeleting && (
          <View style={styles.deletingOverlay}>
            <ActivityIndicator color="#ffffff" size="small" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const handleTogglePublic = async (courseId: string, isPublic: boolean) => {
    try {
      await updateDoc(doc(db, 'courses', courseId), {
        isPublic: isPublic,
      });
      // Update local state
      setCourses((prev) =>
        prev.map((c) => (c.id === courseId ? { ...c, isPublic } : c))
      );
    } catch (err) {
      console.log('Error toggling course visibility:', err);
      Alert.alert('Error', 'Failed to update course visibility.');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="book" size={32} color="#ffffff" />
          <Text style={styles.headerTitle}>{t('courses.myCourses')}</Text>
          <Text style={styles.headerSubtitle}>
            {role === 'lecturer'
              ? t('courses.lecturerSubtitle')
              : t('courses.studentSubtitle')}
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={PRIMARY_GREEN} size="large" />
            <Text style={styles.loadingText}>Loading courses...</Text>
          </View>
        ) : courses.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="book-outline" size={64} color="#9ca3af" />
            </View>
            <Text style={styles.emptyTitle}>{t('courses.noCourses')}</Text>
            <Text style={styles.emptyText}>
              {t('courses.noCoursesDescription')}
            </Text>
            <TouchableOpacity
              style={styles.emptyAddButton}
              onPress={openAddCourseModal}
            >
              <Ionicons name="add-circle-outline" size={20} color="#ffffff" style={{ marginRight: 8 }} />
              <Text style={styles.emptyAddButtonText}>{t('courses.addFirstCourse')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={styles.addButton}
                onPress={openAddCourseModal}
              >
                <Ionicons name="add-circle-outline" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.addButtonText}>{t('courses.addCourse')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.selectButton,
                  isSelectionMode && styles.selectButtonActive,
                ]}
                onPress={toggleSelectionMode}
              >
                <Ionicons
                  name={isSelectionMode ? 'close-circle' : 'checkmark-circle-outline'}
                  size={20}
                  color={isSelectionMode ? '#ffffff' : PRIMARY_GREEN}
                  style={{ marginRight: 8 }}
                />
                <Text
                  style={[
                    styles.selectButtonText,
                    isSelectionMode && styles.selectButtonTextActive,
                  ]}
                >
                  {isSelectionMode ? t('common.cancel') : t('courses.selectCourses')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Selection Action Bar */}
            {isSelectionMode && selectedCourses.size > 0 && (
              <View style={styles.actionBar}>
                <View style={styles.actionBarLeft}>
                  <Ionicons name="checkmark-circle" size={20} color={ACCENT_GREEN} />
                  <Text style={styles.actionBarText}>
                    {selectedCourses.size} course{selectedCourses.size > 1 ? 's' : ''} selected
                  </Text>
                </View>
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      styles.editActionButton,
                      selectedCourses.size !== 1 && styles.actionButtonDisabled,
                    ]}
                    onPress={() => {
                      if (selectedCourses.size === 1) {
                        const courseId = Array.from(selectedCourses)[0];
                        const course = courses.find((c) => c.id === courseId);
                        if (course) {
                          handleEditCourse(course);
                        }
                      } else {
                        Alert.alert('Info', 'Please select only one course to edit.');
                      }
                    }}
                    disabled={selectedCourses.size !== 1}
                  >
                    <Ionicons name="create-outline" size={16} color="#ffffff" />
                    <Text style={styles.actionButtonText}>{t('common.edit')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteActionButton]}
                    onPress={handleDeleteSelected}
                  >
                    <Ionicons name="trash-outline" size={16} color="#ffffff" />
                    <Text style={styles.actionButtonText}>{t('common.delete')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Selection Hint */}
            {isSelectionMode && selectedCourses.size === 0 && (
              <View style={styles.selectionHint}>
                <Ionicons name="information-circle-outline" size={16} color="#92400e" />
                <Text style={styles.selectionHintText}>
                  {t('courses.selectCourses')}
                </Text>
              </View>
            )}

            {/* Courses List */}
            {role === 'student' ? (
              <>
                {/* Personal Courses Section */}
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeaderLeft}>
                    <Ionicons name="person" size={20} color={PRIMARY_GREEN} />
                    <Text style={styles.sectionTitle}>{t('courses.myPersonalCourses')}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.sectionPracticeButton}
                    onPress={() => router.push('/ai-practice-setup' as any)}
                  >
                    <Ionicons name="flask" size={18} color={PRIMARY_GREEN} />
                    <Text style={styles.sectionPracticeButtonText}>{t('courses.practice')}</Text>
                  </TouchableOpacity>
                </View>
                {courses.length > 0 ? (
                  <FlatList
                    data={courses}
                    keyExtractor={(item) => item.id}
                    renderItem={renderCourse}
                    contentContainerStyle={styles.coursesList}
                    scrollEnabled={false}
                  />
                ) : (
                  <View style={styles.emptySection}>
                    <Text style={styles.emptySectionText}>No personal courses yet</Text>
                  </View>
                )}

                {/* Shared Courses Section */}
                {sharedCourses.length > 0 && (
                  <>
                    <View style={[styles.sectionHeader, { marginTop: 24 }]}>
                      <Ionicons name="people" size={20} color={PRIMARY_GREEN} />
                      <Text style={styles.sectionTitle}>{t('courses.lecturerSharedCourses')}</Text>
                    </View>
                    <FlatList
                      data={sharedCourses}
                      keyExtractor={(item) => item.id}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={[styles.courseCard, styles.sharedCourseCard]}
                          onPress={() => {
                            router.push({
                              pathname: `/lecturer-course/${item.id}` as any,
                              params: { name: item.name },
                            });
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={styles.courseIconContainer}>
                            <Ionicons name="book" size={24} color={PRIMARY_GREEN} />
                          </View>
                          <View style={styles.courseContent}>
                            <View style={styles.courseMetaContainer}>
                              <Text style={styles.courseTitle}>{item.name}</Text>
                              <View style={styles.sharedBadge}>
                                <Ionicons name="people" size={12} color="#ffffff" />
                                <Text style={styles.sharedBadgeText}>{t('courses.sharedCourse')}</Text>
                              </View>
                            </View>
                            {item.lecturer && (
                              <Text style={styles.courseDescription}>by {item.lecturer}</Text>
                            )}
                            {item.description && (
                              <Text style={styles.courseDescription} numberOfLines={2}>
                                {item.description}
                              </Text>
                            )}
                          </View>
                          <Ionicons name="chevron-forward" size={20} color="#6b7280" />
                        </TouchableOpacity>
                      )}
                      contentContainerStyle={styles.coursesList}
                      scrollEnabled={false}
                    />
                  </>
                )}
              </>
            ) : (
              <FlatList
                data={courses}
                keyExtractor={(item) => item.id}
                renderItem={renderCourse}
                contentContainerStyle={styles.coursesList}
                scrollEnabled={false}
              />
            )}
          </>
        )}

        {/* Practice Section - Only for students */}
        {role === 'student' && (
          <View style={styles.practiceSection}>
            <View style={styles.practiceHeader}>
              <Ionicons name="flask" size={24} color={PRIMARY_GREEN} />
              <Text style={styles.practiceSectionTitle}>{t('courses.practice')}</Text>
            </View>

            {/* Practice Stats */}
            <View style={styles.practiceStatsContainer}>
              <View style={styles.practiceStatCard}>
                <Text style={styles.practiceStatNumber}>{practiceStats.totalPractices}</Text>
                <Text style={styles.practiceStatLabel}>{t('courses.totalSessions')}</Text>
              </View>
              <View style={styles.practiceStatCard}>
                <Text style={styles.practiceStatNumber}>{practiceStats.averageScore}%</Text>
                <Text style={styles.practiceStatLabel}>{t('courses.averageScore')}</Text>
              </View>
              <View style={styles.practiceStatCard}>
                <Text style={styles.practiceStatNumber}>{practiceStats.bestScore}%</Text>
                <Text style={styles.practiceStatLabel}>{t('courses.bestScore')}</Text>
              </View>
            </View>

            {/* Practice History Table */}
            {practiceSessions.length > 0 && (
              <View style={styles.practiceTableContainer}>
                <Text style={styles.practiceTableTitle}>{t('courses.recentSessions')}</Text>
                <View style={styles.practiceTable}>
                  <View style={styles.practiceTableHeader}>
                    <Text style={styles.practiceTableHeaderText}>{t('courses.course')}</Text>
                    <Text style={styles.practiceTableHeaderText}>{t('courses.type')}</Text>
                    <Text style={styles.practiceTableHeaderText}>{t('courses.score')}</Text>
                    <Text style={styles.practiceTableHeaderText}>{t('courses.date')}</Text>
                  </View>
                  {practiceSessions.slice(0, 3).map((session) => {
                    const percentage = Math.round((session.score / session.totalQuestions) * 100);
                    const scoreColor = percentage >= 80 ? '#10b981' : percentage >= 60 ? '#047857' : '#ef4444';
                    return (
                      <View key={session.id} style={styles.practiceTableRow}>
                        <Text style={styles.practiceTableCell} numberOfLines={1}>
                          {session.courseName}
                        </Text>
                        <Text style={styles.practiceTableCell}>{session.practiceType}</Text>
                        <Text style={[styles.practiceTableCell, { color: scoreColor, fontWeight: '700' }]}>
                          {percentage}%
                        </Text>
                        <Text style={styles.practiceTableCell}>{session.date}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Add Course Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="add-circle" size={28} color={ACCENT_GREEN} />
              <Text style={styles.modalTitle}>Add New Course</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Ionicons name="book-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
                <View style={styles.inputWrapper}>
                  <Text style={styles.modalLabel}>Course name *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. Linear Algebra"
                    placeholderTextColor="#9ca3af"
                    value={courseName}
                    onChangeText={setCourseName}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Ionicons name="person-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
                <View style={styles.inputWrapper}>
                  <Text style={styles.modalLabel}>Lecturer (optional)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. Dr. Cohen"
                    placeholderTextColor="#9ca3af"
                    value={courseLecturer}
                    onChangeText={setCourseLecturer}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Ionicons name="calendar-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
                <View style={styles.inputWrapper}>
                  <Text style={styles.modalLabel}>Semester (optional)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder='e.g. "A" or "B"'
                    placeholderTextColor="#9ca3af"
                    value={courseSemester}
                    onChangeText={setCourseSemester}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Ionicons name="school-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
                <View style={styles.inputWrapper}>
                  <Text style={styles.modalLabel}>Year of study (optional)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. 1, 2, 3"
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                    value={courseYear}
                    onChangeText={setCourseYear}
                  />
                </View>
              </View>

              {role === 'lecturer' && (
                <View style={styles.inputGroup}>
                  <Ionicons name="document-text-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
                  <View style={styles.inputWrapper}>
                    <Text style={styles.modalLabel}>Description (optional)</Text>
                    <TextInput
                      style={[styles.modalInput, styles.textArea]}
                      placeholder="Course description..."
                      placeholderTextColor="#9ca3af"
                      value={courseDescription}
                      onChangeText={setCourseDescription}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                  </View>
                </View>
              )}

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.modalSaveButton]}
                  onPress={handleSaveCourse}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.modalSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Course Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setEditModalVisible(false);
          setEditingCourse(null);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="create" size={28} color={ACCENT_GREEN} />
              <Text style={styles.modalTitle}>Edit Course</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Ionicons name="book-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
                <View style={styles.inputWrapper}>
                  <Text style={styles.modalLabel}>Course name *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. Linear Algebra"
                    placeholderTextColor="#9ca3af"
                    value={courseName}
                    onChangeText={setCourseName}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Ionicons name="person-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
                <View style={styles.inputWrapper}>
                  <Text style={styles.modalLabel}>Lecturer (optional)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. Dr. Cohen"
                    placeholderTextColor="#9ca3af"
                    value={courseLecturer}
                    onChangeText={setCourseLecturer}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Ionicons name="calendar-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
                <View style={styles.inputWrapper}>
                  <Text style={styles.modalLabel}>Semester (optional)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder='e.g. "A" or "B"'
                    placeholderTextColor="#9ca3af"
                    value={courseSemester}
                    onChangeText={setCourseSemester}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Ionicons name="school-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
                <View style={styles.inputWrapper}>
                  <Text style={styles.modalLabel}>Year of study (optional)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. 1, 2, 3"
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                    value={courseYear}
                    onChangeText={setCourseYear}
                  />
                </View>
              </View>

              {role === 'lecturer' && (
                <View style={styles.inputGroup}>
                  <Ionicons name="document-text-outline" size={18} color="#9ca3af" style={styles.inputIcon} />
                  <View style={styles.inputWrapper}>
                    <Text style={styles.modalLabel}>Description (optional)</Text>
                    <TextInput
                      style={[styles.modalInput, styles.textArea]}
                      placeholder="Course description..."
                      placeholderTextColor="#9ca3af"
                      value={courseDescription}
                      onChangeText={setCourseDescription}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                  </View>
                </View>
              )}

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={() => {
                    setEditModalVisible(false);
                    setEditingCourse(null);
                  }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.modalSaveButton]}
                  onPress={handleSaveEdit}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.modalSaveText}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const PRIMARY_GREEN = '#047857';
const ACCENT_GREEN = '#047857';
const GREY = '#4b5563';
const GREY_LIGHT = '#374151';

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
    paddingTop: 80,
    paddingBottom: 40,
    alignItems: 'center',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    marginBottom: -60,
    shadowColor: PRIMARY_GREEN,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
    overflow: 'hidden',
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: '#ffffff',
    marginTop: 12,
    marginBottom: 6,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.95,
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 20,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    marginTop: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#9ca3af',
  },
  emptyState: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
    marginTop: 20,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyAddButton: {
    flexDirection: 'row',
    backgroundColor: PRIMARY_GREEN,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: PRIMARY_GREEN,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyAddButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 16,
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: ACCENT_GREEN,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACCENT_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  addButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
  selectButton: {
    flex: 0.6,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: PRIMARY_GREEN,
    backgroundColor: '#ffffff',
  },
  selectButtonActive: {
    backgroundColor: PRIMARY_GREEN,
    borderColor: PRIMARY_GREEN,
  },
  selectButtonText: {
    color: PRIMARY_GREEN,
    fontWeight: '600',
    fontSize: 15,
  },
  selectButtonTextActive: {
    color: '#ffffff',
  },
  selectionHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#047857',
  },
  selectionHintText: {
    fontSize: 13,
    color: '#92400e',
    marginLeft: 6,
    fontWeight: '500',
  },
  actionBar: {
    backgroundColor: '#dbeafe',
    borderRadius: 15,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: PRIMARY_GREEN,
    shadowColor: PRIMARY_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  actionBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionBarText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  editActionButton: {
    backgroundColor: '#3b82f6',
  },
  deleteActionButton: {
    backgroundColor: '#ef4444',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  sectionPracticeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PRIMARY_GREEN,
  },
  sectionPracticeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: PRIMARY_GREEN,
  },
  emptySection: {
    padding: 20,
    alignItems: 'center',
  },
  emptySectionText: {
    fontSize: 14,
    color: '#6b7280',
  },
  sharedCourseCard: {
    borderLeftWidth: 3,
    borderLeftColor: PRIMARY_GREEN,
  },
  sharedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PRIMARY_GREEN,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  sharedBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  coursesList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  courseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  courseCardSelectionMode: {
    borderWidth: 2,
    borderColor: PRIMARY_GREEN,
  },
  courseCardSelected: {
    backgroundColor: '#dbeafe',
    borderColor: PRIMARY_GREEN,
  },
  courseCardDeleting: {
    opacity: 0.6,
  },
  checkboxContainer: {
    marginRight: 12,
  },
  courseIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  courseContent: {
    flex: 1,
  },
  courseTitle: {
    color: '#111827',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  courseDescription: {
    color: '#6b7280',
    fontSize: 13,
    marginBottom: 8,
    lineHeight: 18,
  },
  courseMetaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  metaTagText: {
    fontSize: 11,
    color: '#6b7280',
    marginLeft: 4,
    fontWeight: '500',
  },
  publicToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  publicToggleText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  publicToggleTextActive: {
    color: ACCENT_GREEN,
  },
  practiceSection: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    marginBottom: 40,
  },
  practiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  practiceSectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  practiceStatsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  practiceStatCard: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  practiceStatNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: PRIMARY_GREEN,
    marginBottom: 4,
  },
  practiceStatLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
  },
  practiceTableContainer: {
    marginTop: 8,
  },
  practiceTableTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  practiceTable: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  practiceTableHeader: {
    flexDirection: 'row',
    backgroundColor: PRIMARY_GREEN,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  practiceTableHeaderText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  practiceTableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  practiceTableCell: {
    flex: 1,
    fontSize: 12,
    color: '#111827',
    textAlign: 'center',
  },
  deletingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '85%',
    borderRadius: 20,
    backgroundColor: '#ffffff',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#111827',
    fontSize: 22,
    fontWeight: '700',
    marginLeft: 10,
  },
  inputGroup: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  inputIcon: {
    marginTop: 28,
    marginRight: 12,
  },
  inputWrapper: {
    flex: 1,
  },
  modalLabel: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    fontSize: 15,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  modalSaveButton: {
    backgroundColor: ACCENT_GREEN,
    shadowColor: ACCENT_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  modalCancelText: {
    color: '#111827',
    fontWeight: '600',
    fontSize: 15,
  },
  modalSaveText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
});

export { };

