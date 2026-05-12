// app/(auth)/pending-approval.tsx
import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { PrimaryButton } from '@/frontend/components/ui/PrimaryButton';
import { layout, radius, spacing, typography } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  I18nManager,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { auth, db } from '@/lib/firebaseConfig';
import { uploadImageToSupabase } from '@/lib/upload';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';

export default function PendingApprovalScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const isHebrewUi = i18n.language === 'he';
  const isRtl = I18nManager.isRTL;

  const inputAlign = {
    textAlign: (isHebrewUi ? 'right' : 'left') as 'right' | 'left',
    writingDirection: (isHebrewUi ? 'rtl' : 'ltr') as 'rtl' | 'ltr',
  };

  const [userStatus, setUserStatus] = useState<'pending' | 'rejected' | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [appealModalVisible, setAppealModalVisible] = useState(false);
  const [appealMessage, setAppealMessage] = useState('');
  const [appealImageUri, setAppealImageUri] = useState<string | null>(null);
  const [appealImageUrl, setAppealImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submittingAppeal, setSubmittingAppeal] = useState(false);

  useEffect(() => {
    loadUserStatus();
  }, []);

  const loadUserStatus = async () => {
    const user = auth.currentUser;
    if (!user) {
      router.replace('/(auth)/login');
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setUserStatus(data.status);
        setRejectionReason(data.rejectionReason || null);
      }
    } catch (err) {
      console.log('Error loading user status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.log('Sign out error:', err);
    } finally {
      router.replace('/(auth)/login');
    }
  };

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        t('auth.permissionRequired'),
        t('auth.galleryPermissionMessage')
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
    setAppealImageUri(uri);
    setUploadingImage(true);

    try {
      // Upload to a new folder for appeal images
      const url = await uploadImageToSupabase(uri, 'profile-pictures'); // Using existing folder, or we could create 'appeal-images'
      if (url) {
        setAppealImageUrl(url);
      } else {
        Alert.alert(t('common.uploadFailed'), t('common.uploadFailedMessage'));
        setAppealImageUri(null);
      }
    } catch (err) {
      console.log('Image upload error:', err);
      Alert.alert(t('common.error'), t('common.uploadError'));
      setAppealImageUri(null);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setAppealImageUri(null);
    setAppealImageUrl(null);
  };

  const handleSubmitAppeal = async () => {
    // Dismiss keyboard when submitting
    Keyboard.dismiss();

    if (!appealMessage.trim()) {
      Alert.alert(t('common.required'), t('auth.appealMessageRequired'));
      return;
    }

    const user = auth.currentUser;
    if (!user) return;

    try {
      setSubmittingAppeal(true);

      // Check if user already has a pending appeal
      const appealsRef = collection(db, 'appeals');
      const pendingAppealsQuery = query(
        appealsRef,
        where('userId', '==', user.uid),
        where('status', '==', 'pending')
      );
      const pendingAppealsSnap = await getDocs(pendingAppealsQuery);

      if (!pendingAppealsSnap.empty) {
        Alert.alert(
          t('auth.appealAlreadySubmitted'),
          t('auth.appealAlreadySubmittedMessage')
        );
        setSubmittingAppeal(false);
        return;
      }

      // If image is selected but not uploaded yet, upload it first
      let finalImageUrl = appealImageUrl;
      if (appealImageUri && !appealImageUrl) {
        setUploadingImage(true);
        finalImageUrl = await uploadImageToSupabase(appealImageUri, 'profile-pictures');
        setUploadingImage(false);
        if (!finalImageUrl) {
          Alert.alert(t('common.error'), t('common.uploadFailedMessage'));
          return;
        }
      }

      await setDoc(doc(db, 'appeals', `${user.uid}_${Date.now()}`), {
        userId: user.uid,
        email: user.email,
        appealMessage: appealMessage.trim(),
        appealImageUrl: finalImageUrl || null,
        rejectionReason: rejectionReason,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      Alert.alert(
        'Appeal Submitted',
        'Your appeal has been submitted. An admin will review it and get back to you.',
        [
          {
            text: 'OK',
            onPress: () => {
              setAppealModalVisible(false);
              setAppealMessage('');
              setAppealImageUri(null);
              setAppealImageUrl(null);
            },
          },
        ]
      );
    } catch (err) {
      console.log('Error submitting appeal:', err);
      Alert.alert(t('common.error'), t('auth.failedToSubmitAppeal'));
    } finally {
      setSubmittingAppeal(false);
      setUploadingImage(false);
    }
  };

  if (loading) {
    return (
      <AppScreen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </AppScreen>
    );
  }

  const isRejected = userStatus === 'rejected';

  return (
    <AppScreen>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
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
            <View
              style={[
                styles.logoInner,
                {
                  backgroundColor: isRejected ? colors.dangerSurface : colors.surfaceMuted,
                },
              ]}
            >
              <Ionicons
                name={isRejected ? 'close-circle-outline' : 'hourglass-outline'}
                size={30}
                color={isRejected ? colors.danger : colors.warning}
              />
            </View>
          </View>
          <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>{t('auth.studybuddy')}</Text>
          <Text style={[styles.heroTagline, { color: colors.textSecondary }]}>{t('auth.tagline')}</Text>
        </View>

        <AppCard style={styles.statusCard}>
          <View
            style={[
              styles.statusIconWrap,
              {
                backgroundColor: isRejected ? colors.dangerSurface : colors.surfaceMuted,
                borderColor: isRejected ? colors.dangerBorder : colors.border,
              },
            ]}
          >
            <Ionicons
              name={isRejected ? 'close-circle' : 'time-outline'}
              size={40}
              color={isRejected ? colors.danger : colors.warning}
            />
          </View>

          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
            {isRejected ? t('auth.accountRejected') : t('auth.accountUnderReview')}
          </Text>
          <Text style={[styles.cardText, { color: colors.textSecondary }]}>
            {isRejected ? t('auth.accountRejectedMessage') : t('auth.accountUnderReviewMessage')}
          </Text>

          {isRejected && rejectionReason && (
            <View
              style={[
                styles.rejectionReasonBox,
                {
                  backgroundColor: colors.dangerSurface,
                  borderColor: colors.dangerBorder,
                },
              ]}
            >
              <View style={styles.rejectionReasonHeader}>
                <Ionicons name="information-circle-outline" size={20} color={colors.danger} />
                <Text style={[styles.rejectionReasonTitle, { color: colors.danger }]}>
                  {t('admin.rejectionReason')}
                </Text>
              </View>
              <Text style={[styles.rejectionReasonText, { color: colors.textPrimary }]}>{rejectionReason}</Text>
            </View>
          )}

          <View
            style={[
              styles.badge,
              {
                backgroundColor: isRejected ? colors.dangerSurface : colors.surfaceMuted,
                borderColor: isRejected ? colors.dangerBorder : colors.border,
              },
            ]}
          >
            <Ionicons
              name={isRejected ? 'close-circle' : 'time-outline'}
              size={16}
              color={isRejected ? colors.danger : colors.warning}
            />
            <Text style={[styles.badgeText, { color: isRejected ? colors.danger : colors.textPrimary }]}>
              {isRejected ? t('admin.status.rejected') : t('admin.status.pending')}
            </Text>
          </View>

          {isRejected && (
            <PrimaryButton
              label={t('auth.submitAppeal')}
              onPress={() => setAppealModalVisible(true)}
              style={styles.appealPrimary}
            />
          )}

          <TouchableOpacity
            style={[
              styles.logoutButton,
              {
                borderColor: colors.danger,
                backgroundColor: colors.surface,
              },
            ]}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.danger} style={styles.logoutIcon} />
            <Text style={[styles.logoutButtonText, { color: colors.danger }]}>{t('auth.backToLogin')}</Text>
          </TouchableOpacity>
        </AppCard>
      </ScrollView>

      {/* Appeal Modal */}
      <Modal
        visible={appealModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          Keyboard.dismiss();
          setAppealModalVisible(false);
          setAppealMessage('');
        }}
      >
        <KeyboardAvoidingView
          style={[styles.modalBackdrop, { backgroundColor: 'rgba(15, 23, 42, 0.45)' }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {
              Keyboard.dismiss();
              setAppealModalVisible(false);
              setAppealMessage('');
            }}
            style={styles.modalBackdropFill}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <View
                style={[
                  styles.appealModalContent,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <View style={styles.appealModalHeader}>
                    <View style={[styles.appealModalIconWrap, { backgroundColor: colors.surfaceMuted }]}>
                      <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.primary} />
                    </View>
                    <Text style={[styles.appealModalTitle, { color: colors.textPrimary }]}>{t('auth.submitAppeal')}</Text>
                  </View>
                  <Text style={[styles.appealModalSubtitle, { color: colors.textSecondary }]}>
                    {t('auth.appealModalSubtitle')}
                  </Text>

                  <Text style={[styles.appealModalLabel, { color: colors.textSecondary }]}>
                    {t('admin.appealMessage')} *
                  </Text>
                  <TextInput
                    style={[
                      styles.appealModalInput,
                      {
                        backgroundColor: colors.surfaceMuted,
                        borderColor: colors.border,
                        color: colors.textPrimary,
                      },
                      inputAlign,
                    ]}
                    placeholder={t('auth.appealMessagePlaceholder')}
                    placeholderTextColor={colors.textSecondary}
                    value={appealMessage}
                    onChangeText={setAppealMessage}
                    multiline
                    numberOfLines={6}
                    textAlignVertical="top"
                  />

                  <Text style={[styles.appealModalLabel, { color: colors.textSecondary }]}>
                    {t('auth.supportingImageOptional')}
                  </Text>
                  <Text style={[styles.appealModalHelperText, { color: colors.textSecondary }]}>
                    {t('auth.supportingImageHelper')}
                  </Text>

                  {appealImageUri ? (
                    <View style={[styles.imagePreviewContainer, { borderColor: colors.border }]}>
                      <Image source={{ uri: appealImageUri }} style={styles.imagePreview} />
                      {uploadingImage ? (
                        <View style={styles.imageOverlay}>
                          <ActivityIndicator size="large" color={colors.primary} />
                          <Text style={[styles.uploadingText, { color: colors.textOnPrimary }]}>
                            {t('common.uploading')}
                          </Text>
                        </View>
                      ) : null}
                      <TouchableOpacity
                        style={[styles.removeImageButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        onPress={handleRemoveImage}
                      >
                        <Ionicons name="close-circle" size={24} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[
                        styles.uploadImageButton,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.surfaceMuted,
                        },
                      ]}
                      onPress={handlePickImage}
                      disabled={uploadingImage}
                      activeOpacity={0.75}
                    >
                      {uploadingImage ? (
                        <ActivityIndicator color={colors.primary} />
                      ) : (
                        <View style={[styles.uploadButtonInner, isRtl && styles.uploadButtonInnerRtl]}>
                          <Ionicons name="image-outline" size={22} color={colors.primary} />
                          <Text style={[styles.uploadImageButtonText, { color: colors.textPrimary }]}>
                            {t('common.uploadImage')}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )}
                </ScrollView>

                <View style={styles.appealModalButtons}>
                  <TouchableOpacity
                    style={[
                      styles.appealModalButton,
                      {
                        backgroundColor: colors.surfaceMuted,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => {
                      Keyboard.dismiss();
                      setAppealModalVisible(false);
                      setAppealMessage('');
                      setAppealImageUri(null);
                      setAppealImageUrl(null);
                    }}
                  >
                    <Text style={[styles.appealModalCancelText, { color: colors.textPrimary }]}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <View style={styles.appealSubmitWrap}>
                    <PrimaryButton
                      label={t('auth.submitAppeal')}
                      onPress={handleSubmitAppeal}
                      disabled={submittingAppeal}
                      loading={submittingAppeal}
                      style={styles.appealSubmitButton}
                    />
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.xs,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  statusCard: {
    marginTop: -spacing.sm,
    alignItems: 'center',
  },
  statusIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  cardTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  cardText: {
    ...typography.body,
    marginBottom: spacing.lg,
    textAlign: 'center',
    lineHeight: 22,
  },
  rejectionReasonBox: {
    width: '100%',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
  },
  rejectionReasonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  rejectionReasonTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  rejectionReasonText: {
    fontSize: 14,
    lineHeight: 20,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  appealPrimary: {
    alignSelf: 'stretch',
    width: '100%',
    marginBottom: spacing.sm,
  },
  logoutButton: {
    flexDirection: 'row',
    width: '100%',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  logoutIcon: {
    marginEnd: spacing.sm,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: layout.screenPadding,
  },
  modalBackdropFill: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appealModalContent: {
    width: '100%',
    maxWidth: 420,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    maxHeight: '88%',
  },
  appealModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  appealModalIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appealModalTitle: {
    ...typography.h3,
    flex: 1,
  },
  appealModalSubtitle: {
    ...typography.body,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  appealModalLabel: {
    ...typography.caption,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  appealModalInput: {
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
  },
  appealModalHelperText: {
    fontSize: 12,
    marginBottom: spacing.sm,
    lineHeight: 16,
  },
  uploadImageButton: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
    marginBottom: spacing.md,
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
  uploadImageButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  imagePreviewContainer: {
    position: 'relative',
    borderRadius: radius.md,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  imagePreview: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingText: {
    marginTop: spacing.sm,
    fontSize: 14,
    fontWeight: '600',
  },
  removeImageButton: {
    position: 'absolute',
    top: spacing.sm,
    end: spacing.sm,
    borderRadius: 20,
    padding: 4,
    borderWidth: 1,
  },
  appealModalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  appealModalButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    borderWidth: 1,
  },
  appealSubmitWrap: {
    flex: 1,
  },
  appealSubmitButton: {
    width: '100%',
  },
  appealModalCancelText: {
    fontWeight: '600',
    fontSize: 15,
  },
});
