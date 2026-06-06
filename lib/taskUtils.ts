import type { StudyTask, TaskStatus } from './studyJournalService';

type PriorityAccentColors = {
  danger: string;
  accent: string;
  warning: string;
};

export type CategorizedTasks = {
  upcoming: StudyTask[];
  todo: StudyTask[];
  done: StudyTask[];
};

export type ScheduleGroups = {
  today: StudyTask[];
  tomorrow: StudyTask[];
  thisWeek: StudyTask[];
  later: StudyTask[];
  noDate: StudyTask[];
};

export type JournalTab = 'calendar' | 'schedule' | 'tasks';

export function parseFirestoreDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    const seconds = Number((value as { seconds: number }).seconds);
    if (!Number.isNaN(seconds)) return new Date(seconds * 1000);
  }
  return undefined;
}

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function isSameDay(a: Date, b: Date): boolean {
  return dateKey(a) === dateKey(b);
}

export function getNextTaskStatus(current: TaskStatus): TaskStatus {
  if (current === 'pending') return 'in-progress';
  if (current === 'in-progress') return 'completed';
  return 'pending';
}

export function getStatusLabelKey(status: TaskStatus): string {
  if (status === 'in-progress') return 'home.inProgress';
  if (status === 'completed') return 'home.completed';
  return 'home.pending';
}

export function categorizeTasks(tasks: StudyTask[]): CategorizedTasks {
  const active = tasks.filter((task) => task.status !== 'completed');
  const done = tasks.filter((task) => task.status === 'completed');

  const upcoming = active
    .filter((task) => task.dueDate instanceof Date)
    .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime());

  const todo = active.filter((task) => !(task.dueDate instanceof Date));

  return { upcoming, todo, done };
}

export function getSoonTasks(tasks: StudyTask[], limit = 3): StudyTask[] {
  const groups = groupTasksForSchedule(tasks.filter((task) => task.status !== 'completed'));
  const ordered = [
    ...groups.today,
    ...groups.tomorrow,
    ...groups.thisWeek,
    ...groups.later,
    ...groups.noDate,
  ];
  return ordered.slice(0, limit);
}

export function getUpcomingWeekTasks(tasks: StudyTask[]): StudyTask[] {
  const groups = groupTasksForSchedule(tasks.filter((task) => task.status !== 'completed'));
  return [...groups.today, ...groups.tomorrow, ...groups.thisWeek];
}

export function groupTasksForSchedule(tasks: StudyTask[]): ScheduleGroups {
  const today = startOfDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const groups: ScheduleGroups = {
    today: [],
    tomorrow: [],
    thisWeek: [],
    later: [],
    noDate: [],
  };

  const sorted = [...tasks].sort((a, b) => {
    const aTime = a.dueDate instanceof Date ? a.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.dueDate instanceof Date ? b.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });

  sorted.forEach((task) => {
    if (!(task.dueDate instanceof Date)) {
      groups.noDate.push(task);
      return;
    }
    const due = startOfDay(task.dueDate);
    if (isSameDay(due, today)) {
      groups.today.push(task);
    } else if (due < today) {
      groups.thisWeek.push(task);
    } else if (isSameDay(due, tomorrow)) {
      groups.tomorrow.push(task);
    } else if (due > tomorrow && due <= weekEnd) {
      groups.thisWeek.push(task);
    } else if (due > weekEnd) {
      groups.later.push(task);
    } else {
      groups.thisWeek.push(task);
    }
  });

  return groups;
}

export function getMonthCalendarWeeks(year: number, month: number): (Date | null)[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const weeks: (Date | null)[][] = [];
  let currentWeek: (Date | null)[] = new Array(firstDay.getDay()).fill(null);

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    currentWeek.push(new Date(year, month, day));
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  return weeks;
}

export function getTasksForDate(tasks: StudyTask[], date: Date): StudyTask[] {
  return tasks.filter((task) => task.dueDate instanceof Date && isSameDay(task.dueDate, date));
}

export function getDatesWithTasks(tasks: StudyTask[], year: number, month: number): Set<string> {
  const keys = new Set<string>();
  tasks.forEach((task) => {
    if (!(task.dueDate instanceof Date)) return;
    if (task.dueDate.getFullYear() === year && task.dueDate.getMonth() === month) {
      keys.add(dateKey(task.dueDate));
    }
  });
  return keys;
}

export function getJournalStats(tasks: StudyTask[]) {
  const today = startOfDay(new Date());
  const active = tasks.filter((task) => task.status !== 'completed');
  const dueToday = active.filter((task) => task.dueDate instanceof Date && isSameDay(task.dueDate, today));
  const done = tasks.filter((task) => task.status === 'completed');
  return {
    active: active.length,
    dueToday: dueToday.length,
    done: done.length,
  };
}

export function formatTaskDate(
  date: Date | undefined,
  language: string,
  noDeadlineLabel: string,
): string {
  if (!(date instanceof Date)) return noDeadlineLabel;

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  if (language === 'he' || language.startsWith('he-')) {
    return `${day}/${month}/${year}`;
  }
  return `${month}/${day}/${year}`;
}

export function formatMonthYear(date: Date, language: string): string {
  if (language === 'he' || language.startsWith('he-')) {
    return date.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
  }
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function isTaskOverdue(task: StudyTask): boolean {
  if (!(task.dueDate instanceof Date) || task.status === 'completed') return false;
  const today = startOfDay(new Date());
  const due = startOfDay(task.dueDate);
  return due < today;
}

export function getPriorityAccentColor(
  priority: StudyTask['priority'] | undefined,
  colors: PriorityAccentColors,
): string {
  if (priority === 'high') return colors.danger;
  if (priority === 'low') return colors.accent;
  return colors.warning;
}

export type StatusVisualStyle = {
  accent: string;
  background: string;
  border: string;
};

export function getStatusAccentColor(
  status: TaskStatus,
  colors: { primary: string; accent: string; success: string; textSecondary: string },
): string {
  if (status === 'in-progress') return colors.accent;
  if (status === 'completed') return colors.success;
  return colors.primary;
}

export function getStatusVisualStyle(
  status: TaskStatus,
  colors: { primary: string; accent: string; success: string },
): StatusVisualStyle {
  if (status === 'in-progress') {
    return {
      accent: colors.accent,
      background: `${colors.accent}1A`,
      border: `${colors.accent}45`,
    };
  }
  if (status === 'completed') {
    return {
      accent: colors.success,
      background: `${colors.success}1A`,
      border: `${colors.success}45`,
    };
  }
  return {
    accent: colors.primary,
    background: `${colors.primary}14`,
    border: `${colors.primary}35`,
  };
}

export function parseDateInputs(day: string, month: string, year: string): Date | null {
  const parsedDay = Number(day);
  const parsedMonth = Number(month);
  const parsedYear = Number(year);

  if (
    Number.isNaN(parsedDay) ||
    Number.isNaN(parsedMonth) ||
    Number.isNaN(parsedYear) ||
    parsedDay < 1 ||
    parsedDay > 31 ||
    parsedMonth < 1 ||
    parsedMonth > 12 ||
    parsedYear < 2000
  ) {
    return null;
  }

  const date = new Date(parsedYear, parsedMonth - 1, parsedDay);
  if (
    date.getFullYear() !== parsedYear ||
    date.getMonth() !== parsedMonth - 1 ||
    date.getDate() !== parsedDay
  ) {
    return null;
  }

  date.setHours(23, 59, 59, 999);
  return date;
}

export function dateToInputs(date?: Date): { day: string; month: string; year: string } {
  if (!(date instanceof Date)) {
    const now = new Date();
    return {
      day: String(now.getDate()),
      month: String(now.getMonth() + 1),
      year: String(now.getFullYear()),
    };
  }
  return {
    day: String(date.getDate()),
    month: String(date.getMonth() + 1),
    year: String(date.getFullYear()),
  };
}
