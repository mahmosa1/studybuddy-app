import { spacing, typography } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

type LoadingStateProps = {
  label?: string;
};

export function LoadingState({ label }: LoadingStateProps) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.container}>
      <ActivityIndicator size="small" color={colors.primary} />
      {label ? <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  label: {
    marginTop: spacing.sm,
    ...typography.body,
  },
});
