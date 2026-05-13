import { useAppTheme } from '@/frontend/styles/useAppTheme';
import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

type Props = ViewProps & {
  children: React.ReactNode;
  /** Default: top, left, right. Omit top when the screen applies `insets.top` manually (e.g. custom header stack). */
  safeAreaEdges?: Edge[];
};

const DEFAULT_SAFE_AREA_EDGES: Edge[] = ['top', 'left', 'right'];

export function AppScreen({ children, style, safeAreaEdges, ...rest }: Props) {
  const { colors } = useAppTheme();
  const edges = safeAreaEdges ?? DEFAULT_SAFE_AREA_EDGES;
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={edges}>
      <View style={[styles.container, { backgroundColor: colors.bg }, style]} {...rest}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
});
