// app/admin/appeals.tsx
import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppHeader } from '@/frontend/components/ui/AppHeader';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { spacing } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { db } from '@/lib/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where
} from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  I18nManager,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

type AppealItem = {
  id: string;
  userId: string;
  email: string;
  appealMessage: string;
  appealImageUrl?: string | null;
  rejectionReason?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
  userFullName?: string;
  userProfilePicture?: string;
};

export default function AdminAppealsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const isRtl = I18nManager.isRTL;
  const [appeals, setAppeals] = useState<AppealItem[]>([]);
  const [filteredAppeals, setFilteredAppeals] = useState<AppealItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedAppeal, setSelectedAppeal] = useState<AppealItem | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    loadAppeals();
  }, []);

  const loadAppeals = async () => {
    try {
      setLoading(true);
      const appealsRef = collection(db, 'appeals');
      // Only load pending appeals
      // Using where only to avoid composite index requirement, then sort in memory
      const q = query(
        appealsRef,
        where('status', '==', 'pending')
      );
      const snapshot = await getDocs(q);

      const list: AppealItem[] = [];
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data() as any;
        
        // Get user info
        let userFullName = t('admin.unknownUser');
        let userProfilePicture = null;
        try {
          const userDoc = await getDoc(doc(db, 'users', data.userId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            userFullName = userData.fullName || userData.username || t('admin.unknownUser');
            userProfilePicture = userData.profilePictureUrl || null;
          }
        } catch (err) {
          console.log('Error loading user info:', err);
        }

        list.push({
          id: docSnap.id,
          userId: data.userId,
          email: data.email,
          appealMessage: data.appealMessage,
          appealImageUrl: data.appealImageUrl || null,
          rejectionReason: data.rejectionReason,
          status: data.status || 'pending',
          createdAt: data.createdAt,
          userFullName,
          userProfilePicture,
        });
      }

      // Sort by createdAt descending (most recent first)
      list.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || a.createdAt || 0;
        const bTime = b.createdAt?.toMillis?.() || b.createdAt || 0;
        return bTime - aTime;
      });

      setAppeals(list);
      setFilteredAppeals(list);
    } catch (err) {
      console.log('Error loading appeals:', err);
      Alert.alert(t('common.error'), t('admin.failedToLoadAppeals'));
    } finally {
      setLoading(false);
    }
  };

  const handleApproveAppeal = async (appeal: AppealItem) => {
    Alert.alert(
      t('admin.approveAppeal'),
      t('admin.approveAppealConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('admin.approve'),
          onPress: async () => {
            try {
              setUpdatingId(appeal.id);
              
              // Update user status to active
              await updateDoc(doc(db, 'users', appeal.userId), {
                status: 'active',
                rejectionReason: null,
                rejectedAt: null,
              });

              // Delete the appeal after processing
              await deleteDoc(doc(db, 'appeals', appeal.id));

              // Optimistically update the list immediately
              setAppeals(prev => prev.filter(a => a.id !== appeal.id));
              setFilteredAppeals(prev => prev.filter(a => a.id !== appeal.id));
              
              // Close detail modal if open
              if (selectedAppeal?.id === appeal.id) {
                setDetailModalVisible(false);
                setSelectedAppeal(null);
              }
              
              Alert.alert(t('common.success'), t('admin.appealApprovedSuccess'));
              
              // Reload appeals list to ensure consistency
              await loadAppeals();
            } catch (err) {
              console.log('Approve appeal error:', err);
              Alert.alert(t('common.error'), t('admin.failedToApproveAppeal'));
              // Reload on error to ensure consistency
              await loadAppeals();
            } finally {
              setUpdatingId(null);
            }
          },
        },
      ]
    );
  };

  const handleRejectAppeal = async (appeal: AppealItem) => {
    Alert.alert(
      t('admin.rejectAppeal'),
      t('admin.rejectAppealConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('admin.rejectAndDelete'),
          style: 'destructive',
          onPress: async () => {
            try {
              setUpdatingId(appeal.id);
              
              // Delete the user account
              await deleteDoc(doc(db, 'users', appeal.userId));
              
              // Delete the appeal after processing
              await deleteDoc(doc(db, 'appeals', appeal.id));
              
              // Optimistically update the list immediately
              setAppeals(prev => prev.filter(a => a.id !== appeal.id));
              setFilteredAppeals(prev => prev.filter(a => a.id !== appeal.id));
              
              // Close detail modal if open
              if (selectedAppeal?.id === appeal.id) {
                setDetailModalVisible(false);
                setSelectedAppeal(null);
              }
              
              Alert.alert(t('common.success'), t('admin.appealRejectedSuccess'));
              
              // Reload appeals list to ensure consistency
              await loadAppeals();
            } catch (err) {
              console.log('Reject appeal error:', err);
              Alert.alert(t('common.error'), t('admin.failedToRejectAppeal'));
              // Reload on error to ensure consistency
              await loadAppeals();
            } finally {
              setUpdatingId(null);
            }
          },
        },
      ]
    );
  };

  const openDetailModal = (appeal: AppealItem) => {
    setSelectedAppeal(appeal);
    setDetailModalVisible(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return colors.success;
      case 'rejected':
        return colors.danger;
      default:
        return colors.warning;
    }
  };

  const getInitials = (appeal: AppealItem) => {
    if (appeal.userFullName) {
      const parts = appeal.userFullName.split(' ').filter(Boolean);
      if (parts.length === 1) return parts[0][0]?.toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    if (appeal.email) return appeal.email[0]?.toUpperCase();
    return '?';
  };

  const renderAppeal = (appeal: AppealItem) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => openDetailModal(appeal)}
      activeOpacity={0.7}
    >
      <View style={[styles.cardAccentLine, { backgroundColor: getStatusColor(appeal.status) }]} />
      <View style={[styles.cardHeader, isRtl && styles.rtlRow]}>
        {appeal.userProfilePicture ? (
          <Image
            source={{ uri: appeal.userProfilePicture }}
            style={[styles.profileImage, { borderColor: colors.border }]}
          />
        ) : (
          <View style={[styles.profilePlaceholder, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Text style={[styles.profileInitials, { color: colors.textPrimary }]}>{getInitials(appeal)}</Text>
          </View>
        )}
        <View style={styles.appealInfo}>
          <Text style={[styles.email, { color: colors.textPrimary }, isRtl && styles.rtlText]}>{appeal.email}</Text>
          <Text style={[styles.userName, { color: colors.textSecondary }, isRtl && styles.rtlText]}>{appeal.userFullName || t('admin.unknownUser')}</Text>
          <Text style={[styles.appealPreview, { color: colors.textSecondary }, isRtl && styles.rtlText]} numberOfLines={2}>
            {appeal.appealMessage}
          </Text>
          {appeal.appealImageUrl && (
            <View style={[styles.imageIndicator, isRtl && styles.rtlRow]}>
              <Ionicons name="image" size={14} color={colors.primary} />
              <Text style={[styles.imageIndicatorText, { color: colors.primary }]}>{t('admin.imageAttached')}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={[styles.statusPill, { borderColor: getStatusColor(appeal.status), backgroundColor: colors.surfaceMuted }, isRtl && styles.rtlRow]}>
        <View style={[styles.statusDot, { backgroundColor: getStatusColor(appeal.status) }]} />
        <Text style={[styles.statusPillText, { color: getStatusColor(appeal.status) }]}>
          {t(`admin.status.${appeal.status}`)}
        </Text>
      </View>

      {appeal.status === 'pending' && (
        <View style={[styles.actionsRow, { borderTopColor: colors.border }, isRtl && styles.rtlRow]}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={(e) => {
              e.stopPropagation();
              handleApproveAppeal(appeal);
            }}
            disabled={updatingId === appeal.id}
          >
            {updatingId === appeal.id ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.textOnPrimary} />
                <Text style={[styles.actionText, { color: colors.textOnPrimary }]}>{t('admin.approve')}</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.danger }]}
            onPress={(e) => {
              e.stopPropagation();
              handleRejectAppeal(appeal);
            }}
            disabled={updatingId === appeal.id}
          >
            {updatingId === appeal.id ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <>
                <Ionicons name="trash-outline" size={16} color={colors.textOnPrimary} />
                <Text style={[styles.actionText, { color: colors.textOnPrimary }]}>{t('admin.rejectAndDelete')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <AppScreen>
      <View style={styles.screenInner}>
        <View pointerEvents="none" style={styles.pageDecor}>
          <View style={[styles.decorGlowPrimary, { backgroundColor: colors.primary }]} />
          <View style={[styles.decorGlowAccent, { backgroundColor: colors.accent }]} />
        </View>
        <AppHeader title={t('admin.appealsManagement')} onBack={() => router.back()} />
        <ScrollView
          style={styles.mainScroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
        {/* Pending Appeals Count */}
        {!loading && appeals.length > 0 && (
          <View style={styles.countContainer}>
            <Text style={[styles.countText, { color: colors.textSecondary }, isRtl && styles.rtlText]}>
              {appeals.length === 1
                ? t('admin.pendingAppeal', { count: appeals.length })
                : t('admin.pendingAppeals', { count: appeals.length })}
            </Text>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t('admin.loadingAppeals')}</Text>
          </View>
        ) : appeals.length === 0 ? (
          <AppCard style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="checkmark-circle" size={44} color={colors.success} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{t('admin.noPendingAppeals')}</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t('admin.allAppealsReviewed')}
            </Text>
          </AppCard>
        ) : (
          <View style={styles.appealsList}>
            {appeals.map((appeal) => (
              <View key={appeal.id}>{renderAppeal(appeal)}</View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Detail Modal */}
      <Modal
        visible={detailModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.detailModalContent}>
            {selectedAppeal && (
              <>
                <View style={styles.detailModalHeader}>
                  <View style={styles.detailUserInfo}>
                    {selectedAppeal.userProfilePicture ? (
                      <Image
                        source={{ uri: selectedAppeal.userProfilePicture }}
                        style={styles.detailProfileImage}
                      />
                    ) : (
                      <View style={styles.detailProfilePlaceholder}>
                        <Text style={styles.detailProfileInitials}>
                          {getInitials(selectedAppeal)}
                        </Text>
                      </View>
                    )}
                    <View>
                      <Text style={styles.detailEmail}>{selectedAppeal.email}</Text>
                      <Text style={styles.detailUserName}>
                        {selectedAppeal.userFullName || t('admin.unknownUser')}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => setDetailModalVisible(false)}
                    style={styles.closeButton}
                  >
                    <Ionicons name="close" size={24} color="#6b7280" />
                  </TouchableOpacity>
                </View>

                {selectedAppeal.rejectionReason && (
                  <View style={styles.rejectionBox}>
                    <Text style={styles.rejectionBoxTitle}>{t('admin.originalRejectionReason')}</Text>
                    <Text style={styles.rejectionBoxText}>
                      {selectedAppeal.rejectionReason}
                    </Text>
                  </View>
                )}

                <View style={styles.appealMessageBox}>
                  <Text style={styles.appealMessageTitle}>{t('admin.appealMessage')}</Text>
                  <Text style={styles.appealMessageText}>
                    {selectedAppeal.appealMessage}
                  </Text>
                </View>

                {selectedAppeal.appealImageUrl && (
                  <View style={styles.appealImageBox}>
                    <Text style={styles.appealImageTitle}>{t('admin.supportingImage')}</Text>
                    <Image
                      source={{ uri: selectedAppeal.appealImageUrl }}
                      style={styles.appealImage}
                      resizeMode="contain"
                    />
                    <TouchableOpacity
                      style={styles.viewFullImageButton}
                      onPress={() => setImagePreviewUrl(selectedAppeal.appealImageUrl || null)}
                    >
                      <Ionicons name="expand-outline" size={16} color={ACCENT_GREEN} />
                      <Text style={styles.viewFullImageText}>{t('admin.viewFullImage')}</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <View style={[styles.statusPill, { borderColor: getStatusColor(selectedAppeal.status) }]}>
                  <View style={[styles.statusDot, { backgroundColor: getStatusColor(selectedAppeal.status) }]} />
                  <Text style={[styles.statusPillText, { color: getStatusColor(selectedAppeal.status) }]}>
                    {t('admin.statusLabel')}: {t(`admin.status.${selectedAppeal.status}`)}
                  </Text>
                </View>

                {selectedAppeal.status === 'pending' && (
                  <View style={styles.detailActionsRow}>
                    <TouchableOpacity
                      style={[styles.detailActionButton, styles.detailApproveButton]}
                      onPress={() => {
                        setDetailModalVisible(false);
                        handleApproveAppeal(selectedAppeal);
                      }}
                      disabled={updatingId === selectedAppeal.id}
                    >
                      {updatingId === selectedAppeal.id ? (
                        <ActivityIndicator color="#ffffff" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
                          <Text style={styles.detailActionText}>Approve & Reactivate</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.detailActionButton, styles.detailRejectButton]}
                      onPress={() => {
                        setDetailModalVisible(false);
                        handleRejectAppeal(selectedAppeal);
                      }}
                      disabled={updatingId === selectedAppeal.id}
                    >
                      <Ionicons name="trash-outline" size={20} color="#ffffff" />
                      <Text style={styles.detailActionText}>Reject & Delete User</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Full Screen Image Preview Modal */}
      <Modal
        visible={!!imagePreviewUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setImagePreviewUrl(null)}
      >
        <View style={styles.imagePreviewBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setImagePreviewUrl(null)}
          />
          <View style={styles.imagePreviewContainer}>
            {imagePreviewUrl ? (
              <Image
                source={{ uri: imagePreviewUrl }}
                style={styles.fullScreenImage}
                resizeMode="contain"
                onError={(error) => {
                  console.log('Image load error:', error);
                  Alert.alert(t('common.error'), 'Failed to load image');
                  setImagePreviewUrl(null);
                }}
                onLoadStart={() => {
                  // Image is starting to load
                }}
                onLoadEnd={() => {
                  // Image finished loading
                }}
              />
            ) : null}
            <TouchableOpacity
              style={styles.imagePreviewCloseButton}
              onPress={() => setImagePreviewUrl(null)}
            >
              <Ionicons name="close" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      </View>
    </AppScreen>
  );
}

const ACCENT_GREEN = '#2563eb';

const styles = StyleSheet.create({
  screenInner: {
    flex: 1,
  },
  pageDecor: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 260,
    zIndex: 0,
    overflow: 'hidden',
  },
  decorGlowPrimary: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    top: -56,
    right: -36,
    opacity: 0.08,
  },
  decorGlowAccent: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    top: 72,
    left: -28,
    opacity: 0.1,
  },
  mainScroll: {
    flex: 1,
    zIndex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: 40,
  },
  countContainer: {
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
  },
  countText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    marginTop: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#6b7280',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    marginTop: 20,
    marginHorizontal: 20,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#374151',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  appealsList: { gap: 10 },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardAccentLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
    borderWidth: 2,
    borderColor: ACCENT_GREEN,
  },
  profilePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  profileInitials: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  appealInfo: {
    flex: 1,
  },
  email: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  userName: {
    color: '#6b7280',
    fontSize: 13,
    marginBottom: 8,
  },
  appealPreview: {
    color: '#4b5563',
    fontSize: 14,
    lineHeight: 20,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    minHeight: 38,
    gap: 6,
  },
  approveButton: {
    backgroundColor: '#22c55e',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  actionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailModalContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 20,
    backgroundColor: '#ffffff',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  detailModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  detailUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  detailProfileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
    borderWidth: 2,
    borderColor: ACCENT_GREEN,
  },
  detailProfilePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#374151',
  },
  detailProfileInitials: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  detailEmail: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  detailUserName: {
    fontSize: 14,
    color: '#6b7280',
  },
  closeButton: {
    padding: 4,
  },
  rejectionBox: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  rejectionBoxTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ef4444',
    marginBottom: 8,
  },
  rejectionBoxText: {
    fontSize: 14,
    color: '#991b1b',
    lineHeight: 20,
  },
  appealMessageBox: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  appealMessageTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  appealMessageText: {
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
  },
  imageIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  imageIndicatorText: {
    fontSize: 12,
    color: ACCENT_GREEN,
    fontWeight: '600',
  },
  appealImageBox: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  appealImageTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 12,
  },
  appealImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    marginBottom: 12,
  },
  viewFullImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dbeafe',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: ACCENT_GREEN,
  },
  viewFullImageText: {
    fontSize: 13,
    fontWeight: '600',
    color: ACCENT_GREEN,
  },
  detailActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  detailActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  detailApproveButton: {
    backgroundColor: '#22c55e',
  },
  detailRejectButton: {
    backgroundColor: '#ef4444',
  },
  detailActionText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  imagePreviewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePreviewContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: '100%',
    height: '100%',
  },
  imagePreviewCloseButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rtlRow: {
    flexDirection: 'row-reverse',
  },
  rtlText: {
    textAlign: 'right',
  },
});

