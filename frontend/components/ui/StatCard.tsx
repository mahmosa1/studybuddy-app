import { AppCard } from '@/frontend/components/ui/AppCard';
import { typography } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

type StatCardProps = {
  value: string | number;
  label: string;
  style?: ViewStyle;
};

export function StatCard({ value, label, style }: StatCardProps) {
  const { colors } = useAppTheme();
  return (
    <AppCard style={[styles.card, style]}>
      <View style={[styles.accentBar, { backgroundColor: colors.accent }]} />
      <Text style={[styles.value, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.45,
  },
  value: {
    fontSize: 24,
    fontWeight: '800',
  },
  label: {
    marginTop: 4,
    ...typography.caption,
    fontWeight: '700',
  },
});
