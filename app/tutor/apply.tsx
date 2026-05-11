// app/tutor/apply.tsx — Student tutor application (grade sheet + course + declaration)
import { auth, db } from '@/lib/firebaseConfig';
import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppHeader } from '@/frontend/components/ui/AppHeader';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { PrimaryButton } from '@/frontend/components/ui/PrimaryButton';
import { layout, spacing } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
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
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type CourseOption = { id: string; name: string };

export default function TutorApplyScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const isHebrewUi = i18n.language === 'he';
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
  const [showCoursePicker, setShowCoursePicker] = useState(false);
  const [courseSearch, setCourseSearch] = useState('');

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
      <AppScreen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </AppScreen>
    );
  }

  if (role !== 'student') {
    return <Redirect href="/(tabs)" />;
  }

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);
  const showCourseSearch = courses.length > 5;
  const filteredCourses = showCourseSearch
    ? courses.filter((c) => c.name.toLowerCase().includes(courseSearch.trim().toLowerCase()))
    : courses;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      <AppScreen>
        <AppHeader title={t('tutor.applyTitle')} onBack={() => router.back()} />
        <View style={[styles.topDecorWrap, { borderBottomColor: colors.border }]}>
          <View style={[styles.topDecorPrimary, { backgroundColor: colors.primary }]} />
          <View style={[styles.topDecorAccent, { backgroundColor: colors.accent }]} />
      </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <AppCard style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.subtitle, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>{t('tutor.applySubtitle')}</Text>
            <View style={[styles.hintBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.warning }]}>
              <Ionicons name="warning-outline" size={16} color={colors.warning} />
              <Text style={[styles.hint, { color: colors.warning }, isHebrewUi && styles.rtlText]}>{t('tutor.minGradeHint')}</Text>
            </View>
          </AppCard>

          <AppCard style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>{t('tutor.selectCourse')}</Text>
            {loadingCourses ? (
              <ActivityIndicator style={{ marginVertical: 16 }} color={colors.primary} />
            ) : courses.length === 0 ? (
              <View
                style={[
                  styles.emptyBox,
                  { borderColor: coursesEmptyReason === 'all_blocked' ? colors.success : colors.dangerBorder, backgroundColor: coursesEmptyReason === 'all_blocked' ? colors.surfaceMuted : colors.dangerSurface },
                ]}
              >
                <Text style={[styles.emptyText, { color: coursesEmptyReason === 'all_blocked' ? colors.success : colors.danger }, isHebrewUi && styles.rtlText]}>
                  {coursesEmptyReason === 'all_blocked'
                    ? t('tutor.noCoursesLeftToApply')
                    : t('tutor.noCoursesForApply')}
                </Text>
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [
                  styles.selectField,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceMuted,
                    opacity: pressed ? 0.9 : 1,
                  },
                  isHebrewUi && styles.rtlRow,
                ]}
                onPress={() => setShowCoursePicker(true)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.selectFieldLabel, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
                    {t('tutor.selectCourse')}
                  </Text>
                  <Text
                    numberOfLines={2}
                    style={[
                      styles.selectFieldValue,
                      { color: selectedCourse ? colors.textPrimary : colors.textSecondary },
                      isHebrewUi && styles.rtlText,
                    ]}
                  >
                    {selectedCourse?.name || t('tutor.selectCourse')}
                  </Text>
                </View>
                <Ionicons name={isHebrewUi ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.textSecondary} />
              </Pressable>
            )}
          </AppCard>

          <AppCard style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>{t('tutor.gradeSheet')}</Text>
            <TouchableOpacity style={[styles.uploadBtn, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]} onPress={pickGradeSheet}>
              <Ionicons name="cloud-upload-outline" size={20} color={colors.primary} />
              <Text style={[styles.uploadBtnText, { color: gradeName ? colors.textPrimary : colors.primary }, isHebrewUi && styles.rtlText]}>
                {gradeName ? gradeName : t('tutor.uploadGradeSheet')}
              </Text>
            </TouchableOpacity>
          </AppCard>

          <AppCard style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>{t('tutor.declarationTitle')}</Text>
            <View style={[styles.declarationBox, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
              <Text style={[styles.declarationBody, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>{declarationText}</Text>
            </View>
            <TouchableOpacity
              style={[styles.checkRow, isHebrewUi && styles.rtlRow]}
              onPress={() => setDeclarationAccepted(!declarationAccepted)}
            >
              <Ionicons
                name={declarationAccepted ? 'checkbox' : 'square-outline'}
                size={22}
                color={declarationAccepted ? colors.primary : colors.textSecondary}
              />
              <Text style={[styles.checkLabel, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>{t('tutor.declarationAcceptLabel')}</Text>
            </TouchableOpacity>
          </AppCard>

          <PrimaryButton
            label={t('tutor.submitApplication')}
            onPress={handleSubmit}
            loading={submitting}
            disabled={!selectedCourseId || !gradeUri || !declarationAccepted || submitting}
            style={styles.submitBtn}
          />

          {selectedCourse ? (
            <Text style={[styles.footerNote, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
              {t('tutor.footerSelected', { course: selectedCourse.name })}
            </Text>
          ) : null}
        </ScrollView>

        <Modal visible={showCoursePicker} transparent animationType="slide" onRequestClose={() => setShowCoursePicker(false)}>
          <Pressable
            style={[
              styles.modalBackdrop,
              { paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom + 12, 28) : 18 },
            ]}
            onPress={() => setShowCoursePicker(false)}
          >
            <Pressable
              style={[
                styles.modalSheet,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom + 10, 24) : 24,
                },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={[styles.modalHeader, isHebrewUi && styles.rtlRow]}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
                  {t('tutor.selectCourse')}
                </Text>
                <TouchableOpacity onPress={() => setShowCoursePicker(false)}>
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {showCourseSearch && (
                <View style={[styles.searchBox, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }, isHebrewUi && styles.rtlRow]}>
                  <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
                  <TextInput
                    style={[styles.searchInput, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}
                    placeholder={t('search.title')}
                    placeholderTextColor={colors.textSecondary}
                    value={courseSearch}
                    onChangeText={setCourseSearch}
                  />
                </View>
              )}

              <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalList} showsVerticalScrollIndicator={false}>
                {filteredCourses.map((c) => {
                  const selected = c.id === selectedCourseId;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => {
                        setSelectedCourseId(c.id);
                        setShowCoursePicker(false);
                      }}
                      style={({ pressed }) => [
                        styles.modalRow,
                        {
                          borderColor: selected ? colors.primary : colors.border,
                          backgroundColor: selected ? colors.surfaceElevated : colors.surfaceMuted,
                          opacity: pressed ? 0.9 : 1,
                        },
                        isHebrewUi && styles.rtlRow,
                      ]}
                    >
                      <Text style={[styles.modalRowText, { color: selected ? colors.primary : colors.textPrimary }, isHebrewUi && styles.rtlText]}>
                        {c.name}
                      </Text>
                      {selected ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  rtlRow: { flexDirection: 'row-reverse' },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
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
  scroll: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: 2,
    paddingBottom: 40,
    gap: spacing.sm,
  },
  sectionCard: {
    padding: spacing.lg,
  },
  subtitle: { fontSize: 14, marginBottom: 8, lineHeight: 20 },
  hintBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hint: { flex: 1, fontSize: 13, lineHeight: 18 },
  sectionLabel: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  selectField: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectFieldLabel: { fontSize: 12, fontWeight: '600' },
  selectFieldValue: { marginTop: 2, fontSize: 15, fontWeight: '600' },
  emptyBox: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  emptyText: { fontSize: 14 },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  uploadBtnText: { fontSize: 15, fontWeight: '600', flex: 1 },
  declarationBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  declarationBody: { fontSize: 13, lineHeight: 20 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  checkLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
  submitBtn: {
    marginTop: 2,
  },
  footerNote: { marginTop: 14, fontSize: 12, textAlign: 'center' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 16,
    maxHeight: '74%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  searchBox: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  modalScroll: { maxHeight: 360 },
  modalList: { gap: 8, paddingBottom: 6 },
  modalRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalRowText: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
});
