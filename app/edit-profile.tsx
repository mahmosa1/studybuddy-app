// app/edit-profile.tsx
import { auth, db } from '@/lib/firebaseConfig';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { uploadImageToSupabase } from '@/lib/upload';

const ACCENT_GREEN = '#047857';

export default function EditProfileScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const isHebrewUi = i18n.language === 'he';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [institution, setInstitution] = useState('');
  const [fieldOfStudy, setFieldOfStudy] = useState('');
  const [department, setDepartment] = useState('');
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [role, setRole] = useState<string>('');

  useEffect(() => {
    const loadProfile = async () => {
      const user = auth.currentUser;
      if (!user) {
        router.replace('/(auth)/login');
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUsername(data.username || '');
          setFullName(data.fullName || '');
          setPhone(data.phone || '');
          setInstitution(data.institution || '');
          setFieldOfStudy(data.fieldOfStudy || '');
          setDepartment(data.department || '');
          setProfilePictureUrl(data.profilePictureUrl || null);
          setRole(data.role || '');
        }
      } catch (err) {
        console.log('Error loading profile:', err);
        Alert.alert(t('common.error'), t('editProfileScreen.loadFailed'));
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [router, t]);

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('editProfileScreen.permissionTitle'), t('editProfileScreen.permissionMessage'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled) return;

    const uri = result.assets[0].uri;
    setUploading(true);

    try {
      const url = await uploadImageToSupabase(uri, 'profile-pictures');
      if (url) {
        setProfilePictureUrl(url);
      } else {
        Alert.alert(t('editProfileScreen.uploadFailedTitle'), t('editProfileScreen.uploadFailedMessage'));
      }
    } catch (err) {
      console.log('Image upload error:', err);
      Alert.alert(t('common.error'), t('editProfileScreen.uploadError'));
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePicture = () => {
    Alert.alert(t('editProfileScreen.deletePictureTitle'), t('editProfileScreen.deletePictureMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => setProfilePictureUrl(null),
      },
    ]);
  };

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert(t('common.error'), t('editProfileScreen.mustBeLoggedIn'));
      return;
    }

    try {
      setSaving(true);
      await updateDoc(doc(db, 'users', user.uid), {
        username: username.trim(),
        fullName: fullName.trim(),
        phone: phone.trim() || null,
        institution: institution.trim() || null,
        fieldOfStudy: fieldOfStudy.trim() || null,
        department: department.trim() || null,
        profilePictureUrl: profilePictureUrl || null,
      });

      Alert.alert(t('common.success'), t('editProfileScreen.profileUpdated'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ]);
    } catch (err) {
      console.log('Error updating profile:', err);
      Alert.alert(t('common.error'), t('editProfileScreen.updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={ACCENT_GREEN} size="large" />
      </View>
    );
  }

  const rtlText = isHebrewUi ? styles.rtlText : undefined;
  const inputStyle = [styles.input, isHebrewUi && styles.inputRtl];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top + 12, 20) },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>

        <Text style={styles.title}>{t('editProfileScreen.title')}</Text>
        <Text style={styles.subtitle}>{t('editProfileScreen.subtitle')}</Text>

        <View style={styles.card}>
          <Text style={[styles.label, rtlText]}>{t('editProfileScreen.profilePicture')}</Text>
          <View style={styles.avatarSection}>
            {profilePictureUrl ? (
              <Image source={{ uri: profilePictureUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {(fullName || username || 'U')[0].toUpperCase()}
                </Text>
              </View>
            )}
            <View style={[styles.avatarButtons, isHebrewUi && styles.avatarButtonsRtl]}>
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={handlePickImage}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color={ACCENT_GREEN} />
                ) : (
                  <Text style={[styles.uploadButtonText, rtlText]}>
                    {profilePictureUrl ? t('editProfileScreen.changePicture') : t('editProfileScreen.uploadPicture')}
                  </Text>
                )}
              </TouchableOpacity>
              {profilePictureUrl && (
                <TouchableOpacity
                  style={[styles.deleteButton, isHebrewUi && styles.deleteButtonRtl]}
                  onPress={handleDeletePicture}
                >
                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                  <Text style={[styles.deleteButtonText, rtlText]}>{t('editProfileScreen.deletePicture')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <Text style={[styles.label, rtlText]}>{t('editProfileScreen.usernameLabel')}</Text>
          <TextInput
            style={inputStyle}
            placeholder={t('editProfileScreen.usernamePlaceholder')}
            placeholderTextColor="#6b7280"
            value={username}
            onChangeText={setUsername}
            textAlign={isHebrewUi ? 'right' : 'left'}
          />

          <Text style={[styles.label, rtlText]}>{t('editProfileScreen.fullNameLabel')}</Text>
          <TextInput
            style={inputStyle}
            placeholder={t('editProfileScreen.fullNamePlaceholder')}
            placeholderTextColor="#6b7280"
            value={fullName}
            onChangeText={setFullName}
            textAlign={isHebrewUi ? 'right' : 'left'}
          />

          <Text style={[styles.label, rtlText]}>{t('editProfileScreen.phoneLabel')}</Text>
          <TextInput
            style={inputStyle}
            placeholder={t('editProfileScreen.phonePlaceholder')}
            placeholderTextColor="#6b7280"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            textAlign={isHebrewUi ? 'right' : 'left'}
          />

          <Text style={[styles.label, rtlText]}>
            {role === 'lecturer' ? t('editProfileScreen.institutionLecturerLabel') : t('editProfileScreen.universityLabel')}
          </Text>
          <TextInput
            style={inputStyle}
            placeholder={
              role === 'lecturer'
                ? t('editProfileScreen.institutionPlaceholderLecturer')
                : t('editProfileScreen.institutionPlaceholderStudent')
            }
            placeholderTextColor="#6b7280"
            value={institution}
            onChangeText={setInstitution}
            textAlign={isHebrewUi ? 'right' : 'left'}
          />

          {role === 'student' ? (
            <>
              <Text style={[styles.label, rtlText]}>{t('editProfileScreen.fieldOfStudyLabel')}</Text>
              <TextInput
                style={inputStyle}
                placeholder={t('editProfileScreen.fieldOfStudyPlaceholder')}
                placeholderTextColor="#6b7280"
                value={fieldOfStudy}
                onChangeText={setFieldOfStudy}
                textAlign={isHebrewUi ? 'right' : 'left'}
              />
            </>
          ) : (
            <>
              <Text style={[styles.label, rtlText]}>{t('editProfileScreen.departmentLabel')}</Text>
              <TextInput
                style={inputStyle}
                placeholder={t('editProfileScreen.departmentPlaceholder')}
                placeholderTextColor="#6b7280"
                value={department}
                onChangeText={setDepartment}
                textAlign={isHebrewUi ? 'right' : 'left'}
              />
            </>
          )}

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving || !username.trim()}
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.saveButtonText}>{t('editProfileScreen.saveChanges')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
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
  avatarSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 12,
    borderWidth: 3,
    borderColor: '#047857',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: ACCENT_GREEN,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: '700',
  },
  avatarButtons: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  avatarButtonsRtl: {
    flexDirection: 'row-reverse',
  },
  uploadButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#047857',
    backgroundColor: '#fff7ed',
  },
  uploadButtonText: {
    color: '#047857',
    fontSize: 13,
    fontWeight: '600',
  },
  deleteButtonRtl: {
    flexDirection: 'row-reverse',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
    gap: 6,
  },
  deleteButtonText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '600',
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
  inputRtl: {
    writingDirection: 'rtl',
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
});
