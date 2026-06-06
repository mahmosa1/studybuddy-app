import { AppHeader } from '@/frontend/components/ui/AppHeader';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { layout, radius, spacing, typography } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { auth, db } from '@/lib/firebaseConfig';
import {
  createTask,
  deleteTask,
  getTasks,
  StudyTask,
  TaskStatus,
  updateTask,
  updateTaskStatus,
} from '@/lib/studyJournalService';
import {
  categorizeTasks,
  dateToInputs,
  formatMonthYear,
  formatTaskDate,
  getDatesWithTasks,
  getJournalStats,
  getMonthCalendarWeeks,
  getPriorityAccentColor,
  getStatusLabelKey,
  getStatusVisualStyle,
  getTasksForDate,
  groupTasksForSchedule,
  isTaskOverdue,
  JournalTab,
  parseDateInputs,
  startOfDay,
} from '@/lib/taskUtils';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { collection, getDocs, query, where } from 'firebase/firestore';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type CourseOption = { id: string; name: string };

type TaskFormState = {
  title: string;
  courseId: string;
  courseName: string;
  hasDueDate: boolean;
  day: string;
  month: string;
  year: string;
  priority: 'low' | 'medium' | 'high';
};

const EMPTY_FORM: TaskFormState = {
  title: '',
  courseId: '',
  courseName: '',
  hasDueDate: true,
  day: '',
  month: '',
  year: '',
  priority: 'medium',
};

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function JournalStatsStrip({
  active,
  dueToday,
  done,
  isRtl,
}: {
  active: number;
  dueToday: number;
  done: number;
  isRtl: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const items = [
    { value: active, label: t('home.statActiveTasks'), color: colors.primary },
    { value: dueToday, label: t('home.statDueToday'), color: colors.warning },
    { value: done, label: t('home.statDoneTasks'), color: colors.success },
  ];

  return (
    <View style={[styles.statsStrip, { backgroundColor: colors.surface, borderColor: colors.border }, isRtl && styles.rtlRow]}>
      {items.map((item, index) => (
        <React.Fragment key={item.label}>
          {index > 0 ? <View style={[styles.statsDivider, { backgroundColor: colors.border }]} /> : null}
          <View style={styles.statsStripItem}>
            <Text style={[styles.statsStripValue, { color: item.color }]}>{item.value}</Text>
            <Text style={[styles.statsStripLabel, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.label}
            </Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

const STATUS_OPTIONS: TaskStatus[] = ['pending', 'in-progress', 'completed'];

function getStatusIcon(status: TaskStatus): keyof typeof Ionicons.glyphMap {
  if (status === 'completed') return 'checkmark';
  if (status === 'in-progress') return 'play';
  return 'time-outline';
}

function StatusBadge({ status, isRtl }: { status: TaskStatus; isRtl: boolean }) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const visual = getStatusVisualStyle(status, colors);

  return (
    <View
      style={[
        styles.statusBadge,
        { backgroundColor: visual.background, borderColor: visual.border },
        isRtl && styles.rtlRow,
      ]}
    >
      <View style={[styles.statusBadgeDot, { backgroundColor: visual.accent }]} />
      <Text style={[styles.statusBadgeText, { color: visual.accent }]}>{t(getStatusLabelKey(status))}</Text>
    </View>
  );
}

function SectionHeader({
  title,
  count,
  accentColor,
  isRtl,
}: {
  title: string;
  count: number;
  accentColor: string;
  isRtl: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.sectionHeader, isRtl ? styles.sectionHeaderRtl : styles.sectionHeaderLtr]}>
      <View style={[styles.sectionHeaderGroup, isRtl && styles.rtlRow]}>
        <View style={[styles.sectionAccent, { backgroundColor: accentColor }]} />
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.textSecondary },
            isRtl && styles.rtlText,
          ]}
        >
          {title}
        </Text>
        <Text style={[styles.sectionCount, { color: colors.textSecondary }]}>{count}</Text>
      </View>
    </View>
  );
}

function TaskCard({
  task,
  isRtl,
  onPress,
  onEdit,
}: {
  task: StudyTask;
  isRtl: boolean;
  onPress: () => void;
  onEdit: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const overdue = isTaskOverdue(task);
  const dateLabel = formatTaskDate(task.dueDate, i18n.language, t('home.noDeadline'));
  const metaParts = [overdue ? t('home.overdue') : dateLabel, task.courseName || null].filter(Boolean);
  const statusVisual = getStatusVisualStyle(task.status, colors);

  return (
    <TouchableOpacity
      style={[styles.taskCard, isRtl && styles.rtlRow]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={[styles.taskPriorityDot, { backgroundColor: statusVisual.accent }]} />
      <View style={styles.taskBody}>
        <Text
          style={[
            styles.taskTitle,
            { color: colors.textPrimary },
            task.status === 'completed' && styles.taskTitleDone,
            isRtl && styles.rtlText,
          ]}
          numberOfLines={1}
        >
          {task.title}
        </Text>
        <View style={[styles.taskMetaRow, isRtl && styles.rtlRow]}>
          {metaParts.length > 0 ? (
            <Text
              style={[
                styles.taskMetaLine,
                { color: overdue ? colors.danger : colors.textSecondary },
                isRtl && styles.rtlText,
              ]}
              numberOfLines={1}
            >
              {metaParts.join('  ·  ')}
            </Text>
          ) : null}
          <StatusBadge status={task.status} isRtl={isRtl} />
        </View>
      </View>
      <TouchableOpacity onPress={onEdit} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function TasksJournalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ add?: string; tab?: string }>();
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const isRtl = i18n.language === 'he';

  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<JournalTab>('schedule');
  const [calendarMonth, setCalendarMonth] = useState(() => startOfDay(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [showModal, setShowModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusTask, setStatusTask] = useState<StudyTask | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [form, setForm] = useState<TaskFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const routeParamsHandled = useRef(false);

  const openAddModal = useCallback(() => {
    const defaults = dateToInputs(selectedDate);
    setEditingTaskId(null);
    setForm({
      ...EMPTY_FORM,
      day: defaults.day,
      month: defaults.month,
      year: defaults.year,
    });
    setShowModal(true);
  }, [selectedDate]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [taskList, coursesSnap] = await Promise.all([
        getTasks(),
        (async () => {
          const user = auth.currentUser;
          if (!user) return [];
          const snap = await getDocs(query(collection(db, 'courses'), where('ownerUid', '==', user.uid)));
          return snap.docs.map((docSnap) => ({
            id: docSnap.id,
            name: docSnap.data().name || 'Course',
          }));
        })(),
      ]);
      setTasks(taskList);
      setCourses(coursesSnap);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData();

      if (routeParamsHandled.current) return;
      routeParamsHandled.current = true;

      const tab = params.tab;
      if (tab === 'calendar' || tab === 'schedule' || tab === 'tasks') {
        setActiveTab(tab);
      }
      if (params.add === '1') {
        const defaults = dateToInputs(new Date());
        setEditingTaskId(null);
        setForm({
          ...EMPTY_FORM,
          day: defaults.day,
          month: defaults.month,
          year: defaults.year,
        });
        setShowModal(true);
      }
    }, [loadData, params.add, params.tab]),
  );

  const stats = useMemo(() => getJournalStats(tasks), [tasks]);
  const { upcoming, todo, done } = categorizeTasks(tasks);
  const scheduleGroups = useMemo(() => groupTasksForSchedule(tasks.filter((task) => task.status !== 'completed')), [tasks]);
  const selectedDayTasks = useMemo(() => getTasksForDate(tasks, selectedDate), [tasks, selectedDate]);
  const calendarWeeks = useMemo(
    () => getMonthCalendarWeeks(calendarMonth.getFullYear(), calendarMonth.getMonth()),
    [calendarMonth],
  );
  const datesWithTasks = useMemo(
    () => getDatesWithTasks(tasks, calendarMonth.getFullYear(), calendarMonth.getMonth()),
    [tasks, calendarMonth],
  );
  const openEditModal = (task: StudyTask) => {
    const inputs = dateToInputs(task.dueDate);
    setEditingTaskId(task.id);
    setForm({
      title: task.title,
      courseId: task.courseId || '',
      courseName: task.courseName || '',
      hasDueDate: task.dueDate instanceof Date,
      day: inputs.day,
      month: inputs.month,
      year: inputs.year,
      priority: task.priority || 'medium',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingTaskId(null);
    setForm(EMPTY_FORM);
  };

  const handleSaveTask = async () => {
    if (!form.title.trim()) {
      Alert.alert(t('common.error'), t('home.taskTitleRequired'));
      return;
    }

    let dueDate: Date | null = null;
    if (form.hasDueDate) {
      const parsed = parseDateInputs(form.day, form.month, form.year);
      if (!parsed) {
        Alert.alert(t('common.error'), t('home.invalidDueDate'));
        return;
      }
      dueDate = parsed;
    }

    setSaving(true);
    try {
      if (editingTaskId) {
        await updateTask(editingTaskId, {
          title: form.title.trim(),
          courseId: form.courseId || null,
          courseName: form.courseName || null,
          dueDate,
          priority: form.priority,
        });
      } else {
        await createTask(
          form.title.trim(),
          undefined,
          form.courseId || undefined,
          form.courseName || undefined,
          dueDate || undefined,
          form.priority,
        );
      }
      closeModal();
      setTasks(await getTasks());
    } catch {
      Alert.alert(t('common.error'), editingTaskId ? t('home.failedToUpdateTask') : t('home.failedToCreateTask'));
    } finally {
      setSaving(false);
    }
  };

  const openStatusPicker = (task: StudyTask) => {
    setStatusTask(task);
    setShowStatusModal(true);
  };

  const closeStatusPicker = () => {
    setShowStatusModal(false);
    setStatusTask(null);
  };

  const handleSelectStatus = async (status: TaskStatus) => {
    if (!statusTask || statusSaving) return;
    if (statusTask.status === status) {
      closeStatusPicker();
      return;
    }
    setStatusSaving(true);
    try {
      await updateTaskStatus(statusTask.id, status);
      setTasks(await getTasks());
      closeStatusPicker();
    } catch {
      Alert.alert(t('common.error'), t('home.failedToUpdateTask'));
    } finally {
      setStatusSaving(false);
    }
  };

  const handleCalendarDayPress = (day: Date) => {
    setSelectedDate(startOfDay(day));
  };

  const handleDeleteTask = () => {
    if (!editingTaskId) return;
    Alert.alert(t('home.deleteTask'), t('home.deleteTaskConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteTask(editingTaskId);
            closeModal();
            setTasks(await getTasks());
          } catch {
            Alert.alert(t('common.error'), t('home.failedToDeleteTask'));
          }
        },
      },
    ]);
  };

  const selectCourse = (course: CourseOption | null) => {
    if (!course) {
      setForm((prev) => ({ ...prev, courseId: '', courseName: '' }));
      return;
    }
    setForm((prev) => ({ ...prev, courseId: course.id, courseName: course.name }));
  };

  const shiftCalendarMonth = (delta: number) => {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const renderScheduleSection = (title: string, items: StudyTask[], accent: string) => {
    if (items.length === 0) return null;
    return (
      <View style={styles.scheduleSection}>
        <SectionHeader title={title} count={items.length} accentColor={accent} isRtl={isRtl} />
        <View style={[styles.taskListCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {items.map((task, index) => (
            <View key={task.id}>
              {index > 0 ? <View style={[styles.taskDivider, { backgroundColor: colors.border }]} /> : null}
              <TaskCard
                task={task}
                isRtl={isRtl}
                onPress={() => openStatusPicker(task)}
                onEdit={() => openEditModal(task)}
              />
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderTaskList = (items: StudyTask[]) => (
    <View style={[styles.taskListCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {items.map((task, index) => (
        <View key={task.id}>
          {index > 0 ? <View style={[styles.taskDivider, { backgroundColor: colors.border }]} /> : null}
          <TaskCard
            task={task}
            isRtl={isRtl}
            onPress={() => openStatusPicker(task)}
            onEdit={() => openEditModal(task)}
          />
        </View>
      ))}
    </View>
  );

  const tabs: { id: JournalTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'calendar', label: t('home.journalTabCalendar'), icon: 'calendar-outline' },
    { id: 'schedule', label: t('home.journalTabSchedule'), icon: 'time-outline' },
    { id: 'tasks', label: t('home.journalTabTasks'), icon: 'list-outline' },
  ];

  return (
    <AppScreen>
      <AppHeader title={t('home.myTasks')} onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <JournalStatsStrip active={stats.active} dueToday={stats.dueToday} done={stats.done} isRtl={isRtl} />

        <View style={[styles.tabBar, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
          {tabs.map((tab) => {
            const selected = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.tabButton,
                  selected && { backgroundColor: colors.surface },
                ]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Ionicons name={tab.icon} size={16} color={selected ? colors.primary : colors.textSecondary} />
                <Text style={[styles.tabButtonText, { color: selected ? colors.primary : colors.textSecondary }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : activeTab === 'calendar' ? (
          <View style={[styles.calendarCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.calendarHeader, isRtl && styles.rtlRow]}>
              <TouchableOpacity onPress={() => shiftCalendarMonth(isRtl ? 1 : -1)} style={styles.calendarNavBtn}>
                <Ionicons name={isRtl ? 'chevron-forward' : 'chevron-back'} size={20} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={[styles.calendarMonthLabel, { color: colors.textPrimary }]}>
                {formatMonthYear(calendarMonth, i18n.language)}
              </Text>
              <TouchableOpacity onPress={() => shiftCalendarMonth(isRtl ? -1 : 1)} style={styles.calendarNavBtn}>
                <Ionicons name={isRtl ? 'chevron-back' : 'chevron-forward'} size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={[styles.weekdayRow, isRtl && styles.rtlRow]}>
              {WEEKDAY_KEYS.map((key) => (
                <Text key={key} style={[styles.weekdayLabel, { color: colors.textSecondary }]}>
                  {t(`home.weekday${key.charAt(0).toUpperCase()}${key.slice(1)}`)}
                </Text>
              ))}
            </View>

            {calendarWeeks.map((week, weekIndex) => (
              <View key={`week-${weekIndex}`} style={[styles.weekRow, isRtl && styles.rtlRow]}>
                {week.map((day, dayIndex) => {
                  if (!day) {
                    return <View key={`empty-${weekIndex}-${dayIndex}`} style={styles.dayCell} />;
                  }
                  const key = `${day.getFullYear()}-${day.getMonth() + 1}-${day.getDate()}`;
                  const hasTasks = datesWithTasks.has(key);
                  const selected = selectedDate.getTime() === startOfDay(day).getTime();
                  const isToday = startOfDay(new Date()).getTime() === startOfDay(day).getTime();
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[
                        styles.dayCell,
                        selected && { backgroundColor: colors.primary, borderColor: colors.primary },
                        !selected && isToday && { borderColor: colors.primary, borderWidth: 1 },
                      ]}
                      onPress={() => handleCalendarDayPress(day)}
                    >
                      <Text
                        style={[
                          styles.dayNumber,
                          { color: selected ? colors.textOnPrimary : colors.textPrimary },
                        ]}
                      >
                        {day.getDate()}
                      </Text>
                      {hasTasks ? (
                        <View
                          style={[
                            styles.dayDot,
                            { backgroundColor: selected ? colors.textOnPrimary : colors.primary },
                          ]}
                        />
                      ) : (
                        <View style={styles.dayDotPlaceholder} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            <SectionHeader
              title={t('home.scheduleSelectedDate', {
                date: formatTaskDate(selectedDate, i18n.language, ''),
              })}
              count={selectedDayTasks.length}
              accentColor={colors.primary}
              isRtl={isRtl}
            />
            {selectedDayTasks.length === 0 ? (
              <Text style={[styles.emptySectionText, { color: colors.textSecondary }, isRtl && styles.rtlText]}>
                {t('home.noTasksOnDate')}
              </Text>
            ) : (
              renderTaskList(selectedDayTasks)
            )}
          </View>
        ) : activeTab === 'schedule' ? (
          <View>
            {renderScheduleSection(t('home.scheduleToday'), scheduleGroups.today, colors.warning)}
            {renderScheduleSection(t('home.scheduleNoDate'), scheduleGroups.noDate, colors.success)}
            {scheduleGroups.today.length === 0 && scheduleGroups.noDate.length === 0 ? (
              <Text style={[styles.emptySectionText, { color: colors.textSecondary }, isRtl && styles.rtlText]}>
                {t('home.noScheduleTasks')}
              </Text>
            ) : null}
          </View>
        ) : (
          <View>
            <SectionHeader
              title={t('home.upcomingAssignments')}
              count={upcoming.length}
              accentColor={colors.primary}
              isRtl={isRtl}
            />
            {upcoming.length === 0 ? (
              <Text style={[styles.emptySectionText, { color: colors.textSecondary }, isRtl && styles.rtlText]}>
                {t('home.noUpcomingTasks')}
              </Text>
            ) : (
              renderTaskList(upcoming)
            )}

            <SectionHeader
              title={t('home.todoTasks')}
              count={todo.length}
              accentColor={colors.success}
              isRtl={isRtl}
            />
            {todo.length === 0 ? (
              <Text style={[styles.emptySectionText, { color: colors.textSecondary }, isRtl && styles.rtlText]}>
                {t('home.noTodoTasks')}
              </Text>
            ) : (
              renderTaskList(todo)
            )}

            {done.length > 0 ? (
              <>
                <SectionHeader
                  title={t('home.completedTasks')}
                  count={done.length}
                  accentColor={colors.textSecondary}
                  isRtl={isRtl}
                />
                {renderTaskList(done)}
              </>
            ) : null}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={openAddModal}
        activeOpacity={0.9}
      >
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>

      <Modal visible={showStatusModal} transparent animationType="slide" onRequestClose={closeStatusPicker}>
        <Pressable style={styles.statusModalOverlay} onPress={closeStatusPicker}>
          <Pressable
            style={[styles.statusModalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.statusModalHandle, { backgroundColor: colors.border }]} />

            <Text style={[styles.statusModalTitle, { color: colors.textPrimary }, isRtl && styles.rtlText]}>
              {t('home.changeTaskStatus')}
            </Text>

            <View style={[styles.statusPickerGrid, isRtl && styles.rtlRow]}>
              {STATUS_OPTIONS.map((status) => {
                const selected = statusTask?.status === status;
                const visual = getStatusVisualStyle(status, colors);
                return (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.statusPickerCard,
                      {
                        borderColor: selected ? visual.accent : colors.border,
                        backgroundColor: selected ? visual.background : colors.surfaceElevated,
                      },
                      selected && styles.statusPickerCardSelected,
                    ]}
                    onPress={() => void handleSelectStatus(status)}
                    disabled={statusSaving}
                    activeOpacity={0.85}
                  >
                    {selected ? (
                      <View
                        style={[
                          styles.statusPickerCheck,
                          { backgroundColor: visual.accent },
                          isRtl ? styles.statusPickerCheckRtl : styles.statusPickerCheckLtr,
                        ]}
                      >
                        <Ionicons name="checkmark" size={11} color="#fff" />
                      </View>
                    ) : null}
                    <Ionicons name={getStatusIcon(status)} size={28} color={visual.accent} style={styles.statusPickerIcon} />
                    <Text
                      style={[
                        styles.statusPickerLabel,
                        { color: selected ? visual.accent : colors.textPrimary },
                        isRtl && styles.rtlText,
                      ]}
                    >
                      {t(getStatusLabelKey(status))}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {statusSaving ? (
              <ActivityIndicator color={colors.primary} style={styles.statusModalLoader} />
            ) : null}

            <TouchableOpacity
              style={[styles.statusCancelBtn, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
              onPress={closeStatusPicker}
            >
              <Text style={[styles.statusCancelText, { color: colors.textSecondary }]}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showModal} transparent animationType="slide" onRequestClose={closeModal}>
        <KeyboardAvoidingView
          style={styles.modalKeyboardWrapper}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 6 : 0}
        >
          <Pressable style={styles.modalOverlay} onPress={closeModal}>
            <Pressable
              style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={(e) => e.stopPropagation()}
            >
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalScrollContent}
              >
                <Text style={[styles.modalTitle, { color: colors.textPrimary }, isRtl && styles.rtlText]}>
                  {editingTaskId ? t('home.editTask') : t('home.addTask')}
                </Text>

                <Text style={[styles.fieldLabel, styles.fieldLabelFirst, { color: colors.textSecondary }, isRtl && styles.rtlText]}>
                  {t('home.taskTitle')}
                </Text>
                <TextInput
                  value={form.title}
                  onChangeText={(value) => setForm((prev) => ({ ...prev, title: value }))}
                  style={[
                    styles.input,
                    { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surfaceElevated },
                    isRtl && styles.inputRtl,
                  ]}
                  placeholder={t('home.taskTitle')}
                  placeholderTextColor={colors.textSecondary}
                />

                <Text style={[styles.fieldLabel, { color: colors.textSecondary }, isRtl && styles.rtlText]}>
                  {t('home.selectCourse')}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.courseChipsRow}>
                  <TouchableOpacity
                    style={[
                      styles.courseChip,
                      { borderColor: colors.border, backgroundColor: !form.courseId ? colors.primary : colors.chipBg },
                    ]}
                    onPress={() => selectCourse(null)}
                  >
                    <Text style={[styles.courseChipText, { color: !form.courseId ? colors.textOnPrimary : colors.textPrimary }]}>
                      {t('home.noCourse')}
                    </Text>
                  </TouchableOpacity>
                  {courses.map((course) => {
                    const selected = form.courseId === course.id;
                    return (
                      <TouchableOpacity
                        key={course.id}
                        style={[
                          styles.courseChip,
                          { borderColor: colors.border, backgroundColor: selected ? colors.primary : colors.chipBg },
                        ]}
                        onPress={() => selectCourse(course)}
                      >
                        <Text
                          style={[styles.courseChipText, { color: selected ? colors.textOnPrimary : colors.textPrimary }]}
                          numberOfLines={1}
                        >
                          {course.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <View style={[styles.switchRow, isRtl && styles.rtlRow]}>
                  <Text style={[styles.fieldLabel, styles.switchLabel, { color: colors.textSecondary }, isRtl && styles.rtlText]}>
                    {t('home.setDueDate')}
                  </Text>
                  <Switch
                    value={form.hasDueDate}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, hasDueDate: value }))}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor="#fff"
                  />
                </View>

                {form.hasDueDate ? (
                  <View style={styles.dateInputsRow}>
                    {(['day', 'month', 'year'] as const).map((part) => (
                      <View key={part} style={styles.dateInputBox}>
                        <Text style={[styles.dateInputLabel, { color: colors.textSecondary }]}>
                          {t(`home.${part}`)}
                        </Text>
                        <TextInput
                          value={form[part]}
                          onChangeText={(value) => setForm((prev) => ({ ...prev, [part]: value }))}
                          style={[
                            styles.input,
                            styles.dateInput,
                            { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surfaceElevated },
                          ]}
                          keyboardType="numeric"
                          placeholderTextColor={colors.textSecondary}
                        />
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={[styles.noDeadlineBadge, { backgroundColor: colors.chipBg }]}>
                    <Ionicons name="infinite" size={14} color={colors.textSecondary} />
                    <Text style={[styles.noDeadlineText, { color: colors.textSecondary }]}>{t('home.noDeadline')}</Text>
                  </View>
                )}

                <Text style={[styles.fieldLabel, { color: colors.textSecondary }, isRtl && styles.rtlText]}>
                  {t('home.priority')}
                </Text>
                <View style={[styles.priorityRow, isRtl && styles.rtlRow]}>
                  {(['low', 'medium', 'high'] as const).map((level) => {
                    const selected = form.priority === level;
                    const accent = getPriorityAccentColor(level, colors);
                    return (
                      <TouchableOpacity
                        key={level}
                        style={[
                          styles.priorityChip,
                          { borderColor: selected ? accent : colors.border, backgroundColor: selected ? `${accent}22` : colors.chipBg },
                        ]}
                        onPress={() => setForm((prev) => ({ ...prev, priority: level }))}
                      >
                        <View style={[styles.priorityDot, { backgroundColor: accent }]} />
                        <Text style={[styles.priorityChipText, { color: colors.textPrimary }]}>
                          {t(`home.priority${level.charAt(0).toUpperCase()}${level.slice(1)}`)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={[styles.modalActions, isRtl && styles.rtlRow]}>
                  {editingTaskId ? (
                    <TouchableOpacity
                      style={[styles.deleteAction, { borderColor: colors.dangerBorder, backgroundColor: colors.dangerSurface }]}
                      onPress={handleDeleteTask}
                    >
                      <Text style={[styles.deleteActionText, { color: colors.danger }]}>{t('common.delete')}</Text>
                    </TouchableOpacity>
                  ) : (
                    <View />
                  )}
                  <View style={[styles.modalActionsRight, isRtl && styles.rtlRow]}>
                    <TouchableOpacity
                      style={[styles.cancelAction, { backgroundColor: colors.surfaceElevated }]}
                      onPress={closeModal}
                    >
                      <Text style={[styles.cancelActionText, { color: colors.textPrimary }]}>{t('common.cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.saveAction, { backgroundColor: colors.primary }]}
                      onPress={() => void handleSaveTask()}
                      disabled={saving}
                    >
                      {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveActionText}>{t('common.save')}</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: 96,
  },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  statsStripItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  statsStripValue: {
    fontSize: 19,
    fontWeight: '800',
  },
  statsStripLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  statsDivider: {
    width: 1,
    height: 32,
  },
  tabBar: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radius.pill,
    padding: 3,
    marginBottom: spacing.md,
    gap: 2,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.pill,
    paddingVertical: 10,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  loader: { marginTop: spacing.xl },
  calendarCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  calendarNavBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarMonthLabel: {
    ...typography.h3,
    fontSize: 16,
  },
  calendarHint: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
  },
  statusBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  taskMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  statusModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  statusModalSheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  statusModalHandle: {
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  statusModalTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  statusPickerGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statusPickerCard: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xs,
    gap: spacing.sm,
    position: 'relative',
  },
  statusPickerCardSelected: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statusPickerCheck: {
    position: 'absolute',
    top: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPickerCheckLtr: { right: 8 },
  statusPickerCheckRtl: { left: 8 },
  statusPickerIcon: {
    height: 32,
  },
  statusPickerLabel: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  statusModalLoader: {
    marginBottom: spacing.sm,
  },
  statusCancelBtn: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  statusCancelText: {
    fontWeight: '600',
    fontSize: 14,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    margin: 2,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayNumber: {
    fontSize: 13,
    fontWeight: '700',
  },
  dayDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 2,
  },
  dayDotPlaceholder: {
    width: 5,
    height: 5,
    marginTop: 2,
  },
  scheduleSection: {
    marginBottom: spacing.sm,
  },
  sectionHeader: {
    width: '100%',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    paddingHorizontal: 2,
  },
  sectionHeaderLtr: {
    alignItems: 'flex-start',
  },
  sectionHeaderRtl: {
    alignItems: 'flex-end',
  },
  sectionHeaderGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionAccent: {
    width: 3,
    height: 16,
    borderRadius: radius.pill,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: '600',
  },
  taskListCard: {
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  taskDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.md,
  },
  emptySectionText: {
    ...typography.body,
    fontSize: 15,
    marginBottom: spacing.sm,
    width: '100%',
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    minHeight: 54,
  },
  taskPriorityDot: {
    width: 3,
    height: 30,
    borderRadius: 2,
    flexShrink: 0,
  },
  taskBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  taskTitleDone: { textDecorationLine: 'line-through', opacity: 0.5 },
  taskMetaLine: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  modalKeyboardWrapper: { flex: 1, justifyContent: 'flex-end' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    maxHeight: '92%',
    minHeight: '72%',
  },
  modalScrollContent: {
    paddingBottom: spacing.sm,
  },
  modalTitle: { ...typography.h3, fontSize: 19, marginBottom: spacing.sm },
  fieldLabel: { ...typography.caption, fontSize: 13, fontWeight: '700', marginBottom: spacing.xs, marginTop: spacing.sm },
  fieldLabelFirst: { marginTop: 0 },
  input: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
  },
  inputRtl: { textAlign: 'right', writingDirection: 'rtl' },
  courseChipsRow: { gap: spacing.sm, paddingVertical: spacing.xs },
  courseChip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxWidth: 180,
  },
  courseChipText: { fontSize: 14, fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  switchLabel: { marginBottom: 0, flex: 1 },
  dateInputsRow: { flexDirection: 'row', gap: spacing.sm },
  dateInputBox: { flex: 1 },
  dateInputLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  dateInput: { textAlign: 'center' },
  noDeadlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  noDeadlineText: { fontSize: 13, fontWeight: '600' },
  priorityRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  priorityChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
  },
  priorityDot: { width: 8, height: 8, borderRadius: 4 },
  priorityChipText: { fontSize: 13, fontWeight: '700' },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  modalActionsRight: { flexDirection: 'row', gap: spacing.sm },
  deleteAction: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  deleteActionText: { fontWeight: '700', fontSize: 13 },
  cancelAction: { borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  cancelActionText: { fontWeight: '600', fontSize: 13 },
  saveAction: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minWidth: 72,
    alignItems: 'center',
  },
  saveActionText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  rtlRow: { flexDirection: 'row-reverse' },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
});
