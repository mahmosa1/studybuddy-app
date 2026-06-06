// app/(tabs)/index.tsx
import { db } from '@/lib/firebaseConfig';
import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { PrimaryButton } from '@/frontend/components/ui/PrimaryButton';
import { SectionTitle } from '@/frontend/components/ui/SectionTitle';
import { radius, spacing, typography } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import {
    getSmartNotifications,
    getStudyStats,
    getTasks,
    saveStudySession,
    SmartNotification,
    StudyStats,
    StudyTask,
    updateDailyGoal,
} from '@/lib/studyJournalService';
import {
    formatTaskDate,
    getUpcomingWeekTasks,
    getStatusLabelKey,
    getStatusVisualStyle,
    isTaskOverdue,
} from '@/lib/taskUtils';
import { useUser } from '@/lib/UserContext';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
  Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

type RecentCourse = {
  id: string;
  name: string;
};

function localizeSmartAlertMessage(
  message: string,
  language: string,
  t: (key: string, options?: Record<string, any>) => string,
): string {
  const isHebrewUi = language === 'he' || language.startsWith('he-');
  if (!isHebrewUi) return message;

  const remainingMatch = message.match(/You still need about\s+(\d+)\s+minutes/i);
  if (remainingMatch?.[1]) {
    return t('home.smartAlertRemainingGoal', { minutes: Number(remainingMatch[1]) });
  }

  const weakTopicMatch = message.match(/Weak topic detected:\s*"?([^"]+)"?\s*\((\d+)% accuracy\)/i);
  if (weakTopicMatch?.[1] && weakTopicMatch?.[2]) {
    return t('home.smartAlertWeakTopic', {
      topic: weakTopicMatch[1],
      accuracy: Number(weakTopicMatch[2]),
    });
  }

  return message;
}

export default function HomeScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { role, firebaseUser } = useUser();
  const [username, setUsername] = useState<string>('');
  const [recentCourses, setRecentCourses] = useState<RecentCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserData = async () => {
      if (!firebaseUser) {
        setLoading(false);
        return;
      }

      try {
        // Load username from Firestore
        const userDocSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          setUsername(userData.username || userData.fullName || 'User');
        }

        // Load recent courses (mock: just load user's courses)
        const coursesQuery = query(
          collection(db, 'courses'),
          where('ownerUid', '==', firebaseUser.uid)
        );
        const coursesSnap = await getDocs(coursesQuery);
        const courses: RecentCourse[] = [];
        coursesSnap.forEach((doc) => {
          courses.push({
            id: doc.id,
            name: doc.data().name || 'Course',
          });
        });
        setRecentCourses(courses.slice(0, 3)); // Show max 3 recent
      } catch (err) {
        console.log('Error loading home data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, [firebaseUser]);

  // Show different content based on role
  if (role === 'lecturer') {
    return <LecturerHomeScreen />;
  }

  if (role === 'admin') {
    return <AdminHomeScreen />;
  }

  // Default: Student Home
  return <StudentHomeWithJournal username={username} loading={loading} recentCourses={recentCourses} />;
}

function StudentHomeWithJournal({
  username,
  loading,
  recentCourses,
}: {
  username: string;
  loading: boolean;
  recentCourses: RecentCourse[];
}) {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const [stats, setStats] = useState<StudyStats | null>(null);
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalHoursInput, setGoalHoursInput] = useState('2');
  const [goalMinutesInput, setGoalMinutesInput] = useState('0');
  const [smartNotifications, setSmartNotifications] = useState<SmartNotification[]>([]);
  const isHebrewUi = i18n.language === 'he';
  const mirroredTextAlignStyle = isHebrewUi ? styles.textAlignRight : styles.textAlignLeft;

  const reloadJournalData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [s, ts, notifications] = await Promise.all([getStudyStats(), getTasks(), getSmartNotifications()]);
      setStats(s);
      setTasks(ts);
      setSmartNotifications(notifications);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reloadJournalData();
    }, [reloadJournalData]),
  );

  useEffect(() => {
    if (!running || paused) return;
    const timer = setInterval(() => setSeconds((v) => v + 1), 1000);
    return () => clearInterval(timer);
  }, [running, paused]);

  const formatTimer = (value: number) => {
    const mins = Math.floor(value / 60);
    const secs = value % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStop = async () => {
    setRunning(false);
    setPaused(false);
    if (seconds > 0) {
      await saveStudySession(seconds);
      Alert.alert(
        t('common.success'),
        t('home.timerSaved', { minutes: Math.floor(seconds / 60) }),
      );
      setSeconds(0);
      const newStats = await getStudyStats();
      setStats(newStats);
    }
  };

  const handlePauseResume = () => {
    if (!running) return;
    setPaused((prev) => !prev);
  };

  const openGoalEditor = () => {
    const currentGoal = stats?.dailyGoal || 7200;
    const hours = Math.floor(currentGoal / 3600);
    const minutes = Math.floor((currentGoal % 3600) / 60);
    setGoalHoursInput(String(hours));
    setGoalMinutesInput(String(minutes));
    setShowGoalModal(true);
  };

  const handleSaveDailyGoal = async () => {
    const parsedHours = Number(goalHoursInput || '0');
    const parsedMinutes = Number(goalMinutesInput || '0');

    if (
      Number.isNaN(parsedHours) ||
      Number.isNaN(parsedMinutes) ||
      parsedHours < 0 ||
      parsedMinutes < 0 ||
      parsedMinutes > 59
    ) {
      Alert.alert(t('common.error'), t('home.invalidGoalInput'));
      return;
    }

    const totalSeconds = parsedHours * 3600 + parsedMinutes * 60;
    if (totalSeconds < 900) {
      Alert.alert(t('common.error'), t('home.minimumGoalMinutes'));
      return;
    }

    await updateDailyGoal(totalSeconds);
    setShowGoalModal(false);
    const newStats = await getStudyStats();
    setStats(newStats);
  };

  const upcomingWeekTasks = getUpcomingWeekTasks(tasks);
  const dailyGoalSeconds = stats?.dailyGoal || 7200;
  const todayStudySecondsLive = (stats?.todayStudyTime || 0) + seconds;
  const liveGoalProgress =
    dailyGoalSeconds > 0 ? Math.min(100, Math.round((todayStudySecondsLive / dailyGoalSeconds) * 100)) : 0;
  const studiedMinutes = Math.floor(todayStudySecondsLive / 60);
  const goalMinutes = Math.max(1, Math.floor(dailyGoalSeconds / 60));
  const remainingMinutes = Math.max(0, goalMinutes - studiedMinutes);

  const formatGoalTarget = (totalMinutes: number) => {
    const hours = totalMinutes / 60;
    const roundedHours = Number.isInteger(hours) ? `${hours}` : hours.toFixed(1);
    return isHebrewUi ? `${roundedHours} שעות` : `${roundedHours} hours`;
  };

  const displayName = loading ? '...' : username || 'Student';
  const welcomeName = isHebrewUi ? `\u200E${displayName}\u200E` : displayName;

  return (
    <AppScreen>
      <View style={styles.homeRoot}>
        <View pointerEvents="none" style={styles.homeDecorLayer}>
          <View style={[styles.heroGlowPrimary, { backgroundColor: colors.primary }]} />
          <View style={[styles.heroGlowAccent, { backgroundColor: colors.accent }]} />
        </View>
        <ScrollView
          style={styles.homeScroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text
            style={[
              styles.homeGreeting,
              isHebrewUi ? styles.homeGreetingHe : styles.homeGreetingEn,
              { color: colors.textPrimary },
            ]}
          >
            {t('home.welcome', { name: welcomeName })}
          </Text>

        <AppCard style={[styles.journalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.journalHeaderBetween, isHebrewUi && styles.rtlRow]}>
            <View style={[styles.journalHeader, isHebrewUi && styles.rtlRow]}>
              <Ionicons name="stats-chart" size={20} color={colors.primary} />
              <Text style={[styles.journalTitle, mirroredTextAlignStyle]}>{t('home.studyStats')}</Text>
            </View>
            <TouchableOpacity style={styles.goalEditButton} onPress={openGoalEditor}>
              <Ionicons name="create-outline" size={16} color={colors.primary} />
              <Text style={styles.goalEditButtonText}>{t('home.editGoalButton')}</Text>
            </TouchableOpacity>
          </View>
          {loadingData ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <Text style={[styles.goalLabel, mirroredTextAlignStyle]}>{t('home.dailyGoal')}</Text>
              <View style={[styles.goalInfoRow, isHebrewUi ? styles.goalInfoRowRtl : styles.goalInfoRowLtr]}>
                <Text style={[styles.goalValue, mirroredTextAlignStyle]}>
                  {isHebrewUi
                    ? `${studiedMinutes} דקות מתוך ${formatGoalTarget(goalMinutes)}`
                    : `${studiedMinutes} minutes out of ${formatGoalTarget(goalMinutes)}`}
                </Text>
              </View>
              <Text style={[styles.goalSubtext, mirroredTextAlignStyle]}>
                {remainingMinutes > 0
                  ? t('home.remainingToGoal', { minutes: remainingMinutes })
                  : t('home.goalCompletedMessage')}
              </Text>
              <View style={styles.progressRow}>
                <View style={[styles.progressTrack, { backgroundColor: colors.surfaceElevated }]}>
                  <View style={[styles.progressFill, { width: `${liveGoalProgress}%`, backgroundColor: colors.primary }]} />
                </View>
                <Text style={[styles.goalPercent, { color: colors.primary }]}>{liveGoalProgress}%</Text>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.statTiny}>
                  <Ionicons name="time-outline" size={16} color={colors.primary} />
                  <Text style={styles.statTinyValue}>{Math.floor(todayStudySecondsLive / 60)}</Text>
                  <Text style={[styles.statTinyLabel, mirroredTextAlignStyle]}>{t('home.minutes')}</Text>
                </View>
                <View style={styles.statTiny}>
                  <Ionicons name="flame-outline" size={16} color="#f59e0b" />
                  <Text style={styles.statTinyValue}>{stats?.currentStreak || 0}</Text>
                  <Text style={[styles.statTinyLabel, mirroredTextAlignStyle]}>{t('home.streak')}</Text>
                </View>
                <View style={styles.statTiny}>
                  <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                  <Text style={styles.statTinyValue}>{stats?.totalSessions || 0}</Text>
                  <Text style={[styles.statTinyLabel, mirroredTextAlignStyle]}>{t('home.sessions')}</Text>
                </View>
              </View>
            </>
          )}
        </AppCard>

        {smartNotifications.length > 0 && (
          <AppCard style={[styles.journalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.journalHeader, isHebrewUi && styles.rtlRow]}>
              <Ionicons name="notifications-outline" size={20} color={colors.primary} />
              <Text style={[styles.journalTitle, mirroredTextAlignStyle]}>{t('home.smartAlerts')}</Text>
            </View>
            {smartNotifications.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.smartAlertItem,
                  item.severity === 'critical'
                    ? styles.smartAlertCritical
                    : item.severity === 'warning'
                      ? styles.smartAlertWarning
                      : styles.smartAlertInfo,
                ]}
              >
                <Text style={[styles.smartAlertText, mirroredTextAlignStyle]}>
                  {localizeSmartAlertMessage(item.message, i18n.language, t)}
                </Text>
              </View>
            ))}
          </AppCard>
        )}

        <AppCard style={[styles.journalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.journalHeader, isHebrewUi && styles.rtlRow]}>
            <Ionicons name="timer-outline" size={20} color={colors.primary} />
            <Text style={[styles.journalTitle, mirroredTextAlignStyle]}>{t('home.studyTimer')}</Text>
          </View>
          <View style={[styles.timerDisplayBox, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
            <Text style={[styles.timerText, { color: colors.primary }]}>{formatTimer(seconds)}</Text>
          </View>
          <View style={styles.timerActions}>
            {!running ? (
              <TouchableOpacity
                style={[styles.timerPrimaryButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setRunning(true);
                  setPaused(false);
                }}
              >
                <Ionicons name="play" size={16} color="#fff" />
                <Text style={styles.timerPrimaryButtonText}>{t('home.startTimer')}</Text>
              </TouchableOpacity>
            ) : !paused ? (
              <TouchableOpacity style={[styles.timerResetButton, { backgroundColor: colors.accent }]} onPress={handlePauseResume}>
                <Ionicons name="pause" size={16} color="#fff" />
                <Text style={styles.timerPrimaryButtonText}>{t('home.pauseTimer')}</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.timerRunningButtonsRow}>
                <TouchableOpacity style={styles.timerStopButton} onPress={handleStop}>
                  <Ionicons name="stop" size={16} color="#fff" />
                  <Text style={styles.timerPrimaryButtonText}>{t('home.finishTimer')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.timerContinueButton, { backgroundColor: colors.primary }]} onPress={handlePauseResume}>
                  <Ionicons name="play" size={16} color="#fff" />
                  <Text style={styles.timerPrimaryButtonText}>{t('home.resumeTimer')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </AppCard>

        <AppCard style={[styles.journalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.tasksHeader, isHebrewUi && styles.rtlRow]}>
            <TouchableOpacity
              style={[styles.journalHeader, isHebrewUi && styles.rtlRow, styles.tasksHeaderTitleWrap]}
              onPress={() => router.push({ pathname: '/tasks', params: { tab: 'tasks' } } as any)}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              <Text style={[styles.journalTitle, mirroredTextAlignStyle]}>{t('home.myTasks')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push({ pathname: '/tasks', params: { tab: 'tasks' } } as any)}>
              <Ionicons
                name={isHebrewUi ? 'chevron-back' : 'chevron-forward'}
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity activeOpacity={0.92} onPress={() => router.push({ pathname: '/tasks', params: { tab: 'tasks' } } as any)}>
            {loadingData ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />
            ) : upcomingWeekTasks.length === 0 ? (
              <Text style={[styles.emptyTasksText, mirroredTextAlignStyle]}>{t('home.noTasksThisWeek')}</Text>
            ) : (
              <>
                <Text style={[styles.tasksHintText, mirroredTextAlignStyle]}>{t('home.tasksUpcomingWeek')}</Text>
                <View style={[styles.homeTaskList, { borderColor: colors.border }]}>
                  {upcomingWeekTasks.map((task, index) => {
                    const statusVisual = getStatusVisualStyle(task.status, colors);
                    const overdue = isTaskOverdue(task);
                    const dateLabel = formatTaskDate(task.dueDate, i18n.language, t('home.noDeadline'));
                    const metaParts = [overdue ? t('home.overdue') : dateLabel, task.courseName || null].filter(Boolean);
                    return (
                      <View key={task.id}>
                        {index > 0 ? <View style={[styles.homeTaskDivider, { backgroundColor: colors.border }]} /> : null}
                        <View style={[styles.homeTaskPreview, isHebrewUi && styles.rtlRow]}>
                          <View style={[styles.homeTaskPriorityDot, { backgroundColor: statusVisual.accent }]} />
                          <View style={styles.homeTaskPreviewContent}>
                            <Text style={[styles.homeTaskPreviewTitle, mirroredTextAlignStyle, { color: colors.textPrimary }]} numberOfLines={1}>
                              {task.title}
                            </Text>
                            <View style={[styles.homeTaskMetaRow, isHebrewUi && styles.rtlRow]}>
                              {metaParts.length > 0 ? (
                                <Text
                                  style={[
                                    styles.homeTaskMetaLine,
                                    mirroredTextAlignStyle,
                                    { color: overdue ? colors.danger : colors.textSecondary },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {metaParts.join('  ·  ')}
                                </Text>
                              ) : null}
                              <View
                                style={[
                                  styles.homeStatusBadge,
                                  { backgroundColor: statusVisual.background, borderColor: statusVisual.border },
                                  isHebrewUi && styles.rtlRow,
                                ]}
                              >
                                <View style={[styles.homeStatusBadgeDot, { backgroundColor: statusVisual.accent }]} />
                                <Text style={[styles.homeStatusBadgeText, { color: statusVisual.accent }]}>
                                  {t(getStatusLabelKey(task.status))}
                                </Text>
                              </View>
                            </View>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
                <Text style={[styles.viewAllTasksText, { color: colors.primary }, mirroredTextAlignStyle]}>
                  {t('home.viewAllTasks')}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </AppCard>

        <AppCard style={[styles.journalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.journalTitle, mirroredTextAlignStyle]}>{t('home.quickActions')}</Text>
          <View style={styles.quickGrid}>
            <TouchableOpacity style={styles.quickTile} onPress={() => router.push('/ai-practice-setup' as any)}>
              <Ionicons name="flask-outline" size={20} color={colors.primary} />
              <Text style={[styles.quickTileText, mirroredTextAlignStyle]}>{t('home.startPractice')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickTile} onPress={() => router.push('/(tabs)/courses')}>
              <Ionicons name="book-outline" size={20} color={colors.primary} />
              <Text style={[styles.quickTileText, mirroredTextAlignStyle]}>{t('home.myCourses')}</Text>
            </TouchableOpacity>
          </View>
          {recentCourses.length > 0 && (
            <TouchableOpacity
              style={styles.lastCourseRow}
              onPress={() => router.push(`/course/${recentCourses[0].id}` as any)}
            >
              <Ionicons name="play-forward-outline" size={16} color={colors.primary} />
              <Text style={[styles.lastCourseText, mirroredTextAlignStyle, { color: colors.primary }]}>
                {t('home.continueCourse', { name: recentCourses[0].name })}
              </Text>
            </TouchableOpacity>
          )}
        </AppCard>
      </ScrollView>
      </View>

      <Modal visible={showGoalModal} transparent animationType="slide" onRequestClose={() => setShowGoalModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalKeyboardWrapper}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
        >
          <View style={styles.modalOverlaySimple}>
            <ScrollView
              contentContainerStyle={styles.modalOverlayScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={[styles.modalSimple, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.modalSimpleTitle, { color: colors.textPrimary }]}>{t('home.editDailyGoal')}</Text>
                <View style={styles.goalInputsRow}>
                  <View style={styles.goalInputBox}>
                    <Text style={[styles.goalInputLabel, { color: colors.textSecondary }]}>{t('home.hours')}</Text>
                    <TextInput
                      value={goalHoursInput}
                      onChangeText={setGoalHoursInput}
                      style={[styles.modalInputSimple, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surface }]}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={colors.textSecondary}
                      selectionColor={colors.primary}
                      cursorColor={colors.primary}
                    />
                  </View>
                  <View style={styles.goalInputBox}>
                    <Text style={[styles.goalInputLabel, { color: colors.textSecondary }]}>{t('home.minutes')}</Text>
                    <TextInput
                      value={goalMinutesInput}
                      onChangeText={setGoalMinutesInput}
                      style={[styles.modalInputSimple, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surface }]}
                      keyboardType="numeric"
                      placeholder="0-59"
                      placeholderTextColor={colors.textSecondary}
                      selectionColor={colors.primary}
                      cursorColor={colors.primary}
                    />
                  </View>
                </View>
                <View style={styles.modalActionsSimple}>
                  <TouchableOpacity
                    style={[styles.modalCancelSimple, { backgroundColor: colors.surfaceElevated }]}
                    onPress={() => setShowGoalModal(false)}
                  >
                    <Text style={[styles.modalCancelText, { color: colors.textPrimary }]}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalSaveSimple, { backgroundColor: colors.primary }]} onPress={handleSaveDailyGoal}>
                    <Text style={styles.modalSaveText}>{t('common.save')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </AppScreen>
  );
}

// Lecturer Home Screen Component
function LecturerHomeScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const { firebaseUser } = useUser();
  const isHebrewUi = i18n.language === 'he';
  const [lecturerName, setLecturerName] = useState<string>('');
  const [recentCourses, setRecentCourses] = useState<RecentCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLecturerData = async () => {
      if (!firebaseUser) {
        setLoading(false);
        return;
      }

      try {
        const userDocSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          setLecturerName(userData.fullName || userData.username || 'Lecturer');
        }

        const coursesQuery = query(
          collection(db, 'courses'),
          where('ownerUid', '==', firebaseUser.uid)
        );
        const coursesSnap = await getDocs(coursesQuery);
        const courses: RecentCourse[] = [];
        coursesSnap.forEach((doc) => {
          courses.push({
            id: doc.id,
            name: doc.data().name || 'Course',
          });
        });
        setRecentCourses(courses.slice(0, 3));
      } catch (err) {
        console.log('Error loading lecturer data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadLecturerData();
  }, [firebaseUser]);

  const displayName = loading ? '...' : lecturerName || t('auth.lecturer');
  const welcomeName = isHebrewUi ? `\u200E${displayName}\u200E` : displayName;

  return (
    <AppScreen>
      <View style={styles.homeRoot}>
        <View pointerEvents="none" style={styles.homeDecorLayer}>
          <View style={[styles.lecturerHeroGlowPrimary, { backgroundColor: colors.primary }]} />
          <View style={[styles.lecturerHeroGlowAccent, { backgroundColor: colors.accent }]} />
        </View>
        <ScrollView
          style={styles.homeScroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text
            style={[
              styles.homeGreeting,
              isHebrewUi ? styles.homeGreetingHe : styles.homeGreetingEn,
              { color: colors.textPrimary },
            ]}
          >
            {t('home.welcome', { name: welcomeName })}
          </Text>

        <View style={styles.cardsWrapper}>
          <AppCard style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.lecturerCardAccent, { backgroundColor: colors.primary }]} />
            <View style={styles.lecturerCardHeader}>
              <View style={[styles.lecturerCardIconBadge, { backgroundColor: colors.surfaceElevated }]}>
                <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
              </View>
              <Text style={styles.cardTitle}>{t('home.createNewCourse')}</Text>
            </View>
            <Text style={styles.cardText}>
              {t('home.createNewCourseDescription')}
            </Text>
            <PrimaryButton
              label={t('home.createCourse')}
              onPress={() => router.push('/lecturer/add-course' as any)}
              style={styles.primaryCta}
            />
          </AppCard>

          {recentCourses.length > 0 && (
            <AppCard style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.lecturerCardAccent, { backgroundColor: colors.primary }]} />
              <View style={styles.lecturerCardHeader}>
                <View style={[styles.lecturerCardIconBadge, { backgroundColor: colors.surfaceElevated }]}>
                  <Ionicons name="time-outline" size={16} color={colors.primary} />
                </View>
                <Text style={styles.cardTitle}>{t('home.recentCourses')}</Text>
              </View>
              <FlatList
                data={recentCourses}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.courseItem}
                    onPress={() => router.push(`/lecturer/course/${item.id}` as any)}
                  >
                    <Text style={styles.courseItemText}>{item.name}</Text>
                  </TouchableOpacity>
                )}
                scrollEnabled={false}
              />
            </AppCard>
          )}

          <AppCard style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.lecturerCardAccent, { backgroundColor: colors.primary }]} />
            <View style={styles.lecturerCardHeader}>
              <View style={[styles.lecturerCardIconBadge, { backgroundColor: colors.surfaceElevated }]}>
                <Ionicons name="library-outline" size={16} color={colors.primary} />
              </View>
              <Text style={styles.cardTitle}>{t('home.myCourses')}</Text>
            </View>
            <Text style={styles.cardText}>
              {t('home.lecturerCoursesDescription')}
            </Text>
            <PrimaryButton
              label={t('home.viewAllCourses')}
              onPress={() => router.push('/(tabs)/courses')}
              style={styles.primaryCta}
            />
          </AppCard>
        </View>
      </ScrollView>
      </View>
    </AppScreen>
  );
}
// Admin Home Screen Component
function AdminHomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const [stats, setStats] = useState({
    students: 0,
    lecturers: 0,
    pendingUsers: 0,
    pendingAppeals: 0,
    courses: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const coursesSnap = await getDocs(collection(db, 'courses'));
        const appealsSnap = await getDocs(
          query(collection(db, 'appeals'), where('status', '==', 'pending'))
        );

        let students = 0;
        let lecturers = 0;
        let pending = 0;

        usersSnap.forEach((doc) => {
          const data = doc.data();
          if (data.role === 'student') students++;
          if (data.role === 'lecturer') lecturers++;
          if (data.status === 'pending') pending++;
        });

        setStats({
          students,
          lecturers,
          pendingUsers: pending,
          pendingAppeals: appealsSnap.size,
          courses: coursesSnap.size,
        });
      } catch (err) {
        console.log('Error loading admin stats:', err);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  return (
    <AppScreen>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.adminHeroWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.adminHeroGlowPrimary, { backgroundColor: colors.primary }]} />
          <View style={[styles.adminHeroGlowAccent, { backgroundColor: colors.accent }]} />
          <View style={styles.adminHeroTopRow}>
            <View style={[styles.adminHeroBadge, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <Ionicons name="shield-checkmark" size={14} color={colors.primary} />
              <Text style={[styles.adminHeroBadgeText, { color: colors.textSecondary }]}>
                לוח בקרה
              </Text>
            </View>
          </View>
          <View style={styles.adminHeroRow}>
            <View style={[styles.adminHeroIcon, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <Ionicons name="shield-half" size={22} color={colors.primary} />
            </View>
            <SectionTitle title="לוח בקרה למנהל" subtitle="נהל משתמשים, קורסים והגדרות מערכת" />
          </View>
        </View>

        {/* Statistics Grid */}
        <View style={styles.statsGrid}>
          <AppCard style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.statAccentLine, { backgroundColor: colors.primary }]} />
            <View style={[styles.statIconContainer, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name="school" size={22} color={colors.primary} />
            </View>
            <Text style={styles.statNumber}>{loading ? '...' : stats.students}</Text>
            <Text style={styles.statLabel}>{t('admin.students')}</Text>
          </AppCard>

          <AppCard style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.statAccentLine, { backgroundColor: colors.accent }]} />
            <View style={[styles.statIconContainer, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name="person" size={22} color={colors.accent} />
            </View>
            <Text style={styles.statNumber}>{loading ? '...' : stats.lecturers}</Text>
            <Text style={styles.statLabel}>{t('admin.lecturers')}</Text>
          </AppCard>

          <AppCard style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.statAccentLine, { backgroundColor: colors.warning }]} />
            <View style={[styles.statIconContainer, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name="time" size={22} color={colors.warning} />
            </View>
            <Text style={styles.statNumber}>{loading ? '...' : stats.pendingUsers}</Text>
            <Text style={styles.statLabel}>{t('admin.pending')}</Text>
          </AppCard>

          <AppCard style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.statAccentLine, { backgroundColor: colors.primary }]} />
            <View style={[styles.statIconContainer, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name="book" size={22} color={colors.primary} />
            </View>
            <Text style={styles.statNumber}>{loading ? '...' : stats.courses}</Text>
            <Text style={styles.statLabel}>{t('admin.courses')}</Text>
          </AppCard>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.sectionTitle}>{t('admin.quickActions')}</Text>

          <Pressable
            style={({ pressed }) => [
              styles.actionCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && { opacity: 0.9, transform: [{ scale: 0.995 }] },
            ]}
            onPress={() => router.push('/admin/pending-approvals' as any)}
          >
            <View style={[styles.actionAccentLine, { backgroundColor: colors.warning }]} />
            <View style={styles.actionCardLeft}>
              <View style={[styles.actionIconContainer, { backgroundColor: colors.surfaceElevated }]}>
                <Ionicons name="checkmark-circle" size={20} color={colors.warning} />
              </View>
              <View style={styles.actionCardContent}>
                <Text style={styles.actionCardTitle}>{t('admin.pendingApprovals')}</Text>
                <Text style={styles.actionCardText}>
                  {stats.pendingUsers === 1
                    ? t('admin.reviewPendingUser', { count: stats.pendingUsers })
                    : t('admin.reviewPendingUsers', { count: stats.pendingUsers })}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.actionCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && { opacity: 0.9, transform: [{ scale: 0.995 }] },
            ]}
            onPress={() => router.push('/admin/appeals' as any)}
          >
            <View style={[styles.actionAccentLine, { backgroundColor: colors.warning }]} />
            <View style={styles.actionCardLeft}>
              <View style={[styles.actionIconContainer, { backgroundColor: colors.surfaceElevated }]}>
                <Ionicons name="chatbubble-ellipses" size={20} color={colors.warning} />
              </View>
              <View style={styles.actionCardContent}>
                <Text style={styles.actionCardTitle}>{t('admin.appeals')}</Text>
                <Text style={styles.actionCardText}>
                  {stats.pendingAppeals > 0
                    ? stats.pendingAppeals === 1
                      ? t('home.pendingAppeal', { count: stats.pendingAppeals })
                      : t('home.pendingAppeals', { count: stats.pendingAppeals })
                    : t('home.noPendingAppeals')}
                </Text>
              </View>
            </View>
            {stats.pendingAppeals > 0 && (
              <View style={styles.badgeContainer}>
                <View style={[styles.badge, { backgroundColor: colors.warning }]}>
                  <Text style={styles.badgeText}>{stats.pendingAppeals}</Text>
                </View>
              </View>
            )}
            <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.actionCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && { opacity: 0.9, transform: [{ scale: 0.995 }] },
            ]}
            onPress={() => router.push('/admin/users' as any)}
          >
            <View style={[styles.actionAccentLine, { backgroundColor: colors.primary }]} />
            <View style={styles.actionCardLeft}>
              <View style={[styles.actionIconContainer, { backgroundColor: colors.surfaceElevated }]}>
                <Ionicons name="people" size={20} color={colors.primary} />
              </View>
              <View style={styles.actionCardContent}>
                <Text style={styles.actionCardTitle}>{t('admin.userManagement')}</Text>
                <Text style={styles.actionCardText}>
                  {t('admin.userManagementDescription')}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.actionCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && { opacity: 0.9, transform: [{ scale: 0.995 }] },
            ]}
            onPress={() => router.push('/admin/courses' as any)}
          >
            <View style={[styles.actionAccentLine, { backgroundColor: colors.accent }]} />
            <View style={styles.actionCardLeft}>
              <View style={[styles.actionIconContainer, { backgroundColor: colors.surfaceElevated }]}>
                <Ionicons name="library" size={20} color={colors.accent} />
              </View>
              <View style={styles.actionCardContent}>
                <Text style={styles.actionCardTitle}>{t('admin.courseManagement')}</Text>
                <Text style={styles.actionCardText}>
                  {t('admin.courseManagementDescription')}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* System Info */}
        <AppCard style={[styles.systemInfoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.systemInfoHeader}>
            <View style={[styles.systemInfoIcon, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <Ionicons name="information-circle" size={18} color={colors.primary} />
            </View>
            <Text style={styles.systemInfoTitle}>{t('admin.systemOverview')}</Text>
          </View>
          <View style={[styles.systemInfoRow, { borderBottomColor: colors.border }]}>
            <Text style={styles.systemInfoLabel}>{t('admin.totalUsers')}:</Text>
            <Text style={styles.systemInfoValue}>
              {loading ? '...' : stats.students + stats.lecturers}
            </Text>
          </View>
          <View style={[styles.systemInfoRow, styles.systemInfoLastRow]}>
            <Text style={styles.systemInfoLabel}>{t('admin.activeUsers')}:</Text>
            <Text style={styles.systemInfoValue}>
              {loading ? '...' : stats.students + stats.lecturers - stats.pendingUsers}
            </Text>
          </View>
        </AppCard>
      </ScrollView>
    </AppScreen>
  );
}

const PRIMARY_GREEN = '#2563eb';
const ACCENT_GREEN = '#2563eb';
const GREY = '#4b5563';
const GREY_LIGHT = '#374151';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  homeRoot: {
    flex: 1,
  },
  homeDecorLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 170,
    overflow: 'hidden',
    zIndex: 0,
    pointerEvents: 'none',
  },
  homeScroll: {
    flex: 1,
    zIndex: 1,
  },
  homeGreeting: {
    ...typography.h3,
    marginBottom: spacing.lg,
  },
  homeGreetingHe: {
    textAlign: 'right',
    alignSelf: 'stretch',
    writingDirection: 'rtl',
  },
  homeGreetingEn: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  heroGlowPrimary: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    top: -80,
    right: -45,
    opacity: 0.08,
  },
  heroGlowAccent: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    left: -30,
    bottom: -60,
    opacity: 0.08,
  },
  adminHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  adminHeroIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lecturerHeroGlowPrimary: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    top: -90,
    right: -45,
    opacity: 0.08,
  },
  lecturerHeroGlowAccent: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    left: -30,
    bottom: -65,
    opacity: 0.08,
  },
  lecturerCardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.35,
  },
  lecturerCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  lecturerCardIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitle: {
    fontSize: 38,
    fontWeight: '900',
    color: PRIMARY_GREEN,
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.8,
    textShadowColor: 'rgba(37, 99, 235, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  appTagline: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  welcomeInlineText: {
    marginTop: 2,
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  journalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  smartAlertItem: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
    borderWidth: 1,
  },
  smartAlertInfo: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  smartAlertWarning: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  smartAlertCritical: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  smartAlertText: {
    color: '#1f2937',
    fontSize: 12,
    fontWeight: '600',
  },
  journalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  journalHeaderBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
  },
  goalEditButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  journalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  goalLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  goalValue: {
    marginTop: 4,
    fontSize: 13,
    color: '#111827',
    fontWeight: '700',
  },
  goalInfoRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalInfoRowRtl: {
    justifyContent: 'flex-end',
  },
  goalInfoRowLtr: {
    justifyContent: 'flex-start',
  },
  goalPercent: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  goalSubtext: {
    marginTop: 4,
    fontSize: 12,
    color: '#6b7280',
  },
  progressRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563eb',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  statTiny: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  statTinyValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  statTinyLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  timerDisplayBox: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  timerText: {
    fontSize: 44,
    fontWeight: '700',
    color: '#111827',
  },
  timerActions: {
    alignItems: 'center',
    marginTop: 12,
  },
  timerRunningButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  timerPrimaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 12,
  },
  timerResetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  timerContinueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  timerStopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ef4444',
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 12,
  },
  timerPrimaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  tasksHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tasksHeaderTitleWrap: {
    flex: 1,
  },
  homeTaskList: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  homeTaskDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 12,
  },
  homeTaskPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    minHeight: 46,
  },
  homeTaskPriorityDot: {
    width: 3,
    height: 26,
    borderRadius: 2,
    flexShrink: 0,
  },
  homeTaskPreviewContent: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  homeTaskPreviewTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  homeTaskMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  homeTaskMetaLine: {
    fontSize: 11,
    fontWeight: '500',
    flexShrink: 1,
  },
  homeStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    flexShrink: 0,
  },
  homeStatusBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  homeStatusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  viewAllTasksText: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '700',
  },
  emptyTasksText: {
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
  },
  tasksHintText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    marginBottom: 6,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  taskRowCompleted: {
    opacity: 0.9,
  },
  taskRowText: {
    fontSize: 14,
    color: '#111827',
    flex: 1,
  },
  taskRowTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#6b7280',
  },
  taskStatusBadge: {
    backgroundColor: '#f3f4f6',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  taskStatusBadgeInProgress: {
    backgroundColor: '#eff6ff',
  },
  taskStatusBadgeDone: {
    backgroundColor: '#ecfdf5',
  },
  taskStatusBadgeText: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
  },
  taskStatusBadgeTextInProgress: {
    color: '#1d4ed8',
  },
  taskStatusBadgeTextDone: {
    color: '#16a34a',
  },
  taskDeleteButton: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  quickGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  quickTile: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  quickTileText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  lastCourseRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lastCourseText: {
    color: '#111827',
    fontWeight: '600',
    fontSize: 13,
  },
  modalOverlaySimple: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalKeyboardWrapper: {
    flex: 1,
  },
  modalOverlayScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  modalSimple: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  modalSimpleTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 10,
  },
  modalInputSimple: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#ffffff',
    includeFontPadding: false,
  },
  modalInputRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  modalInputLtr: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  textAlignRight: {
    textAlign: 'right',
  },
  textAlignLeft: {
    textAlign: 'left',
  },
  rtlRow: {
    flexDirection: 'row-reverse',
  },
  modalActionsSimple: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  goalInputsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  goalInputBox: {
    flex: 1,
  },
  goalInputLabel: {
    marginBottom: 6,
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  modalCancelSimple: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
  },
  modalSaveSimple: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#2563eb',
  },
  modalCancelText: {
    color: '#111827',
    fontWeight: '600',
  },
  modalSaveText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  welcomeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 28,
    marginBottom: 28,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e0e7ff',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    overflow: 'hidden',
  },
  welcomeEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    fontWeight: '500',
  },
  cardsWrapper: {
    rowGap: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1.5,
    borderColor: '#e0e7ff',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  cardText: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 14,
  },
  buttonBase: {
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignSelf: 'flex-start',
  },
  primaryCta: {
    alignSelf: 'flex-start',
    minHeight: 40,
    paddingHorizontal: 16,
  },
  buttonDisabled: {
    backgroundColor: GREY_LIGHT,
  },
  buttonDisabledText: {
    color: GREY,
    fontSize: 13,
    fontWeight: '600',
  },
  buttonPrimary: {
    backgroundColor: PRIMARY_GREEN,
    shadowColor: PRIMARY_GREEN,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  buttonPrimaryText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  buttonOutline: {
    borderWidth: 1,
    borderColor: GREY,
    backgroundColor: '#ffffff',
  },
  buttonOutlineText: {
    color: GREY,
    fontSize: 13,
    fontWeight: '600',
  },
  courseItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  courseItemText: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
  },
  tipText: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  statText: {
    fontSize: 14,
    color: '#111827',
    marginTop: 6,
    fontWeight: '500',
  },
  // Admin Dashboard Styles
  adminHeroWrap: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  adminHeroGlowPrimary: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    top: -78,
    right: -42,
    opacity: 0.08,
  },
  adminHeroGlowAccent: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    bottom: -56,
    left: -38,
    opacity: 0.1,
  },
  adminHeroTopRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: spacing.sm,
  },
  adminHeroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  adminHeroBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 24,
    gap: 12,
  },
  statCard: {
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    width: '48%',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  statAccentLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  statIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  quickActionsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  actionCard: {
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  actionAccentLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  actionCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  actionCardContent: {
    flex: 1,
  },
  actionCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  actionCardText: {
    fontSize: 13,
    color: '#6b7280',
  },
  badgeContainer: {
    marginRight: 8,
  },
  badge: {
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  systemInfoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  systemInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  systemInfoIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: 8,
  },
  systemInfoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  systemInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  systemInfoLastRow: {
    borderBottomWidth: 0,
  },
  systemInfoLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  systemInfoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
});

export { };

