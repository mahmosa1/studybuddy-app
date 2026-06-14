import { useAppTheme } from '@/frontend/styles/useAppTheme';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type CourseFolderIconProps = {
  initial?: string;
  color?: string;
  size?: 'sm' | 'md';
};

export function CourseFolderIcon({ initial, color, size = 'md' }: CourseFolderIconProps) {
  const { colors } = useAppTheme();
  const folderColor = color ?? colors.primary;
  const isSmall = size === 'sm';
  const letter = initial?.trim().charAt(0).toUpperCase() || '?';

  return (
    <View style={[styles.wrapper, isSmall ? styles.wrapperSm : styles.wrapperMd]}>
      <View
        style={[
          styles.tab,
          isSmall ? styles.tabSm : styles.tabMd,
          { backgroundColor: folderColor },
        ]}
      />
      <View
        style={[
          styles.body,
          isSmall ? styles.bodySm : styles.bodyMd,
          {
            backgroundColor: folderColor,
            shadowColor: folderColor,
          },
        ]}
      >
        <Text style={[styles.initial, isSmall ? styles.initialSm : styles.initialMd]}>{letter}</Text>
        <View style={styles.paperLine} />
        <View style={[styles.paperLine, styles.paperLineShort]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'flex-start',
  },
  wrapperSm: {
    width: 56,
    height: 46,
  },
  wrapperMd: {
    width: 68,
    height: 56,
  },
  tab: {
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    marginLeft: 6,
    opacity: 0.95,
  },
  tabSm: {
    width: 22,
    height: 7,
  },
  tabMd: {
    width: 28,
    height: 8,
  },
  body: {
    width: '100%',
    borderRadius: 10,
    borderTopLeftRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 5,
    overflow: 'hidden',
  },
  bodySm: {
    height: 40,
  },
  bodyMd: {
    height: 48,
  },
  initial: {
    color: '#ffffff',
    fontWeight: '800',
    zIndex: 1,
  },
  initialSm: {
    fontSize: 18,
  },
  initialMd: {
    fontSize: 22,
  },
  paperLine: {
    position: 'absolute',
    bottom: 8,
    width: '46%',
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  paperLineShort: {
    bottom: 13,
    width: '34%',
    opacity: 0.55,
  },
});
