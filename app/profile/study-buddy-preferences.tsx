// app/profile/study-buddy-preferences.tsx — Study buddy preferences (full screen)
import { auth, db } from '@/lib/firebaseConfig';
import { useUser } from '@/lib/UserContext';
import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppHeader } from '@/frontend/components/ui/AppHeader';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { PrimaryButton } from '@/frontend/components/ui/PrimaryButton';
import { layout, spacing } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
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

type CourseRow = { id: string; name: string };

export default function StudyBuddyPreferencesScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const isHebrewUi = i18n.language === 'he';
  const { role, loading: userLoading } = useUser();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [preferredTime, setPreferredTime] = useState('');
  const [selectedCoursesForBuddy, setSelectedCoursesForBuddy] = useState<Set<string>>(new Set());
  const [studyBuddyPhone, setStudyBuddyPhone] = useState('');
  const [showTimePicker, setShowTimePicker] = useState(false);

  const timeOptions = ['Morning', 'Afternoon', 'Evening', 'Night', 'Weekends', 'Flexible'] as const;

  const load = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      router.replace('/(auth)/login');
      return;
    }
    try {
      setLoading(true);
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        const data = snap.data() as any;
        setPreferredTime(data.preferredTime || '');
        setSelectedCoursesForBuddy(new Set(data.studyBuddyCourses || []));
        setStudyBuddyPhone(data.studyBuddyPhone || '');
      }
      const q = query(collection(db, 'courses'), where('ownerUid', '==', user.uid));
      const coursesSnap = await getDocs(q);
      const list: CourseRow[] = [];
      coursesSnap.forEach((d) => {
        const data = d.data() as any;
        list.push({ id: d.id, name: data.name ?? 'Course' });
      });
      setCourses(list);
    } catch (e) {
      console.log('study buddy prefs load', e);
      Alert.alert(t('common.error'), t('profile.preferencesSaveError'));
    } finally {
      setLoading(false);
    }
  }, [router, t]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!preferredTime) {
      Alert.alert(t('common.error'), t('profile.selectTimeRequired'));
      return;
    }
    if (selectedCoursesForBuddy.size === 0) {
      Alert.alert(t('common.error'), t('profile.selectCourseRequired'));
      return;
    }
    const user = auth.currentUser;
    if (!user) return;
    try {
      setSaving(true);
      await updateDoc(doc(db, 'users', user.uid), {
        preferredTime,
        studyBuddyCourses: Array.from(selectedCoursesForBuddy),
        studyBuddyPhone: studyBuddyPhone.trim() || null,
      });
      Alert.alert(t('common.success'), t('profile.preferencesUpdated'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ]);
    } catch (err) {
      console.log('save study buddy prefs', err);
      Alert.alert(t('common.error'), t('profile.preferencesSaveError'));
    } finally {
      setSaving(false);
    }
  };

  const getPreferredTimeLabel = (timeValue: string) => {
    if (!timeValue) return t('profile.preferredTime');
    return t(`profile.time.${timeValue.toLowerCase()}`);
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
    return <Redirect href="/(tabs)/profile" />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      <AppScreen>
        <AppHeader title={t('profile.studyBuddyPreferences')} onBack={() => router.back()} />
        <View style={[styles.topDecorWrap, { borderBottomColor: colors.border }]}>
          <View style={[styles.topDecorPrimary, { backgroundColor: colors.primary }]} />
          <View style={[styles.topDecorAccent, { backgroundColor: colors.accent }]} />
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <AppCard style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>{t('profile.preferredTime')} *</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.selectField,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceMuted,
                    opacity: pressed ? 0.88 : 1,
                  },
                  isHebrewUi && styles.rtlRow,
                ]}
                onPress={() => setShowTimePicker(true)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.selectFieldLabel, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
                    {t('profile.preferredTime')}
                  </Text>
                  <Text
                    style={[
                      styles.selectFieldValue,
                      { color: preferredTime ? colors.textPrimary : colors.textSecondary },
                      isHebrewUi && styles.rtlText,
                    ]}
                  >
                    {preferredTime ? getPreferredTimeLabel(preferredTime) : t('profile.preferredTime')}
                  </Text>
                </View>
                <Ionicons name={isHebrewUi ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.textSecondary} />
              </Pressable>
            </AppCard>

            <AppCard style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>{t('profile.selectCoursesForBuddy')} *</Text>
              <Text style={[styles.helper, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>{t('profile.chooseCoursesMessage')}</Text>
              <View style={styles.courseBox}>
                {courses.length === 0 ? (
                  <Text style={[styles.emptyCourses, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>{t('profile.noCoursesAvailable')}</Text>
                ) : (
                  courses.map((course) => (
                    <TouchableOpacity
                      key={course.id}
                      style={[
                        styles.courseRow,
                        { borderColor: colors.border, backgroundColor: colors.surfaceMuted },
                        selectedCoursesForBuddy.has(course.id) && { backgroundColor: colors.surfaceElevated, borderColor: colors.primary },
                      ]}
                      onPress={() => {
                        const next = new Set(selectedCoursesForBuddy);
                        if (next.has(course.id)) next.delete(course.id);
                        else next.add(course.id);
                        setSelectedCoursesForBuddy(next);
                      }}
                    >
                      <Ionicons
                        name={selectedCoursesForBuddy.has(course.id) ? 'checkbox' : 'checkbox-outline'}
                        size={24}
                        color={selectedCoursesForBuddy.has(course.id) ? colors.primary : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.courseName,
                          { color: colors.textSecondary },
                          selectedCoursesForBuddy.has(course.id) && { color: colors.textPrimary, fontWeight: '600' },
                          isHebrewUi && styles.rtlText,
                        ]}
                      >
                        {course.name}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </AppCard>

            <AppCard style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
                {t('profile.phoneNumber')} ({t('common.optional')})
              </Text>
              <Text style={[styles.helper, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>{t('profile.phoneNumberHelper')}</Text>
              <View style={[styles.phoneRow, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                <Ionicons name="call-outline" size={20} color={colors.primary} />
                <TextInput
                  style={[styles.phoneInput, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}
                  placeholder={t('profile.phoneNumberPlaceholder')}
                  placeholderTextColor={colors.textSecondary}
                  value={studyBuddyPhone}
                  onChangeText={setStudyBuddyPhone}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                />
              </View>
            </AppCard>

            <View style={styles.actions}>
              <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={() => router.back()}>
                <Text style={[styles.cancelBtnText, { color: colors.textPrimary }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <PrimaryButton
                label={t('common.save')}
                onPress={save}
                loading={saving}
                disabled={saving}
                style={styles.saveBtn}
              />
            </View>
          </ScrollView>
        )}

        <Modal visible={showTimePicker} transparent animationType="slide" onRequestClose={() => setShowTimePicker(false)}>
          <Pressable
            style={[
              styles.modalBackdrop,
              { paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom + 12, 28) : 18 },
            ]}
            onPress={() => setShowTimePicker(false)}
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
                  {t('profile.preferredTime')}
                </Text>
                <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                  <Ionicons name="close" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <View style={styles.modalList}>
                {timeOptions.map((time) => {
                  const selected = preferredTime === time;
                  return (
                    <Pressable
                      key={time}
                      onPress={() => {
                        setPreferredTime(time);
                        setShowTimePicker(false);
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
                      <Text
                        style={[
                          styles.modalRowText,
                          { color: selected ? colors.primary : colors.textPrimary },
                          isHebrewUi && styles.rtlText,
                        ]}
                      >
                        {t(`profile.time.${time.toLowerCase()}`)}
                      </Text>
                      {selected ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  rtlRow: { flexDirection: 'row-reverse' },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  scroll: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: 2,
    paddingBottom: 40,
    gap: spacing.sm,
  },
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
  sectionCard: { padding: spacing.lg },
  label: { fontSize: 15, fontWeight: '600', marginBottom: 10 },
  helper: { fontSize: 12, marginBottom: 10 },
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
  courseBox: { marginBottom: 22 },
  emptyCourses: { textAlign: 'center', paddingVertical: 20 },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    gap: 12,
  },
  courseName: { flex: 1, fontSize: 14 },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    gap: 8,
  },
  phoneInput: { flex: 1, paddingVertical: 12, fontSize: 16 },
  actions: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600' },
  saveBtn: {
    flex: 1,
    minHeight: 48,
  },
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
  modalList: { gap: 8 },
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
  modalRowText: { fontSize: 15, fontWeight: '600', flex: 1 },
});
