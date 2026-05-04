import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { CourseFileRef, LearningContext, WeaknessSignal } from './types';

async function getCourseFiles(courseId: string): Promise<CourseFileRef[]> {
  const snap = await getDocs(query(collection(db, 'courseFiles'), where('courseId', '==', courseId)));
  return snap.docs
    .map((docSnap) => {
      const d = docSnap.data() as any;
      return {
        id: docSnap.id,
        courseId,
        name: String(d?.name || 'File'),
        url: String(d?.url || ''),
        mimeType: d?.mimeType || null,
        size: d?.size ?? null,
      } as CourseFileRef;
    })
    .filter((f) => !!f.url);
}

async function getWeaknessSignals(userId: string, courseId: string): Promise<WeaknessSignal[]> {
  const snap = await getDocs(
    query(
      collection(db, 'userTopicPerformance'),
      where('userId', '==', userId),
      where('courseId', '==', courseId)
    )
  );

  return snap.docs.map((docSnap) => {
    const d = docSnap.data() as any;
    const attempts = Number(d?.attempts || 0);
    const correct = Number(d?.correct || 0);
    const accuracy = Number(d?.accuracy || 0);
    const confidence = Math.min(100, attempts * 10);
    const predictedRisk = Math.max(0, 100 - accuracy);
    return {
      topic: String(d?.topic || 'General'),
      attempts,
      correct,
      accuracy,
      confidence,
      predictedRisk,
    };
  });
}

async function getRecentPractice(userId: string, courseId: string): Promise<{ recentScores: number[]; recentQuestions: Array<{ question: string; topic?: string; isCorrect?: boolean }> }> {
  let resultSnap;
  try {
    resultSnap = await getDocs(
      query(
        collection(db, 'practiceResults'),
        where('userId', '==', userId),
        where('courseId', '==', courseId),
        orderBy('completedAt', 'desc')
      )
    );
  } catch {
    resultSnap = await getDocs(
      query(collection(db, 'practiceResults'), where('userId', '==', userId), where('courseId', '==', courseId))
    );
  }

  const ordered = resultSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .sort((a, b) => {
      const at = a?.completedAt?.toMillis?.() || a?.completedAt?.seconds || 0;
      const bt = b?.completedAt?.toMillis?.() || b?.completedAt?.seconds || 0;
      return bt - at;
    });

  const recentScores = ordered.slice(0, 8).map((r) => Number(r?.score || 0));
  const recentQuestions = ordered
    .slice(0, 4)
    .flatMap((result) =>
      (Array.isArray(result?.answers) ? result.answers : []).slice(0, 5).map((answer: any) => ({
        question: String(answer?.questionText || ''),
        topic: answer?.topic ? String(answer.topic) : undefined,
        isCorrect: Boolean(answer?.isCorrect),
      }))
    );

  return { recentScores, recentQuestions };
}

export async function buildLearningContext(input: {
  userId?: string;
  courseId: string;
  courseName: string;
}): Promise<LearningContext> {
  const { userId, courseId, courseName } = input;
  const files = await getCourseFiles(courseId);
  if (!userId) {
    return { userId, courseId, courseName, files, weakTopics: [], recentScores: [], recentQuestions: [] };
  }

  const [weakTopics, recent] = await Promise.all([
    getWeaknessSignals(userId, courseId),
    getRecentPractice(userId, courseId),
  ]);

  return {
    userId,
    courseId,
    courseName,
    files,
    weakTopics,
    recentScores: recent.recentScores,
    recentQuestions: recent.recentQuestions,
  };
}

