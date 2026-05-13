// app/lecturer-course/[courseId].tsx
import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppHeader } from '@/frontend/components/ui/AppHeader';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { EmptyState } from '@/frontend/components/ui/EmptyState';
import { LoadingState } from '@/frontend/components/ui/LoadingState';
import { PrimaryButton } from '@/frontend/components/ui/PrimaryButton';
import { layout, radius, spacing, typography, ThemeColors } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { getExistingJoinRequest, requestToJoinCourse } from '@/lib/courseJoinRequestService';
import { auth, db } from '@/lib/firebaseConfig';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type CourseFile = {
  id: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
  url?: string | null;
};

export default function StudentLecturerCourseViewScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const isHebrewUi = i18n.language === 'he';
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);

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
  const [accessResolved, setAccessResolved] = useState(false);
  const [canViewMaterials, setCanViewMaterials] = useState(false);
  const [followingLecturer, setFollowingLecturer] = useState(false);
  const [followResolved, setFollowResolved] = useState(false);

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
        const ownerUid = String(
          data?.ownerUid || data?.lecturerUid || data?.createdBy || data?.userId || '',
        );
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

  useEffect(() => {
    if (!courseOwnerUid) {
      setFollowingLecturer(false);
      setFollowResolved(true);
      return;
    }

    const user = auth.currentUser;
    if (!user?.uid || user.uid === courseOwnerUid) {
      setFollowingLecturer(false);
      setFollowResolved(true);
      return;
    }

    setFollowResolved(false);
    const followDocId = `${user.uid}_${courseOwnerUid}`;
    const followRef = doc(db, 'follows', followDocId);
    const unsub = onSnapshot(
      followRef,
      (snap) => {
        setFollowingLecturer(snap.exists());
        setFollowResolved(true);
      },
      () => {
        setFollowingLecturer(false);
        setFollowResolved(true);
      },
    );
    return () => unsub();
  }, [courseOwnerUid]);

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
      Alert.alert(t('common.error'), t('courseJoin.requestFailed'));
      return;
    }

    Linking.openURL(file.url).catch((err) => {
      console.log('Failed to open file url:', err);
      Alert.alert(t('common.error'), t('courseJoin.requestFailed'));
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

    if (!courseOwnerUid) {
      Alert.alert(t('common.error'), t('courseJoin.requestUnavailable'));
      return;
    }

    if (user.uid === courseOwnerUid) {
      Alert.alert(t('common.error'), t('courseJoin.cannotRequestOwnCourse'));
      return;
    }

    try {
      const followSnap = await getDoc(doc(db, 'follows', `${user.uid}_${courseOwnerUid}`));
      if (!followSnap.exists()) {
        Alert.alert(t('common.error'), t('courseJoin.mustFollowLecturerToRequest'));
        return;
      }
    } catch (e) {
      console.log('Follow check before join request failed:', e);
      Alert.alert(t('common.error'), t('courseJoin.mustFollowLecturerToRequest'));
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

  const currentUid = auth.currentUser?.uid ?? '';
  const isOwnerViewer = !!courseOwnerUid && currentUid === courseOwnerUid;

  const showRequestJoin =
    accessResolved &&
    followResolved &&
    !!currentUid &&
    !isOwnerViewer &&
    !requestPending &&
    !alreadyParticipating &&
    followingLecturer &&
    !!courseOwnerUid;

  const showMustFollowMessage =
    accessResolved &&
    followResolved &&
    !!currentUid &&
    !isOwnerViewer &&
    !requestPending &&
    !alreadyParticipating &&
    !followingLecturer &&
    !!courseOwnerUid;

  const showLoginHint =
    accessResolved && followResolved && !currentUid && !isOwnerViewer && !requestPending && !alreadyParticipating;

  return (
    <AppScreen>
      <AppHeader title={String(name)} onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroWrap, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={styles.heroGlowPrimary} />
          <View style={styles.heroGlowAccent} />
          <View
            style={[
              styles.previewBadge,
              { borderColor: colors.border, backgroundColor: colors.surfaceElevated },
            ]}
          >
            <Ionicons name="eye-outline" size={14} color={colors.textSecondary} />
            <Text style={[styles.previewBadgeText, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
              {t('courseJoin.previewBadge')}
            </Text>
          </View>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
            {t('courseJoin.previewHeroSubtitle')}
          </Text>
          {!!lecturerName && (
            <Text style={[styles.lecturerLine, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
              {lecturerInstitution ? `${lecturerName} · ${lecturerInstitution}` : lecturerName}
            </Text>
          )}
        </View>

        {!isOwnerViewer && !requestPending && !alreadyParticipating && (
          <View style={styles.actionBlock}>
            {accessResolved && followResolved && !courseOwnerUid ? (
              <AppCard style={[styles.noticeCard, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
                <Text style={[styles.noticeText, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
                  {t('courseJoin.requestUnavailable')}
                </Text>
              </AppCard>
            ) : showRequestJoin ? (
              <PrimaryButton
                label={t('courseJoin.requestToJoin')}
                onPress={() => void handleRequestJoin()}
                loading={requestLoading}
                disabled={requestLoading}
              />
            ) : showMustFollowMessage ? (
              <AppCard style={[styles.noticeCard, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
                <View style={[styles.noticeRow, isHebrewUi && styles.rtlRow]}>
                  <Ionicons name="person-add-outline" size={20} color={colors.textSecondary} />
                  <Text style={[styles.noticeText, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
                    {t('courseJoin.mustFollowLecturerToRequest')}
                  </Text>
                </View>
              </AppCard>
            ) : showLoginHint ? (
              <AppCard style={[styles.noticeCard, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
                <Text style={[styles.noticeText, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
                  {t('courseJoin.notAuthenticated')}
                </Text>
              </AppCard>
            ) : null}
          </View>
        )}

        {requestPending ? (
          <AppCard style={[styles.statusCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <View style={[styles.statusRow, isHebrewUi && styles.rtlRow]}>
              <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
              <Text style={[styles.statusText, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
                {t('courseJoin.requestPending')}
              </Text>
            </View>
          </AppCard>
        ) : null}

        {alreadyParticipating ? (
          <AppCard style={[styles.statusCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <View style={[styles.statusRow, isHebrewUi && styles.rtlRow]}>
              <Ionicons name="checkmark-done-circle" size={22} color={colors.success} />
              <Text style={[styles.statusText, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
                {t('courseJoin.alreadyParticipating')}
              </Text>
            </View>
          </AppCard>
        ) : null}

        {isOwnerViewer ? (
          <View style={styles.actionBlock}>
            <AppCard style={[styles.statusCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <View style={[styles.statusRow, isHebrewUi && styles.rtlRow]}>
                <Ionicons name="information-circle-outline" size={22} color={colors.accent} />
                <Text style={[styles.statusText, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
                  {t('courseJoin.ownerUseLecturerTools')}
                </Text>
              </View>
            </AppCard>
            {courseId ? (
              <PrimaryButton
                label={t('courseJoin.openLecturerCourse')}
                onPress={() =>
                  router.push({
                    pathname: '/lecturer/course/[courseId]' as any,
                    params: { courseId, name },
                  })
                }
              />
            ) : null}
          </View>
        ) : null}

        <AppCard style={[styles.filesCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={styles.cardAccentBar} />
          <View style={[styles.sectionHeader, isHebrewUi && styles.rtlRow]}>
            <View style={[styles.sectionIconBadge, { backgroundColor: colors.surfaceMuted }]}>
              <Ionicons name="document-text" size={18} color={colors.textPrimary} />
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
                {t('courseJoin.teachingMaterials')}
              </Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
                {t('courseJoin.downloadOnly')}
              </Text>
            </View>
          </View>

          {!accessResolved ? (
            <LoadingState label={t('common.loading')} />
          ) : !canViewMaterials ? (
            <EmptyState
              title={t('courseJoin.materialsLockedTitle')}
              subtitle={t('courseJoin.materialsLockedSubtitle')}
            />
          ) : loadingFiles ? (
            <LoadingState label={t('common.loading')} />
          ) : files.length === 0 ? (
            <EmptyState
              title={t('courseJoin.noMaterialsTitle')}
              subtitle={t('courseJoin.noMaterialsSubtitle')}
            />
          ) : (
            <View style={styles.filesList}>
              {files.map((item) => {
                const sizeMb =
                  item.size != null ? (item.size / (1024 * 1024)).toFixed(2) : null;
                const fileIcon = getFileIcon(item.mimeType);
                return (
                  <View
                    key={item.id}
                    style={[
                      styles.fileCard,
                      { borderColor: colors.border, backgroundColor: colors.surfaceMuted },
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.fileContent}
                      onPress={() => handleOpenFile(item)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.fileIconContainer, { backgroundColor: colors.surfaceElevated }]}>
                        <Ionicons name={fileIcon} size={24} color={colors.accent} />
                      </View>
                      <View style={styles.fileInfo}>
                        <Text
                          style={[styles.fileName, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                        <View style={[styles.fileMetaRow, isHebrewUi && styles.rtlRow]}>
                          {item.mimeType ? (
                            <View style={[styles.metaTag, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                              <Ionicons name="document-outline" size={10} color={colors.textSecondary} />
                              <Text style={[styles.metaTagText, { color: colors.textSecondary }]}>
                                {item.mimeType.split('/')[1]?.toUpperCase() || 'FILE'}
                              </Text>
                            </View>
                          ) : null}
                          {sizeMb ? (
                            <View style={[styles.metaTag, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                              <Ionicons name="hardware-chip-outline" size={10} color={colors.textSecondary} />
                              <Text style={[styles.metaTagText, { color: colors.textSecondary }]}>{sizeMb} MB</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      <Ionicons
                        name={isHebrewUi ? 'chevron-back' : 'chevron-forward'}
                        size={20}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </AppCard>
      </ScrollView>
    </AppScreen>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
      bottom: -65,
      left: -30,
      backgroundColor: colors.accent,
      opacity: 0.08,
    },
    previewBadge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radius.pill,
      borderWidth: 1,
      marginBottom: spacing.sm,
    },
    previewBadgeText: {
      ...typography.caption,
      fontWeight: '600',
    },
    heroSubtitle: {
      ...typography.body,
      lineHeight: 20,
    },
    lecturerLine: {
      marginTop: spacing.sm,
      fontSize: 14,
      fontWeight: '600',
    },
    actionBlock: {
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    noticeCard: {
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
    },
    noticeRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    noticeText: {
      flex: 1,
      ...typography.body,
      lineHeight: 20,
    },
    statusCard: {
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      marginBottom: spacing.sm,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    statusText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
    },
    filesCard: {
      position: 'relative',
      overflow: 'hidden',
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.md,
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
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    sectionIconBadge: {
      width: 36,
      height: 36,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionHeaderText: {
      flex: 1,
      minWidth: 0,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: '700',
    },
    sectionSubtitle: {
      marginTop: 2,
      fontSize: 12,
    },
    filesList: {
      gap: spacing.sm,
    },
    fileCard: {
      borderRadius: radius.md,
      borderWidth: 1,
      overflow: 'hidden',
    },
    fileContent: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.sm,
      gap: spacing.sm,
    },
    fileIconContainer: {
      width: 48,
      height: 48,
      borderRadius: radius.md,
      justifyContent: 'center',
      alignItems: 'center',
    },
    fileInfo: {
      flex: 1,
      minWidth: 0,
    },
    fileName: {
      fontSize: 15,
      fontWeight: '600',
      marginBottom: 6,
    },
    fileMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    metaTag: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 6,
      borderWidth: 1,
      paddingVertical: 3,
      paddingHorizontal: 6,
    },
    metaTagText: {
      fontSize: 11,
      marginLeft: 4,
      fontWeight: '500',
    },
    rtlText: {
      writingDirection: 'rtl',
      textAlign: 'right',
    },
    rtlRow: {
      flexDirection: 'row-reverse',
    },
  });
