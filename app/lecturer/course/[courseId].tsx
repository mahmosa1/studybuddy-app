// app/lecturer/course/[courseId].tsx
import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppHeader } from '@/frontend/components/ui/AppHeader';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { EmptyState } from '@/frontend/components/ui/EmptyState';
import { LoadingState } from '@/frontend/components/ui/LoadingState';
import { PrimaryButton } from '@/frontend/components/ui/PrimaryButton';
import { SectionTitle } from '@/frontend/components/ui/SectionTitle';
import {
  CourseJoinRequest,
  approveJoinRequest,
  rejectJoinRequest,
  subscribeCourseApprovedParticipants,
  subscribeCoursePendingRequests,
} from '@/lib/courseJoinRequestService';
import { iconContainer, layout, radius, spacing, typography } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { auth, db } from '@/lib/firebaseConfig';
import { startCourseFileIntelligenceJob } from '@/lib/learningIntelligence/api';
import { supabase } from '@/lib/supabaseClient';
import { uploadCourseFileToSupabase } from '@/lib/upload';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
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
import {
  formatEnglishJoinRequestWhen,
  formatHebrewJoinRequestDate,
  formatHebrewJoinRequestTime,
  isHebrewUiLanguage,
} from '@/frontend/utils/format';

type CourseFile = {
  id: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
  url?: string | null;
};

export default function LecturerCourseDetailsScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);
  const params = useLocalSearchParams<{
    courseId?: string | string[];
    name?: string;
  }>();

  const courseId =
    typeof params.courseId === 'string' ? params.courseId : undefined;
  const name = params.name;

  const [files, setFiles] = useState<CourseFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [joinedStudents, setJoinedStudents] = useState<CourseJoinRequest[]>([]);
  const [pendingRequests, setPendingRequests] = useState<CourseJoinRequest[]>([]);
  const [loadingJoinedStudents, setLoadingJoinedStudents] = useState(true);
  const [loadingPendingRequests, setLoadingPendingRequests] = useState(true);
  const [joinedStudentsError, setJoinedStudentsError] = useState(false);
  const [pendingRequestsError, setPendingRequestsError] = useState(false);
  const [actingRequestId, setActingRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) {
      setLoadingFiles(false);
      return;
    }

    const filesRef = collection(db, 'courseFiles');
    const q = query(
      filesRef,
      where('courseId', '==', courseId),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: CourseFile[] = [];
        snapshot.forEach((docSnap) => {
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
      (err) => {
        console.log('Error loading course files:', err);
        Alert.alert(t('lecturer.error'), t('lecturer.failedToLoadFiles'));
        setLoadingFiles(false);
      }
    );

    return unsub;
  }, [courseId]);

  useEffect(() => {
    if (!courseId) {
      setLoadingJoinedStudents(false);
      setLoadingPendingRequests(false);
      return;
    }

    const unsubApproved = subscribeCourseApprovedParticipants(
      { courseId },
      (list) => {
        setJoinedStudents(list);
        setLoadingJoinedStudents(false);
        setJoinedStudentsError(false);
      },
      (err) => {
        console.log('Failed to subscribe approved participants:', err);
        setLoadingJoinedStudents(false);
        setJoinedStudentsError(true);
      },
    );

    const unsubPending = subscribeCoursePendingRequests(
      { courseId },
      (list) => {
        setPendingRequests(list);
        setLoadingPendingRequests(false);
        setPendingRequestsError(false);
      },
      (err) => {
        console.log('Failed to subscribe pending requests:', err);
        setLoadingPendingRequests(false);
        setPendingRequestsError(true);
      },
    );

    return () => {
      unsubApproved();
      unsubPending();
    };
  }, [courseId]);

  const formatApprovedAtLabel = (ts: any) => {
    if (!ts?.toDate) return '-';
    const d = ts.toDate();
    if (isHebrewUiLanguage(i18n.language)) {
      return t('lecturer.approvedAt', {
        date: formatHebrewJoinRequestDate(d),
        time: formatHebrewJoinRequestTime(d),
      });
    }
    return t('lecturer.approvedAt', { when: formatEnglishJoinRequestWhen(d) });
  };

  const formatRequestedAtLabel = (ts: any) => {
    if (!ts?.toDate) return '-';
    const d = ts.toDate();
    if (isHebrewUiLanguage(i18n.language)) {
      return t('lecturer.requestedAt', {
        date: formatHebrewJoinRequestDate(d),
        time: formatHebrewJoinRequestTime(d),
      });
    }
    return t('lecturer.requestedAt', { when: formatEnglishJoinRequestWhen(d) });
  };

  const showActionError = (reason?: string) => {
    if (reason === 'already_handled') {
      Alert.alert(t('common.error'), t('lecturer.joinRequestAlreadyHandled'));
      return;
    }
    if (reason === 'not_authorized') {
      Alert.alert(t('common.error'), t('lecturer.joinRequestNotAuthorized'));
      return;
    }
    if (reason === 'request_not_found') {
      Alert.alert(t('common.error'), t('lecturer.joinRequestNotFound'));
      return;
    }
    Alert.alert(t('common.error'), t('lecturer.joinRequestActionFailed'));
  };

  const handleApproveRequest = async (requestId: string) => {
    if (actingRequestId) return;
    setActingRequestId(requestId);
    try {
      const result = await approveJoinRequest({ requestId });
      if (!result.ok) {
        showActionError(result.reason);
        return;
      }
      Alert.alert(t('common.success'), t('lecturer.joinRequestApproved'));
    } catch (err) {
      console.log('Approve request from course detail failed:', err);
      Alert.alert(t('common.error'), t('lecturer.joinRequestActionFailed'));
    } finally {
      setActingRequestId(null);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    if (actingRequestId) return;
    setActingRequestId(requestId);
    try {
      const result = await rejectJoinRequest({ requestId });
      if (!result.ok) {
        showActionError(result.reason);
        return;
      }
      Alert.alert(t('common.success'), t('lecturer.joinRequestRejected'));
    } catch (err) {
      console.log('Reject request from course detail failed:', err);
      Alert.alert(t('common.error'), t('lecturer.joinRequestActionFailed'));
    } finally {
      setActingRequestId(null);
    }
  };

  const handleUploadFile = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert(t('lecturer.error'), t('lecturer.mustBeLoggedInToUpload'));
        return;
      }
      if (!courseId) {
        Alert.alert(t('lecturer.error'), t('lecturer.missingCourseId'));
        return;
      }

      setUploading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        setUploading(false);
        return;
      }

      const asset = result.assets?.[0];
      if (!asset || !asset.uri) {
        Alert.alert(t('lecturer.error'), t('lecturer.couldNotReadFile'));
        setUploading(false);
        return;
      }

      const fileUrl = await uploadCourseFileToSupabase(
        asset.uri,
        courseId,
        asset.mimeType ?? undefined
      );

      if (!fileUrl) {
        Alert.alert(t('common.uploadFailed'), t('lecturer.couldNotUploadFile'));
        setUploading(false);
        return;
      }

      const createdRef = await addDoc(collection(db, 'courseFiles'), {
        courseId,
        ownerUid: user.uid,
        name: asset.name ?? t('lecturer.untitledFile'),
        size: asset.size ?? null,
        mimeType: asset.mimeType ?? null,
        url: fileUrl,
        createdAt: serverTimestamp(),
      });

      startCourseFileIntelligenceJob({
        userId: user.uid,
        courseId,
        courseName: name ?? t('lecturer.course'),
        fileId: createdRef.id,
      }).catch((engineErr) => {
        console.log('Lecturer file intelligence job trigger failed:', engineErr);
      });

      Alert.alert(t('lecturer.success'), t('lecturer.fileUploadedSuccessfully'));
    } catch (err) {
      console.log('Upload error:', err);
      Alert.alert(t('lecturer.error'), t('lecturer.failedToUploadFile'));
    } finally {
      setUploading(false);
    }
  };

  const handleOpenFile = (file: CourseFile) => {
    if (!file.url) {
      Alert.alert(t('lecturer.error'), t('lecturer.missingFileUrl'));
      return;
    }

    Linking.openURL(file.url).catch((err) => {
      console.log('Failed to open file url:', err);
      Alert.alert(t('lecturer.error'), t('lecturer.couldNotOpenFile'));
    });
  };

  const getPathFromPublicUrl = (url: string): string | null => {
    try {
      const parts = url.split(
        '/storage/v1/object/public/studybuddy-files/'
      );
      if (parts.length !== 2) return null;
      return parts[1];
    } catch {
      return null;
    }
  };

  // Get file icon based on mime type
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

  const handleDeleteFile = (file: CourseFile) => {
    Alert.alert(t('lecturer.deleteFileTitle'), t('lecturer.deleteFileConfirm'), [
      { text: t('lecturer.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            if (file.url) {
              const path = getPathFromPublicUrl(file.url);
              if (path) {
                const { error } = await supabase.storage
                  .from('studybuddy-files')
                  .remove([path]);
                if (error) {
                  console.log('Supabase delete error:', error);
                }
              }
            }

            await deleteDoc(doc(db, 'courseFiles', file.id));
          } catch (err) {
            console.log('Delete file error:', err);
            Alert.alert(t('lecturer.error'), t('lecturer.failedToDeleteFile'));
          }
        },
      },
    ]);
  };

  const renderFile = ({ item }: { item: CourseFile }) => {
    const sizeMb =
      item.size != null ? (item.size / (1024 * 1024)).toFixed(2) : null;
    const fileIcon = getFileIcon(item.mimeType);

    return (
      <View style={styles.fileCard}>
        <TouchableOpacity
          style={styles.fileContent}
          onPress={() => handleOpenFile(item)}
          activeOpacity={0.7}
        >
          <View style={styles.fileIconContainer}>
            <Ionicons name={fileIcon} size={24} color={colors.accent} />
          </View>
          <View style={styles.fileInfo}>
            <Text style={styles.fileName} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.fileMetaRow}>
              {item.mimeType && (
                <View style={styles.metaTag}>
                  <Ionicons name="document-outline" size={10} color={colors.textSecondary} />
                  <Text style={styles.metaTagText}>
                    {item.mimeType.split('/')[1]?.toUpperCase() || 'FILE'}
                  </Text>
                </View>
              )}
              {sizeMb && (
                <View style={styles.metaTag}>
                  <Ionicons name="hardware-chip-outline" size={10} color={colors.textSecondary} />
                  <Text style={styles.metaTagText}>{sizeMb} MB</Text>
                </View>
              )}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteFile(item)}
        >
          <Ionicons name="trash-outline" size={18} color={colors.textOnPrimary} />
        </TouchableOpacity>
      </View>
    );
  };

  const courseName = typeof name === 'string' ? name : t('lecturer.course');

  return (
    <AppScreen>
      <AppHeader title={courseName} onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroWrap}>
          <View style={styles.heroGlowPrimary} />
          <View style={styles.heroGlowAccent} />
          <View style={styles.heroBadge}>
            <Ionicons name="school-outline" size={14} color={colors.primary} />
            <Text style={styles.heroBadgeText}>{t('lecturer.tools')}</Text>
          </View>
          <SectionTitle
            title={courseName}
            subtitle={t('lecturer.courseSubtitle')}
          />
        </View>

        {/* Joined Students Section */}
        <AppCard style={styles.studentsCard}>
          <View style={styles.cardAccentBar} />
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconBadge}>
              <Ionicons name="people" size={18} color={colors.textPrimary} />
            </View>
            <Text style={styles.sectionTitle}>{t('lecturer.joinedStudents')}</Text>
          </View>
          {loadingJoinedStudents ? (
            <LoadingState label={t('common.loading')} />
          ) : joinedStudentsError ? (
            <EmptyState title={t('common.error')} subtitle={t('lecturer.joinRequestsLoadError')} />
          ) : joinedStudents.length === 0 ? (
            <EmptyState
              title={t('lecturer.noJoinedStudents')}
              subtitle={t('lecturer.noJoinedStudentsSubtitle')}
            />
          ) : (
            <View style={styles.studentsList}>
              {joinedStudents.map((student) => (
                <View key={student.id} style={styles.studentItem}>
                  <View style={styles.studentAvatar}>
                    <Ionicons name="person" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{student.studentName || '-'}</Text>
                    <Text style={styles.studentEmail}>{student.studentEmail || '-'}</Text>
                    <Text style={styles.studentMeta}>
                      {formatApprovedAtLabel(student.approvedAt)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </AppCard>

        {/* Pending Join Requests Section */}
        <AppCard style={styles.requestsCard}>
          <View style={styles.cardAccentBar} />
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconBadge}>
              <Ionicons name="mail" size={18} color={colors.textPrimary} />
            </View>
            <Text style={styles.sectionTitle}>{t('lecturer.pendingJoinRequests')}</Text>
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => router.push('/lecturer/join-requests' as any)}
            >
              <Text style={styles.viewAllText}>{t('lecturer.viewAll')}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {loadingPendingRequests ? (
            <LoadingState label={t('common.loading')} />
          ) : pendingRequestsError ? (
            <EmptyState title={t('common.error')} subtitle={t('lecturer.joinRequestsLoadError')} />
          ) : pendingRequests.length === 0 ? (
            <EmptyState
              title={t('lecturer.noPendingRequests')}
              subtitle={t('lecturer.noPendingRequestsSubtitle')}
            />
          ) : (
            <View style={styles.requestsList}>
              {pendingRequests.map((request) => (
                <View key={request.id} style={styles.requestItem}>
                  <View style={styles.requestInfo}>
                    <Text style={styles.requestStudentName}>{request.studentName || '-'}</Text>
                    <Text style={styles.requestStudentEmail}>{request.studentEmail || '-'}</Text>
                    <Text style={styles.requestDate}>
                      {formatRequestedAtLabel(request.createdAt)}
                    </Text>
                  </View>
                  <View style={styles.requestActions}>
                    <PrimaryButton
                      label={t('lecturer.approve')}
                      onPress={() => handleApproveRequest(request.id)}
                      loading={actingRequestId === request.id}
                      disabled={!!actingRequestId}
                      style={styles.requestActionButton}
                    />
                    <PrimaryButton
                      label={t('lecturer.reject')}
                      variant="secondary"
                      onPress={() => handleRejectRequest(request.id)}
                      disabled={!!actingRequestId}
                      style={[styles.requestActionButton, styles.requestRejectButton]}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </AppCard>

        {/* Files Section */}
        <AppCard style={styles.filesCard}>
          <View style={styles.cardAccentBar} />
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconBadge}>
              <Ionicons name="document-text" size={18} color={colors.accent} />
            </View>
            <Text style={styles.sectionTitle}>{t('lecturer.teachingMaterials')}</Text>
          </View>

          {loadingFiles ? (
            <View style={styles.loadingContainer}>
              <LoadingState label={t('lecturer.loadingFiles')} />
            </View>
          ) : files.length === 0 ? (
            <EmptyState
              title={t('lecturer.noFiles')}
              subtitle={t('lecturer.noFilesSubtitle')}
            />
          ) : (
            <FlatList
              data={files}
              keyExtractor={(item) => item.id}
              renderItem={renderFile}
              scrollEnabled={false}
              contentContainerStyle={styles.filesList}
            />
          )}

          <PrimaryButton
            style={styles.uploadButton}
            onPress={handleUploadFile}
            disabled={uploading}
            loading={uploading}
            label={t('lecturer.uploadFile')}
          />
        </AppCard>
      </ScrollView>
    </AppScreen>
  );
}

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: 40,
  },
  heroWrap: {
    position: 'relative',
    overflow: 'hidden',
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  heroGlowPrimary: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    top: -100,
    right: -50,
    backgroundColor: colors.primary,
    opacity: 0.08,
  },
  heroGlowAccent: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    bottom: -70,
    left: -30,
    backgroundColor: colors.accent,
    opacity: 0.08,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    marginBottom: spacing.sm,
  },
  heroBadgeText: {
    color: colors.textSecondary,
    ...typography.caption,
    fontWeight: '700',
  },
  cardAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.primary,
    opacity: 0.35,
  },
  studentsCard: {
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    position: 'relative',
    overflow: 'hidden',
  },
  studentsList: {
    gap: 12,
  },
  studentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  studentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  studentEmail: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  studentMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  requestsCard: {
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    position: 'relative',
    overflow: 'hidden',
  },
  requestsList: {
    gap: 12,
  },
  requestItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  requestInfo: {
    flex: 1,
  },
  requestStudentName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  requestDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  requestStudentEmail: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  requestActions: {
    marginLeft: 10,
    width: 96,
    gap: 8,
  },
  requestActionButton: {
    minHeight: 34,
    paddingVertical: 6,
  },
  requestRejectButton: {
    borderColor: colors.dangerBorder ?? colors.danger,
    backgroundColor: colors.dangerSurface ?? colors.surfaceElevated,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filesCard: {
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    position: 'relative',
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginLeft: 10,
  },
  sectionIconBadge: {
    width: iconContainer.size,
    height: iconContainer.size,
    borderRadius: iconContainer.radius,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  filesList: {
    paddingBottom: 10,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fileContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    color: colors.textPrimary,
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
    backgroundColor: colors.surface,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  metaTagText: {
    fontSize: 10,
    color: colors.textSecondary,
    marginLeft: 4,
    fontWeight: '500',
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  uploadButton: {
    marginTop: spacing.md,
  },
  uploadButtonDisabled: {
    opacity: 0.7,
  },
  uploadButtonText: {
    color: colors.textOnPrimary,
    fontWeight: '600',
    fontSize: 16,
  },
});

