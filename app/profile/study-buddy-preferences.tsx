// app/profile/study-buddy-preferences.tsx — Study buddy preferences (full screen)
import { auth, db } from '@/lib/firebaseConfig';
import { useUser } from '@/lib/UserContext';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
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
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ACCENT_GREEN = '#047857';

type CourseRow = { id: string; name: string };

export default function StudyBuddyPreferencesScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const isHebrewUi = i18n.language === 'he';
  const { role, loading: userLoading } = useUser();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [preferredTime, setPreferredTime] = useState('');
  const [selectedCoursesForBuddy, setSelectedCoursesForBuddy] = useState<Set<string>>(new Set());
  const [studyBuddyPhone, setStudyBuddyPhone] = useState('');

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

  if (userLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={ACCENT_GREEN} />
      </View>
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
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={[styles.title, isHebrewUi && styles.rtlText]} numberOfLines={1}>
            {t('profile.studyBuddyPreferences')}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={ACCENT_GREEN} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.subtitle, isHebrewUi && styles.rtlText]}>{t('profile.setPreferencesMessage')}</Text>

            <Text style={[styles.label, isHebrewUi && styles.rtlText]}>{t('profile.preferredTime')} *</Text>
            <View style={styles.timeWrap}>
              {['Morning', 'Afternoon', 'Evening', 'Night', 'Weekends', 'Flexible'].map((time) => (
                <TouchableOpacity
                  key={time}
                  style={[styles.timeChip, preferredTime === time && styles.timeChipSelected]}
                  onPress={() => setPreferredTime(time)}
                >
                  <Text
                    style={[
                      styles.timeChipText,
                      preferredTime === time && styles.timeChipTextSelected,
                    ]}
                  >
                    {t(`profile.time.${time.toLowerCase()}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, isHebrewUi && styles.rtlText]}>{t('profile.selectCoursesForBuddy')} *</Text>
            <Text style={[styles.helper, isHebrewUi && styles.rtlText]}>{t('profile.chooseCoursesMessage')}</Text>
            <View style={styles.courseBox}>
              {courses.length === 0 ? (
                <Text style={[styles.emptyCourses, isHebrewUi && styles.rtlText]}>{t('profile.noCoursesAvailable')}</Text>
              ) : (
                courses.map((course) => (
                  <TouchableOpacity
                    key={course.id}
                    style={[styles.courseRow, selectedCoursesForBuddy.has(course.id) && styles.courseRowSelected]}
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
                      color={selectedCoursesForBuddy.has(course.id) ? ACCENT_GREEN : '#6b7280'}
                    />
                    <Text
                      style={[
                        styles.courseName,
                        selectedCoursesForBuddy.has(course.id) && styles.courseNameSelected,
                        isHebrewUi && styles.rtlText,
                      ]}
                    >
                      {course.name}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>

            <Text style={[styles.label, isHebrewUi && styles.rtlText]}>
              {t('profile.phoneNumber')} ({t('common.optional')})
            </Text>
            <Text style={[styles.helper, isHebrewUi && styles.rtlText]}>{t('profile.phoneNumberHelper')}</Text>
            <View style={styles.phoneRow}>
              <Ionicons name="call-outline" size={20} color={ACCENT_GREEN} />
              <TextInput
                style={[styles.phoneInput, isHebrewUi && styles.rtlText]}
                placeholder={t('profile.phoneNumberPlaceholder')}
                placeholderTextColor="#9ca3af"
                value={studyBuddyPhone}
                onChangeText={setStudyBuddyPhone}
                keyboardType="phone-pad"
                autoComplete="tel"
              />
            </View>

            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
                <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{t('common.save')}</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  rtlRow: { flexDirection: 'row-reverse' },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 17, fontWeight: '800', color: '#111827', textAlign: 'center' },
  scroll: { padding: 20, paddingBottom: 40 },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 20, lineHeight: 20 },
  label: { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 10 },
  helper: { fontSize: 12, color: '#6b7280', marginBottom: 10 },
  timeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 22 },
  timeChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#374151',
    backgroundColor: '#f9fafb',
  },
  timeChipSelected: { backgroundColor: '#dbeafe', borderColor: ACCENT_GREEN },
  timeChipText: { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  timeChipTextSelected: { color: ACCENT_GREEN, fontWeight: '600' },
  courseBox: { marginBottom: 22 },
  emptyCourses: { textAlign: 'center', color: '#6b7280', paddingVertical: 20 },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#f9fafb',
    gap: 12,
  },
  courseRowSelected: { backgroundColor: '#dbeafe', borderColor: ACCENT_GREEN },
  courseName: { flex: 1, fontSize: 14, color: '#6b7280' },
  courseNameSelected: { color: '#111827', fontWeight: '600' },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
    marginBottom: 24,
    gap: 8,
  },
  phoneInput: { flex: 1, paddingVertical: 12, fontSize: 16, color: '#111827' },
  actions: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  cancelBtnText: { color: '#111827', fontSize: 15, fontWeight: '600' },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: ACCENT_GREEN,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
