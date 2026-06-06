import { useStudyTimer } from '@/lib/StudyTimerContext';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

export default function StudyTimerRedirectScreen() {
  const { openTimer } = useStudyTimer();
  const router = useRouter();

  useEffect(() => {
    openTimer();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }, [openTimer, router]);

  return <View />;
}
