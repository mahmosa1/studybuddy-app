import {
  formatTimerCountdown,
  getTimerFabBottom,
  TIMER_FAB_RIGHT,
  TIMER_FAB_SIZE,
} from '@/frontend/components/study/timerFabConstants';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { useStudyTimer } from '@/lib/StudyTimerContext';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useSegments } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

type GlobalStudyTimerFabProps = {
  onPress: () => void;
};

const FAB_STROKE = 3.5;
const FAB_INNER_SIZE = TIMER_FAB_SIZE - FAB_STROKE * 2;

export function GlobalStudyTimerFab({ onPress }: GlobalStudyTimerFabProps) {
  const { colors } = useAppTheme();
  const { session } = useStudyTimer();
  const pathname = usePathname();
  const segments = useSegments();
  const bottomOffset = getTimerFabBottom(pathname, segments);

  const isActive = session.phase === 'running' || session.phase === 'paused';
  const progress =
    session.totalSeconds > 0
      ? (session.totalSeconds - session.remainingSeconds) / session.totalSeconds
      : 0;
  const clampedProgress = Math.min(1, Math.max(0, progress));

  const ring = useMemo(() => {
    const size = TIMER_FAB_SIZE;
    const center = size / 2;
    const radius = (size - FAB_STROKE) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference * (1 - clampedProgress);

    return { center, radius, circumference, strokeDashoffset };
  }, [clampedProgress]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.fabHost,
        {
          bottom: bottomOffset,
          shadowColor: '#000',
          opacity: pressed ? 0.92 : 1,
        },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Study timer"
      hitSlop={8}
    >
      <View
        style={[
          styles.fab,
          {
            backgroundColor: colors.surface,
            borderColor: isActive ? 'transparent' : colors.primary,
          },
        ]}
      >
        {isActive ? (
          <Text
            style={[styles.countdown, { color: colors.primary }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {formatTimerCountdown(session.remainingSeconds)}
          </Text>
        ) : (
          <Ionicons name="timer-outline" size={24} color={colors.primary} />
        )}
      </View>

      {isActive ? (
        <Svg
          width={TIMER_FAB_SIZE}
          height={TIMER_FAB_SIZE}
          style={styles.ringSvg}
          pointerEvents="none"
        >
          <Circle
            cx={ring.center}
            cy={ring.center}
            r={ring.radius}
            stroke={colors.border}
            strokeWidth={FAB_STROKE}
            fill="none"
          />
          <Circle
            cx={ring.center}
            cy={ring.center}
            r={ring.radius}
            stroke={colors.primary}
            strokeWidth={FAB_STROKE}
            fill="none"
            strokeDasharray={`${ring.circumference} ${ring.circumference}`}
            strokeDashoffset={ring.strokeDashoffset}
            strokeLinecap="round"
            rotation={-90}
            origin={`${ring.center}, ${ring.center}`}
          />
        </Svg>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fabHost: {
    position: 'absolute',
    right: TIMER_FAB_RIGHT,
    width: TIMER_FAB_SIZE,
    height: TIMER_FAB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    elevation: 999,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  ringSvg: {
    ...StyleSheet.absoluteFillObject,
  },
  fab: {
    width: FAB_INNER_SIZE,
    height: FAB_INNER_SIZE,
    borderRadius: FAB_INNER_SIZE / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  countdown: {
    fontSize: 11,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    includeFontPadding: false,
  },
});
