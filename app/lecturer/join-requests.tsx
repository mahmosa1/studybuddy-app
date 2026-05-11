// app/lecturer/join-requests.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { AppHeader } from '@/frontend/components/ui/AppHeader';
import { EmptyState } from '@/frontend/components/ui/EmptyState';
import { AppCard } from '@/frontend/components/ui/AppCard';
import { layout, spacing, ThemeColors } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { Text } from 'react-native';
import { LoadingState } from '@/frontend/components/ui/LoadingState';
import {
  CourseJoinRequest,
  approveJoinRequest,
  rejectJoinRequest,
  subscribeLecturerPendingRequests,
} from '@/lib/courseJoinRequestService';
import { auth } from '@/lib/firebaseConfig';
import { PrimaryButton } from '@/frontend/components/ui/PrimaryButton';
import {
  formatEnglishJoinRequestWhen,
  formatHebrewJoinRequestDate,
  formatHebrewJoinRequestTime,
  isHebrewUiLanguage,
} from '@/frontend/utils/format';

export default function LecturerJoinRequestsScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<CourseJoinRequest[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [actingRequestId, setActingRequestId] = useState<string | null>(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user?.uid) {
      setRequests([]);
      setLoading(false);
      return;
    }

    const unsub = subscribeLecturerPendingRequests(
      { lecturerUid: user.uid },
      (list) => {
        setRequests(list);
        setLoadError(false);
        setLoading(false);
      },
      (err) => {
        console.log('Failed to subscribe lecturer pending requests:', err);
        setLoadError(true);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  const formatRequestWhen = (request: CourseJoinRequest) => {
    const ts = request.createdAt;
    if (!ts?.toDate) return t('common.loading');
    const d = ts.toDate();
    if (isHebrewUiLanguage(i18n.language)) {
      return t('lecturer.requestedAt', {
        date: formatHebrewJoinRequestDate(d),
        time: formatHebrewJoinRequestTime(d),
      });
    }
    return t('lecturer.requestedAt', {
      when: formatEnglishJoinRequestWhen(d),
    });
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

  const handleApprove = async (requestId: string) => {
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
      console.log('Approve join request failed:', err);
      Alert.alert(t('common.error'), t('lecturer.joinRequestActionFailed'));
    } finally {
      setActingRequestId(null);
    }
  };

  const handleReject = async (requestId: string) => {
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
      console.log('Reject join request failed:', err);
      Alert.alert(t('common.error'), t('lecturer.joinRequestActionFailed'));
    } finally {
      setActingRequestId(null);
    }
  };

  return (
    <AppScreen>
      <AppHeader title={t('lecturer.joinRequests')} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <LoadingState label={t('common.loading')} />
        ) : loadError ? (
          <AppCard style={styles.emptyCard}>
            <EmptyState title={t('common.error')} subtitle={t('lecturer.joinRequestsLoadError')} />
          </AppCard>
        ) : requests.length === 0 ? (
          <AppCard style={styles.emptyCard}>
            <EmptyState
              title={t('lecturer.noPendingRequests')}
              subtitle={t('lecturer.noPendingRequestsSubtitle')}
            />
          </AppCard>
        ) : (
          requests.map((request) => (
            <AppCard key={request.id} style={styles.requestCard}>
              <View style={styles.requestHeader}>
                <View style={styles.requestMeta}>
                  <Text style={styles.studentName}>{request.studentName || '-'}</Text>
                  <Text style={styles.studentEmail}>{request.studentEmail || '-'}</Text>
                </View>
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>{t('lecturer.statusPending')}</Text>
                </View>
              </View>
              <Text style={styles.courseText}>{t('lecturer.course')}: {request.courseName || '-'}</Text>
              <Text style={styles.requestedText}>
                {formatRequestWhen(request)}
              </Text>
              <View style={styles.actionsRow}>
                <PrimaryButton
                  label={t('lecturer.approve')}
                  onPress={() => handleApprove(request.id)}
                  loading={actingRequestId === request.id}
                  disabled={!!actingRequestId}
                  style={styles.actionBtn}
                />
                <PrimaryButton
                  label={t('lecturer.reject')}
                  variant="secondary"
                  onPress={() => handleReject(request.id)}
                  disabled={!!actingRequestId}
                  style={[styles.actionBtn, styles.rejectActionBtn]}
                />
              </View>
            </AppCard>
          ))
        )}
        <TouchableOpacity style={styles.secondaryAction} onPress={() => router.push('/courses/my' as any)}>
          <Ionicons name="book-outline" size={16} color={colors.textPrimary} />
          <Text style={styles.secondaryActionText}>{t('lecturer.manageCourses')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </AppScreen>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  emptyCard: {
    paddingVertical: spacing.lg,
  },
  requestCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  requestMeta: {
    flex: 1,
    marginRight: spacing.sm,
  },
  studentName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  studentEmail: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: 13,
  },
  pendingBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pendingBadgeText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  courseText: {
    marginTop: spacing.sm,
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  requestedText: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 12,
  },
  actionsRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
  rejectActionBtn: {
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerSurface,
  },
  secondaryAction: {
    marginTop: spacing.sm,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    alignSelf: 'center',
  },
  secondaryActionText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
});

