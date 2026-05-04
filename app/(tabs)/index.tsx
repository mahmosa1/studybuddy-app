// app/(tabs)/index.tsx
import { db } from '@/lib/firebaseConfig';
import {
    createTask,
    deleteTask as deleteStudyTask,
    getSmartNotifications,
    getStudyStats,
    getTasks,
    saveStudySession,
    SmartNotification,
    StudyStats,
    StudyTask,
    updateDailyGoal,
    updateTaskStatus,
} from '@/lib/studyJournalService';
import { useUser } from '@/lib/UserContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
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
  const [stats, setStats] = useState<StudyStats | null>(null);
  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [isTaskEditMode, setIsTaskEditMode] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goalHoursInput, setGoalHoursInput] = useState('2');
  const [goalMinutesInput, setGoalMinutesInput] = useState('0');
  const [smartNotifications, setSmartNotifications] = useState<SmartNotification[]>([]);
  const isHebrewUi = i18n.language === 'he';
  const mirroredTextAlignStyle = isHebrewUi ? styles.textAlignRight : styles.textAlignLeft;

  useEffect(() => {
    const load = async () => {
      setLoadingData(true);
      const [s, ts, notifications] = await Promise.all([getStudyStats(), getTasks(), getSmartNotifications()]);
      setStats(s);
      setTasks(ts);
      setSmartNotifications(notifications);
      setLoadingData(false);
    };
    load();
  }, []);

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
      Alert.alert('Saved', `Study session saved (${Math.floor(seconds / 60)} min)`);
      setSeconds(0);
      const newStats = await getStudyStats();
      setStats(newStats);
    }
  };

  const handlePauseResume = () => {
    if (!running) return;
    setPaused((prev) => !prev);
  };

  const handleAddTask = async () => {
    if (!taskTitle.trim()) return;
    await createTask(taskTitle.trim());
    setTaskTitle('');
    setShowTaskModal(false);
    setTasks(await getTasks());
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

  const visibleTasks = tasks.slice(0, 6);
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

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.logoContainer}>
          <Text style={styles.appTitle}>{t('home.title')}</Text>
          <Text style={styles.welcomeInlineText}>
            {t('home.welcome', { name: loading ? '...' : username || 'Student' })}
          </Text>
          <Text style={[styles.appTagline, mirroredTextAlignStyle]}>{t('home.tagline')}</Text>
        </View>

        <View style={styles.journalCard}>
          <View style={[styles.journalHeaderBetween, isHebrewUi && styles.rtlRow]}>
            <View style={[styles.journalHeader, isHebrewUi && styles.rtlRow]}>
              <Ionicons name="stats-chart" size={20} color={PRIMARY_GREEN} />
              <Text style={[styles.journalTitle, mirroredTextAlignStyle]}>{t('home.studyStats')}</Text>
            </View>
            <TouchableOpacity style={styles.goalEditButton} onPress={openGoalEditor}>
              <Ionicons name="create-outline" size={16} color={PRIMARY_GREEN} />
              <Text style={styles.goalEditButtonText}>{t('home.editGoalButton')}</Text>
            </TouchableOpacity>
          </View>
          {loadingData ? (
            <ActivityIndicator color={PRIMARY_GREEN} />
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
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${liveGoalProgress}%` }]} />
                </View>
                <Text style={styles.goalPercent}>{liveGoalProgress}%</Text>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.statTiny}>
                  <Ionicons name="time-outline" size={16} color={PRIMARY_GREEN} />
                  <Text style={styles.statTinyValue}>{Math.floor(todayStudySecondsLive / 60)}</Text>
                  <Text style={[styles.statTinyLabel, mirroredTextAlignStyle]}>{t('home.minutes')}</Text>
                </View>
                <View style={styles.statTiny}>
                  <Ionicons name="flame-outline" size={16} color="#f59e0b" />
                  <Text style={styles.statTinyValue}>{stats?.currentStreak || 0}</Text>
                  <Text style={[styles.statTinyLabel, mirroredTextAlignStyle]}>{t('home.streak')}</Text>
                </View>
                <View style={styles.statTiny}>
                  <Ionicons name="calendar-outline" size={16} color={PRIMARY_GREEN} />
                  <Text style={styles.statTinyValue}>{stats?.totalSessions || 0}</Text>
                  <Text style={[styles.statTinyLabel, mirroredTextAlignStyle]}>{t('home.sessions')}</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {smartNotifications.length > 0 && (
          <View style={styles.journalCard}>
            <View style={[styles.journalHeader, isHebrewUi && styles.rtlRow]}>
              <Ionicons name="notifications-outline" size={20} color={PRIMARY_GREEN} />
              <Text style={[styles.journalTitle, mirroredTextAlignStyle]}>Smart Alerts</Text>
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
                <Text style={[styles.smartAlertText, mirroredTextAlignStyle]}>{item.message}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.journalCard}>
          <View style={[styles.journalHeader, isHebrewUi && styles.rtlRow]}>
            <Ionicons name="timer-outline" size={20} color={PRIMARY_GREEN} />
            <Text style={[styles.journalTitle, mirroredTextAlignStyle]}>{t('home.studyTimer')}</Text>
          </View>
          <View style={styles.timerDisplayBox}>
            <Text style={styles.timerText}>{formatTimer(seconds)}</Text>
          </View>
          <View style={styles.timerActions}>
            {!running ? (
              <TouchableOpacity
                style={styles.timerPrimaryButton}
                onPress={() => {
                  setRunning(true);
                  setPaused(false);
                }}
              >
                <Ionicons name="play" size={16} color="#fff" />
                <Text style={styles.timerPrimaryButtonText}>{t('home.startTimer')}</Text>
              </TouchableOpacity>
            ) : !paused ? (
              <TouchableOpacity style={styles.timerResetButton} onPress={handlePauseResume}>
                <Ionicons name="pause" size={16} color="#fff" />
                <Text style={styles.timerPrimaryButtonText}>{t('home.pauseTimer')}</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.timerRunningButtonsRow}>
                <TouchableOpacity style={styles.timerStopButton} onPress={handleStop}>
                  <Ionicons name="stop" size={16} color="#fff" />
                  <Text style={styles.timerPrimaryButtonText}>{t('home.finishTimer')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.timerContinueButton} onPress={handlePauseResume}>
                  <Ionicons name="play" size={16} color="#fff" />
                  <Text style={styles.timerPrimaryButtonText}>{t('home.resumeTimer')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        <View style={styles.journalCard}>
          <View style={[styles.tasksHeader, isHebrewUi && styles.rtlRow]}>
            <View style={[styles.journalHeader, isHebrewUi && styles.rtlRow]}>
              <Ionicons name="checkmark-circle" size={20} color={PRIMARY_GREEN} />
              <Text style={[styles.journalTitle, mirroredTextAlignStyle]}>{t('home.myTasks')}</Text>
            </View>
            <View style={[styles.taskHeaderActions, isHebrewUi && styles.rtlRow]}>
              <TouchableOpacity onPress={() => setIsTaskEditMode((prev) => !prev)}>
                <Ionicons name={isTaskEditMode ? 'close-circle' : 'create-outline'} size={21} color={PRIMARY_GREEN} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowTaskModal(true)}>
                <Ionicons name="add-circle" size={22} color={PRIMARY_GREEN} />
              </TouchableOpacity>
            </View>
          </View>
          {tasks.length === 0 ? (
            <Text style={[styles.emptyTasksText, mirroredTextAlignStyle]}>{t('home.noTasks')}</Text>
          ) : (
            <>
              <Text style={[styles.tasksHintText, mirroredTextAlignStyle]}>{t('home.tapTaskToToggle')}</Text>
              {visibleTasks.map((task) => (
              <TouchableOpacity
                key={task.id}
                style={[styles.taskRow, task.status === 'completed' && styles.taskRowCompleted]}
                onPress={async () => {
                  const nextStatus =
                    task.status === 'pending'
                      ? 'in-progress'
                      : task.status === 'in-progress'
                        ? 'completed'
                        : 'pending';
                  await updateTaskStatus(task.id, nextStatus);
                  setTasks(await getTasks());
                }}
              >
                <Ionicons
                  name={
                    task.status === 'completed'
                      ? 'checkmark-circle'
                      : task.status === 'in-progress'
                        ? 'play-circle-outline'
                        : 'ellipse-outline'
                  }
                  size={16}
                  color={
                    task.status === 'completed'
                      ? PRIMARY_GREEN
                      : task.status === 'in-progress'
                        ? '#1d4ed8'
                        : '#6b7280'
                  }
                />
                <Text style={[styles.taskRowText, mirroredTextAlignStyle, task.status === 'completed' && styles.taskRowTextCompleted]}>
                  {task.title}
                </Text>
                <View
                  style={[
                    styles.taskStatusBadge,
                    task.status === 'in-progress' && styles.taskStatusBadgeInProgress,
                    task.status === 'completed' && styles.taskStatusBadgeDone,
                  ]}
                >
                  <Text
                    style={[
                      styles.taskStatusBadgeText,
                      task.status === 'in-progress' && styles.taskStatusBadgeTextInProgress,
                      task.status === 'completed' && styles.taskStatusBadgeTextDone,
                    ]}
                  >
                    {task.status === 'completed'
                      ? t('home.completed')
                      : task.status === 'in-progress'
                        ? t('home.inProgress')
                        : t('home.pending')}
                  </Text>
                </View>
                {isTaskEditMode && (
                  <TouchableOpacity
                    style={styles.taskDeleteButton}
                    onPress={() => {
                      Alert.alert(
                        t('home.deleteTask'),
                        t('home.deleteTaskConfirm'),
                        [
                          { text: t('common.cancel'), style: 'cancel' },
                          {
                            text: t('common.delete'),
                            style: 'destructive',
                            onPress: async () => {
                              await deleteStudyTask(task.id);
                              setTasks(await getTasks());
                            },
                          },
                        ]
                      );
                    }}
                  >
                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
              ))}
            </>
          )}
        </View>

        <View style={styles.journalCard}>
          <Text style={[styles.journalTitle, mirroredTextAlignStyle]}>{t('home.quickActions')}</Text>
          <View style={styles.quickGrid}>
            <TouchableOpacity style={styles.quickTile} onPress={() => router.push('/ai-practice-setup' as any)}>
              <Ionicons name="flask-outline" size={20} color={PRIMARY_GREEN} />
              <Text style={[styles.quickTileText, mirroredTextAlignStyle]}>{t('home.startPractice')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickTile} onPress={() => router.push('/(tabs)/courses')}>
              <Ionicons name="book-outline" size={20} color={PRIMARY_GREEN} />
              <Text style={[styles.quickTileText, mirroredTextAlignStyle]}>{t('home.myCourses')}</Text>
            </TouchableOpacity>
          </View>
          {recentCourses.length > 0 && (
            <TouchableOpacity
              style={styles.lastCourseRow}
              onPress={() => router.push(`/course/${recentCourses[0].id}` as any)}
            >
              <Ionicons name="play-forward-outline" size={16} color={PRIMARY_GREEN} />
              <Text style={[styles.lastCourseText, mirroredTextAlignStyle]}>
                {t('home.continueCourse', { name: recentCourses[0].name })}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <Modal visible={showTaskModal} transparent animationType="slide" onRequestClose={() => setShowTaskModal(false)}>
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
              <View style={styles.modalSimple}>
                <Text style={styles.modalSimpleTitle}>{t('home.addTask')}</Text>
                <TextInput
                  value={taskTitle}
                  onChangeText={setTaskTitle}
                  style={[styles.modalInputSimple, isHebrewUi ? styles.modalInputRtl : styles.modalInputLtr]}
                  placeholder={t('home.taskTitle')}
                  placeholderTextColor="#9ca3af"
                  selectionColor={PRIMARY_GREEN}
                  cursorColor={PRIMARY_GREEN}
                  multiline={false}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <View style={styles.modalActionsSimple}>
                  <TouchableOpacity style={styles.modalCancelSimple} onPress={() => setShowTaskModal(false)}>
                    <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalSaveSimple} onPress={handleAddTask}>
                    <Text style={styles.modalSaveText}>{t('common.save')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
              <View style={styles.modalSimple}>
                <Text style={styles.modalSimpleTitle}>{t('home.editDailyGoal')}</Text>
                <View style={styles.goalInputsRow}>
                  <View style={styles.goalInputBox}>
                    <Text style={styles.goalInputLabel}>{t('home.hours')}</Text>
                    <TextInput
                      value={goalHoursInput}
                      onChangeText={setGoalHoursInput}
                      style={styles.modalInputSimple}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#9ca3af"
                      selectionColor={PRIMARY_GREEN}
                      cursorColor={PRIMARY_GREEN}
                    />
                  </View>
                  <View style={styles.goalInputBox}>
                    <Text style={styles.goalInputLabel}>{t('home.minutes')}</Text>
                    <TextInput
                      value={goalMinutesInput}
                      onChangeText={setGoalMinutesInput}
                      style={styles.modalInputSimple}
                      keyboardType="numeric"
                      placeholder="0-59"
                      placeholderTextColor="#9ca3af"
                      selectionColor={PRIMARY_GREEN}
                      cursorColor={PRIMARY_GREEN}
                    />
                  </View>
                </View>
                <View style={styles.modalActionsSimple}>
                  <TouchableOpacity style={styles.modalCancelSimple} onPress={() => setShowGoalModal(false)}>
                    <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalSaveSimple} onPress={handleSaveDailyGoal}>
                    <Text style={styles.modalSaveText}>{t('common.save')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// Lecturer Home Screen Component
function LecturerHomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { firebaseUser } = useUser();
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

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.appTitle}>{t('home.title')}</Text>
        <Text style={styles.title}>
          {t('home.welcome', { name: loading ? '...' : lecturerName || t('auth.lecturer') })}
        </Text>
        <Text style={styles.subtitle}>
          {t('home.lecturerSubtitle')}
        </Text>

        <View style={styles.cardsWrapper}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('home.createNewCourse')}</Text>
            <Text style={styles.cardText}>
              {t('home.createNewCourseDescription')}
            </Text>
            <TouchableOpacity
              style={[styles.buttonBase, styles.buttonPrimary]}
              onPress={() => router.push('/lecturer/add-course' as any)}
            >
              <Text style={styles.buttonPrimaryText}>{t('home.createCourse')}</Text>
            </TouchableOpacity>
          </View>

          {recentCourses.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('home.recentCourses')}</Text>
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
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('home.myCourses')}</Text>
            <Text style={styles.cardText}>
              {t('home.lecturerCoursesDescription')}
            </Text>
            <TouchableOpacity
              style={[styles.buttonBase, styles.buttonPrimary]}
              onPress={() => router.push('/(tabs)/courses')}
            >
              <Text style={styles.buttonPrimaryText}>{t('home.viewAllCourses')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// Admin Home Screen Component
function AdminHomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
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
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="shield-checkmark" size={36} color="#ffffff" />
          <Text style={styles.headerTitle}>{t('admin.dashboard')}</Text>
          <Text style={styles.headerSubtitle}>
            {t('admin.dashboardSubtitle')}
          </Text>
        </View>

        {/* Statistics Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: '#dbeafe' }]}>
              <Ionicons name="school" size={28} color="#3b82f6" />
            </View>
            <Text style={styles.statNumber}>{loading ? '...' : stats.students}</Text>
            <Text style={styles.statLabel}>{t('admin.students')}</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: '#ffffff' }]}>
              <Ionicons name="person" size={28} color={ACCENT_GREEN} />
            </View>
            <Text style={styles.statNumber}>{loading ? '...' : stats.lecturers}</Text>
            <Text style={styles.statLabel}>{t('admin.lecturers')}</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: '#fee2e2' }]}>
              <Ionicons name="time" size={28} color="#ef4444" />
            </View>
            <Text style={styles.statNumber}>{loading ? '...' : stats.pendingUsers}</Text>
            <Text style={styles.statLabel}>{t('admin.pending')}</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: '#d1fae5' }]}>
              <Ionicons name="book" size={28} color="#047857" />
            </View>
            <Text style={styles.statNumber}>{loading ? '...' : stats.courses}</Text>
            <Text style={styles.statLabel}>{t('admin.courses')}</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.sectionTitle}>{t('admin.quickActions')}</Text>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/admin')}
          >
            <View style={styles.actionCardLeft}>
              <View style={[styles.actionIconContainer, { backgroundColor: '#ffffff' }]}>
                <Ionicons name="checkmark-circle" size={24} color={ACCENT_GREEN} />
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
            <Ionicons name="chevron-forward" size={24} color="#6b7280" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/admin/appeals' as any)}
          >
            <View style={styles.actionCardLeft}>
              <View style={[styles.actionIconContainer, { backgroundColor: '#ffffff' }]}>
                <Ionicons name="chatbubble-ellipses" size={24} color={ACCENT_GREEN} />
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
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{stats.pendingAppeals}</Text>
                </View>
              </View>
            )}
            <Ionicons name="chevron-forward" size={24} color="#6b7280" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/admin/users' as any)}
          >
            <View style={styles.actionCardLeft}>
              <View style={[styles.actionIconContainer, { backgroundColor: '#eff6ff' }]}>
                <Ionicons name="people" size={24} color="#3b82f6" />
              </View>
              <View style={styles.actionCardContent}>
                <Text style={styles.actionCardTitle}>{t('admin.userManagement')}</Text>
                <Text style={styles.actionCardText}>
                  {t('admin.userManagementDescription')}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#6b7280" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/admin/courses' as any)}
          >
            <View style={styles.actionCardLeft}>
              <View style={[styles.actionIconContainer, { backgroundColor: '#f0fdf4' }]}>
                <Ionicons name="library" size={24} color="#047857" />
              </View>
              <View style={styles.actionCardContent}>
                <Text style={styles.actionCardTitle}>{t('admin.courseManagement')}</Text>
                <Text style={styles.actionCardText}>
                  {t('admin.courseManagementDescription')}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {/* System Info */}
        <View style={styles.systemInfoCard}>
          <View style={styles.systemInfoHeader}>
            <Ionicons name="information-circle" size={20} color={ACCENT_GREEN} />
            <Text style={styles.systemInfoTitle}>{t('admin.systemOverview')}</Text>
          </View>
          <View style={styles.systemInfoRow}>
            <Text style={styles.systemInfoLabel}>{t('admin.totalUsers')}:</Text>
            <Text style={styles.systemInfoValue}>
              {loading ? '...' : stats.students + stats.lecturers}
            </Text>
          </View>
          <View style={styles.systemInfoRow}>
            <Text style={styles.systemInfoLabel}>{t('admin.activeUsers')}:</Text>
            <Text style={styles.systemInfoValue}>
              {loading ? '...' : stats.students + stats.lecturers - stats.pendingUsers}
            </Text>
          </View>
        </View>
      </ScrollView>
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
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
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
    padding: 16,
    marginBottom: 14,
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
    color: '#047857',
  },
  journalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  goalLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  goalValue: {
    marginTop: 4,
    fontSize: 14,
    color: '#047857',
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
    fontSize: 13,
    fontWeight: '700',
    color: '#047857',
  },
  goalSubtext: {
    marginTop: 4,
    fontSize: 12,
    color: '#6b7280',
  },
  progressRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#047857',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  statTiny: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  statTinyValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  statTinyLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  timerDisplayBox: {
    borderWidth: 2,
    borderColor: '#047857',
    borderRadius: 14,
    paddingVertical: 20,
    alignItems: 'center',
  },
  timerText: {
    fontSize: 52,
    fontWeight: '700',
    color: '#047857',
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
    backgroundColor: '#047857',
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
  taskHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
    color: '#047857',
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
    color: '#047857',
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
    backgroundColor: '#047857',
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
  header: {
    backgroundColor: PRIMARY_GREEN,
    paddingTop: 60,
    paddingBottom: 30,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: -30,
    marginHorizontal: -24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 24,
    gap: 12,
  },
  statCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    width: '48%',
    borderWidth: 1,
    borderColor: '#374151',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  statIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
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
  actionCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
    backgroundColor: '#ef4444',
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
    borderColor: '#374151',
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
  systemInfoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 8,
  },
  systemInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
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

