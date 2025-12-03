// app/(tabs)/courses.tsx
import { auth, db } from '@/lib/firebaseConfig';
import { useRouter } from 'expo-router';
import {
  addDoc,
  collection,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
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
};

export default function CoursesScreen() {
  const router = useRouter();

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  // modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [courseLecturer, setCourseLecturer] = useState('');
  const [courseSemester, setCourseSemester] = useState('');
  const [courseYear, setCourseYear] = useState('');

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

      await addDoc(coursesRef, {
        name: courseName.trim(),
        lecturer: courseLecturer.trim() || null,
        semester: courseSemester.trim() || null,
        yearOfStudy: courseYear ? Number(courseYear) : null,
        ownerUid: user.uid,
        createdAt: serverTimestamp(),
      });

      setModalVisible(false);
    } catch (err) {
      console.log('Error adding course:', err);
      Alert.alert('Error', 'Failed to add course, please try again.');
    }
  };

  const renderCourse = ({ item }: { item: Course }) => (
    <TouchableOpacity
      style={styles.courseCard}
      onPress={() => router.push(`/course/${item.id}`)}
    >
      <Text style={styles.courseTitle}>{item.name}</Text>
      {item.lecturer ? (
        <Text style={styles.courseMeta}>Lecturer: {item.lecturer}</Text>
      ) : null}
      {item.semester ? (
        <Text style={styles.courseMeta}>Semester: {item.semester}</Text>
      ) : null}
      {item.yearOfStudy != null ? (
        <Text style={styles.courseMeta}>Year of study: {item.yearOfStudy}</Text>
      ) : null}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header כמו במסך הבית */}
      <View style={styles.header}>
        <Text style={styles.title}>My Courses</Text>
        <Text style={styles.subtitle}>
          View your courses, upload files and manage your study materials.
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator
          style={{ marginTop: 24 }}
          color="#f97316"
          size="small"
        />
      ) : courses.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No courses yet</Text>
          <Text style={styles.emptyText}>
            Start by adding your first course to keep your study materials
            organized in one place.
          </Text>

          <TouchableOpacity style={styles.addButton} onPress={openAddCourseModal}>
            <Text style={styles.addButtonText}>Add New Course</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <TouchableOpacity style={styles.addButton} onPress={openAddCourseModal}>
            <Text style={styles.addButtonText}>Add New Course</Text>
          </TouchableOpacity>

          <FlatList
            data={courses}
            keyExtractor={(item) => item.id}
            renderItem={renderCourse}
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
          />
        </>
      )}

      {/* Add Course Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Course</Text>

            <Text style={styles.modalLabel}>Course name *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Linear Algebra"
              placeholderTextColor="#9ca3af"
              value={courseName}
              onChangeText={setCourseName}
            />

            <Text style={styles.modalLabel}>Lecturer (optional)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Dr. Cohen"
              placeholderTextColor="#9ca3af"
              value={courseLecturer}
              onChangeText={setCourseLecturer}
            />

            <Text style={styles.modalLabel}>Semester (optional)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder='e.g. "A" or "B"'
              placeholderTextColor="#9ca3af"
              value={courseSemester}
              onChangeText={setCourseSemester}
            />

            <Text style={styles.modalLabel}>Year of study (optional)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 1, 2, 3"
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
              value={courseYear}
              onChangeText={setCourseYear}
            />

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
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const ORANGE = '#f97316';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb', // לבן עדין
    paddingHorizontal: 24,
    paddingTop: 40,
  },

  header: {
    marginTop: 20,
    marginBottom: 16,
  },
  appTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: ORANGE,
    textAlign: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#4b5563',
    textAlign: 'center',
  },

  emptyBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 14,
  },
  addButton: {
    backgroundColor: ORANGE,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    marginTop: 12,
  },
  addButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },

  courseCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 10,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  courseTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
  },
  courseMeta: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 2,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    padding: 18,
  },
  modalTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalLabel: {
    color: '#374151',
    fontSize: 13,
    marginTop: 8,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    marginTop: 16,
    columnGap: 10,
  },
  modalButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  modalSaveButton: {
    backgroundColor: ORANGE,
  },
  modalCancelText: {
    color: '#4b5563',
    fontWeight: '500',
  },
  modalSaveText: {
    color: 'white',
    fontWeight: '600',
  },
});

export { };

