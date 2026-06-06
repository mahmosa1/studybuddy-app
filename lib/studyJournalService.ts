// lib/studyJournalService.ts
// Service for managing study journal, tasks, timer, and statistics

import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    Timestamp,
    updateDoc,
    where,
} from 'firebase/firestore';
import { auth, db } from './firebaseConfig';

function parseFirestoreDate(value: unknown): Date | undefined {
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

export type TaskStatus = 'pending' | 'in-progress' | 'completed';

export type StudyTask = {
  id: string;
  title: string;
  description?: string;
  courseId?: string;
  courseName?: string;
  status: TaskStatus;
  dueDate?: Date;
  createdAt: Date;
  completedAt?: Date;
  priority?: 'low' | 'medium' | 'high';
};

export type StudySession = {
  id: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // in seconds
  courseId?: string;
  courseName?: string;
  notes?: string;
};

export type StudyStats = {
  totalStudyTime: number; // in seconds
  todayStudyTime: number; // in seconds
  weeklyStudyTime: number; // in seconds
  monthlyStudyTime: number; // in seconds
  totalSessions: number;
  averageSessionDuration: number; // in seconds
  currentStreak: number; // days
  longestStreak: number; // days
  dailyGoal: number; // in seconds (default: 2 hours = 7200)
  goalAchieved: boolean;
  goalProgress: number; // percentage
};

export type SmartNotification = {
  id: string;
  type: 'streak-risk' | 'weak-topic' | 'goal-risk';
  message: string;
  severity: 'info' | 'warning' | 'critical';
};

/**
 * Get all tasks for the current user
 */
export async function getTasks(): Promise<StudyTask[]> {
  const user = auth.currentUser;
  if (!user) {
    return [];
  }

  try {
    const tasksRef = collection(db, 'studyTasks');
    let snapshot;
    
    try {
      // Try query with orderBy (requires index)
      const q = query(
        tasksRef,
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      snapshot = await getDocs(q);
    } catch (indexError: any) {
      console.log('⚠️ Index not found or not ready yet, using fallback query (slower but works)');
      console.log('💡 To improve performance, create a composite index for studyTasks on userId (asc), createdAt (desc).');
      // Fallback: query without orderBy
      const q = query(
        tasksRef,
        where('userId', '==', user.uid)
      );
      snapshot = await getDocs(q);
    }
    const tasks: StudyTask[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      tasks.push({
        id: docSnap.id,
        title: data.title || '',
        description: data.description || '',
        courseId: data.courseId || '',
        courseName: data.courseName || '',
        status: (data.status || 'pending') as TaskStatus,
        dueDate: parseFirestoreDate(data.dueDate),
        createdAt: parseFirestoreDate(data.createdAt) || new Date(),
        completedAt: parseFirestoreDate(data.completedAt),
        priority: data.priority || 'medium',
      });
    });

    // If we used fallback query, sort by date in memory
    if (tasks.length > 0) {
      tasks.sort((a, b) => {
        const dateA = a.createdAt.getTime();
        const dateB = b.createdAt.getTime();
        return dateB - dateA; // Descending order (newest first)
      });
    }

    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const nowMs = Date.now();

    // Hide completed tasks after 24 hours from completion time.
    const visibleTasks = tasks.filter((task) => {
      if (task.status !== 'completed') return true;
      if (!task.completedAt) return true;
      return nowMs - task.completedAt.getTime() < ONE_DAY_MS;
    });

    return visibleTasks;
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return [];
  }
}

/**
 * Create a new task
 */
export async function createTask(
  title: string,
  description?: string,
  courseId?: string,
  courseName?: string,
  dueDate?: Date,
  priority?: 'low' | 'medium' | 'high'
): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be authenticated');
  }

  const taskData: any = {
    userId: user.uid,
    title,
    description: description || '',
    status: 'pending',
    createdAt: serverTimestamp(),
    priority: priority || 'medium',
  };

  if (courseId) {
    taskData.courseId = courseId;
  }
  if (courseName) {
    taskData.courseName = courseName;
  }
  if (dueDate) {
    taskData.dueDate = Timestamp.fromDate(dueDate);
  }

  const docRef = await addDoc(collection(db, 'studyTasks'), taskData);
  return docRef.id;
}

export type UpdateTaskInput = {
  title?: string;
  description?: string;
  courseId?: string | null;
  courseName?: string | null;
  dueDate?: Date | null;
  priority?: 'low' | 'medium' | 'high';
  status?: TaskStatus;
};

/**
 * Update an existing task
 */
export async function updateTask(taskId: string, input: UpdateTaskInput): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be authenticated');
  }

  const updateData: Record<string, unknown> = {};

  if (input.title !== undefined) updateData.title = input.title;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.priority !== undefined) updateData.priority = input.priority;

  if (input.courseId !== undefined) {
    updateData.courseId = input.courseId || '';
  }
  if (input.courseName !== undefined) {
    updateData.courseName = input.courseName || '';
  }

  if (input.dueDate !== undefined) {
    updateData.dueDate = input.dueDate ? Timestamp.fromDate(input.dueDate) : null;
  }

  if (input.status !== undefined) {
    updateData.status = input.status;
    if (input.status === 'completed') {
      updateData.completedAt = serverTimestamp();
    } else {
      updateData.completedAt = null;
    }
  }

  await updateDoc(doc(db, 'studyTasks', taskId), updateData);
}

/**
 * Update task status
 */
export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus
): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be authenticated');
  }

  const updateData: any = {
    status,
  };

  if (status === 'completed') {
    updateData.completedAt = serverTimestamp();
  } else {
    updateData.completedAt = null;
  }

  await updateDoc(doc(db, 'studyTasks', taskId), updateData);
}

/**
 * Delete a task
 */
export async function deleteTask(taskId: string): Promise<void> {
  await deleteDoc(doc(db, 'studyTasks', taskId));
}

/**
 * Save a study session
 */
export async function saveStudySession(
  duration: number,
  courseId?: string,
  courseName?: string,
  notes?: string
): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be authenticated');
  }

  const sessionData: any = {
    userId: user.uid,
    startTime: serverTimestamp(),
    duration,
    createdAt: serverTimestamp(),
  };

  if (courseId) {
    sessionData.courseId = courseId;
  }
  if (courseName) {
    sessionData.courseName = courseName;
  }
  if (notes) {
    sessionData.notes = notes;
  }

  const docRef = await addDoc(collection(db, 'studySessions'), sessionData);
  return docRef.id;
}

/**
 * Get study statistics
 */
export async function getStudyStats(): Promise<StudyStats> {
  const user = auth.currentUser;
  if (!user) {
    return getDefaultStats();
  }

  try {
    const sessionsRef = collection(db, 'studySessions');
    let snapshot;
    
    try {
      // Try query with orderBy (requires index)
      const q = query(
        sessionsRef,
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      snapshot = await getDocs(q);
    } catch (indexError: any) {
      console.log('⚠️ Index not found or not ready yet, using fallback query (slower but works)');
      console.log('💡 To improve performance, create a composite index for studySessions on userId (asc), createdAt (desc).');
      // Fallback: query without orderBy
      const q = query(
        sessionsRef,
        where('userId', '==', user.uid)
      );
      snapshot = await getDocs(q);
    }
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    let totalStudyTime = 0;
    let todayStudyTime = 0;
    let weeklyStudyTime = 0;
    let monthlyStudyTime = 0;
    let totalSessions = 0;
    let totalDuration = 0;

    // Collect all sessions first
    const sessions: Array<{ date: Date; duration: number }> = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const sessionDate = data.createdAt?.toDate() || new Date();
      const duration = data.duration || 0;
      sessions.push({ date: sessionDate, duration });
    });

    // If we used fallback query, sort by date in memory (descending)
    if (sessions.length > 0) {
      sessions.sort((a, b) => b.date.getTime() - a.date.getTime());
    }

    // Process sorted sessions
    sessions.forEach((session) => {
      const { date: sessionDate, duration } = session;
      totalStudyTime += duration;
      totalSessions++;
      totalDuration += duration;

      if (sessionDate >= today) {
        todayStudyTime += duration;
      }
      if (sessionDate >= weekAgo) {
        weeklyStudyTime += duration;
      }
      if (sessionDate >= monthAgo) {
        monthlyStudyTime += duration;
      }
    });

    const averageSessionDuration =
      totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0;

    // Get user's daily goal (default: 2 hours = 7200 seconds)
    const userDocRef = doc(db, 'users', user.uid);
    const userDocSnap = await getDoc(userDocRef);
    let dailyGoal = 7200; // 2 hours default
    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      dailyGoal = userData.dailyStudyGoal || 7200;
    }

    const goalAchieved = todayStudyTime >= dailyGoal;
    const goalProgress = dailyGoal > 0 ? Math.min(100, Math.round((todayStudyTime / dailyGoal) * 100)) : 0;

    // Calculate streaks (simplified - check last 30 days)
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    const sessionsByDate = new Map<string, number>();
    sessions.forEach((session) => {
      const dateKey = session.date.toISOString().split('T')[0];
      sessionsByDate.set(dateKey, (sessionsByDate.get(dateKey) || 0) + session.duration);
    });

    // Check streaks
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateKey = checkDate.toISOString().split('T')[0];
      const hasStudy = sessionsByDate.has(dateKey);

      if (hasStudy) {
        tempStreak++;
        if (i === 0) {
          currentStreak = tempStreak;
        }
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        if (i > 0) break; // Break if gap found (except for today)
        tempStreak = 0;
      }
    }

    return {
      totalStudyTime,
      todayStudyTime,
      weeklyStudyTime,
      monthlyStudyTime,
      totalSessions,
      averageSessionDuration,
      currentStreak,
      longestStreak,
      dailyGoal,
      goalAchieved,
      goalProgress,
    };
  } catch (error) {
    console.error('Error fetching study stats:', error);
    return getDefaultStats();
  }
}

function getDefaultStats(): StudyStats {
  return {
    totalStudyTime: 0,
    todayStudyTime: 0,
    weeklyStudyTime: 0,
    monthlyStudyTime: 0,
    totalSessions: 0,
    averageSessionDuration: 0,
    currentStreak: 0,
    longestStreak: 0,
    dailyGoal: 7200, // 2 hours
    goalAchieved: false,
    goalProgress: 0,
  };
}

/**
 * Update daily study goal
 */
export async function updateDailyGoal(goalInSeconds: number): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be authenticated');
  }

  await updateDoc(doc(db, 'users', user.uid), {
    dailyStudyGoal: goalInSeconds,
  });
}

/**
 * Save daily statistics to history
 */
export async function saveDailyStatistics(stats: StudyStats, date: Date): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be authenticated');
  }

  const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD format
  
  const dailyStatsData = {
    userId: user.uid,
    date: dateKey,
    dateTimestamp: date,
    totalStudyTime: stats.todayStudyTime,
    sessions: stats.totalSessions,
    goalAchieved: stats.goalAchieved,
    goalProgress: stats.goalProgress,
    dailyGoal: stats.dailyGoal,
    createdAt: serverTimestamp(),
  };

  // Check if entry already exists for this date
  const dailyStatsRef = collection(db, 'dailyStatistics');
  const q = query(
    dailyStatsRef,
    where('userId', '==', user.uid),
    where('date', '==', dateKey)
  );
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    // Update existing entry
    const existingDoc = snapshot.docs[0];
    await updateDoc(doc(db, 'dailyStatistics', existingDoc.id), dailyStatsData);
  } else {
    // Create new entry
    await addDoc(collection(db, 'dailyStatistics'), dailyStatsData);
  }
}

export async function getSmartNotifications(): Promise<SmartNotification[]> {
  const user = auth.currentUser;
  if (!user) return [];

  const notifications: SmartNotification[] = [];

  try {
    const stats = await getStudyStats();
    const tasks = await getTasks();

    // Goal risk
    if (stats.goalProgress < 40) {
      const remainingMinutes = Math.max(0, Math.ceil((stats.dailyGoal - stats.todayStudyTime) / 60));
      notifications.push({
        id: 'goal-risk',
        type: 'goal-risk',
        message: `You still need about ${remainingMinutes} minutes to reach today's goal.`,
        severity: 'warning',
      });
    }

    // Streak risk
    if (stats.currentStreak > 0 && stats.todayStudyTime < 300) {
      notifications.push({
        id: 'streak-risk',
        type: 'streak-risk',
        message: `Your ${stats.currentStreak}-day streak is at risk. Study at least 5 minutes today.`,
        severity: 'critical',
      });
    }

    // Near due pending tasks
    const now = new Date();
    const soon = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const dueSoon = tasks.filter(
      (task) =>
        task.status !== 'completed' &&
        task.dueDate instanceof Date &&
        task.dueDate >= now &&
        task.dueDate <= soon
    );
    if (dueSoon.length > 0) {
      notifications.push({
        id: 'due-soon',
        type: 'goal-risk',
        message: `${dueSoon.length} task(s) are due in the next 48 hours.`,
        severity: 'info',
      });
    }

    // Weak-topic signal from practice service
    try {
      const { getWeaknessProfile } = await import('./practiceService');
      const coursesSnap = await getDocs(query(collection(db, 'courses'), where('ownerUid', '==', user.uid)));
      for (const c of coursesSnap.docs.slice(0, 3)) {
        const weak = await getWeaknessProfile(c.id);
        const topWeak = weak.find((w) => w.attempts >= 3 && w.accuracy < 60);
        if (topWeak) {
          notifications.push({
            id: `weak-${c.id}`,
            type: 'weak-topic',
            message: `Weak topic detected: "${topWeak.topic}" (${topWeak.accuracy}% accuracy).`,
            severity: 'warning',
          });
          break;
        }
      }
    } catch {
      // silent fallback if weakness profile unavailable
    }

    return notifications.slice(0, 3);
  } catch (error) {
    console.log('Error creating smart notifications:', error);
    return [];
  }
}

