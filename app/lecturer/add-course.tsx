// app/lecturer/add-course.tsx
import { auth, db } from '@/lib/firebaseConfig';
import { useRouter } from 'expo-router';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
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

export default function LecturerAddCourseScreen() {
  const router = useRouter();
  const { t } = useTranslation();
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
      Alert.alert(t('common.error'), t('auth.emailRequired') || 'You must be logged in');
      return;
    }

    if (!courseName.trim()) {
      Alert.alert(t('common.error'), t('courses.courseNameRequired') || 'Course name is required');
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

      Alert.alert(t('common.success'), t('courses.courseCreatedSuccess') || 'Course created successfully', [
        { text: t('common.ok'), onPress: () => router.back() },
      ]);
    } catch (err) {
      console.log('Error creating course:', err);
      Alert.alert(t('common.error'), t('courses.failedToCreateCourse') || 'Failed to create course');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{t('home.createNewCourse')}</Text>
        <Text style={styles.subtitle}>
          {t('home.createNewCourseDescription')}
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>{t('courses.courseName')} *</Text>
          <TextInput
            style={styles.input}
            placeholder={t('courses.courseNamePlaceholder')}
            placeholderTextColor="#6b7280"
            value={courseName}
            onChangeText={setCourseName}
          />

          <Text style={styles.label}>{t('courses.courseDescription')} ({t('common.optional')})</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder={t('courses.courseDescriptionPlaceholder')}
            placeholderTextColor="#6b7280"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <Text style={styles.label}>{t('auth.institution')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('auth.institutionPlaceholder')}
            placeholderTextColor="#6b7280"
            value={institution}
            onChangeText={setInstitution}
          />

          <TouchableOpacity
            style={[styles.saveButton, loading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={loading || !courseName.trim()}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.saveButtonText}>{t('home.createCourse')}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
          >
            <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const ACCENT_GREEN = '#047857';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#374151',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  label: {
    fontSize: 13,
    color: '#374151',
    marginTop: 12,
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    fontSize: 14,
  },
  textArea: {
    minHeight: 100,
  },
  saveButton: {
    marginTop: 24,
    backgroundColor: ACCENT_GREEN,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#ffffff',
  },
  cancelButtonText: {
    color: '#4b5563',
    fontSize: 16,
    fontWeight: '600',
  },
});

