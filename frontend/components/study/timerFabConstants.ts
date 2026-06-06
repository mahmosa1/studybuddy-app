export const TIMER_FAB_SIZE = 52;
export const TIMER_FAB_RIGHT = 20;
export const TIMER_RING_SIZE = 248;

export type StudyTimerPhase = 'setup' | 'running' | 'paused' | 'finished';

export type StudyTimerSession = {
  phase: StudyTimerPhase;
  remainingSeconds: number;
  totalSeconds: number;
};

export function formatTimerCountdown(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function getActiveTimerElapsed(session: StudyTimerSession): number {
  if (session.phase !== 'running' && session.phase !== 'paused') return 0;
  return Math.max(0, session.totalSeconds - session.remainingSeconds);
}

const TIMER_FAB_TABS = new Set(['index', 'courses']);

const TIMER_FAB_ROUTE_ROOTS = new Set([
  'course',
  'courses',
  'ai-practice-setup',
  'ai-practice-test',
  'practice-results',
]);

export function shouldShowTimerFab(segments?: readonly string[]): boolean {
  if (!segments?.length) return false;

  const root = segments[0];
  if (root === '(tabs)') {
    const tab = segments[1] ?? 'index';
    return TIMER_FAB_TABS.has(tab);
  }

  return TIMER_FAB_ROUTE_ROOTS.has(root);
}

export function getTimerFabBottom(pathname?: string | null, segments?: readonly string[]): number {
  if (pathname?.includes('/tasks')) return 96;
  if (segments?.[0] === '(tabs)') return 108;
  if (
    pathname?.startsWith('/course') ||
    pathname?.startsWith('/courses') ||
    pathname?.includes('ai-practice') ||
    pathname?.includes('practice-results')
  ) {
    return 28;
  }
  return 108;
}
