import { Stack } from 'expo-router';
import React from 'react';

export default function ProfileSettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#f9fafb' },
      }}
    />
  );
}
