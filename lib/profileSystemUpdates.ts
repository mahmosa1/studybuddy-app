import AsyncStorage from '@react-native-async-storage/async-storage';

export type TutorApprovedForSignature = { courseId: string; approvedAt?: string };

export function buildTutorUpdatesSignature(courses: TutorApprovedForSignature[]): string {
  if (!courses.length) return '';
  return courses
    .map((c) => `${c.courseId}:${c.approvedAt ?? ''}`)
    .sort()
    .join('|');
}

export function tutorUpdatesSeenStorageKey(uid: string): string {
  return `studybuddy_tutor_updates_seen_${uid}`;
}

export async function getTutorUpdatesSeenSignature(uid: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(tutorUpdatesSeenStorageKey(uid));
  } catch {
    return null;
  }
}

export async function setTutorUpdatesSeenSignature(uid: string, signature: string): Promise<void> {
  try {
    await AsyncStorage.setItem(tutorUpdatesSeenStorageKey(uid), signature);
  } catch {
    // ignore persistence failures; badge may reappear until storage works
  }
}
