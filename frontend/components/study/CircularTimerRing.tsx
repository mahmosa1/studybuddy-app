import { useAppTheme } from '@/frontend/styles/useAppTheme';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

type CircularTimerRingProps = {
  size?: number;
  strokeWidth?: number;
  progress: number;
  timeLabel: string;
  subtitle?: string;
};

export function CircularTimerRing({
  size = 260,
  strokeWidth = 12,
  progress,
  timeLabel,
  subtitle,
}: CircularTimerRingProps) {
  const { colors } = useAppTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const strokeDashoffset = circumference * (1 - clampedProgress);
  const center = size / 2;

  const textStyles = useMemo(
    () => ({
      time: {
        fontSize: Math.round(size * 0.17),
        lineHeight: Math.round(size * 0.2),
      },
      subtitle: {
        fontSize: Math.round(size * 0.048),
        lineHeight: Math.round(size * 0.06),
      },
    }),
    [size],
  );

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} style={styles.svg}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.primary}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${center}, ${center}`}
        />
      </Svg>
      <View style={styles.centerContent} pointerEvents="none">
        <Text
          style={[styles.time, textStyles.time, { color: colors.textPrimary }]}
          numberOfLines={1}
        >
          {timeLabel}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.subtitle, textStyles.subtitle, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  centerContent: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: '14%',
  },
  time: {
    fontWeight: '800',
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    includeFontPadding: false,
  },
  subtitle: {
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
    includeFontPadding: false,
  },
});
