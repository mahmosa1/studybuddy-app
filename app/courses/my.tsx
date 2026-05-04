import { auth, db } from '@/lib/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type Course = {
  id: string;
  name: string;
  lecturer?: string;
  semester?: string;
  yearOfStudy?: number | null;
};

export default function MyCoursesScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [courses, setCourses] = useState<Course[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [courseName, setCourseName] = useState('');
  const [courseLecturer, setCourseLecturer] = useState('');
  const [courseSemester, setCourseSemester] = useState('');
  const [courseYear, setCourseYear] = useState('');

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const q = query(collection(db, 'courses'), where('ownerUid', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const list: Course[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: data.name || 'Course',
          lecturer: data.lecturer || '',
          semester: data.semester || '',
          yearOfStudy: data.yearOfStudy ?? null,
        };
      });
      setCourses(list);
    });
    return unsub;
  }, []);

  const resetForm = () => {
    setCourseName('');
    setCourseLecturer('');
    setCourseSemester('');
    setCourseYear('');
    setEditingCourseId(null);
  };

  const openAdd = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (course: Course) => {
    setEditingCourseId(course.id);
    setCourseName(course.name);
    setCourseLecturer(course.lecturer || '');
    setCourseSemester(course.semester || '');
    setCourseYear(course.yearOfStudy ? String(course.yearOfStudy) : '');
    setShowModal(true);
  };

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) return;
    if (!courseName.trim()) {
      Alert.alert(t('common.error'), t('courses.courseNameRequired'));
      return;
    }

    const payload = {
      name: courseName.trim(),
      lecturer: courseLecturer.trim() || null,
      semester: courseSemester.trim() || null,
      yearOfStudy: courseYear.trim() ? Number(courseYear.trim()) : null,
    };

    try {
      if (editingCourseId) {
        await updateDoc(doc(db, 'courses', editingCourseId), payload);
      } else {
        await addDoc(collection(db, 'courses'), {
          ...payload,
          ownerUid: user.uid,
          createdAt: serverTimestamp(),
        });
      }
      setShowModal(false);
      resetForm();
    } catch (err) {
      Alert.alert(t('common.error'), t('courses.failedToCreateCourse'));
    }
  };

  const confirmDelete = (course: Course) => {
    Alert.alert(
      t('common.delete'),
      t('courses.deleteCourseConfirm', { courseName: course.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            await deleteDoc(doc(db, 'courses', course.id));
          },
        },
      ]
    );
  };

  const openCourse = (course: Course) => {
    router.push({
      pathname: '/course/[courseId]',
      params: { courseId: course.id, name: course.name },
    } as any);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('courses.hub.myCoursesTitle')}</Text>
        <TouchableOpacity onPress={openAdd}>
          <Ionicons name="add-circle" size={24} color="#047857" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {courses.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="book-outline" size={36} color="#9ca3af" />
            <Text style={styles.emptyText}>{t('courses.noCourses')}</Text>
          </View>
        ) : (
          courses.map((course) => (
            <View key={course.id} style={styles.courseCard}>
              <TouchableOpacity style={styles.courseMainPress} onPress={() => openCourse(course)} activeOpacity={0.8}>
                <View style={styles.iconWrap}>
                  <Ionicons name="book-outline" size={18} color="#047857" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.courseName}>{course.name}</Text>
                  {!!course.lecturer && <Text style={styles.metaText}>{course.lecturer}</Text>}
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
              </TouchableOpacity>
              <View style={styles.rowActions}>
                <TouchableOpacity style={styles.rowActionBtn} onPress={() => openEdit(course)}>
                  <Ionicons name="create-outline" size={15} color="#111827" />
                  <Text style={styles.rowActionTxt}>{t('common.edit')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.rowActionBtn, styles.rowDeleteBtn]} onPress={() => confirmDelete(course)}>
                  <Ionicons name="trash-outline" size={15} color="#ef4444" />
                  <Text style={styles.rowDeleteTxt}>{t('common.delete')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingCourseId ? t('courses.editCourse') : t('courses.addCourse')}
            </Text>
            <TextInput
              style={styles.input}
              value={courseName}
              onChangeText={setCourseName}
              placeholder={t('courses.courseNamePlaceholder')}
              placeholderTextColor="#9ca3af"
            />
            <TextInput
              style={styles.input}
              value={courseLecturer}
              onChangeText={setCourseLecturer}
              placeholder={t('courses.hub.lecturerOptional')}
              placeholderTextColor="#9ca3af"
            />
            <TextInput
              style={styles.input}
              value={courseSemester}
              onChangeText={setCourseSemester}
              placeholder={t('courses.hub.semesterOptional')}
              placeholderTextColor="#9ca3af"
            />
            <TextInput
              style={styles.input}
              value={courseYear}
              onChangeText={setCourseYear}
              placeholder={t('courses.hub.yearOptional')}
              placeholderTextColor="#9ca3af"
              keyboardType="numeric"
            />
            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={styles.cancelTxt}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveTxt}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  content: { padding: 14, paddingBottom: 40 },
  emptyBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { color: '#6b7280', fontSize: 14 },
  courseCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    marginBottom: 10,
  },
  courseMainPress: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseName: { color: '#111827', fontSize: 16, fontWeight: '700' },
  metaText: { marginTop: 2, color: '#6b7280', fontSize: 12 },
  rowActions: { marginTop: 10, flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  rowActionBtn: {
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  rowActionTxt: { color: '#111827', fontSize: 12, fontWeight: '600' },
  rowDeleteBtn: { borderColor: '#fecaca', backgroundColor: '#fef2f2' },
  rowDeleteTxt: { color: '#ef4444', fontSize: 12, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '90%', backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  modalTitle: { color: '#111827', fontSize: 19, fontWeight: '700', marginBottom: 10 },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    color: '#111827',
    fontSize: 14,
    backgroundColor: '#f9fafb',
  },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  cancelBtn: { flex: 1, height: 42, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  saveBtn: { flex: 1, height: 42, borderRadius: 10, backgroundColor: '#047857', alignItems: 'center', justifyContent: 'center' },
  cancelTxt: { color: '#111827', fontWeight: '600' },
  saveTxt: { color: '#fff', fontWeight: '700' },
});

