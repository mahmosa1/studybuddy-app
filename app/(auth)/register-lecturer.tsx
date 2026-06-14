// app/(auth)/register-lecturer.tsx
import { AcademicInstitutionPicker } from '@/frontend/components/ui/AcademicInstitutionPicker';
import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { PrimaryButton } from '@/frontend/components/ui/PrimaryButton';
import { buildInstitutionFirestoreFields, getInstitutionPickerSummaryLabel } from '@/lib/institutionUtils';
import { layout, radius, spacing, typography } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  I18nManager,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function RegisterLecturerScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const isHebrewUi = i18n.language === 'he';
  const isRtl = I18nManager.isRTL;

  const inputAlign = { textAlign: (isHebrewUi ? 'right' : 'left') as 'right' | 'left', writingDirection: (isHebrewUi ? 'rtl' : 'ltr') as 'rtl' | 'ltr' };

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [institution, setInstitution] = useState('');
  const [department, setDepartment] = useState('');

  const [lecturerIdUrl, setLecturerIdUrl] = useState<string | null>(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [verificationSelfieUrl, setVerificationSelfieUrl] = useState<string | null>(null);

  const [uploadingId, setUploadingId] = useState(false);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [uploadingSelfie, setUploadingSelfie] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const TOTAL_STEPS = 4;

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

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
      const folder = type === 'id' ? 'lecturer-ids' : 'lecturer-profile-pictures';

      const url = await uploadImageToSupabase(uri, folder);
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

  const uploadVerificationSelfie = async (uri: string) => {
    setUploadingSelfie(true);
    try {
      const url = await uploadImageToSupabase(uri, 'verification-selfies');
      if (!url) {
        Alert.alert('Upload failed', 'Could not upload image. Please try again.');
        return;
      }
      setVerificationSelfieUrl(url);
    } catch (err) {
      console.log('Verification selfie upload error:', err);
      Alert.alert('Error', 'Unexpected error while uploading image.');
    } finally {
      setUploadingSelfie(false);
    }
  };

  const captureVerificationSelfieAndUpload = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          isHebrewUi ? 'נדרש אישור מצלמה' : 'Camera permission required',
          isHebrewUi
            ? 'אישור המצלמה נדרש כדי לצלם סלפי אימות פנים. אפשר להפעיל אותו בהגדרות המכשיר → StudyBuddy → מצלמה.'
            : 'Camera access is required to take a live face verification selfie. Enable it in Settings → StudyBuddy → Camera.',
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.85,
        cameraType: ImagePicker.CameraType.front,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;
      await uploadVerificationSelfie(result.assets[0].uri);
    } catch (err: unknown) {
      console.log('Verification selfie camera error:', err);
      const message = String((err as { message?: string })?.message || '').toLowerCase();
      if (message.includes('camera') || message.includes('simulator') || message.includes('unavailable')) {
        Alert.alert(
          isHebrewUi ? 'מצלמה לא זמינה' : 'Camera unavailable',
          isHebrewUi
            ? 'לא הצלחנו לפתוח את המצלמה. ודא/י שאת/ה על מכשיר אמיתי (לא סימולטור), שאישרת גישה למצלמה, ונסה/י שוב.'
            : 'Could not open the camera. Make sure you are on a real device (not a simulator), camera access is granted, and try again.',
        );
        return;
      }
      Alert.alert(
        t('common.error'),
        isHebrewUi
          ? 'לא הצלחנו לפתוח את המצלמה. נסה/י שוב.'
          : 'Could not open the camera. Please try again.',
      );
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
      Alert.alert(t('common.error'), t('auth.institutionRequired'));
      return;
    }

    if (!lecturerIdUrl) {
      Alert.alert(
        'Lecturer ID required',
        'Please upload your lecturer ID before continuing.'
      );
      return;
    }

    if (!verificationSelfieUrl) {
      Alert.alert(
        'Face verification required',
        'Please upload a face verification selfie for manual review before continuing.'
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

      const institutionFields = buildInstitutionFirestoreFields(institution);

      // 2) Firestore – users collection
      await setDoc(doc(db, 'users', uid), {
        uid,
        role: 'lecturer',
        status: 'pending', // עד שהאדמין יאשר
        username,
        fullName,
        email,
        phone,
        ...institutionFields,
        department,
        lecturerIdUrl,
        profilePictureUrl,
        verificationSelfieUrl,
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

  const goToPreviousStep = () => setCurrentStep((s) => Math.max(1, s - 1));

  const tryAdvanceStep = () => {
    if (currentStep === 1) {
      if (!fullName.trim() || !username.trim() || !email.trim() || !password || !confirmPassword) {
        Alert.alert(
          isHebrewUi ? 'שדות חסרים' : 'Missing fields',
          isHebrewUi ? 'מלא/י את כל השדות כדי להמשיך.' : 'Please fill in all fields before continuing.',
        );
        return;
      }
      if (!isValidEmail(email)) {
        Alert.alert(
          isHebrewUi ? 'אימייל לא תקין' : 'Invalid email',
          isHebrewUi ? 'הזן/י כתובת אימייל תקינה.' : 'Please enter a valid email address.',
        );
        return;
      }
      if (password.length < 6) {
        Alert.alert(
          isHebrewUi ? 'סיסמה קצרה מדי' : 'Password too short',
          isHebrewUi
            ? 'הסיסמה חייבת להכיל לפחות 6 תווים.'
            : 'Password must be at least 6 characters.',
        );
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert(
          isHebrewUi ? 'הסיסמאות אינן תואמות' : 'Passwords do not match',
          isHebrewUi
            ? 'ודאי שהסיסמה ואימות הסיסמה זהים.'
            : 'Make sure the password and password verification are the same.',
        );
        return;
      }
    } else if (currentStep === 2) {
      if (!institution.trim()) {
        Alert.alert(t('common.error'), t('auth.institutionRequired'));
        return;
      }
      if (!department.trim() || !phone.trim()) {
        Alert.alert(
          'Missing fields',
          'Please fill in your institution, department, and phone number before continuing.',
        );
        return;
      }
    } else if (currentStep === 3) {
      if (!lecturerIdUrl) {
        Alert.alert(
          'Lecturer ID required',
          'Please upload your lecturer ID before continuing.',
        );
        return;
      }
      if (!verificationSelfieUrl) {
        Alert.alert(
          isHebrewUi ? 'נדרשת תמונת אימות פנים' : 'Face verification required',
          isHebrewUi
            ? 'יש להעלות תמונת סלפי ברורה לבדיקה ידנית.'
            : 'Please upload a clear face photo for manual review.',
        );
        return;
      }
    }
    setCurrentStep((s) => Math.min(TOTAL_STEPS, s + 1));
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicatorWrap}>
      <Text style={[styles.stepIndicatorLabel, { color: colors.textSecondary }]}>
        {t('practice.setup.stepOf', { current: currentStep, total: TOTAL_STEPS })}
      </Text>
      <View style={[styles.stepDotsRow, isRtl && styles.stepDotsRowRtl]}>
        {[1, 2, 3, 4].map((step) => (
          <View
            key={step}
            style={[
              styles.stepDot,
              { backgroundColor: step <= currentStep ? colors.primary : colors.border },
            ]}
          />
        ))}
      </View>
    </View>
  );

  const renderSummaryRow = (label: string, value: string) => (
    <View style={[styles.summaryRow, isRtl && styles.summaryRowRtl]}>
      <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text
        style={[
          styles.summaryValue,
          { color: colors.textPrimary, textAlign: isRtl ? 'left' : 'right' },
        ]}
      >
        {value}
      </Text>
    </View>
  );

  const renderCurrentStep = () => {
    if (currentStep === 1) {
      return (
        <AppCard style={styles.sectionCard}>
          <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>{t('auth.register')}</Text>

          <View style={styles.fieldBlock}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('auth.fullName')}</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <Ionicons name="person-circle-outline" size={18} color={colors.textSecondary} style={styles.inputRowIcon} />
              <TextInput
                style={[styles.input, { color: colors.textPrimary }, inputAlign]}
                placeholder={t('auth.fullNamePlaceholder')}
                placeholderTextColor={colors.textSecondary}
                value={fullName}
                onChangeText={setFullName}
              />
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('auth.username')} *</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <Ionicons name="person-outline" size={18} color={colors.textSecondary} style={styles.inputRowIcon} />
              <TextInput
                style={[styles.input, { color: colors.textPrimary }, inputAlign]}
                placeholder={t('auth.usernamePlaceholder')}
                placeholderTextColor={colors.textSecondary}
                value={username}
                onChangeText={setUsername}
              />
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('auth.email')} *</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <Ionicons name="mail-outline" size={18} color={colors.textSecondary} style={styles.inputRowIcon} />
              <TextInput
                style={[styles.input, { color: colors.textPrimary }, inputAlign]}
                placeholder={t('auth.emailPlaceholderLecturer')}
                placeholderTextColor={colors.textSecondary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('auth.password')} *</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} style={styles.inputRowIcon} />
              <TextInput
                style={[styles.input, styles.inputWithTrailingToggle, { color: colors.textPrimary }, inputAlign]}
                placeholder={t('auth.passwordPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.inputRowSuffix}
                activeOpacity={0.65}
                accessibilityRole="button"
                accessibilityLabel={isHebrewUi ? 'הצג או הסתר סיסמה' : 'Show or hide password'}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={showPassword ? colors.primary : colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {isHebrewUi ? 'אימות סיסמה' : t('auth.confirmPassword')} *
            </Text>
            <View style={[styles.inputRow, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.textSecondary} style={styles.inputRowIcon} />
              <TextInput
                style={[styles.input, styles.inputWithTrailingToggle, { color: colors.textPrimary }, inputAlign]}
                placeholder={isHebrewUi ? 'הקלד שוב את הסיסמה' : t('auth.confirmPasswordPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword((v) => !v)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={styles.inputRowSuffix}
                activeOpacity={0.65}
                accessibilityRole="button"
                accessibilityLabel={isHebrewUi ? 'הצג או הסתר אימות סיסמה' : 'Show or hide confirm password'}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={showConfirmPassword ? colors.primary : colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>
        </AppCard>
      );
    }

    if (currentStep === 2) {
      return (
        <AppCard style={styles.sectionCard}>
          <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>{t('auth.lecturer')}</Text>

          <View style={styles.fieldBlock}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('auth.institution')} *</Text>
            <AcademicInstitutionPicker
              value={institution}
              onChange={setInstitution}
              placeholder={t('auth.institutionPlaceholder')}
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('auth.department')}</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <Ionicons name="school-outline" size={18} color={colors.textSecondary} style={styles.inputRowIcon} />
              <TextInput
                style={[styles.input, { color: colors.textPrimary }, inputAlign]}
                placeholder={t('auth.departmentPlaceholder')}
                placeholderTextColor={colors.textSecondary}
                value={department}
                onChangeText={setDepartment}
              />
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('auth.phoneNumber')}</Text>
            <View style={[styles.inputRow, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <Ionicons name="call-outline" size={18} color={colors.textSecondary} style={styles.inputRowIcon} />
              <TextInput
                style={[styles.input, { color: colors.textPrimary }, inputAlign]}
                placeholder={t('auth.phonePlaceholder')}
                placeholderTextColor={colors.textSecondary}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>
          </View>
        </AppCard>
      );
    }

    if (currentStep === 3) {
      return (
        <AppCard style={styles.sectionCard}>
          <View style={styles.uploadSection}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('auth.profilePicture')} ({t('common.optional')})</Text>
            <TouchableOpacity
              style={[
                styles.uploadButton,
                {
                  borderColor: profilePictureUrl ? colors.success : colors.border,
                  backgroundColor: profilePictureUrl ? colors.surface : colors.surfaceMuted,
                },
              ]}
              onPress={() => pickAndUploadImage('profile')}
              disabled={uploadingProfile}
              activeOpacity={0.75}
            >
              {uploadingProfile ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <View style={[styles.uploadButtonInner, isRtl && styles.uploadButtonInnerRtl]}>
                  <Ionicons
                    name={profilePictureUrl ? 'checkmark-circle' : 'image-outline'}
                    size={20}
                    color={profilePictureUrl ? colors.success : colors.primary}
                  />
                  <Text
                    style={[
                      styles.uploadText,
                      { color: profilePictureUrl ? colors.success : colors.textPrimary },
                    ]}
                  >
                    {profilePictureUrl
                      ? t('auth.profilePictureUploaded')
                      : t('auth.uploadProfilePicture')}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {profilePictureUrl && (
              <View style={[styles.previewContainer, { borderColor: colors.border }]}>
                <Image
                  source={{ uri: profilePictureUrl }}
                  style={[styles.previewSmall, { borderColor: colors.border }]}
                />
              </View>
            )}
          </View>

          <View style={styles.uploadSection}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{t('auth.uploadLecturerID')} *</Text>
            <TouchableOpacity
              style={[
                styles.uploadButton,
                {
                  borderColor: lecturerIdUrl ? colors.success : colors.border,
                  backgroundColor: lecturerIdUrl ? colors.surface : colors.surfaceMuted,
                },
              ]}
              onPress={() => pickAndUploadImage('id')}
              disabled={uploadingId}
              activeOpacity={0.75}
            >
              {uploadingId ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <View style={[styles.uploadButtonInner, isRtl && styles.uploadButtonInnerRtl]}>
                  <Ionicons
                    name={lecturerIdUrl ? 'checkmark-circle' : 'card-outline'}
                    size={20}
                    color={lecturerIdUrl ? colors.success : colors.primary}
                  />
                  <Text
                    style={[
                      styles.uploadText,
                      { color: lecturerIdUrl ? colors.success : colors.textPrimary },
                    ]}
                  >
                    {lecturerIdUrl ? t('auth.lecturerIDUploaded') : t('auth.uploadLecturerID')}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {lecturerIdUrl && (
              <View style={[styles.previewContainer, { borderColor: colors.border }]}>
                <Image source={{ uri: lecturerIdUrl }} style={styles.preview} />
              </View>
            )}
          </View>

          <View style={styles.uploadSection}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {isHebrewUi ? 'תמונת אימות פנים *' : 'Face Verification Selfie *'}
            </Text>
            <Text style={[styles.uploadCaption, { color: colors.textSecondary }]}>
              {isHebrewUi ? 'תמונת אימות פנים לבדיקה ידנית' : 'Face verification image for manual review'}
            </Text>
            <Text style={[styles.uploadHelperText, { color: colors.textSecondary }]}>
              {isHebrewUi
                ? 'יש לצלם סלפי חי מהמצלמה הקדמית בזמן ההרשמה. לא ניתן להעלות תמונה מהגלריה.'
                : 'You must take a live front-camera selfie during registration. Gallery uploads are not allowed.'}
            </Text>
            <TouchableOpacity
              style={[
                styles.uploadButton,
                {
                  borderColor: verificationSelfieUrl ? colors.success : colors.border,
                  backgroundColor: verificationSelfieUrl ? colors.surface : colors.surfaceMuted,
                },
              ]}
              onPress={captureVerificationSelfieAndUpload}
              disabled={uploadingSelfie}
              activeOpacity={0.75}
            >
              {uploadingSelfie ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <View style={[styles.uploadButtonInner, isRtl && styles.uploadButtonInnerRtl]}>
                  <Ionicons
                    name={verificationSelfieUrl ? 'checkmark-circle' : 'camera-outline'}
                    size={20}
                    color={verificationSelfieUrl ? colors.success : colors.primary}
                  />
                  <Text
                    style={[
                      styles.uploadText,
                      { color: verificationSelfieUrl ? colors.success : colors.textPrimary },
                    ]}
                  >
                    {verificationSelfieUrl
                      ? isHebrewUi
                        ? 'הועלה'
                        : 'Uploaded'
                      : isHebrewUi
                        ? 'צלם סלפי אימות'
                        : 'Take Verification Selfie'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {verificationSelfieUrl && (
              <View style={[styles.previewContainer, { borderColor: colors.border }]}>
                <Image source={{ uri: verificationSelfieUrl }} style={styles.preview} />
              </View>
            )}
          </View>
        </AppCard>
      );
    }

    const profileStatus = profilePictureUrl
      ? isHebrewUi
        ? 'הועלה'
        : 'Uploaded'
      : isHebrewUi
        ? 'לא הועלה'
        : 'Not uploaded';
    const idStatus = lecturerIdUrl
      ? isHebrewUi
        ? 'הועלה'
        : 'Uploaded'
      : isHebrewUi
        ? 'חסר'
        : 'Missing';
    const selfieSummaryStatus = verificationSelfieUrl
      ? isHebrewUi
        ? 'הועלתה'
        : 'Uploaded'
      : isHebrewUi
        ? 'חסרה'
        : 'Missing';

    return (
      <AppCard style={styles.sectionCard}>
        <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>
          {isHebrewUi ? 'סיכום' : 'Review'}
        </Text>
        {renderSummaryRow(t('auth.fullName'), fullName.trim() || '—')}
        {renderSummaryRow(t('auth.username'), username.trim() || '—')}
        {renderSummaryRow(t('auth.email'), email.trim() || '—')}
        {renderSummaryRow(t('auth.password'), '••••••••')}
        {renderSummaryRow(t('auth.institution'), institution.trim() ? getInstitutionPickerSummaryLabel(institution) : '—')}
        {renderSummaryRow(t('auth.department'), department.trim() || '—')}
        {renderSummaryRow(t('auth.phoneNumber'), phone.trim() || '—')}
        {renderSummaryRow(t('auth.profilePicture'), profileStatus)}
        {renderSummaryRow(t('auth.uploadLecturerID'), idStatus)}
        {renderSummaryRow(
          isHebrewUi ? 'תמונת אימות פנים' : 'Face Verification Selfie',
          selfieSummaryStatus,
        )}
      </AppCard>
    );
  };

  const backButtonEdge = isRtl ? { right: layout.screenPadding } : { left: layout.screenPadding };

  return (
    <AppScreen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.backButtonContainer, backButtonEdge]}>
            <TouchableOpacity
              style={[
                styles.backButton,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => router.back()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.85}
            >
              <Ionicons
                name={isRtl ? 'chevron-forward' : 'chevron-back'}
                size={22}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.hero}>
            <View
              style={[
                styles.logoRing,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View style={[styles.logoInner, { backgroundColor: colors.surfaceMuted }]}>
                <Ionicons name="person" size={30} color={colors.primary} />
              </View>
            </View>
            <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>{t('auth.lecturerRegistration')}</Text>
            <Text style={[styles.heroTagline, { color: colors.textSecondary }]}>{t('auth.fillDetailsLecturer')}</Text>
          </View>

          {renderStepIndicator()}
          {renderCurrentStep()}

          <View style={[styles.stepNav, { paddingBottom: insets.bottom + spacing.xl + spacing.sm }]}>
            {currentStep === 4 ? (
              <>
                <PrimaryButton
                  label={t('auth.createAccount')}
                  onPress={handleSubmit}
                  disabled={loading || uploadingId || uploadingSelfie}
                  loading={loading}
                />
                <PrimaryButton variant="secondary" label={t('common.back')} onPress={goToPreviousStep} />
              </>
            ) : (
              <>
                {currentStep > 1 && (
                  <PrimaryButton variant="secondary" label={t('common.back')} onPress={goToPreviousStep} />
                )}
                <PrimaryButton
                  label={t('common.next')}
                  onPress={tryAdvanceStep}
                  disabled={currentStep === 3 && (uploadingId || uploadingProfile || uploadingSelfie)}
                />
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.xs,
  },
  backButtonContainer: {
    position: 'absolute',
    top: spacing.xs,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    paddingTop: spacing.xxl + spacing.md,
    paddingBottom: spacing.md,
  },
  logoRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  logoInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    ...typography.h1,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  heroTagline: {
    ...typography.body,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    lineHeight: 20,
  },
  sectionCard: {
    marginBottom: spacing.md,
  },
  sectionHeading: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  fieldBlock: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.caption,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  inputRowIcon: {
    marginEnd: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
  },
  inputWithTrailingToggle: {
    minWidth: 0,
    paddingEnd: spacing.md,
  },
  inputRowSuffix: {
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginStart: spacing.xs,
    minWidth: 32,
  },
  uploadSection: {
    marginBottom: spacing.lg,
  },
  uploadCaption: {
    ...typography.caption,
    fontWeight: '600',
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  uploadHelperText: {
    ...typography.caption,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    lineHeight: 18,
    fontWeight: '500',
  },
  uploadButton: {
    marginTop: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
  },
  uploadButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  uploadButtonInnerRtl: {
    flexDirection: 'row-reverse',
  },
  uploadText: {
    fontWeight: '600',
    fontSize: 14,
    flexShrink: 1,
    textAlign: 'center',
  },
  previewContainer: {
    marginTop: spacing.md,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
  },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: radius.md,
  },
  previewSmall: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    alignSelf: 'center',
  },
  stepIndicatorWrap: {
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  stepIndicatorLabel: {
    ...typography.caption,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  stepDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepDotsRowRtl: {
    flexDirection: 'row-reverse',
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepNav: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  summaryRowRtl: {
    flexDirection: 'row-reverse',
  },
  summaryLabel: {
    ...typography.caption,
    fontWeight: '600',
    flexShrink: 0,
    maxWidth: '42%',
  },
  summaryValue: {
    ...typography.body,
    fontWeight: '500',
    flex: 1,
  },
});
