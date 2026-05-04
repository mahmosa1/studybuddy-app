// app/_layout.tsx
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';
import 'react-native-url-polyfill/auto';

import { useColorScheme } from '@/hooks/use-color-scheme';
import '@/lib/i18n'; // Initialize i18n
import { UserProvider } from '@/lib/UserContext';

export const unstable_settings = {
  initialRouteName: '(auth)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // Align root window with light surfaces (tabs, feed, chat) so edge-to-edge Android
    // does not leave a mismatched strip behind the status bar.
    void SystemUI.setBackgroundColorAsync('#f9fafb');
  }, []);

  return (
    <UserProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen
            name="(tabs)"
            options={{
              // Prevent iOS back-swipe from popping out of the tab navigator to `/`,
              // which can trigger auth-redirect flicker during transient network issues.
              gestureEnabled: false,
              fullScreenGestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="profile"
            options={{
              animation: 'slide_from_right',
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
            }}
          />
          <Stack.Screen
            name="chat/[chatId]"
            options={{
              animation: 'slide_from_right',
              gestureEnabled: true,
              fullScreenGestureEnabled: true,
            }}
          />
          <Stack.Screen
            name="modal"
            options={{ presentation: 'modal', title: 'Modal' }}
          />
        </Stack>
        {/* "auto" follows system dark mode → light icons on our light screens = invisible with edge-to-edge */}
        <StatusBar style="dark" backgroundColor={Platform.OS === 'android' ? '#f9fafb' : undefined} />
      </ThemeProvider>
    </UserProvider>
  );
}
