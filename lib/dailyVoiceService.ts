import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

export function isDailyConfigured(): boolean {
  return !!process.env.EXPO_PUBLIC_DAILY_DOMAIN?.trim();
}

export function getDailyRoomName(roomId: string): string {
  return `sb-${roomId.trim().toLowerCase()}`;
}

export function buildDailyRoomUrl(roomName: string): string {
  const domain = process.env.EXPO_PUBLIC_DAILY_DOMAIN?.trim();
  if (!domain) return '';
  return `https://${domain}/${roomName}`;
}

export async function createDailyRoom(roomName: string): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_DAILY_API_KEY?.trim();
  const fallbackUrl = buildDailyRoomUrl(roomName);
  if (!apiKey) return fallbackUrl;

  const response = await fetch('https://api.daily.co/v1/rooms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      name: roomName,
      properties: {
        enable_screenshare: false,
        enable_chat: true,
        max_participants: 30,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
      },
    }),
  });

  if (response.status === 409) {
    return fallbackUrl;
  }

  if (!response.ok) {
    return fallbackUrl;
  }

  const data = (await response.json()) as { url?: string };
  return data.url || fallbackUrl;
}

export function resolveDailyRoomUrl(room: {
  id: string;
  dailyRoomUrl?: string;
  dailyRoomName?: string;
}): string {
  if (room.dailyRoomUrl) return room.dailyRoomUrl;
  const roomName = room.dailyRoomName || getDailyRoomName(room.id);
  return buildDailyRoomUrl(roomName);
}

export function isDailyNativeAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  // Daily native SDK is not available in Expo Go — only in custom dev/production builds.
  return Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}
