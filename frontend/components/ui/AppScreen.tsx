import { useAppTheme } from '@/frontend/styles/useAppTheme';
import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = ViewProps & {
  children: React.ReactNode;
};

export function AppScreen({ children, style, ...rest }: Props) {
  const { colors } = useAppTheme();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top', 'left', 'right']}>
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
