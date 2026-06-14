import AsyncStorage from '@react-native-async-storage/async-storage';

export function adminPendingApprovalsSeenKey(adminUid: string): string {
  return `studybuddy_admin_pending_approvals_seen_${adminUid}`;
}

export async function getLastSeenPendingCount(adminUid: string): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(adminPendingApprovalsSeenKey(adminUid));
    if (raw == null) return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

export async function setLastSeenPendingCount(adminUid: string, count: number): Promise<void> {
  try {
    await AsyncStorage.setItem(adminPendingApprovalsSeenKey(adminUid), String(Math.max(0, count)));
  } catch {
    // ignore persistence failures
  }
}

export function shouldShowPendingApprovalsBadge(
  pendingCount: number,
  lastSeenPendingCount: number,
): boolean {
  return pendingCount > 0 && pendingCount > lastSeenPendingCount;
}
