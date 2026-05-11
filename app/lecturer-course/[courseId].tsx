// app/lecturer-course/[courseId].tsx
import { getExistingJoinRequest, requestToJoinCourse } from '@/lib/courseJoinRequestService';
import { auth, db } from '@/lib/firebaseConfig';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PRIMARY_GREEN = '#047857';
const ACCENT_GREEN = '#047857';

type CourseFile = {
  id: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
  url?: string | null;
};

export default function StudentLecturerCourseViewScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    courseId?: string | string[];
    name?: string;
  }>();

  const courseId =
    typeof params.courseId === 'string' ? params.courseId : undefined;
  const name = params.name || 'Course';

  const [files, setFiles] = useState<CourseFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [requestPending, setRequestPending] = useState(false);
  const [alreadyParticipating, setAlreadyParticipating] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [courseOwnerUid, setCourseOwnerUid] = useState('');
  const [lecturerName, setLecturerName] = useState('');
  const [lecturerInstitution, setLecturerInstitution] = useState('');
  /** True once course snapshot (+ join-request check when needed) finished for this viewer. */
  const [accessResolved, setAccessResolved] = useState(false);
  /** Owner or approved participant via sharedWithUids or latest approved join request */
  const [canViewMaterials, setCanViewMaterials] = useState(false);

  // Course doc + participation / request UI state (live updates when lecturer approves)
  useEffect(() => {
    if (!courseId) {
      setAccessResolved(false);
      setCanViewMaterials(false);
      return;
    }

    let cancelled = false;
    const courseRef = doc(db, 'courses', courseId);

    const unsub = onSnapshot(
      courseRef,
      async (courseSnap) => {
        if (cancelled || !courseSnap.exists()) return;

        const data = courseSnap.data() as any;
        const ownerUid = String(data?.ownerUid || data?.lecturerUid || '');
        const sharedList = Array.isArray(data?.sharedWithUids)
          ? data.sharedWithUids.map((v: any) => String(v))
          : [];

        setCourseOwnerUid(ownerUid);
        setLecturerName(String(data?.lecturer || data?.ownerName || ''));
        setLecturerInstitution(String(data?.institution || ''));

        const user = auth.currentUser;

        if (!user?.uid) {
          setRequestPending(false);
          setAlreadyParticipating(false);
          setCanViewMaterials(false);
          setAccessResolved(true);
          return;
        }

        if (ownerUid && user.uid === ownerUid) {
          setRequestPending(false);
          setAlreadyParticipating(false);
          setCanViewMaterials(true);
          setAccessResolved(true);
          return;
        }

        const inShared = sharedList.includes(user.uid);
        let approvedFromRequest = false;
        let pending = false;

        try {
          const latest = await getExistingJoinRequest({ courseId, studentUid: user.uid });
          approvedFromRequest = latest?.status === 'approved';
          pending = latest?.status === 'pending';
        } catch (err) {
          console.log('Error loading join request for access:', err);
        }

        if (cancelled) return;

        const hasApprovedAccess = inShared || approvedFromRequest;
        setAlreadyParticipating(hasApprovedAccess);
        setRequestPending(hasApprovedAccess ? false : pending);
        setCanViewMaterials(hasApprovedAccess);
        setAccessResolved(true);
      },
      (err) => {
        console.log('Error subscribing to course:', err);
        setAccessResolved(true);
        setCanViewMaterials(false);
      },
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [courseId]);

  // Load file metadata only when viewer may download (owner or approved participant)
  useEffect(() => {
    if (!courseId) {
      setLoadingFiles(false);
      setFiles([]);
      return;
    }

    if (!canViewMaterials) {
      setFiles([]);
      setLoadingFiles(false);
      return;
    }

    setLoadingFiles(true);

    const filesRef = collection(db, 'courseFiles');
    const q = query(
      filesRef,
      where('courseId', '==', courseId),
      orderBy('createdAt', 'desc'),
    );

    const unsub = onSnapshot(
      q,
      snapshot => {
        const list: CourseFile[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data() as any;
          list.push({
            id: docSnap.id,
            name: data.name,
            mimeType: data.mimeType ?? null,
            size: data.size ?? null,
            url: data.url ?? null,
          });
        });
        setFiles(list);
        setLoadingFiles(false);
      },
      err => {
        console.log('Error loading course files:', err);
        setLoadingFiles(false);
      },
    );

    return unsub;
  }, [courseId, canViewMaterials]);

  const handleOpenFile = (file: CourseFile) => {
    if (!canViewMaterials) {
      Alert.alert(t('common.error'), t('courseJoin.materialsLockedSubtitle'));
      return;
    }
    if (!file.url) {
      Alert.alert('Error', 'Missing file URL.');
      return;
    }

    Linking.openURL(file.url).catch(err => {
      console.log('Failed to open file url:', err);
      Alert.alert('Error', 'Could not open file.');
    });
  };

  const getFileIcon = (mimeType: string | null | undefined) => {
    if (!mimeType) return 'document-outline';
    if (mimeType.includes('pdf')) return 'document-text-outline';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'document-outline';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'grid-outline';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'easel-outline';
    if (mimeType.includes('image')) return 'image-outline';
    if (mimeType.includes('video')) return 'videocam-outline';
    if (mimeType.includes('audio')) return 'musical-notes-outline';
    if (mimeType.includes('zip') || mimeType.includes('archive')) return 'archive-outline';
    return 'document-outline';
  };

  const handleRequestJoin = async () => {
    if (!courseId) return;
    const user = auth.currentUser;
    if (!user?.uid) {
      Alert.alert(t('common.error'), t('courseJoin.notAuthenticated'));
      return;
    }

    if (courseOwnerUid && user.uid === courseOwnerUid) {
      Alert.alert(t('common.error'), t('courseJoin.cannotRequestOwnCourse'));
      return;
    }

    setRequestLoading(true);
    try {
      const result = await requestToJoinCourse({
        courseId,
        courseName: name,
        lecturerUid: courseOwnerUid,
      });

      if (!result.ok) {
        if (result.reason === 'pending_exists') {
          setRequestPending(true);
          Alert.alert(t('common.error'), t('courseJoin.requestAlreadyPending'));
          return;
        }
        if (result.reason === 'already_participating') {
          setAlreadyParticipating(true);
          setCanViewMaterials(true);
          setRequestPending(false);
          Alert.alert(t('common.error'), t('courseJoin.alreadyParticipating'));
          return;
        }
        if (result.reason === 'owner_blocked') {
          Alert.alert(t('common.error'), t('courseJoin.cannotRequestOwnCourse'));
          return;
        }
        if (result.reason === 'not_authenticated') {
          Alert.alert(t('common.error'), t('courseJoin.notAuthenticated'));
          return;
        }
        Alert.alert(t('common.error'), t('courseJoin.requestFailed'));
        return;
      }

      setRequestPending(true);
      Alert.alert(t('common.success'), t('courseJoin.requestSent'));
    } catch (err) {
      console.log('Request join error:', err);
      Alert.alert(t('common.error'), t('courseJoin.requestFailed'));
    } finally {
      setRequestLoading(false);
    }
  };

  const renderFile = ({ item }: { item: CourseFile }) => {
    const sizeMb =
      item.size != null ? (item.size / (1024 * 1024)).toFixed(2) : null;
    const fileIcon = getFileIcon(item.mimeType);

    return (
      <TouchableOpacity
        style={styles.fileCard}
        onPress={() => handleOpenFile(item)}
        activeOpacity={0.7}
      >
        <View style={styles.fileIconContainer}>
          <Ionicons name={fileIcon} size={24} color={ACCENT_GREEN} />
        </View>
        <View style={styles.fileInfo}>
          <Text style={styles.fileName} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.fileMetaRow}>
            {item.mimeType && (
              <View style={styles.metaTag}>
                <Ionicons name="document-outline" size={10} color="#6b7280" />
                <Text style={styles.metaTagText}>
                  {item.mimeType.split('/')[1]?.toUpperCase() || 'FILE'}
                </Text>
              </View>
            )}
            {sizeMb && (
              <View style={styles.metaTag}>
                <Ionicons name="hardware-chip-outline" size={10} color="#6b7280" />
                <Text style={styles.metaTagText}>{sizeMb} MB</Text>
              </View>
            )}
          </View>
        </View>
        <Ionicons name="download-outline" size={20} color={PRIMARY_GREEN} />
      </TouchableOpacity>
    );
  };

  const currentUid = auth.currentUser?.uid ?? '';
  const isOwnerViewer = !!courseOwnerUid && currentUid === courseOwnerUid;

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
          <Ionicons name="people" size={32} color="#ffffff" />
          <Text style={styles.headerTitle}>{name}</Text>
          {!!lecturerName && (
            <Text style={styles.headerSubtitle}>
              {lecturerInstitution
                ? `${lecturerName} • ${lecturerInstitution}`
                : lecturerName}
            </Text>
          )}
          <View style={styles.readOnlyBadge}>
            <Ionicons name="lock-closed" size={14} color="#ffffff" />
            <Text style={styles.readOnlyBadgeText}>Read-Only</Text>
          </View>
        </View>

        {/* Request Join Button */}
        {!isOwnerViewer && !requestPending && !alreadyParticipating && (
          <View style={styles.requestSection}>
            <TouchableOpacity
              style={[styles.requestButton, requestLoading && styles.requestButtonDisabled]}
              onPress={handleRequestJoin}
              disabled={requestLoading}
            >
              <Ionicons name="person-add" size={20} color="#ffffff" />
              <Text style={styles.requestButtonText}>{t('courseJoin.requestToJoin')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {requestPending && (
          <View style={styles.requestedSection}>
            <Ionicons name="checkmark-circle" size={24} color={ACCENT_GREEN} />
            <Text style={styles.requestedText}>
              {t('courseJoin.requestPending')}
            </Text>
          </View>
        )}

        {alreadyParticipating && (
          <View style={styles.requestedSection}>
            <Ionicons name="checkmark-done-circle" size={24} color={ACCENT_GREEN} />
            <Text style={styles.requestedText}>
              {t('courseJoin.alreadyParticipating')}
            </Text>
          </View>
        )}

        {isOwnerViewer && (
          <View style={styles.ownerActions}>
            <View style={[styles.requestedSection, styles.requestedSectionOwner]}>
              <Ionicons name="information-circle" size={24} color={ACCENT_GREEN} />
              <Text style={styles.requestedText}>
                {t('courseJoin.ownerUseLecturerTools')}
              </Text>
            </View>
            {courseId ? (
              <TouchableOpacity
                style={styles.ownerToolsButton}
                onPress={() =>
                  router.push({
                    pathname: '/lecturer/course/[courseId]' as any,
                    params: { courseId, name },
                  })
                }
              >
                <Ionicons name="construct-outline" size={18} color="#ffffff" />
                <Text style={styles.ownerToolsButtonText}>{t('courseJoin.openLecturerCourse')}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {/* Files Section */}
        <View style={styles.filesCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text" size={22} color={ACCENT_GREEN} />
            <Text style={styles.sectionTitle}>{t('courseJoin.teachingMaterials')}</Text>
            <Text style={styles.sectionSubtitle}>{t('courseJoin.downloadOnly')}</Text>
          </View>

          {!accessResolved ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={PRIMARY_GREEN} size="large" />
              <Text style={styles.loadingText}>{t('common.loading')}</Text>
            </View>
          ) : !canViewMaterials ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="lock-closed-outline" size={64} color="#6b7280" />
              </View>
              <Text style={styles.emptyTitle}>{t('courseJoin.materialsLockedTitle')}</Text>
              <Text style={styles.emptyText}>{t('courseJoin.materialsLockedSubtitle')}</Text>
            </View>
          ) : loadingFiles ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={PRIMARY_GREEN} size="large" />
              <Text style={styles.loadingText}>Loading files...</Text>
            </View>
          ) : files.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="document-outline" size={64} color="#6b7280" />
              </View>
              <Text style={styles.emptyTitle}>No files available</Text>
              <Text style={styles.emptyText}>
                The lecturer hasn't uploaded any materials yet.
              </Text>
            </View>
          ) : (
            <FlatList
              data={files}
              keyExtractor={item => item.id}
              renderItem={renderFile}
              scrollEnabled={false}
              contentContainerStyle={styles.filesList}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

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
    marginHorizontal: -24,
    shadowColor: PRIMARY_GREEN,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  backButtonHeader: {
    position: 'absolute',
    top: 60,
    left: 20,
    padding: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 10,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#ffffff',
    opacity: 0.9,
    marginBottom: 12,
  },
  readOnlyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  readOnlyBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  requestSection: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 20,
  },
  requestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: PRIMARY_GREEN,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: PRIMARY_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  requestButtonDisabled: {
    opacity: 0.7,
  },
  requestButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  requestedSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 20,
    backgroundColor: '#f0fdf4',
    marginHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ACCENT_GREEN,
  },
  requestedText: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  ownerActions: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 12,
    gap: 12,
  },
  requestedSectionOwner: {
    marginHorizontal: 0,
  },
  ownerToolsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: PRIMARY_GREEN,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  ownerToolsButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  filesCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 'auto',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#6b7280',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  filesList: {
    paddingBottom: 10,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  fileIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  fileMetaRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  metaTagText: {
    fontSize: 11,
    color: '#6b7280',
    marginLeft: 4,
    fontWeight: '500',
  },
});

