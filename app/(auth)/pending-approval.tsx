// app/(auth)/pending-approval.tsx
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
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
  const { t } = useTranslation();
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
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={PRIMARY_GREEN} />
      </View>
    );
  }

  const isRejected = userStatus === 'rejected';

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons
              name={isRejected ? 'close-circle' : 'hourglass-outline'}
              size={48}
              color="#ffffff"
            />
          </View>
          <Text style={styles.headerTitle}>StudyBuddy</Text>
          <Text style={styles.headerSubtitle}>
            Your smart companion for better studying
          </Text>
        </View>

        {/* Status Card */}
        <View style={styles.card}>
          <View style={[styles.statusIconContainer, isRejected && styles.statusIconContainerRejected]}>
            <Ionicons
              name={isRejected ? 'close-circle' : 'time-outline'}
              size={64}
              color={isRejected ? '#ef4444' : PRIMARY_GREEN}
            />
          </View>
          <Text style={styles.cardTitle}>
            {isRejected ? t('auth.accountRejected') : t('auth.accountUnderReview')}
          </Text>
          <Text style={styles.cardText}>
            {isRejected
              ? t('auth.accountRejectedMessage')
              : t('auth.accountUnderReviewMessage')}
          </Text>

          {isRejected && rejectionReason && (
            <View style={styles.rejectionReasonBox}>
              <View style={styles.rejectionReasonHeader}>
                <Ionicons name="information-circle" size={20} color="#ef4444" />
                <Text style={styles.rejectionReasonTitle}>{t('admin.rejectionReason')}</Text>
              </View>
              <Text style={styles.rejectionReasonText}>{rejectionReason}</Text>
            </View>
          )}

          <View style={[styles.badge, isRejected && styles.badgeRejected]}>
            <Ionicons
              name={isRejected ? 'close-circle' : 'checkmark-circle-outline'}
              size={16}
              color={isRejected ? '#ef4444' : PRIMARY_GREEN}
            />
            <Text style={[styles.badgeText, isRejected && styles.badgeTextRejected]}>
              {isRejected ? t('admin.status.rejected') : t('admin.status.pending')}
            </Text>
          </View>

          {isRejected && (
            <TouchableOpacity
              style={styles.appealButton}
              onPress={() => setAppealModalVisible(true)}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={20} color="#ffffff" style={{ marginRight: 8 }} />
              <Text style={styles.appealButtonText}>{t('auth.submitAppeal')}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.button} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.buttonText}>{t('auth.backToLogin')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Appeal Modal */}
      <Modal
        visible={appealModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setAppealModalVisible(false);
          setAppealMessage('');
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.appealModalContent}>
            <View style={styles.appealModalHeader}>
              <Ionicons name="chatbubble-ellipses" size={24} color={ACCENT_GREEN} />
              <Text style={styles.appealModalTitle}>Submit Appeal</Text>
            </View>
            <Text style={styles.appealModalSubtitle}>
              Please explain why you believe your registration should be approved. An admin will review your appeal.
            </Text>

            <Text style={styles.appealModalLabel}>Your Message *</Text>
            <TextInput
              style={styles.appealModalInput}
              placeholder={t('auth.appealMessagePlaceholder')}
              placeholderTextColor="#6b7280"
              value={appealMessage}
              onChangeText={setAppealMessage}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />

            <Text style={styles.appealModalLabel}>
              {t('auth.supportingImageOptional')}
            </Text>
            <Text style={styles.appealModalHelperText}>
              {t('auth.supportingImageHelper')}
            </Text>

            {appealImageUri ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: appealImageUri }} style={styles.imagePreview} />
                {uploadingImage ? (
                  <View style={styles.imageOverlay}>
                    <ActivityIndicator size="large" color="#ffffff" />
                    <Text style={styles.uploadingText}>{t('common.uploading')}</Text>
                  </View>
                ) : null}
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={handleRemoveImage}
                >
                  <Ionicons name="close-circle" size={24} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.uploadImageButton}
                onPress={handlePickImage}
                disabled={uploadingImage}
              >
                {uploadingImage ? (
                  <ActivityIndicator color={PRIMARY_GREEN} />
                ) : (
                  <>
                    <Ionicons name="image-outline" size={24} color={PRIMARY_GREEN} />
                    <Text style={styles.uploadImageButtonText}>{t('common.uploadImage')}</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            <View style={styles.appealModalButtons}>
              <TouchableOpacity
                style={[styles.appealModalButton, styles.appealModalCancelButton]}
                onPress={() => {
                  setAppealModalVisible(false);
                  setAppealMessage('');
                  setAppealImageUri(null);
                  setAppealImageUrl(null);
                }}
              >
                <Text style={styles.appealModalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.appealModalButton, styles.appealModalConfirmButton]}
                onPress={handleSubmitAppeal}
                disabled={submittingAppeal}
              >
                {submittingAppeal ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="send-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.appealModalConfirmText}>{t('auth.submitAppeal')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const PRIMARY_GREEN = '#047857';
const ACCENT_GREEN = '#047857';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    backgroundColor: PRIMARY_GREEN,
    paddingTop: 80,
    paddingBottom: 40,
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
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#ffffff',
    opacity: 0.9,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
    marginTop: 20,
  },
  statusIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  cardText: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#dbeafe',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: ACCENT_GREEN,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: ACCENT_GREEN,
    marginLeft: 8,
  },
  button: {
    flexDirection: 'row',
    width: '100%',
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
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusIconContainerRejected: {
    backgroundColor: '#fee2e2',
  },
  badgeRejected: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
  },
  badgeTextRejected: {
    color: '#ef4444',
  },
  rejectionReasonBox: {
    width: '100%',
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  rejectionReasonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  rejectionReasonTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ef4444',
    marginLeft: 8,
  },
  rejectionReasonText: {
    fontSize: 14,
    color: '#991b1b',
    lineHeight: 20,
  },
  appealButton: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: PRIMARY_GREEN,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: PRIMARY_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  appealButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  appealModalContent: {
    width: '90%',
    borderRadius: 20,
    backgroundColor: '#ffffff',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  appealModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  appealModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 10,
  },
  appealModalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
    lineHeight: 20,
  },
  appealModalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  appealModalInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#374151',
    fontSize: 15,
    color: '#111827',
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  appealModalHelperText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 12,
    lineHeight: 16,
  },
  uploadImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dbeafe',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: ACCENT_GREEN,
    borderStyle: 'dashed',
    marginBottom: 20,
    gap: 8,
  },
  uploadImageButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: ACCENT_GREEN,
  },
  imagePreviewContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: ACCENT_GREEN,
  },
  imagePreview: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingText: {
    color: '#ffffff',
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  appealModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  appealModalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
  },
  appealModalCancelButton: {
    backgroundColor: '#374151',
    borderWidth: 1,
    borderColor: '#374151',
  },
  appealModalConfirmButton: {
    backgroundColor: PRIMARY_GREEN,
    shadowColor: PRIMARY_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  appealModalCancelText: {
    color: '#4b5563',
    fontWeight: '600',
    fontSize: 15,
  },
  appealModalConfirmText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
});
