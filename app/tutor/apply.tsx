// app/tutor/apply.tsx — Student tutor application (grade sheet + course + declaration)
import { auth, db } from '@/lib/firebaseConfig';
import {
  canSubmitTutorApplication,
  getTutorApplyExcludedCourseIds,
  submitTutorApplication,
} from '@/lib/tutorApplicationService';
import { uploadTutorGradeSheetToSupabase } from '@/lib/upload';
import { useUser } from '@/lib/UserContext';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Redirect, useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type CourseOption = { id: string; name: string };

export default function TutorApplyScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { role, loading: userLoading } = useUser();

  const [loadingCourses, setLoadingCourses] = useState(true);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [coursesEmptyReason, setCoursesEmptyReason] = useState<'none' | 'no_owned' | 'all_blocked'>('none');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [gradeUri, setGradeUri] = useState<string | null>(null);
  const [gradeName, setGradeName] = useState<string | null>(null);
  const [gradeMime, setGradeMime] = useState<string | null>(null);
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const declarationText = t('tutor.declarationBody');

  const loadCourses = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      setLoadingCourses(false);
      return;
    }
    try {
      setLoadingCourses(true);
      const q = query(collection(db, 'courses'), where('ownerUid', '==', user.uid));
      const snap = await getDocs(q);
      const owned: CourseOption[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        owned.push({ id: d.id, name: data.name || 'Course' });
      });
      const excluded = await getTutorApplyExcludedCourseIds(user.uid);
      const list = owned.filter((c) => !excluded.has(c.id));
      setCourses(list);
      if (owned.length === 0) {
        setCoursesEmptyReason('no_owned');
      } else if (list.length === 0) {
        setCoursesEmptyReason('all_blocked');
      } else {
        setCoursesEmptyReason('none');
      }
      setSelectedCourseId((prev) => (prev && list.some((c) => c.id === prev) ? prev : null));
    } catch (e) {
      console.log('Tutor apply load courses error:', e);
      setCourses([]);
      setCoursesEmptyReason('no_owned');
    } finally {
      setLoadingCourses(false);
    }
  }, []);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const pickGradeSheet = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      setGradeUri(asset.uri);
      setGradeName(asset.name ?? 'document');
      setGradeMime(asset.mimeType ?? null);
    } catch (e) {
      console.log('Document pick error:', e);
      Alert.alert(t('common.error'), t('tutor.pickFileFailed'));
    }
  };

  const handleSubmit = async () => {
    const user = auth.currentUser;
    if (!user || !selectedCourseId || !gradeUri || !declarationAccepted || submitting) return;

    const course = courses.find((c) => c.id === selectedCourseId);
    if (!course) return;

    try {
      setSubmitting(true);
      const gate = await canSubmitTutorApplication(user.uid, course.id);
      if (!gate.ok) {
        Alert.alert(
          t('common.error'),
          gate.reason === 'already_tutor' ? t('tutor.errorAlreadyTutor') : t('tutor.errorPending'),
        );
        return;
      }

      const url = await uploadTutorGradeSheetToSupabase(gradeUri, user.uid, gradeMime ?? undefined);
      if (!url) {
        Alert.alert(t('common.error'), t('tutor.uploadFailed'));
        return;
      }

      let email = '';
      let fullName = '';
      try {
        const uSnap = await getDoc(doc(db, 'users', user.uid));
        const u = uSnap.data() as any;
        email = u?.email || user.email || '';
        fullName = u?.fullName || u?.username || '';
      } catch {
        email = user.email || '';
      }

      await submitTutorApplication({
        applicantUid: user.uid,
        applicantEmail: email,
        applicantFullName: fullName,
        courseId: course.id,
        courseName: course.name,
        gradeSheetUrl: url,
        declarationAccepted: true,
        declarationTextSnapshot: declarationText,
      });

      Alert.alert(t('common.success'), t('tutor.submitSuccess'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ]);
    } catch (err: any) {
      console.log('Submit tutor application error:', err);
      const raw = String(err?.message || '');
      let userMsg = t('tutor.submitFailed');
      if (raw.includes('already approved')) userMsg = t('tutor.errorAlreadyTutor');
      else if (raw.includes('pending')) userMsg = t('tutor.errorPending');
      else if (raw) userMsg = raw;
      Alert.alert(t('common.error'), userMsg);
    } finally {
      setSubmitting(false);
    }
  };

  if (userLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#047857" />
      </View>
    );
  }

  if (role !== 'student') {
    return <Redirect href="/(tabs)" />;
  }

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
    >
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('tutor.applyTitle')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>{t('tutor.applySubtitle')}</Text>
        <Text style={styles.hint}>{t('tutor.minGradeHint')}</Text>

        <Text style={styles.sectionLabel}>{t('tutor.selectCourse')}</Text>
        {loadingCourses ? (
          <ActivityIndicator style={{ marginVertical: 16 }} color="#047857" />
        ) : courses.length === 0 ? (
          <View
            style={[
              styles.emptyBox,
              coursesEmptyReason === 'all_blocked' && styles.emptyBoxInfo,
            ]}
          >
            <Text
              style={[
                styles.emptyText,
                coursesEmptyReason === 'all_blocked' && styles.emptyTextInfo,
              ]}
            >
              {coursesEmptyReason === 'all_blocked'
                ? t('tutor.noCoursesLeftToApply')
                : t('tutor.noCoursesForApply')}
            </Text>
          </View>
        ) : (
          <View style={styles.courseList}>
            {courses.map((c) => {
              const sel = c.id === selectedCourseId;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.courseChip, sel && styles.courseChipSelected]}
                  onPress={() => setSelectedCourseId(c.id)}
                >
                  <Text style={[styles.courseChipText, sel && styles.courseChipTextSelected]} numberOfLines={2}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <Text style={styles.sectionLabel}>{t('tutor.gradeSheet')}</Text>
        <TouchableOpacity style={styles.uploadBtn} onPress={pickGradeSheet}>
          <Ionicons name="cloud-upload-outline" size={20} color="#047857" />
          <Text style={styles.uploadBtnText}>
            {gradeName ? gradeName : t('tutor.uploadGradeSheet')}
          </Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>{t('tutor.declarationTitle')}</Text>
        <View style={styles.declarationBox}>
          <Text style={styles.declarationBody}>{declarationText}</Text>
        </View>
        <TouchableOpacity
          style={styles.checkRow}
          onPress={() => setDeclarationAccepted(!declarationAccepted)}
        >
          <Ionicons
            name={declarationAccepted ? 'checkbox' : 'square-outline'}
            size={22}
            color={declarationAccepted ? '#047857' : '#6b7280'}
          />
          <Text style={styles.checkLabel}>{t('tutor.declarationAcceptLabel')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.submitBtn,
            (!selectedCourseId || !gradeUri || !declarationAccepted || submitting) && styles.submitBtnDisabled,
          ]}
          disabled={!selectedCourseId || !gradeUri || !declarationAccepted || submitting}
          onPress={handleSubmit}
        >
          {submitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitBtnText}>{t('tutor.submitApplication')}</Text>
          )}
        </TouchableOpacity>

        {selectedCourse ? (
          <Text style={styles.footerNote}>
            {t('tutor.footerSelected', { course: selectedCourse.name })}
          </Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#111827', flex: 1, textAlign: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  subtitle: { fontSize: 14, color: '#374151', marginBottom: 8, lineHeight: 20 },
  hint: { fontSize: 13, color: '#b45309', backgroundColor: '#fffbeb', padding: 10, borderRadius: 10, marginBottom: 16 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#111827', marginBottom: 8, marginTop: 8 },
  courseList: { gap: 8 },
  courseChip: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#ffffff',
  },
  courseChipSelected: { borderColor: '#047857', backgroundColor: '#ecfdf5' },
  courseChipText: { fontSize: 15, color: '#374151' },
  courseChipTextSelected: { color: '#065f46', fontWeight: '700' },
  emptyBox: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  emptyText: { color: '#991b1b', fontSize: 14 },
  emptyBoxInfo: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  emptyTextInfo: { color: '#065f46' },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#047857',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#ffffff',
  },
  uploadBtnText: { fontSize: 15, color: '#047857', fontWeight: '600', flex: 1 },
  declarationBox: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#ffffff',
    marginBottom: 10,
  },
  declarationBody: { fontSize: 13, color: '#374151', lineHeight: 20 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  checkLabel: { flex: 1, fontSize: 14, color: '#111827', fontWeight: '600' },
  submitBtn: {
    backgroundColor: '#047857',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  footerNote: { marginTop: 14, fontSize: 12, color: '#6b7280', textAlign: 'center' },
});
