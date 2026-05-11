// app/edit-profile.tsx
import { auth, db } from '@/lib/firebaseConfig';
import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppHeader } from '@/frontend/components/ui/AppHeader';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { PrimaryButton } from '@/frontend/components/ui/PrimaryButton';
import { layout, radius, spacing } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
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
import { uploadImageToSupabase } from '@/lib/upload';

export default function EditProfileScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
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
      <AppScreen>
        <View style={[styles.container, styles.center]}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </AppScreen>
    );
  }

  const rtlText = isHebrewUi ? styles.rtlText : undefined;
  const inputStyle = [styles.input, isHebrewUi && styles.inputRtl];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppScreen>
        <AppHeader title={t('editProfileScreen.title')} onBack={() => router.back()} />
        <View style={[styles.topDecorWrap, { borderBottomColor: colors.border }]}>
          <View style={[styles.topDecorPrimary, { backgroundColor: colors.primary }]} />
          <View style={[styles.topDecorAccent, { backgroundColor: colors.accent }]} />
        </View>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AppCard style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.textPrimary }, rtlText]}>{t('editProfileScreen.profilePicture')}</Text>
            <View style={styles.avatarSection}>
              {profilePictureUrl ? (
                <Image source={{ uri: profilePictureUrl }} style={[styles.avatar, { borderColor: colors.primary }]} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                  <Text style={styles.avatarText}>
                    {(fullName || username || 'U')[0].toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={[styles.avatarButtons, isHebrewUi && styles.avatarButtonsRtl]}>
                <TouchableOpacity
                  style={[styles.uploadButton, { borderColor: colors.primary, backgroundColor: colors.surfaceMuted }]}
                  onPress={handlePickImage}
                  disabled={uploading}
                >
                  {uploading ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <Text style={[styles.uploadButtonText, { color: colors.primary }, rtlText]}>
                      {profilePictureUrl ? t('editProfileScreen.changePicture') : t('editProfileScreen.uploadPicture')}
                    </Text>
                  )}
                </TouchableOpacity>
                {profilePictureUrl && (
                  <TouchableOpacity
                    style={[styles.deleteButton, { borderColor: colors.danger, backgroundColor: colors.dangerSurface }, isHebrewUi && styles.deleteButtonRtl]}
                    onPress={handleDeletePicture}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                    <Text style={[styles.deleteButtonText, { color: colors.danger }, rtlText]}>{t('editProfileScreen.deletePicture')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <Text style={[styles.label, { color: colors.textPrimary }, rtlText]}>{t('editProfileScreen.usernameLabel')}</Text>
            <TextInput
              style={[...inputStyle, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.textPrimary }]}
              placeholder={t('editProfileScreen.usernamePlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={username}
              onChangeText={setUsername}
              textAlign={isHebrewUi ? 'right' : 'left'}
            />

            <Text style={[styles.label, { color: colors.textPrimary }, rtlText]}>{t('editProfileScreen.fullNameLabel')}</Text>
            <TextInput
              style={[...inputStyle, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.textPrimary }]}
              placeholder={t('editProfileScreen.fullNamePlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={fullName}
              onChangeText={setFullName}
              textAlign={isHebrewUi ? 'right' : 'left'}
            />

            <Text style={[styles.label, { color: colors.textPrimary }, rtlText]}>{t('editProfileScreen.phoneLabel')}</Text>
            <TextInput
              style={[...inputStyle, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.textPrimary }]}
              placeholder={t('editProfileScreen.phonePlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              textAlign={isHebrewUi ? 'right' : 'left'}
            />

            <Text style={[styles.label, { color: colors.textPrimary }, rtlText]}>
              {role === 'lecturer' ? t('editProfileScreen.institutionLecturerLabel') : t('editProfileScreen.universityLabel')}
            </Text>
            <TextInput
              style={[...inputStyle, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.textPrimary }]}
              placeholder={
                role === 'lecturer'
                  ? t('editProfileScreen.institutionPlaceholderLecturer')
                  : t('editProfileScreen.institutionPlaceholderStudent')
              }
              placeholderTextColor={colors.textSecondary}
              value={institution}
              onChangeText={setInstitution}
              textAlign={isHebrewUi ? 'right' : 'left'}
            />

            {role === 'student' ? (
              <>
                <Text style={[styles.label, { color: colors.textPrimary }, rtlText]}>{t('editProfileScreen.fieldOfStudyLabel')}</Text>
                <TextInput
                  style={[...inputStyle, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.textPrimary }]}
                  placeholder={t('editProfileScreen.fieldOfStudyPlaceholder')}
                  placeholderTextColor={colors.textSecondary}
                  value={fieldOfStudy}
                  onChangeText={setFieldOfStudy}
                  textAlign={isHebrewUi ? 'right' : 'left'}
                />
              </>
            ) : (
              <>
                <Text style={[styles.label, { color: colors.textPrimary }, rtlText]}>{t('editProfileScreen.departmentLabel')}</Text>
                <TextInput
                  style={[...inputStyle, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.textPrimary }]}
                  placeholder={t('editProfileScreen.departmentPlaceholder')}
                  placeholderTextColor={colors.textSecondary}
                  value={department}
                  onChangeText={setDepartment}
                  textAlign={isHebrewUi ? 'right' : 'left'}
                />
              </>
            )}

            <PrimaryButton
              label={t('editProfileScreen.saveChanges')}
              onPress={handleSave}
              loading={saving}
              disabled={saving || !username.trim()}
              style={styles.saveButton}
            />
          </AppCard>
        </ScrollView>
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: 40,
    paddingTop: 2,
    gap: spacing.sm,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
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
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  card: {
    borderRadius: radius.lg,
    padding: 20,
    borderWidth: 1,
  },
  label: {
    fontSize: 13,
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
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
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
  },
  uploadButtonText: {
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
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    fontSize: 14,
  },
  inputRtl: {
    writingDirection: 'rtl',
  },
  saveButton: {
    marginTop: 24,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
});
