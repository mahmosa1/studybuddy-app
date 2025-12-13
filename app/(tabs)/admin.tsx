// app/(tabs)/admin.tsx
import { db } from '@/lib/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
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
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

type UserItem = {
  uid: string;
  email: string;
  fullName?: string;
  username?: string;
  role: string;
  status: string;
  studentCardUrl?: string | null;
  lecturerIdUrl?: string | null;
  profilePictureUrl?: string | null;
};

export default function AdminScreen() {
  const { t } = useTranslation();
  const [pendingUsers, setPendingUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);

  // לתצוגת תמונה במודאל
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // Rejection modal state
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectingUid, setRejectingUid] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const loadPendingUsers = async () => {
    try {
      setLoading(true);
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('status', '==', 'pending'));
      const snapshot = await getDocs(q);

      const list: UserItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as any;
        list.push({
          uid: data.uid ?? docSnap.id,
          email: data.email,
          fullName: data.fullName,
          username: data.username,
          role: data.role,
          status: data.status,
          studentCardUrl: data.studentCardUrl,
          lecturerIdUrl: data.lecturerIdUrl,
          profilePictureUrl: data.profilePictureUrl,
        });
      });

      setPendingUsers(list);
    } catch (err) {
      console.log('Error loading pending users:', err);
      Alert.alert('Error', 'Failed to load pending users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingUsers();
  }, []);

  const handleApprove = async (uid: string) => {
    try {
      setUpdatingUid(uid);
      await updateDoc(doc(db, 'users', uid), {
        status: 'active',
      });
      setPendingUsers((prev) => prev.filter((u) => u.uid !== uid));
    } catch (err) {
      console.log('Approve error:', err);
      Alert.alert(t('common.error'), t('admin.failedToApprove'));
    } finally {
      setUpdatingUid(null);
    }
  };

  const openRejectModal = (uid: string) => {
    setRejectingUid(uid);
    setRejectionReason('');
    setRejectModalVisible(true);
  };

  const handleReject = async () => {
    if (!rejectingUid) return;
    
    if (!rejectionReason.trim()) {
      Alert.alert(t('common.error'), t('admin.enterReason'));
      return;
    }

    try {
      setUpdatingUid(rejectingUid);
      await updateDoc(doc(db, 'users', rejectingUid), {
        status: 'rejected',
        rejectionReason: rejectionReason.trim(),
        rejectedAt: new Date().toISOString(),
      });
      setPendingUsers((prev) => prev.filter((u) => u.uid !== rejectingUid));
      setRejectModalVisible(false);
      setRejectingUid(null);
      setRejectionReason('');
    } catch (err) {
      console.log('Reject error:', err);
      Alert.alert(t('common.error'), t('admin.failedToReject'));
    } finally {
      setUpdatingUid(null);
    }
  };

  const openPreview = (url: string) => {
    setPreviewUrl(url);
  };

  const closePreview = () => {
    setPreviewUrl(null);
  };

  const renderItem = ({ item }: { item: UserItem }) => (
    <View style={styles.card}>
      {/* Header with profile picture */}
      <View style={styles.cardHeader}>
        {item.profilePictureUrl ? (
          <Image
            source={{ uri: item.profilePictureUrl }}
            style={styles.profileImage}
          />
        ) : (
          <View style={styles.profilePlaceholder}>
            <Ionicons
              name={item.role === 'lecturer' ? 'person' : 'school'}
              size={24}
              color="#6b7280"
            />
          </View>
        )}
        <View style={styles.userInfo}>
          <Text style={styles.email}>{item.email}</Text>
          <Text style={styles.smallText}>
            {item.fullName ?? t('admin.noName')} · {item.username ?? t('admin.noUsername')}
          </Text>
          <View style={styles.roleBadge}>
            <Ionicons
              name={item.role === 'lecturer' ? 'person' : 'school'}
              size={12}
              color="#ffffff"
            />
            <Text style={styles.roleText}>{t(`auth.${item.role}`)}</Text>
          </View>
        </View>
      </View>

      {/* Status badge */}
      <View style={styles.statusPill}>
        <Ionicons name="time-outline" size={12} color={ACCENT_GREEN} />
        <Text style={styles.statusPillText}>{t('admin.pendingApproval')}</Text>
      </View>

      {/* Documents section */}
      <View style={styles.documentsSection}>
        <Text style={styles.documentsTitle}>{t('admin.documents')}</Text>
        <View style={styles.documentsList}>
          {item.role === 'student' ? (
            <View style={styles.documentItem}>
              <Ionicons name="card-outline" size={16} color="#6b7280" />
              <Text style={styles.documentText}>
                {t('admin.studentCard')}: {item.studentCardUrl ? t('admin.uploaded') : t('admin.missing')}
              </Text>
              {item.studentCardUrl && (
                <TouchableOpacity
                  onPress={() => openPreview(item.studentCardUrl!)}
                  style={styles.viewButton}
                >
                  <Ionicons name="eye-outline" size={14} color={ACCENT_GREEN} />
                  <Text style={styles.viewButtonText}>{t('admin.view')}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : item.role === 'lecturer' ? (
            <View style={styles.documentItem}>
              <Ionicons name="id-card-outline" size={16} color="#6b7280" />
              <Text style={styles.documentText}>
                {t('admin.lecturerID')}: {item.lecturerIdUrl ? t('admin.uploaded') : t('admin.missing')}
              </Text>
              {item.lecturerIdUrl && (
                <TouchableOpacity
                  onPress={() => openPreview(item.lecturerIdUrl!)}
                  style={styles.viewButton}
                >
                  <Ionicons name="eye-outline" size={14} color={ACCENT_GREEN} />
                  <Text style={styles.viewButtonText}>{t('admin.view')}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}
          <View style={styles.documentItem}>
            <Ionicons name="image-outline" size={16} color="#6b7280" />
            <Text style={styles.documentText}>
              {t('admin.profilePicture')}: {item.profilePictureUrl ? t('admin.uploaded') : t('admin.missing')}
            </Text>
            {item.profilePictureUrl && (
              <TouchableOpacity
                onPress={() => openPreview(item.profilePictureUrl!)}
                style={styles.viewButton}
              >
                <Ionicons name="eye-outline" size={14} color={ACCENT_GREEN} />
                <Text style={styles.viewButtonText}>{t('admin.view')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionButton, styles.approveButton]}
          onPress={() => handleApprove(item.uid)}
          disabled={updatingUid === item.uid}
        >
          {updatingUid === item.uid ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={18} color="#ffffff" />
              <Text style={styles.actionText}>{t('admin.approve')}</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => openRejectModal(item.uid)}
          disabled={updatingUid === item.uid}
        >
          <Ionicons name="close-circle-outline" size={18} color="#ffffff" />
          <Text style={styles.actionText}>{t('admin.reject')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="shield-checkmark" size={32} color="#ffffff" />
          <Text style={styles.headerTitle}>{t('admin.title')}</Text>
          <Text style={styles.headerSubtitle}>
            {t('admin.reviewPendingRegistrations')}
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={PRIMARY_GREEN} />
            <Text style={styles.loadingText}>{t('admin.loadingPendingUsers')}</Text>
          </View>
        ) : pendingUsers.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle" size={64} color="#22c55e" />
            <Text style={styles.emptyTitle}>{t('admin.noPendingUsers')}</Text>
            <Text style={styles.emptyText}>{t('admin.allUsersReviewed')}</Text>
          </View>
        ) : (
          <View style={styles.usersList}>
            {pendingUsers.map((item) => (
              <View key={item.uid}>{renderItem({ item })}</View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Modal לתצוגת תמונה מלאה */}
      <Modal
        visible={!!previewUrl}
        transparent
        animationType="fade"
        onRequestClose={closePreview}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closePreview} />
          <View style={styles.modalContent}>
            {previewUrl && (
              <Image
                source={{ uri: previewUrl }}
                style={styles.modalImage}
                resizeMode="contain"
              />
            )}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={closePreview}
            >
              <Ionicons name="close" size={18} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Rejection Reason Modal */}
      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setRejectModalVisible(false);
          setRejectingUid(null);
          setRejectionReason('');
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.rejectModalContent}>
            <View style={styles.rejectModalHeader}>
              <Ionicons name="close-circle" size={24} color="#ef4444" />
              <Text style={styles.rejectModalTitle}>{t('admin.rejectUser')}</Text>
            </View>
            <Text style={styles.rejectModalSubtitle}>
              {t('admin.rejectUserSubtitle')}
            </Text>
            
            <Text style={styles.rejectModalLabel}>{t('admin.rejectionReason')} *</Text>
            <TextInput
              style={styles.rejectModalInput}
              placeholder={t('admin.rejectionReasonPlaceholder')}
              placeholderTextColor="#6b7280"
              value={rejectionReason}
              onChangeText={setRejectionReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.rejectModalButtons}>
              <TouchableOpacity
                style={[styles.rejectModalButton, styles.rejectModalCancelButton]}
                onPress={() => {
                  setRejectModalVisible(false);
                  setRejectingUid(null);
                  setRejectionReason('');
                }}
              >
                <Text style={styles.rejectModalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rejectModalButton, styles.rejectModalConfirmButton]}
                onPress={handleReject}
                disabled={updatingUid === rejectingUid}
              >
                {updatingUid === rejectingUid ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="close-circle" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.rejectModalConfirmText}>{t('admin.rejectUser')}</Text>
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
const GREY = '#4b5563';
const GREY_LIGHT = '#374151';

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
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    marginBottom: -60,
    shadowColor: PRIMARY_GREEN,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
    overflow: 'hidden',
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: '#ffffff',
    marginTop: 12,
    marginBottom: 6,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.95,
    textAlign: 'center',
    paddingHorizontal: 20,
    fontWeight: '500',
    letterSpacing: 0.2,
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
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  usersList: {
    paddingHorizontal: 20,
    paddingTop: 20,
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
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
    borderWidth: 2,
    borderColor: PRIMARY_GREEN,
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
  userInfo: {
    flex: 1,
  },
  email: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  smallText: {
    color: '#6b7280',
    fontSize: 13,
    marginBottom: 6,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: PRIMARY_GREEN,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 4,
  },
  roleText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },

  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: PRIMARY_GREEN,
  },
  statusPillText: {
    color: PRIMARY_GREEN,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  documentsSection: {
    marginBottom: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  documentsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  documentsList: {
    gap: 10,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#374151',
  },
  documentText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    marginLeft: 10,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: PRIMARY_GREEN,
  },
  viewButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: PRIMARY_GREEN,
    marginLeft: 4,
  },

  actionsRow: {
    flexDirection: 'row',
    marginTop: 8,
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
    paddingVertical: 14,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  approveButton: {
    backgroundColor: ACCENT_GREEN,
  },
  rejectButton: {
    backgroundColor: GREY,
  },
  actionText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '95%',
    maxHeight: '90%',
    borderRadius: 20,
    backgroundColor: '#000000',
    padding: 16,
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: 400,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
  },
  modalCloseButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: PRIMARY_GREEN,
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
  rejectModalContent: {
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
  rejectModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  rejectModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 10,
  },
  rejectModalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
    lineHeight: 20,
  },
  rejectModalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  rejectModalInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#374151',
    fontSize: 15,
    color: '#111827',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  rejectModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectModalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
  },
  rejectModalCancelButton: {
    backgroundColor: '#374151',
    borderWidth: 1,
    borderColor: '#374151',
  },
  rejectModalConfirmButton: {
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  rejectModalCancelText: {
    color: '#4b5563',
    fontWeight: '600',
    fontSize: 15,
  },
  rejectModalConfirmText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 15,
  },
});
