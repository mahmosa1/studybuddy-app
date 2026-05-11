import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppHeader } from '@/frontend/components/ui/AppHeader';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { EmptyState } from '@/frontend/components/ui/EmptyState';
import { LoadingState } from '@/frontend/components/ui/LoadingState';
import { PrimaryButton } from '@/frontend/components/ui/PrimaryButton';
import { iconContainer, layout, radius, spacing, typography, ThemeColors } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { useUser } from '@/lib/UserContext';
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
  const { role } = useUser();
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);
  const [courses, setCourses] = useState<Course[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [courseName, setCourseName] = useState('');
  const [courseLecturer, setCourseLecturer] = useState('');
  const [courseSemester, setCourseSemester] = useState('');
  const [courseYear, setCourseYear] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }
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
      setLoading(false);
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
    if (role === 'lecturer') {
      router.push('/lecturer/add-course' as any);
      return;
    }
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
    if (role === 'lecturer') {
      router.push({
        pathname: '/lecturer/course/[courseId]',
        params: { courseId: course.id, name: course.name },
      } as any);
      return;
    }
    router.push({
      pathname: '/course/[courseId]',
      params: { courseId: course.id, name: course.name },
    } as any);
  };

  return (
    <AppScreen>
      <AppHeader
        title={t('courses.hub.myCoursesTitle')}
        onBack={() => router.back()}
        rightSlot={
          <TouchableOpacity onPress={openAdd} accessibilityRole="button" accessibilityLabel={t('courses.addCourse')}>
            <Ionicons name="add-circle" size={24} color={colors.primary} />
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroWrap}>
          <View style={styles.heroGlowPrimary} />
          <View style={styles.heroBadge}>
            <Ionicons name="book-outline" size={14} color={colors.primary} />
            <Text style={styles.heroBadgeText}>{t('courses.hub.myCoursesTitle')}</Text>
          </View>
          <Text style={styles.heroTitle}>{t('courses.hub.myCoursesTitle')}</Text>
          <Text style={styles.heroSubtitle}>{t('courses.hub.myCoursesSubtitle')}</Text>
        </View>

        {loading ? (
          <LoadingState label={t('common.loading')} />
        ) : courses.length === 0 ? (
          <EmptyState title={t('courses.noCourses')} subtitle={t('courses.noCoursesMessage')} />
        ) : (
          courses.map((course) => (
            <AppCard key={course.id} style={styles.courseCard}>
              <View style={styles.cardAccentBar} />
              <TouchableOpacity style={styles.courseMainPress} onPress={() => openCourse(course)} activeOpacity={0.8}>
                <View style={styles.iconWrap}>
                  <Ionicons name="book-outline" size={17} color={colors.textPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.courseName}>{course.name}</Text>
                  {!!course.lecturer && <Text style={styles.metaText}>{course.lecturer}</Text>}
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={styles.rowActions}>
                <TouchableOpacity style={styles.rowActionBtn} onPress={() => openEdit(course)}>
                  <Ionicons name="create-outline" size={14} color={colors.textPrimary} />
                  <Text style={styles.rowActionTxt}>{t('common.edit')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.rowActionBtn, styles.rowDeleteBtn]} onPress={() => confirmDelete(course)}>
                  <Ionicons name="trash-outline" size={14} color={colors.danger} />
                  <Text style={styles.rowDeleteTxt}>{t('common.delete')}</Text>
                </TouchableOpacity>
              </View>
            </AppCard>
          ))
        )}
      </ScrollView>

      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <View style={styles.backdrop}>
          <AppCard style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingCourseId ? t('courses.editCourse') : t('courses.addCourse')}
            </Text>
            <TextInput
              style={styles.input}
              value={courseName}
              onChangeText={setCourseName}
              placeholder={t('courses.courseNamePlaceholder')}
              placeholderTextColor={colors.textSecondary}
            />
            <TextInput
              style={styles.input}
              value={courseLecturer}
              onChangeText={setCourseLecturer}
              placeholder={t('courses.hub.lecturerOptional')}
              placeholderTextColor={colors.textSecondary}
            />
            <TextInput
              style={styles.input}
              value={courseSemester}
              onChangeText={setCourseSemester}
              placeholder={t('courses.hub.semesterOptional')}
              placeholderTextColor={colors.textSecondary}
            />
            <TextInput
              style={styles.input}
              value={courseYear}
              onChangeText={setCourseYear}
              placeholder={t('courses.hub.yearOptional')}
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
            />
            <View style={styles.actions}>
              <PrimaryButton
                label={t('common.cancel')}
                variant="secondary"
                onPress={() => setShowModal(false)}
                style={styles.modalBtn}
              />
              <PrimaryButton
                label={t('common.save')}
                onPress={handleSave}
                style={styles.modalBtn}
              />
            </View>
          </AppCard>
        </View>
      </Modal>
    </AppScreen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  content: { padding: layout.screenPadding, paddingBottom: 40 },
  heroWrap: {
    position: 'relative',
    overflow: 'hidden',
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  heroGlowPrimary: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    top: -90,
    right: -45,
    backgroundColor: colors.primary,
    opacity: 0.08,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
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
  heroTitle: { color: colors.textPrimary, ...typography.h3 },
  heroSubtitle: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  courseCard: {
    padding: 10,
    marginBottom: 10,
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
    opacity: 0.3,
  },
  courseMainPress: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: {
    width: iconContainer.size,
    height: iconContainer.size,
    borderRadius: iconContainer.radius,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  courseName: { color: colors.textPrimary, ...typography.h3 },
  metaText: { marginTop: 2, color: colors.textSecondary, fontSize: 12 },
  rowActions: { marginTop: 8, flexDirection: 'row', justifyContent: 'flex-end', gap: 6 },
  rowActionBtn: {
    height: 28,
    paddingHorizontal: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 3,
  },
  rowActionTxt: { color: colors.textPrimary, fontSize: 11, fontWeight: '600' },
  rowDeleteBtn: { borderColor: colors.dangerBorder, backgroundColor: colors.dangerSurface },
  rowDeleteTxt: { color: colors.danger, fontSize: 11, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '90%', padding: spacing.lg },
  modalTitle: { color: colors.textPrimary, fontSize: 19, fontWeight: '700', marginBottom: 10 },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    marginBottom: 8,
    color: colors.textPrimary,
    fontSize: 14,
    backgroundColor: colors.surfaceMuted,
  },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  modalBtn: { flex: 1 },
});

