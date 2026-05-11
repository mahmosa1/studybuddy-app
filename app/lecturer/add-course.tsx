// app/lecturer/add-course.tsx
import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppHeader } from '@/frontend/components/ui/AppHeader';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { PrimaryButton } from '@/frontend/components/ui/PrimaryButton';
import { layout, radius, spacing, typography, ThemeColors } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { auth, db } from '@/lib/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export default function LecturerAddCourseScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);
  const [loading, setLoading] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [description, setDescription] = useState('');
  const [institution, setInstitution] = useState('');

  useEffect(() => {
    const loadLecturerData = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setInstitution(data.institution || '');
        }
      } catch (err) {
        console.log('Error loading lecturer data:', err);
      }
    };

    loadLecturerData();
  }, []);

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert(t('common.error'), t('auth.emailRequired'));
      return;
    }

    if (!courseName.trim()) {
      Alert.alert(t('common.error'), t('courses.courseNameRequired'));
      return;
    }

    try {
      setLoading(true);
      await addDoc(collection(db, 'courses'), {
        name: courseName.trim(),
        description: description.trim() || null,
        institution: institution.trim() || null,
        ownerUid: user.uid,
        createdAt: serverTimestamp(),
      });

      Alert.alert(t('common.success'), t('courses.courseCreatedSuccess'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ]);
    } catch (err) {
      console.log('Error creating course:', err);
      Alert.alert(t('common.error'), t('courses.failedToCreateCourse'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppScreen>
      <AppHeader title={t('lecturer.createCourse')} onBack={() => router.back()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.heroWrap}>
            <View style={styles.heroGlowPrimary} />
            <View style={styles.heroBadge}>
              <Ionicons name="add-circle-outline" size={14} color={colors.primary} />
              <Text style={styles.heroBadgeText}>{t('lecturer.createCourse')}</Text>
            </View>
            <Text style={styles.heroTitle}>{t('lecturer.createCourse')}</Text>
            <Text style={styles.heroSubtitle}>{t('lecturer.createCourseSubtitle')}</Text>
          </View>

          <AppCard style={styles.card}>
            <Text style={styles.label}>{t('lecturer.courseName')} *</Text>
            <TextInput
              style={styles.input}
              placeholder={t('courses.courseNamePlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={courseName}
              onChangeText={setCourseName}
            />

            <Text style={styles.label}>{t('lecturer.courseDescription')} ({t('common.optional')})</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('courses.courseDescriptionPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <Text style={styles.label}>{t('lecturer.institution')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('auth.institutionPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={institution}
              onChangeText={setInstitution}
            />

            <View style={styles.actions}>
              <PrimaryButton
                label={t('lecturer.cancel')}
                variant="secondary"
                onPress={() => router.back()}
                style={styles.actionButton}
              />
              <PrimaryButton
                label={t('lecturer.createCourse')}
                onPress={handleSave}
                loading={loading}
                disabled={loading || !courseName.trim()}
                style={styles.actionButton}
              />
            </View>
          </AppCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  scrollContent: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: 40,
  },
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
  card: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: {
    fontSize: 13,
    color: colors.textPrimary,
    marginTop: 12,
    marginBottom: 6,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: 14,
  },
  textArea: {
    minHeight: 100,
  },
  actions: { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  actionButton: { flex: 1 },
});

