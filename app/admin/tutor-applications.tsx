// app/admin/tutor-applications.tsx — Review pending tutor (course helper) applications
import { db } from '@/lib/firebaseConfig';
import {
  approveTutorApplication,
  fetchPendingTutorApplications,
  rejectTutorApplication,
  type TutorApplicationDoc,
} from '@/lib/tutorApplicationService';
import { useUser } from '@/lib/UserContext';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const ACCENT = '#047857';

export default function AdminTutorApplicationsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { role, loading: userLoading } = useUser();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<TutorApplicationDoc[]>([]);
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [declarationModal, setDeclarationModal] = useState<TutorApplicationDoc | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const list = await fetchPendingTutorApplications();
      const enriched = await Promise.all(
        list.map(async (app) => {
          try {
            const uSnap = await getDoc(doc(db, 'users', app.applicantUid));
            const u = uSnap.data() as any;
            const display =
              app.applicantFullName?.trim() ||
              u?.fullName ||
              u?.username ||
              app.applicantEmail ||
              app.applicantUid;
            return { ...app, applicantFullName: display } as TutorApplicationDoc;
          } catch {
            return app;
          }
        }),
      );
      setItems(enriched);
    } catch (e) {
      console.log('load tutor applications', e);
      Alert.alert(t('common.error'), t('admin.tutorApplications.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      if (role === 'admin') load();
    }, [load, role]),
  );

  const openGradeSheet = (url: string) => {
    Linking.openURL(url).catch(() => Alert.alert(t('common.error'), t('admin.tutorApplications.openLinkFailed')));
  };

  const onApprove = (app: TutorApplicationDoc) => {
    Alert.alert(t('admin.tutorApplications.approveTitle'), t('admin.tutorApplications.approveMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        onPress: async () => {
          try {
            setActionId(app.id);
            await approveTutorApplication(app.id);
            setItems((prev) => prev.filter((x) => x.id !== app.id));
            Alert.alert(t('common.success'), t('admin.tutorApplications.approvedOk'));
          } catch (err: any) {
            Alert.alert(t('common.error'), err?.message || t('admin.tutorApplications.actionFailed'));
          } finally {
            setActionId(null);
          }
        },
      },
    ]);
  };

  const openReject = (id: string) => {
    setRejectingId(id);
    setRejectReason('');
    setRejectModalVisible(true);
  };

  const confirmReject = async () => {
    if (!rejectingId) return;
    const reason = rejectReason.trim();
    if (!reason) {
      Alert.alert(t('common.error'), t('admin.enterReason'));
      return;
    }
    try {
      setActionId(rejectingId);
      await rejectTutorApplication(rejectingId, reason);
      setItems((prev) => prev.filter((x) => x.id !== rejectingId));
      setRejectModalVisible(false);
      setRejectingId(null);
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message || t('admin.tutorApplications.actionFailed'));
    } finally {
      setActionId(null);
    }
  };

  if (userLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }

  if (role !== 'admin') {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin.tutorApplications.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.banner}>
        <Ionicons name="information-circle" size={20} color="#92400e" />
        <Text style={styles.bannerText}>{t('admin.tutorApplications.adminHint')}</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="checkmark-done-outline" size={56} color="#22c55e" />
          <Text style={styles.emptyTitle}>{t('admin.tutorApplications.emptyTitle')}</Text>
          <Text style={styles.emptySubtitle}>{t('admin.tutorApplications.emptySubtitle')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          {items.map((app) => (
            <View key={app.id} style={styles.card}>
              <Text style={styles.applicantName}>{app.applicantFullName || app.applicantEmail || app.applicantUid}</Text>
              {app.applicantEmail ? <Text style={styles.muted}>{app.applicantEmail}</Text> : null}
              <View style={styles.courseRow}>
                <Ionicons name="book-outline" size={18} color={ACCENT} />
                <Text style={styles.courseName}>{app.courseName}</Text>
              </View>

              <View style={styles.rowBtns}>
                <TouchableOpacity style={styles.outlineBtn} onPress={() => openGradeSheet(app.gradeSheetUrl)}>
                  <Ionicons name="document-text-outline" size={18} color={ACCENT} />
                  <Text style={styles.outlineBtnText}>{t('admin.tutorApplications.viewGradeSheet')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.outlineBtn} onPress={() => setDeclarationModal(app)}>
                  <Ionicons name="reader-outline" size={18} color={ACCENT} />
                  <Text style={styles.outlineBtnText}>{t('admin.tutorApplications.viewDeclaration')}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.approveBtn, actionId === app.id && styles.btnDisabled]}
                  disabled={actionId === app.id}
                  onPress={() => onApprove(app)}
                >
                  {actionId === app.id ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      <Text style={styles.approveBtnText}>{t('admin.tutorApplications.approve')}</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.rejectBtn, actionId === app.id && styles.btnDisabled]}
                  disabled={actionId === app.id}
                  onPress={() => openReject(app.id)}
                >
                  <Ionicons name="close-circle" size={20} color="#fff" />
                  <Text style={styles.rejectBtnText}>{t('admin.reject')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={rejectModalVisible} transparent animationType="fade" onRequestClose={() => setRejectModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setRejectModalVisible(false)} />
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t('admin.tutorApplications.rejectTitle')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('admin.enterReason')}
              placeholderTextColor="#9ca3af"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setRejectModalVisible(false)}>
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirm} onPress={confirmReject}>
                <Text style={styles.modalConfirmText}>{t('admin.reject')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!declarationModal} transparent animationType="fade" onRequestClose={() => setDeclarationModal(null)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDeclarationModal(null)} />
          <View style={[styles.modalBox, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>{t('admin.tutorApplications.declarationSnapshotTitle')}</Text>
            <ScrollView style={styles.declScroll}>
              <Text style={styles.declBody}>{declarationModal?.declarationTextSnapshot || '—'}</Text>
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setDeclarationModal(null)}>
              <Text style={styles.modalCloseText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#111827', flex: 1, textAlign: 'center' },
  banner: {
    flexDirection: 'row',
    gap: 10,
    margin: 16,
    padding: 12,
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  bannerText: { flex: 1, fontSize: 13, color: '#78350f', lineHeight: 18 },
  list: { padding: 16, paddingBottom: 40, gap: 14 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  applicantName: { fontSize: 17, fontWeight: '800', color: '#111827' },
  muted: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  courseRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  courseName: { fontSize: 15, fontWeight: '700', color: '#374151', flex: 1 },
  rowBtns: { flexDirection: 'row', gap: 8, marginTop: 12 },
  outlineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1fae5',
    backgroundColor: '#ecfdf5',
  },
  outlineBtnText: { fontSize: 13, fontWeight: '700', color: ACCENT },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: ACCENT,
    paddingVertical: 12,
    borderRadius: 10,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#b91c1c',
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnDisabled: { opacity: 0.6 },
  approveBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  rejectBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginTop: 12 },
  emptySubtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', marginTop: 8 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 18,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    minHeight: 88,
    textAlignVertical: 'top',
    fontSize: 15,
    color: '#111827',
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 14 },
  modalCancel: { paddingVertical: 10, paddingHorizontal: 14 },
  modalCancelText: { color: '#6b7280', fontWeight: '700' },
  modalConfirm: { backgroundColor: '#b91c1c', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10 },
  modalConfirmText: { color: '#fff', fontWeight: '800' },
  declScroll: { maxHeight: 320 },
  declBody: { fontSize: 14, color: '#374151', lineHeight: 22 },
  modalClose: { marginTop: 12, alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 20 },
  modalCloseText: { color: ACCENT, fontWeight: '800' },
});
