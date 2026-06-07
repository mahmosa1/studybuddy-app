import { layout, spacing, typography } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { I18nManager, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type AppHeaderProps = {
  title: string;
  onBack?: () => void;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
};

export function AppHeader({ title, onBack, leftSlot, rightSlot }: AppHeaderProps) {
  const isRtl = I18nManager.isRTL;
  const { colors } = useAppTheme();

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: layout.headerTopPadding,
          backgroundColor: colors.bg,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.inner}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.sideButton}
          disabled={!onBack}
          accessibilityRole="button"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons
            name={isRtl ? 'arrow-forward' : 'arrow-back'}
            size={layout.headerIconSize}
            color={colors.textPrimary}
          />
        </TouchableOpacity>
        {leftSlot ? <View style={styles.sideSlot}>{leftSlot}</View> : null}
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.sideSlot}>{rightSlot}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderBottomWidth: 1,
    paddingBottom: layout.headerBottomPadding,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
  },
  sideButton: {
    width: 44,
    height: 44,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideSlot: {
    minWidth: 44,
    minHeight: 44,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    ...typography.h3,
    fontWeight: '800',
    paddingHorizontal: spacing.sm,
  },
});
