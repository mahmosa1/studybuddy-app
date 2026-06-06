import { CircularTimerRing } from '@/frontend/components/study/CircularTimerRing';
import {
  formatTimerCountdown,
  getTimerFabBottom,
  StudyTimerPhase,
  StudyTimerSession,
  TIMER_FAB_RIGHT,
  TIMER_FAB_SIZE,
  TIMER_RING_SIZE,
} from '@/frontend/components/study/timerFabConstants';
import { layout, radius, spacing, typography } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { getTasks, saveStudySession, StudyTask } from '@/lib/studyJournalService';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { usePathname, useSegments } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  BackHandler,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type PresetId = 'pomodoro' | 'focus15' | 'deep45' | 'custom';
type TimerPhase = StudyTimerPhase;

const PRESETS: { id: PresetId; minutes: number; labelKey: string }[] = [
  { id: 'pomodoro', minutes: 25, labelKey: 'timer.pomodoro' },
  { id: 'focus15', minutes: 15, labelKey: 'timer.shortFocus' },
  { id: 'deep45', minutes: 45, labelKey: 'timer.deepFocus' },
  { id: 'custom', minutes: 30, labelKey: 'timer.custom' },
];

type StudyTimerModalProps = {
  visible: boolean;
  onClose: () => void;
  syncTimerSession: (session: StudyTimerSession) => void;
  onSessionSaved: () => void;
};

export function StudyTimerModal({ visible, onClose, syncTimerSession, onSessionSaved }: StudyTimerModalProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const segments = useSegments();
  const isRtl = i18n.language === 'he';

  const [mounted, setMounted] = useState(false);
  const closeGeneration = useRef(0);
  const openProgress = useSharedValue(0);
  const fabBottom = getTimerFabBottom(pathname, segments);
  const fabCenterX = SCREEN_WIDTH - TIMER_FAB_RIGHT - TIMER_FAB_SIZE / 2;
  const fabCenterY = SCREEN_HEIGHT - fabBottom - TIMER_FAB_SIZE / 2;

  const [tasks, setTasks] = useState<StudyTask[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<PresetId>('pomodoro');
  const [customMinutes, setCustomMinutes] = useState(30);
  const [selectedTask, setSelectedTask] = useState<StudyTask | null>(null);
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [taskDropdownLayout, setTaskDropdownLayout] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const taskSelectorRef = useRef<View>(null);
  const [phase, setPhase] = useState<TimerPhase>('setup');
  const [totalSeconds, setTotalSeconds] = useState(25 * 60);
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60);
  const [saving, setSaving] = useState(false);
  const completedHandled = useRef(false);

  const activeTasks = useMemo(
    () => tasks.filter((task) => task.status !== 'completed'),
    [tasks],
  );

  const selectedMinutes = useMemo(() => {
    if (selectedPreset === 'custom') return customMinutes;
    return PRESETS.find((preset) => preset.id === selectedPreset)?.minutes ?? 25;
  }, [customMinutes, selectedPreset]);

  const progress = totalSeconds > 0 ? (totalSeconds - remainingSeconds) / totalSeconds : 0;
  const isLocked = phase === 'running' || phase === 'paused';

  useEffect(() => {
    syncTimerSession({ phase, remainingSeconds, totalSeconds });
  }, [phase, remainingSeconds, syncTimerSession, totalSeconds]);

  const loadTasks = useCallback(async () => {
    try {
      const loaded = await getTasks();
      setTasks(loaded);
    } catch {
      setTasks([]);
    }
  }, []);

  const finishCloseIfCurrent = useCallback((generation: number) => {
    if (generation === closeGeneration.current) {
      setMounted(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      void loadTasks();
    }
  }, [loadTasks, visible]);

  const closeTaskPicker = useCallback(() => {
    setShowTaskPicker(false);
    setTaskDropdownLayout(null);
  }, []);

  const openTaskPicker = useCallback(() => {
    if (isLocked) return;
    taskSelectorRef.current?.measureInWindow((x, y, width, height) => {
      const top = y + height + 6;
      const maxHeight = Math.max(140, SCREEN_HEIGHT - top - insets.bottom - 20);
      setTaskDropdownLayout({ top, left: x, width, maxHeight });
      setShowTaskPicker(true);
    });
  }, [insets.bottom, isLocked]);

  useEffect(() => {
    if (!visible) {
      closeTaskPicker();
    }
  }, [closeTaskPicker, visible]);

  useEffect(() => {
    if (visible) {
      closeGeneration.current += 1;
      cancelAnimation(openProgress);
      setMounted(true);
      openProgress.value = 0;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      openProgress.value = withSpring(1, { damping: 14, stiffness: 95, mass: 0.9 });
      return;
    }

    if (!mounted) return;

    const generation = closeGeneration.current;
    cancelAnimation(openProgress);
    openProgress.value = withTiming(0, { duration: 260 }, (finished) => {
      if (finished) {
        runOnJS(finishCloseIfCurrent)(generation);
      }
    });
  }, [finishCloseIfCurrent, mounted, openProgress, visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(openProgress.value, [0, 1], [0, 0.55], Extrapolation.CLAMP),
  }));

  const sheetStyle = useAnimatedStyle(() => {
    const progress = openProgress.value;
    const scale = interpolate(progress, [0, 1], [0.1, 1], Extrapolation.CLAMP);
    const sheetHeight = SCREEN_HEIGHT - insets.top - insets.bottom - 24;
    const originX = fabCenterX - SCREEN_WIDTH / 2;
    const originY = fabCenterY - (insets.top + 8 + sheetHeight / 2);
    return {
      opacity: interpolate(progress, [0, 0.14, 1], [0, 1, 1], Extrapolation.CLAMP),
      borderRadius: interpolate(progress, [0, 1], [TIMER_FAB_SIZE / 2, 28], Extrapolation.CLAMP),
      transform: [
        { translateX: interpolate(progress, [0, 1], [originX, 0], Extrapolation.CLAMP) },
        { translateY: interpolate(progress, [0, 1], [originY, 0], Extrapolation.CLAMP) },
        { scale },
      ],
    };
  });

  const revealStyle = useAnimatedStyle(() => ({
    opacity: interpolate(openProgress.value, [0.5, 1], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(openProgress.value, [0.5, 1], [12, 0], Extrapolation.CLAMP),
      },
    ],
  }));

  const applyDuration = useCallback((minutes: number) => {
    const seconds = minutes * 60;
    setTotalSeconds(seconds);
    setRemainingSeconds(seconds);
    setPhase('setup');
    completedHandled.current = false;
  }, []);

  useEffect(() => {
    if (!isLocked) {
      applyDuration(selectedMinutes);
    }
  }, [applyDuration, isLocked, selectedMinutes]);

  const persistSession = useCallback(
    async (elapsedSeconds: number) => {
      if (elapsedSeconds < 5) {
        Alert.alert(t('home.timerStopped'), t('home.timerTooShort'));
        return;
      }
      setSaving(true);
      try {
        await saveStudySession(
          elapsedSeconds,
          selectedTask?.courseId,
          selectedTask?.courseName,
          selectedTask?.title,
        );
        onSessionSaved();
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          t('common.success'),
          t('home.timerSaved', { minutes: Math.max(1, Math.round(elapsedSeconds / 60)) }),
        );
      } catch {
        Alert.alert(t('common.error'), t('timer.saveFailed'));
      } finally {
        setSaving(false);
      }
    },
    [onSessionSaved, selectedTask, t],
  );

  const handleComplete = useCallback(async () => {
    if (completedHandled.current) return;
    completedHandled.current = true;
    setPhase('finished');
    await persistSession(totalSeconds);
    applyDuration(selectedMinutes);
  }, [applyDuration, persistSession, selectedMinutes, totalSeconds]);

  useEffect(() => {
    if (phase !== 'running') return;
    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          void handleComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [handleComplete, phase]);

  const handleStart = async () => {
    if (phase === 'finished' || remainingSeconds <= 0) {
      applyDuration(selectedMinutes);
    }
    completedHandled.current = false;
    setPhase('running');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handlePause = () => setPhase('paused');

  const handleResume = async () => {
    setPhase('running');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleReset = () => applyDuration(selectedMinutes);

  const handleFinish = async () => {
    const elapsed = totalSeconds - remainingSeconds;
    setPhase('setup');
    await persistSession(elapsed);
    applyDuration(selectedMinutes);
  };

  const selectPreset = (presetId: PresetId) => {
    if (isLocked) return;
    setSelectedPreset(presetId);
    const minutes = presetId === 'custom' ? customMinutes : PRESETS.find((p) => p.id === presetId)?.minutes ?? 25;
    applyDuration(minutes);
  };

  const adjustCustomMinutes = (delta: number) => {
    if (isLocked) return;
    setCustomMinutes((prev) => Math.min(120, Math.max(5, prev + delta)));
  };

  const handleClose = () => {
    onClose();
  };

  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleClose();
      return true;
    });
    return () => subscription.remove();
  }, [handleClose, visible]);

  const ringSubtitle =
    phase === 'running'
      ? t('timer.focusing')
      : phase === 'paused'
        ? t('timer.paused')
        : phase === 'finished'
          ? t('timer.completed')
          : t('timer.ready');

  return (
    <>
      {mounted ? (
        <View style={styles.overlayRoot} pointerEvents={visible ? 'auto' : 'none'}>
          <Pressable style={styles.backdropPressable} onPress={handleClose}>
            <Animated.View style={[styles.backdrop, backdropStyle]} />
          </Pressable>

          <View style={[styles.sheetHost, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 10 }]}>
            <Animated.View
              style={[
                styles.sheet,
                sheetStyle,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={[styles.heroGlow, { backgroundColor: colors.primary }]} />

              <View style={[styles.header, isRtl && styles.rtlRow]}>
                <TouchableOpacity style={styles.closeButton} onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Ionicons name="chevron-down" size={28} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }, isRtl && styles.rtlText]}>
                  {t('timer.focusTimer')}
                </Text>
                <View style={styles.closeButton} />
              </View>

              <View style={styles.ringSection}>
                <CircularTimerRing
                  size={TIMER_RING_SIZE}
                  strokeWidth={12}
                  progress={progress}
                  timeLabel={formatTimerCountdown(remainingSeconds)}
                  subtitle={ringSubtitle}
                />
              </View>

              <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                <Animated.View style={[styles.contentBlock, revealStyle]}>
            <View style={[styles.presetRow, isRtl && styles.rtlRow]}>
              {PRESETS.map((preset) => {
                const selected = selectedPreset === preset.id;
                return (
                  <TouchableOpacity
                    key={preset.id}
                    style={[
                      styles.presetChip,
                      {
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected ? `${colors.primary}16` : colors.surface,
                      },
                    ]}
                    onPress={() => selectPreset(preset.id)}
                    disabled={isLocked}
                  >
                    <Text style={[styles.presetChipText, { color: selected ? colors.primary : colors.textSecondary }]}>
                      {t(preset.labelKey)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {selectedPreset === 'custom' ? (
              <View style={[styles.customRow, isRtl && styles.rtlRow]}>
                <TouchableOpacity
                  style={[styles.customAdjustBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  onPress={() => adjustCustomMinutes(-5)}
                  disabled={isLocked}
                >
                  <Ionicons name="remove" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.customMinutesText, { color: colors.textPrimary }]}>
                  {t('timer.minutesValue', { count: customMinutes })}
                </Text>
                <TouchableOpacity
                  style={[styles.customAdjustBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  onPress={() => adjustCustomMinutes(5)}
                  disabled={isLocked}
                >
                  <Ionicons name="add" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
            ) : null}

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }, isRtl && styles.rtlText]}>
              {t('timer.whatWorkingOn')}
            </Text>
            <View ref={taskSelectorRef} collapsable={false} style={styles.taskSelectorWrap}>
              <TouchableOpacity
                style={[
                  styles.taskSelector,
                  {
                    borderColor: showTaskPicker ? colors.primary : colors.border,
                    backgroundColor: colors.surface,
                  },
                  isRtl && styles.rtlRow,
                ]}
                onPress={openTaskPicker}
                disabled={isLocked}
                activeOpacity={0.85}
              >
                <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                <Text
                  style={[styles.taskSelectorText, { color: selectedTask ? colors.textPrimary : colors.textSecondary }, isRtl && styles.rtlText]}
                  numberOfLines={1}
                >
                  {selectedTask?.title ?? t('timer.selectTask')}
                </Text>
                <Ionicons
                  name={showTaskPicker ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            <View style={[styles.controlsRow, isRtl && styles.rtlRow]}>
              <TouchableOpacity
                style={[styles.resetButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
                onPress={handleReset}
                disabled={saving}
              >
                <Ionicons name="refresh" size={22} color={colors.textSecondary} />
              </TouchableOpacity>

              {phase === 'setup' || phase === 'finished' ? (
                <TouchableOpacity
                  style={[styles.playButton, { backgroundColor: colors.primary }]}
                  onPress={() => void handleStart()}
                  disabled={saving}
                >
                  <Ionicons name="play" size={32} color="#fff" style={styles.playIcon} />
                </TouchableOpacity>
              ) : phase === 'running' ? (
                <TouchableOpacity
                  style={[styles.playButton, { backgroundColor: colors.primary }]}
                  onPress={handlePause}
                  disabled={saving}
                >
                  <Ionicons name="pause" size={32} color="#fff" />
                </TouchableOpacity>
              ) : (
                <View style={[styles.pausedControls, isRtl && styles.rtlRow]}>
                  <TouchableOpacity
                    style={[styles.secondaryControl, { backgroundColor: colors.accent }]}
                    onPress={() => void handleFinish()}
                    disabled={saving}
                  >
                    <Ionicons name="stop" size={20} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.playButton, styles.playButtonCompact, { backgroundColor: colors.primary }]}
                    onPress={() => void handleResume()}
                    disabled={saving}
                  >
                    <Ionicons name="play" size={28} color="#fff" style={styles.playIcon} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
                </Animated.View>
              </ScrollView>
            </Animated.View>
          </View>
          {showTaskPicker && taskDropdownLayout ? (
            <>
              <Pressable style={styles.taskDropdownBackdrop} onPress={closeTaskPicker} />
              <View
                style={[
                  styles.taskDropdown,
                  {
                    top: taskDropdownLayout.top,
                    left: taskDropdownLayout.left,
                    width: taskDropdownLayout.width,
                    maxHeight: taskDropdownLayout.maxHeight,
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <ScrollView
                  style={{ maxHeight: taskDropdownLayout.maxHeight }}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  bounces={false}
                  nestedScrollEnabled
                >
                  <TouchableOpacity
                    style={[
                      styles.taskDropdownItem,
                      { borderBottomColor: colors.border },
                      !selectedTask && { backgroundColor: `${colors.primary}10` },
                    ]}
                    onPress={() => {
                      setSelectedTask(null);
                      closeTaskPicker();
                    }}
                  >
                    <Text style={[styles.taskDropdownText, { color: colors.textPrimary }, isRtl && styles.rtlText]}>
                      {t('timer.noTask')}
                    </Text>
                  </TouchableOpacity>
                  {activeTasks.length === 0 ? (
                    <Text style={[styles.noTasksText, { color: colors.textSecondary }, isRtl && styles.rtlText]}>
                      {t('timer.noActiveTasks')}
                    </Text>
                  ) : (
                    activeTasks.map((task, index) => {
                      const selected = selectedTask?.id === task.id;
                      const isLast = index === activeTasks.length - 1;
                      return (
                        <TouchableOpacity
                          key={task.id}
                          style={[
                            styles.taskDropdownItem,
                            !isLast && { borderBottomColor: colors.border },
                            selected && { backgroundColor: `${colors.primary}10` },
                          ]}
                          onPress={() => {
                            setSelectedTask(task);
                            closeTaskPicker();
                          }}
                        >
                          <Text style={[styles.taskDropdownText, { color: colors.textPrimary }, isRtl && styles.rtlText]} numberOfLines={1}>
                            {task.title}
                          </Text>
                          {task.courseName ? (
                            <Text style={[styles.taskDropdownMeta, { color: colors.textSecondary }, isRtl && styles.rtlText]} numberOfLines={1}>
                              {task.courseName}
                            </Text>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            </>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 998,
    elevation: 998,
  },
  backdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  backdrop: {
    flex: 1,
    backgroundColor: '#000',
  },
  sheetHost: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
  },
  sheet: {
    flex: 1,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#635BFF',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  ringSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  contentBlock: {
    width: '100%',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.h3,
    fontWeight: '800',
  },
  scrollContent: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.lg,
    alignItems: 'center',
    flexGrow: 1,
  },
  heroGlow: {
    position: 'absolute',
    top: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
    opacity: 0.07,
    alignSelf: 'center',
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
    marginBottom: spacing.md,
    width: '100%',
  },
  presetChip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  presetChipText: { fontSize: 13, fontWeight: '700' },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  customAdjustBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customMinutesText: {
    fontSize: 16,
    fontWeight: '700',
    minWidth: 120,
    textAlign: 'center',
  },
  fieldLabel: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: '700',
    alignSelf: 'stretch',
    marginBottom: spacing.xs,
  },
  taskSelectorWrap: {
    width: '100%',
    marginBottom: spacing.xl,
  },
  taskSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    width: '100%',
  },
  taskSelectorText: { flex: 1, fontSize: 15, fontWeight: '600' },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    width: '100%',
    marginTop: spacing.sm,
  },
  resetButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#635BFF',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  playButtonCompact: { width: 68, height: 68, borderRadius: 34 },
  playIcon: { marginLeft: 3 },
  pausedControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  secondaryControl: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskDropdownBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    elevation: 40,
    backgroundColor: 'transparent',
  },
  taskDropdown: {
    position: 'absolute',
    zIndex: 41,
    elevation: 41,
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  taskDropdownItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  taskDropdownText: { fontSize: 15, fontWeight: '600' },
  taskDropdownMeta: { fontSize: 12, marginTop: 2, fontWeight: '500' },
  noTasksText: { textAlign: 'center', paddingVertical: spacing.md, fontSize: 13 },
  rtlRow: { flexDirection: 'row-reverse' },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
});
