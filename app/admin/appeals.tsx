// app/admin/appeals.tsx
import { db } from '@/lib/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
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

              // Optimistically update state instead of reloading to avoid BloomFilter warning
              setAppeals((prev) => prev.filter((a) => a.id !== appeal.id));
              
              Alert.alert(t('common.success'), t('admin.appealApprovedSuccess'));
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
              
              // Optimistically update state instead of reloading to avoid BloomFilter warning
              setAppeals((prev) => prev.filter((a) => a.id !== appeal.id));
              
              Alert.alert(t('common.success'), t('admin.appealRejectedSuccess'));
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
        return '#22c55e';
      case 'rejected':
        return '#ef4444';
      default:
        return ACCENT_GREEN;
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
      style={styles.card}
      onPress={() => openDetailModal(appeal)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        {appeal.userProfilePicture ? (
          <Image
            source={{ uri: appeal.userProfilePicture }}
            style={styles.profileImage}
          />
        ) : (
          <View style={styles.profilePlaceholder}>
            <Text style={styles.profileInitials}>{getInitials(appeal)}</Text>
          </View>
        )}
        <View style={styles.appealInfo}>
          <Text style={styles.email}>{appeal.email}</Text>
          <Text style={styles.userName}>{appeal.userFullName || t('admin.unknownUser')}</Text>
          <Text style={styles.appealPreview} numberOfLines={2}>
            {appeal.appealMessage}
          </Text>
          {appeal.appealImageUrl && (
            <View style={styles.imageIndicator}>
              <Ionicons name="image" size={14} color={ACCENT_GREEN} />
              <Text style={styles.imageIndicatorText}>{t('admin.imageAttached')}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={[styles.statusPill, { borderColor: getStatusColor(appeal.status) }]}>
        <View style={[styles.statusDot, { backgroundColor: getStatusColor(appeal.status) }]} />
        <Text style={[styles.statusPillText, { color: getStatusColor(appeal.status) }]}>
          {t(`admin.status.${appeal.status}`)}
        </Text>
      </View>

      {appeal.status === 'pending' && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={(e) => {
              e.stopPropagation();
              handleApproveAppeal(appeal);
            }}
            disabled={updatingId === appeal.id}
          >
            {updatingId === appeal.id ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={16} color="#ffffff" />
                <Text style={styles.actionText}>{t('admin.approve')}</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={(e) => {
              e.stopPropagation();
              handleRejectAppeal(appeal);
            }}
            disabled={updatingId === appeal.id}
          >
            {updatingId === appeal.id ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={16} color="#ffffff" />
                <Text style={styles.actionText}>{t('admin.rejectAndDelete')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
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
          <Ionicons name="chatbubble-ellipses" size={32} color="#ffffff" />
          <Text style={styles.headerTitle}>{t('admin.appealsManagement')}</Text>
          <Text style={styles.headerSubtitle}>
            {t('admin.appealsManagementDescription')}
          </Text>
        </View>

        {/* Pending Appeals Count */}
        {!loading && appeals.length > 0 && (
          <View style={styles.countContainer}>
            <Text style={styles.countText}>
              {appeals.length === 1
                ? t('admin.pendingAppeal', { count: appeals.length })
                : t('admin.pendingAppeals', { count: appeals.length })}
            </Text>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={PRIMARY_GREEN} />
            <Text style={styles.loadingText}>{t('admin.loadingAppeals')}</Text>
          </View>
        ) : appeals.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle" size={64} color="#22c55e" />
            <Text style={styles.emptyTitle}>{t('admin.noPendingAppeals')}</Text>
            <Text style={styles.emptyText}>
              {t('admin.allAppealsReviewed')}
            </Text>
          </View>
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
            {imagePreviewUrl && (
              <Image
                source={{ uri: imagePreviewUrl }}
                style={styles.fullScreenImage}
                resizeMode="contain"
              />
            )}
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
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 10,
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#ffffff',
    opacity: 0.9,
    textAlign: 'center',
    paddingHorizontal: 20,
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
  appealsList: {
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
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
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#374151',
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
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
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
});

