// app/admin/pending-approvals.tsx
import { auth, db } from '@/lib/firebaseConfig';
import { setLastSeenPendingCount } from '@/lib/adminPendingApprovalsBadge';
import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppHeader } from '@/frontend/components/ui/AppHeader';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { radius, spacing } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useFocusEffect, useRouter } from 'expo-router';
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
  TextInput,
  TouchableOpacity,
  View,
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
  verificationSelfieUrl?: string | null;
};

export default function PendingApprovalsScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const isRtl = I18nManager.isRTL;
  const isHebrewUi = i18n.language === 'he';
  const router = useRouter();
  const [pendingUsers, setPendingUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectingUid, setRejectingUid] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
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
            verificationSelfieUrl: data.verificationSelfieUrl,
          });
        });
        setPendingUsers(list);
        setLoading(false);
      },
      (err) => {
        console.log('Error subscribing pending users:', err);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  useFocusEffect(
    useCallback(() => {
      const markSeen = async () => {
        const adminUid = auth.currentUser?.uid;
        if (!adminUid) return;
        await setLastSeenPendingCount(adminUid, pendingUsers.length);
      };
      void markSeen();
    }, [pendingUsers.length]),
  );

  const handleApprove = async (uid: string) => {
    try {
      setUpdatingUid(uid);
      await updateDoc(doc(db, 'users', uid), { status: 'active' });
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

  const renderItem = ({ item }: { item: UserItem }) => (
    <AppCard style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.cardAccentLine, { backgroundColor: colors.warning }]} />
      <View style={[styles.cardHeader, isRtl && styles.rtlRow]}>
        {item.profilePictureUrl ? (
          <Image source={{ uri: item.profilePictureUrl }} style={[styles.profileImage, { borderColor: colors.border }]} />
        ) : (
          <View style={[styles.profilePlaceholder, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <Ionicons name={item.role === 'lecturer' ? 'person' : 'school'} size={22} color={colors.textSecondary} />
          </View>
        )}
        <View style={styles.userInfo}>
          <Text style={[styles.email, { color: colors.textPrimary }, isRtl && styles.rtlText]}>{item.email}</Text>
          <Text style={[styles.namePrimary, { color: colors.textPrimary }, isRtl && styles.rtlText]}>
            {item.fullName ?? t('admin.noName')}
          </Text>
          <Text style={[styles.usernameSecondary, { color: colors.textSecondary }, isRtl && styles.rtlText]}>
            {item.username ?? t('admin.noUsername')}
          </Text>
          <View style={[styles.roleBadge, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }, isRtl && styles.rtlRow]}>
            <Ionicons name={item.role === 'lecturer' ? 'person-outline' : 'school-outline'} size={11} color={colors.textSecondary} />
            <Text style={[styles.roleText, { color: colors.textSecondary }]}>{t(`auth.${item.role}`)}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.statusPill, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }, isRtl && styles.rtlRow]}>
        <Ionicons name="time-outline" size={11} color={colors.warning} />
        <Text style={[styles.statusPillText, { color: colors.warning }]}>{t('admin.pendingApproval')}</Text>
      </View>

      <View style={[styles.documentsSection, { borderTopColor: colors.border }]}>
        <Text style={[styles.documentsTitle, { color: colors.textPrimary }]}>{t('admin.documents')}</Text>
        <View style={styles.documentsList}>
          {item.role === 'student' ? (
            <View style={[styles.documentItem, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }, isRtl && styles.rtlRow]}>
              <Ionicons name="card-outline" size={15} color={colors.textSecondary} />
              <Text style={[styles.documentText, { color: colors.textSecondary }]}>
                {t('admin.studentCard')}: {item.studentCardUrl ? t('admin.uploaded') : t('admin.missing')}
              </Text>
              {item.studentCardUrl && (
                <TouchableOpacity
                  onPress={() => setPreviewUrl(item.studentCardUrl!)}
                  style={styles.viewLink}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.65}
                >
                  <Ionicons name="eye-outline" size={14} color={colors.textSecondary} />
                  <Text style={[styles.viewLinkText, { color: colors.textSecondary }]}>{t('admin.view')}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : item.role === 'lecturer' ? (
            <View style={[styles.documentItem, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }, isRtl && styles.rtlRow]}>
              <Ionicons name="id-card-outline" size={15} color={colors.textSecondary} />
              <Text style={[styles.documentText, { color: colors.textSecondary }]}>
                {t('admin.lecturerID')}: {item.lecturerIdUrl ? t('admin.uploaded') : t('admin.missing')}
              </Text>
              {item.lecturerIdUrl && (
                <TouchableOpacity
                  onPress={() => setPreviewUrl(item.lecturerIdUrl!)}
                  style={styles.viewLink}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  activeOpacity={0.65}
                >
                  <Ionicons name="eye-outline" size={14} color={colors.textSecondary} />
                  <Text style={[styles.viewLinkText, { color: colors.textSecondary }]}>{t('admin.view')}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}
          {item.verificationSelfieUrl ? (
            <View style={[styles.documentItem, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }, isRtl && styles.rtlRow]}>
              <Ionicons name="camera-outline" size={15} color={colors.textSecondary} />
              <Text style={[styles.documentText, { color: colors.textSecondary }]}>
                {isHebrewUi ? 'תמונת אימות פנים' : 'Face Verification Selfie'}
              </Text>
              <TouchableOpacity
                onPress={() => setPreviewUrl(item.verificationSelfieUrl!)}
                style={styles.viewLink}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.65}
              >
                <Ionicons name="eye-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.viewLinkText, { color: colors.textSecondary }]}>{t('admin.view')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={[styles.documentItem, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }, isRtl && styles.rtlRow]}>
            <Ionicons name="image-outline" size={15} color={colors.textSecondary} />
            <Text style={[styles.documentText, { color: colors.textSecondary }]}>
              {t('admin.profilePicture')}: {item.profilePictureUrl ? t('admin.uploaded') : t('admin.missing')}
            </Text>
            {item.profilePictureUrl && (
              <TouchableOpacity
                onPress={() => setPreviewUrl(item.profilePictureUrl!)}
                style={styles.viewLink}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.65}
              >
                <Ionicons name="eye-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.viewLinkText, { color: colors.textSecondary }]}>{t('admin.view')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <View style={[styles.actionsRow, { borderTopColor: colors.border }, isRtl && styles.rtlRow]}>
        <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.primary }]} onPress={() => handleApprove(item.uid)} disabled={updatingUid === item.uid}>
          {updatingUid === item.uid ? <ActivityIndicator color={colors.textOnPrimary} /> : <>
            <Ionicons name="checkmark-circle" size={17} color={colors.textOnPrimary} />
            <Text style={[styles.actionText, { color: colors.textOnPrimary }]}>{t('admin.approve')}</Text>
          </>}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.outlineActionButton, { backgroundColor: colors.surface, borderColor: colors.danger }]}
          onPress={() => openRejectModal(item.uid)}
          disabled={updatingUid === item.uid}
        >
          <Ionicons name="close-circle" size={17} color={colors.danger} />
          <Text style={[styles.actionText, { color: colors.danger }]}>{t('admin.reject')}</Text>
        </TouchableOpacity>
      </View>
    </AppCard>
  );

  return (
    <AppScreen>
      <AppHeader title={t('admin.pendingApprovals')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.heroWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.heroGlowPrimary, { backgroundColor: colors.primary }]} />
          <View style={[styles.heroGlowAccent, { backgroundColor: colors.accent }]} />
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>{t('admin.reviewPendingRegistrations')}</Text>
          <View style={styles.adminHeaderActions}>
            <TouchableOpacity style={[styles.diagnosticsButton, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]} onPress={() => router.push('/admin/tutor-applications')}>
              <Ionicons name="school-outline" size={16} color={colors.primary} />
              <Text style={[styles.diagnosticsButtonText, { color: colors.primary }]}>{t('admin.tutorApplications.shortTitle')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t('admin.loadingPendingUsers')}</Text>
          </View>
        ) : pendingUsers.length === 0 ? (
          <AppCard style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="checkmark-circle" size={44} color={colors.success} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{t('admin.noPendingUsers')}</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t('admin.allUsersReviewed')}</Text>
          </AppCard>
        ) : (
          <View style={styles.usersList}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              {pendingUsers.length === 1
                ? t('admin.reviewPendingUser', { count: pendingUsers.length })
                : t('admin.reviewPendingUsers', { count: pendingUsers.length })}
            </Text>
            {pendingUsers.map((item) => <View key={item.uid}>{renderItem({ item })}</View>)}
          </View>
        )}
      </ScrollView>

      <Modal visible={!!previewUrl} transparent animationType="fade" onRequestClose={() => setPreviewUrl(null)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setPreviewUrl(null)} />
          <View style={styles.modalContent}>
            {previewUrl && <Image source={{ uri: previewUrl }} style={styles.modalImage} resizeMode="contain" />}
            <TouchableOpacity style={[styles.modalCloseButton, { backgroundColor: colors.primary }]} onPress={() => setPreviewUrl(null)}>
              <Ionicons name="close" size={18} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.modalCloseText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
            <Text style={styles.rejectModalSubtitle}>{t('admin.rejectUserSubtitle')}</Text>
            <Text style={styles.rejectModalLabel}>{t('admin.rejectionReason')}</Text>
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
                    <Text style={styles.rejectModalConfirmText}>{t('admin.reject')}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: spacing.md, paddingBottom: 40 },
  heroWrap: { position: 'relative', overflow: 'hidden', borderRadius: 16, borderWidth: 1, padding: spacing.md, marginTop: spacing.sm, marginBottom: spacing.md },
  heroGlowPrimary: { position: 'absolute', width: 130, height: 130, borderRadius: 65, top: -72, right: -38, opacity: 0.08 },
  heroGlowAccent: { position: 'absolute', width: 100, height: 100, borderRadius: 50, bottom: -52, left: -26, opacity: 0.1 },
  heroSubtitle: { fontSize: 14, fontWeight: '500', lineHeight: 20, marginBottom: spacing.md },
  adminHeaderActions: { marginTop: 0, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, width: '100%', paddingHorizontal: 8 },
  diagnosticsButton: { marginTop: 0, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  diagnosticsButtonText: { fontSize: 13, fontWeight: '700' },
  loadingContainer: { alignItems: 'center', paddingVertical: 40, marginTop: 40, paddingHorizontal: 20 },
  loadingText: { marginTop: 10, fontSize: 14 },
  emptyState: { alignItems: 'center', paddingVertical: 60, marginTop: 40, marginHorizontal: 20, borderRadius: 20, borderWidth: 1 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: 'center' },
  usersList: { paddingTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16, paddingHorizontal: 4 },
  card: { overflow: 'hidden', borderRadius: 16, padding: 16, marginBottom: 16 },
  cardAccentLine: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, opacity: 0.35 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  profileImage: { width: 56, height: 56, borderRadius: 28, marginEnd: 12, borderWidth: 1 },
  profilePlaceholder: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginEnd: 12, borderWidth: 1 },
  userInfo: { flex: 1, minWidth: 0 },
  email: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  namePrimary: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  usernameSecondary: { fontSize: 12, fontWeight: '500', marginBottom: 6 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 3, marginTop: 2, gap: 4 },
  roleText: { fontSize: 10, fontWeight: '600' },
  statusPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 12, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.md, borderWidth: 1, gap: 5 },
  statusPillText: { fontSize: 11, fontWeight: '500' },
  documentsSection: { marginBottom: 12, paddingTop: 10, borderTopWidth: 1 },
  documentsTitle: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  documentsList: { gap: 6 },
  documentItem: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, gap: 8 },
  documentText: { flex: 1, fontSize: 12, minWidth: 0 },
  viewLink: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 4 },
  viewLinkText: { fontSize: 11, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 10, paddingTop: 12, borderTopWidth: 1 },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, minHeight: 40, gap: 6 },
  outlineActionButton: { borderWidth: 1 },
  actionText: { fontSize: 14, fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '95%', maxHeight: '90%', borderRadius: 20, backgroundColor: '#000000', padding: 16, alignItems: 'center' },
  modalImage: { width: '100%', height: 400, borderRadius: 12, backgroundColor: '#1a1a1a' },
  modalCloseButton: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center' },
  modalCloseText: { color: '#ffffff', fontWeight: '600', fontSize: 15 },
  rejectModalContent: { width: '90%', borderRadius: 20, backgroundColor: '#ffffff', padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
  rejectModalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  rejectModalTitle: { fontSize: 22, fontWeight: '700', color: '#111827', marginLeft: 10 },
  rejectModalSubtitle: { fontSize: 14, color: '#6b7280', marginBottom: 20, lineHeight: 20 },
  rejectModalLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  rejectModalInput: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#d1d5db', fontSize: 15, color: '#111827', minHeight: 100, textAlignVertical: 'top', marginBottom: 20 },
  rejectModalButtons: { flexDirection: 'row', gap: 12 },
  rejectModalButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 14 },
  rejectModalCancelButton: { backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#d1d5db' },
  rejectModalConfirmButton: { backgroundColor: '#ef4444', shadowColor: '#ef4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
  rejectModalCancelText: { color: '#111827', fontWeight: '600', fontSize: 15 },
  rejectModalConfirmText: { color: '#ffffff', fontWeight: '600', fontSize: 15 },
  rtlRow: { flexDirection: 'row-reverse' },
  rtlText: { textAlign: 'right' },
});
