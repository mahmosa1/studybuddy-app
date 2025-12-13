// app/(auth)/register-lecturer.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import * as ImagePicker from 'expo-image-picker';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

import { auth, db } from '@/lib/firebaseConfig';
import { uploadImageToSupabase } from '@/lib/upload';

export default function RegisterLecturerScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [institution, setInstitution] = useState('');
  const [department, setDepartment] = useState('');

  const [lecturerIdUrl, setLecturerIdUrl] = useState<string | null>(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);

  const [uploadingId, setUploadingId] = useState(false);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [loading, setLoading] = useState(false);

  const pickAndUploadImage = async (type: 'id' | 'profile') => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permission required',
        'We need access to your gallery to upload images.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled) return;

    const uri = result.assets[0].uri;

    if (type === 'id') setUploadingId(true);
    else setUploadingProfile(true);

    try {
      const folder =
        type === 'id' ? 'lecturer-ids' : 'lecturer-profile-pictures';

      const url = await uploadImageToSupabase(uri, folder as any);
      if (!url) {
        Alert.alert('Upload failed', 'Could not upload image. Please try again.');
        return;
      }

      if (type === 'id') setLecturerIdUrl(url);
      else setProfilePictureUrl(url);
    } catch (err) {
      console.log('Lecturer image upload error:', err);
      Alert.alert('Error', 'Unexpected error while uploading image.');
    } finally {
      if (type === 'id') setUploadingId(false);
      else setUploadingProfile(false);
    }
  };

  const handleSubmit = async () => {
    if (!email || !password || !username) {
      Alert.alert(
        'Missing fields',
        'Username, email and password are required.'
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password mismatch', 'Passwords do not match.');
      return;
    }

    if (!institution) {
      Alert.alert('Institution required', 'Please fill where you teach.');
      return;
    }

    if (!lecturerIdUrl) {
      Alert.alert(
        'Lecturer ID required',
        'Please upload your lecturer ID before continuing.'
      );
      return;
    }

    try {
      setLoading(true);

      // 1) Firebase Auth
      const cred = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      const uid = cred.user.uid;

      // 2) Firestore – users collection
      await setDoc(doc(db, 'users', uid), {
        uid,
        role: 'lecturer',
        status: 'pending', // עד שהאדמין יאשר
        username,
        fullName,
        email,
        phone,
        institution,
        department,
        lecturerIdUrl,
        profilePictureUrl,
        createdAt: serverTimestamp(),
      });

      Alert.alert(
        'Registration complete',
        'Your lecturer account is pending admin approval.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(auth)/pending-approval'),
          },
        ]
      );
    } catch (err: any) {
      console.log('Register lecturer error:', err);
      Alert.alert('Error', err?.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButtonHeader}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <View style={styles.logoContainer}>
            <Ionicons name="person" size={40} color="#ffffff" />
          </View>
          <Text style={styles.headerTitle}>{t('auth.lecturerRegistration')}</Text>
          <Text style={styles.headerSubtitle}>
            {t('auth.fillDetailsLecturer')}
          </Text>
        </View>

        <View style={styles.card}>
          {/* Username */}
          <View style={styles.inputGroup}>
            <Ionicons name="person-outline" size={18} color="#6b7280" style={styles.inputIcon} />
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>{t('auth.username')} *</Text>
              <TextInput
                style={styles.input}
                placeholder={t('auth.usernamePlaceholder')}
                placeholderTextColor="#9CA3AF"
                value={username}
                onChangeText={setUsername}
              />
            </View>
          </View>

          {/* Full Name */}
          <View style={styles.inputGroup}>
            <Ionicons name="person-circle-outline" size={18} color="#6b7280" style={styles.inputIcon} />
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>{t('auth.fullName')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('auth.fullNamePlaceholder')}
                placeholderTextColor="#9CA3AF"
                value={fullName}
                onChangeText={setFullName}
              />
            </View>
          </View>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Ionicons name="mail-outline" size={18} color="#6b7280" style={styles.inputIcon} />
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>{t('auth.email')} *</Text>
              <TextInput
                style={styles.input}
                placeholder={t('auth.emailPlaceholderLecturer')}
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <Ionicons name="lock-closed-outline" size={18} color="#6b7280" style={styles.inputIcon} />
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>{t('auth.password')} *</Text>
              <TextInput
                style={styles.input}
                placeholder={t('auth.passwordPlaceholder')}
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>
          </View>

          {/* Confirm Password */}
          <View style={styles.inputGroup}>
            <Ionicons name="lock-closed-outline" size={18} color="#6b7280" style={styles.inputIcon} />
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>{t('auth.confirmPassword')} *</Text>
              <TextInput
                style={styles.input}
                placeholder={t('auth.confirmPasswordPlaceholder')}
                placeholderTextColor="#9CA3AF"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
            </View>
          </View>

          {/* Phone */}
          <View style={styles.inputGroup}>
            <Ionicons name="call-outline" size={18} color="#6b7280" style={styles.inputIcon} />
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>{t('auth.phoneNumber')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('auth.phonePlaceholder')}
                placeholderTextColor="#9CA3AF"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Institution */}
          <View style={styles.inputGroup}>
            <Ionicons name="business-outline" size={18} color="#6b7280" style={styles.inputIcon} />
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>{t('auth.institution')} *</Text>
              <TextInput
                style={styles.input}
                placeholder={t('auth.institutionPlaceholder')}
                placeholderTextColor="#9CA3AF"
                value={institution}
                onChangeText={setInstitution}
              />
            </View>
          </View>

          {/* Department */}
          <View style={styles.inputGroup}>
            <Ionicons name="school-outline" size={18} color="#6b7280" style={styles.inputIcon} />
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>{t('auth.department')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('auth.departmentPlaceholder')}
                placeholderTextColor="#9CA3AF"
                value={department}
                onChangeText={setDepartment}
              />
            </View>
          </View>

          {/* Lecturer ID */}
          <View style={styles.uploadSection}>
            <Text style={styles.label}>{t('auth.uploadLecturerID')} *</Text>
            <TouchableOpacity
              style={[
                styles.uploadButton,
                lecturerIdUrl && styles.uploadButtonFilled,
              ]}
              onPress={() => pickAndUploadImage('id')}
              disabled={uploadingId}
            >
              {uploadingId ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Ionicons
                    name={lecturerIdUrl ? 'checkmark-circle' : 'card-outline'}
                    size={20}
                    color={lecturerIdUrl ? '#ffffff' : PRIMARY_GREEN}
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={[
                      styles.uploadText,
                      lecturerIdUrl && styles.uploadTextFilled,
                    ]}
                  >
                    {lecturerIdUrl ? t('auth.lecturerIDUploaded') : t('auth.uploadLecturerID')}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {lecturerIdUrl && (
              <View style={styles.previewContainer}>
                <Image source={{ uri: lecturerIdUrl }} style={styles.preview} />
              </View>
            )}
          </View>

          {/* Profile picture */}
          <View style={styles.uploadSection}>
            <Text style={styles.label}>{t('auth.profilePicture')} ({t('common.optional')})</Text>
            <TouchableOpacity
              style={[
                styles.uploadButton,
                profilePictureUrl && styles.uploadButtonFilled,
              ]}
              onPress={() => pickAndUploadImage('profile')}
              disabled={uploadingProfile}
            >
              {uploadingProfile ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Ionicons
                    name={profilePictureUrl ? 'checkmark-circle' : 'image-outline'}
                    size={20}
                    color={profilePictureUrl ? '#ffffff' : ACCENT_GREEN}
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={[
                      styles.uploadText,
                      profilePictureUrl && styles.uploadTextFilled,
                    ]}
                  >
                    {profilePictureUrl
                      ? t('auth.profilePictureUploaded')
                      : t('auth.uploadProfilePicture')}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {profilePictureUrl && (
              <View style={styles.previewContainer}>
                <Image
                  source={{ uri: profilePictureUrl }}
                  style={styles.previewSmall}
                />
              </View>
            )}
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading || uploadingId}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.submitText}>{t('auth.createAccount')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const PRIMARY_GREEN = '#047857';
const ACCENT_GREEN = '#047857';

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  header: {
    backgroundColor: PRIMARY_GREEN,
    paddingTop: 60,
    paddingBottom: 30,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: -30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  backButtonHeader: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ACCENT_GREEN,
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: ACCENT_GREEN,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: ACCENT_GREEN,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: ACCENT_GREEN,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#ffffff',
    opacity: 0.9,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
    marginTop: 20,
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
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    fontSize: 15,
  },
  uploadSection: {
    marginBottom: 20,
  },
  uploadButton: {
    flexDirection: 'row',
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: ACCENT_GREEN,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  uploadButtonFilled: {
    backgroundColor: ACCENT_GREEN,
    borderColor: ACCENT_GREEN,
  },
  uploadText: {
    color: ACCENT_GREEN,
    fontWeight: '600',
    fontSize: 14,
  },
  uploadTextFilled: {
    color: '#ffffff',
  },
  previewContainer: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
  },
  previewSmall: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: PRIMARY_GREEN,
  },
  submitButton: {
    flexDirection: 'row',
    marginTop: 24,
    backgroundColor: PRIMARY_GREEN,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PRIMARY_GREEN,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
