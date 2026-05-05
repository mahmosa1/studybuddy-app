import AsyncStorage from '@react-native-async-storage/async-storage';

export type TutorApprovedForSignature = { courseId: string; approvedAt?: string };
export type TutorRequestForSignature = { id: string; createdAtMs?: number };

export function buildSystemUpdatesSignature(input: {
  courses: TutorApprovedForSignature[];
  tutorRequests: TutorRequestForSignature[];
  studentDecisionRequests?: TutorRequestForSignature[];
}): string {
  const coursesSig = input.courses
    .map((c) => `${c.courseId}:${c.approvedAt ?? ''}`)
    .sort()
    .join('|');
  const requestsSig = input.tutorRequests
    .map((r) => `${r.id}:${r.createdAtMs ?? 0}`)
    .sort()
    .join('|');
  const studentDecisionSig = (input.studentDecisionRequests || [])
    .map((r) => `${r.id}:${r.createdAtMs ?? 0}`)
    .sort()
    .join('|');
  return `${coursesSig}::${requestsSig}::${studentDecisionSig}`;
}

export function tutorUpdatesSeenStorageKey(uid: string): string {
  return `studybuddy_tutor_updates_seen_${uid}`;
}

export function dismissedSystemUpdatesStorageKey(uid: string): string {
  return `studybuddy_system_updates_dismissed_${uid}`;
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

export async function getDismissedSystemUpdateKeys(uid: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(dismissedSystemUpdatesStorageKey(uid));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function addDismissedSystemUpdateKey(uid: string, key: string): Promise<void> {
  if (!key) return;
  try {
    const current = new Set(await getDismissedSystemUpdateKeys(uid));
    current.add(key);
    await AsyncStorage.setItem(
      dismissedSystemUpdatesStorageKey(uid),
      JSON.stringify(Array.from(current)),
    );
  } catch {
    // ignore persistence failures
  }
}
