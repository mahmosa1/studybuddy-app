// lib/practiceService.ts
// Service for managing practice sessions in Firestore

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { PracticeQuestion } from './aiService';
import { auth, db } from './firebaseConfig';

export type PracticeAnswer = {
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
  score?: number; // For open questions
  questionText?: string;
  topic?: string;
  mistakeType?: 'conceptual' | 'careless' | 'incomplete';
};

export type PracticeResult = {
  sessionId: string;
  courseId: string;
  courseName: string;
  userId: string;
  score: number; // Percentage
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  answers: PracticeAnswer[];
  weakTopics: string[]; // Topics with incorrect answers
  completedAt: Date;
};

export type TopicPerformance = {
  topic: string;
  attempts: number;
  correct: number;
  accuracy: number;
  confidence?: number;
  predictedRisk?: number;
  rollingAccuracy7?: number;
  rollingAccuracy30?: number;
  recommendation?: string;
  lastUpdated: Date | null;
};

export type ProgressDashboard = {
  readinessScore: number;
  averageScore: number;
  trendDelta: number;
  courseRankingPercentile: number;
  topicPerformance: TopicPerformance[];
};

function normalizeTopicLabel(topicRaw: string): string {
  const topic = String(topicRaw || '')
    .replace(/\.[a-z0-9]{1,5}$/i, '')
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!topic) return '';
  const lower = topic.toLowerCase();
  const noisePatterns = [
    /^pdf$/i,
    /^docx?$/i,
    /^pptx?$/i,
    /^file$/i,
    /^document$/i,
    /^lecture\s*\d*$/i,
    /^lesson\s*\d*$/i,
    /^chapter\s*\d*$/i,
    /^unit\s*\d*$/i,
    /^הרצאה\s*\d*$/i,
    /^שיעור\s*\d*$/i,
    /^פרק\s*\d*$/i,
  ];
  if (noisePatterns.some((p) => p.test(lower))) return '';

  // Keep meaningful labels only.
  const letters = topic.replace(/[^\p{L}]/gu, '');
  if (letters.length < 3) return '';
  return topic;
}

/**
 * Save a practice session to Firestore
 */
export async function savePracticeSession(
  courseId: string,
  courseName: string,
  practiceType: 'true-false' | 'open-questions' | 'mixed',
  numQuestions: number,
  questions: PracticeQuestion[],
  language?: 'hebrew' | 'english',
  adaptiveMode?: boolean,
  generationMode?: 'ai' | 'fallback'
): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be authenticated');
  }

  const sessionData = {
    courseId,
    courseName,
    practiceType,
    numQuestions,
    questions,
    language: language || 'hebrew',
    adaptiveMode: Boolean(adaptiveMode),
    generationMode: generationMode || 'ai',
    userId: user.uid,
    createdAt: serverTimestamp(),
    status: 'in-progress',
  };

  const docRef = await addDoc(collection(db, 'practiceSessions'), sessionData);
  return docRef.id;
}

/**
 * Save practice results after completion
 */
export async function savePracticeResults(
  sessionId: string,
  answers: PracticeAnswer[],
  score: number
): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User must be authenticated');
  }

  try {
    // Get the session to get course info
    const sessionDoc = await getDoc(doc(db, 'practiceSessions', sessionId));
    if (!sessionDoc.exists()) {
      throw new Error('Practice session not found');
    }

    const sessionData = sessionDoc.data();
    const questions = (sessionData.questions || []) as PracticeQuestion[];

    // Calculate weak topics (topics with incorrect answers)
    const incorrectTopics = new Set<string>();
    answers.forEach((answer, index) => {
      if (!answer.isCorrect && questions[index]?.topic) {
        const topic = normalizeTopicLabel(questions[index].topic || '');
        if (topic && typeof topic === 'string' && topic.trim().length > 0) {
          incorrectTopics.add(topic);
        }
      }
    });

    const weakTopics = Array.from(incorrectTopics);

    // Prepare answers array - ensure no undefined values
    const cleanedAnswers = answers.map((a, index) => {
      const answerData: any = {
        questionId: String(a.questionId || `q${index}`),
        userAnswer: String(a.userAnswer || ''),
        isCorrect: Boolean(a.isCorrect === true),
      };
      if (a.questionText) answerData.questionText = String(a.questionText);
      if (a.topic) answerData.topic = String(a.topic);
      if (a.mistakeType) answerData.mistakeType = a.mistakeType;
      // Only add score if it exists and is a valid number (for open questions)
      if (a.score !== undefined && a.score !== null && typeof a.score === 'number' && !isNaN(a.score)) {
        answerData.score = Number(a.score);
      }
      return answerData;
    });

    // Prepare result data - ensure all fields are defined and valid
    const resultData: any = {
      sessionId: String(sessionId || ''),
      courseId: String(sessionData.courseId || ''),
      courseName: String(sessionData.courseName || 'Course'),
      userId: String(user.uid || ''),
      score: Number(score || 0),
      totalQuestions: Number(answers.length || 0),
      correctAnswers: Number(answers.filter(a => a.isCorrect === true).length || 0),
      incorrectAnswers: Number(answers.filter(a => a.isCorrect !== true).length || 0),
      answers: cleanedAnswers,
      weakTopics: Array.isArray(weakTopics) ? weakTopics.filter(t => t && typeof t === 'string' && t.trim().length > 0) : [],
      completedAt: serverTimestamp(),
    };
    
    // Final validation - remove any undefined/null values
    const finalData: any = {};
    Object.keys(resultData).forEach(key => {
      const value = resultData[key];
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          // Filter out any undefined/null items from arrays
          finalData[key] = value.filter(item => item !== undefined && item !== null);
        } else if (typeof value === 'object' && value !== null) {
          // Clean nested objects
          const cleanedObj: any = {};
          Object.keys(value).forEach(subKey => {
            if (value[subKey] !== undefined && value[subKey] !== null) {
              cleanedObj[subKey] = value[subKey];
            }
          });
          finalData[key] = cleanedObj;
        } else {
          finalData[key] = value;
        }
      }
    });
    
    console.log('💾 Prepared practice results data:', {
      sessionId: finalData.sessionId,
      courseId: finalData.courseId,
      score: finalData.score,
      totalQuestions: finalData.totalQuestions,
      answersCount: finalData.answers?.length || 0,
      weakTopicsCount: finalData.weakTopics?.length || 0,
    });

    // Validate one more time before saving
    if (!finalData.sessionId || !finalData.userId || finalData.score === undefined) {
      throw new Error('Invalid practice results data: missing required fields');
    }

    // Save results to Firestore - use final cleaned data
    await addDoc(collection(db, 'practiceResults'), finalData);

    console.log('✅ Practice results saved successfully');

    // Update user weakness engine profile per topic
    await updateTopicPerformanceProfile(
      String(user.uid),
      String(sessionData.courseId || ''),
      questions,
      answers
    );

    // Update session status
    try {
      await updateDoc(doc(db, 'practiceSessions', sessionId), {
        status: 'completed',
        completedAt: serverTimestamp(),
      });
      console.log('✅ Practice session updated successfully');
    } catch (updateError: any) {
      // Log but don't fail if session update fails
      console.warn('⚠️ Failed to update session status:', updateError);
    }
  } catch (error: any) {
    console.error('❌ Error saving practice results:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack,
    });
    
    // Re-throw with more context
    throw new Error(
      `Failed to save practice results: ${error.message || 'Unknown error'}`
    );
  }
}

async function updateTopicPerformanceProfile(
  userId: string,
  courseId: string,
  questions: PracticeQuestion[],
  answers: PracticeAnswer[]
): Promise<void> {
  const topicStats = new Map<string, { attempts: number; correct: number }>();

  answers.forEach((answer, idx) => {
    const topic = normalizeTopicLabel(questions[idx]?.topic || '');
    if (!topic) return;
    const existing = topicStats.get(topic) || { attempts: 0, correct: 0 };
    existing.attempts += 1;
    if (answer.isCorrect) existing.correct += 1;
    topicStats.set(topic, existing);
  });

  for (const [topic, stat] of topicStats.entries()) {
    const q = query(
      collection(db, 'userTopicPerformance'),
      where('userId', '==', userId),
      where('courseId', '==', courseId),
      where('topic', '==', topic)
    );
    const snap = await getDocs(q);

    if (snap.empty) {
      const confidence = Math.min(100, stat.attempts * 10);
      const predictedRisk = Math.max(0, 100 - (stat.attempts > 0 ? Math.round((stat.correct / stat.attempts) * 100) : 0));
      await addDoc(collection(db, 'userTopicPerformance'), {
        userId,
        courseId,
        topic,
        attempts: stat.attempts,
        correct: stat.correct,
        accuracy: stat.attempts > 0 ? Math.round((stat.correct / stat.attempts) * 100) : 0,
        confidence,
        predictedRisk,
        rollingAccuracy7: stat.attempts > 0 ? Math.round((stat.correct / stat.attempts) * 100) : 0,
        rollingAccuracy30: stat.attempts > 0 ? Math.round((stat.correct / stat.attempts) * 100) : 0,
        recommendation:
          predictedRisk >= 40
            ? `Focus on ${topic} with mixed and open questions.`
            : `Maintain ${topic} with spaced repetition.`,
        lastUpdated: serverTimestamp(),
      });
      continue;
    }

    const docRef = snap.docs[0];
    const prev = docRef.data() as any;
    const attempts = Number(prev.attempts || 0) + stat.attempts;
    const correct = Number(prev.correct || 0) + stat.correct;
    const accuracy = attempts > 0 ? Math.round((correct / attempts) * 100) : 0;
    const confidence = Math.min(100, attempts * 10);
    const predictedRisk = Math.max(0, 100 - accuracy);
    const rollingAccuracy7 = Math.round((Number(prev.rollingAccuracy7 || accuracy) * 0.6) + (accuracy * 0.4));
    const rollingAccuracy30 = Math.round((Number(prev.rollingAccuracy30 || accuracy) * 0.8) + (accuracy * 0.2));

    await updateDoc(doc(db, 'userTopicPerformance', docRef.id), {
      attempts,
      correct,
      accuracy,
      confidence,
      predictedRisk,
      rollingAccuracy7,
      rollingAccuracy30,
      recommendation:
        predictedRisk >= 40
          ? `Focus on ${topic} with mixed and open questions.`
          : `Maintain ${topic} with spaced repetition.`,
      lastUpdated: serverTimestamp(),
    });
  }
}

export async function getWeaknessInsights(courseId?: string): Promise<{
  weakTopics: TopicPerformance[];
  predictedFailureAreas: string[];
  recommendations: string[];
}> {
  const user = auth.currentUser;
  if (!user) return { weakTopics: [], predictedFailureAreas: [], recommendations: [] };

  let snap;
  if (courseId) {
    snap = await getDocs(
      query(
        collection(db, 'userTopicPerformance'),
        where('userId', '==', user.uid),
        where('courseId', '==', courseId)
      )
    );
  } else {
    snap = await getDocs(query(collection(db, 'userTopicPerformance'), where('userId', '==', user.uid)));
  }

  const weakTopics: TopicPerformance[] = snap.docs
    .map((docSnap) => {
      const d = docSnap.data() as any;
      return {
        topic: String(d?.topic || ''),
        attempts: Number(d?.attempts || 0),
        correct: Number(d?.correct || 0),
        accuracy: Number(d?.accuracy || 0),
        confidence: Number(d?.confidence || 0),
        predictedRisk: Number(d?.predictedRisk ?? Math.max(0, 100 - Number(d?.accuracy || 0))),
        rollingAccuracy7: Number(d?.rollingAccuracy7 || d?.accuracy || 0),
        rollingAccuracy30: Number(d?.rollingAccuracy30 || d?.accuracy || 0),
        recommendation: d?.recommendation ? String(d.recommendation) : undefined,
        lastUpdated: d?.lastUpdated?.toDate ? d.lastUpdated.toDate() : null,
      } as TopicPerformance;
    })
    .filter((item) => !!item.topic)
    .sort((a, b) => Number(b.predictedRisk || 0) - Number(a.predictedRisk || 0));

  const topWeak = weakTopics.slice(0, 5);
  return {
    weakTopics: topWeak,
    predictedFailureAreas: topWeak.filter((t) => Number(t.predictedRisk || 0) >= 45).map((t) => t.topic),
    recommendations: topWeak.map(
      (t) => t.recommendation || `Practice ${t.topic} and review mistakes from recent sessions.`
    ),
  };
}

/**
 * Get practice history for a course
 */
export async function getPracticeHistory(courseId: string): Promise<PracticeResult[]> {
  const user = auth.currentUser;
  if (!user) {
    return [];
  }

  try {
    const resultsRef = collection(db, 'practiceResults');
    
    // Try query with orderBy first (requires index)
    // If it fails (index not ready or not found), fall back to query without orderBy and sort in memory
    let snapshot;
    try {
      const q = query(
        resultsRef,
        where('courseId', '==', courseId),
        where('userId', '==', user.uid),
        orderBy('completedAt', 'desc')
      );
      snapshot = await getDocs(q);
    } catch (indexError: any) {
      // If index error (not found or still building), use simpler query and sort in memory
      const errorMsg = indexError.message || '';
      if (errorMsg.includes('index') || errorMsg.includes('Index')) {
        console.log('⚠️ Index not ready yet, using fallback query (will work until index is built)');
      } else {
        console.log('⚠️ Query error, using fallback query');
      }
      
      const q = query(
        resultsRef,
        where('courseId', '==', courseId),
        where('userId', '==', user.uid)
      );
      snapshot = await getDocs(q);
    }

    const results: PracticeResult[] = [];

    snapshot.forEach((docSnap) => {
      try {
        const data = docSnap.data();
        
        // Handle completedAt - it might be a Firestore Timestamp, Date, or undefined
        let completedAt: Date = new Date(); // Default to current date
        
        if (data.completedAt) {
          try {
            // Check if it's a Firestore Timestamp with toDate method
            if (data.completedAt.toDate && typeof data.completedAt.toDate === 'function') {
              completedAt = data.completedAt.toDate();
            } 
            // Check if it's already a Date object
            else if (data.completedAt instanceof Date) {
              completedAt = data.completedAt;
            } 
            // Check if it's a Firestore Timestamp object with seconds property
            else if (data.completedAt.seconds && typeof data.completedAt.seconds === 'number') {
              completedAt = new Date(data.completedAt.seconds * 1000);
            }
            // Check if it's a number (timestamp in milliseconds)
            else if (typeof data.completedAt === 'number') {
              completedAt = new Date(data.completedAt);
            }
            // If it's a string, try to parse it
            else if (typeof data.completedAt === 'string') {
              const parsed = new Date(data.completedAt);
              if (!isNaN(parsed.getTime())) {
                completedAt = parsed;
              }
            }
          } catch (dateError) {
            console.warn('Error parsing completedAt date, using current date:', dateError);
            completedAt = new Date();
          }
        }
        
        results.push({
          sessionId: String(data.sessionId || ''),
          courseId: String(data.courseId || ''),
          courseName: String(data.courseName || 'Course'),
          userId: String(data.userId || ''),
          score: Number(data.score || 0),
          totalQuestions: Number(data.totalQuestions || 0),
          correctAnswers: Number(data.correctAnswers || 0),
          incorrectAnswers: Number(data.incorrectAnswers || 0),
          answers: Array.isArray(data.answers) ? data.answers : [],
          weakTopics: Array.isArray(data.weakTopics) ? data.weakTopics : [],
          completedAt: completedAt,
        });
      } catch (itemError) {
        console.error('Error processing practice result item:', itemError);
        // Skip this item and continue with others
      }
    });

    // If we used fallback query, sort by date in memory
    if (results.length > 0 && results[0].completedAt) {
      results.sort((a, b) => {
        const dateA = a.completedAt.getTime();
        const dateB = b.completedAt.getTime();
        return dateB - dateA; // Descending order (newest first)
      });
    }

    return results;
  } catch (error: any) {
    console.error('Error fetching practice history:', error);
    
    // If error contains index link, log it for user
    if (error.message && error.message.includes('index')) {
      console.error('💡 To improve performance, create a Firestore index:');
      console.error('   Go to: https://console.firebase.google.com/project/studybuddy-898b1/firestore/indexes');
      console.error('   Or click the link in the error message above');
    }
    
    return [];
  }
}

/**
 * Get practice statistics for a course
 */
export async function getPracticeStats(courseId: string): Promise<{
  totalPractices: number;
  averageScore: number;
  lastPracticeDate: Date | null;
  weakTopics: string[];
}> {
  const history = await getPracticeHistory(courseId);

  if (history.length === 0) {
    return {
      totalPractices: 0,
      averageScore: 0,
      lastPracticeDate: null,
      weakTopics: [],
    };
  }

  const totalPractices = history.length;
  const averageScore = Math.round(
    history.reduce((sum, result) => sum + result.score, 0) / totalPractices
  );

  // Get all weak topics from all practices
  const allWeakTopics = new Set<string>();
  history.forEach((result) => {
    result.weakTopics.forEach((topic) => allWeakTopics.add(topic));
  });

  // Get top 3 most common weak topics
  const topicCounts = new Map<string, number>();
  history.forEach((result) => {
    result.weakTopics.forEach((topic) => {
      topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
    });
  });

  const sortedTopics = Array.from(topicCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([topic]) => topic);

  return {
    totalPractices,
    averageScore,
    lastPracticeDate: history[0]?.completedAt || null,
    weakTopics: sortedTopics,
  };
}

export async function getWeaknessProfile(courseId: string): Promise<TopicPerformance[]> {
  const user = auth.currentUser;
  if (!user) return [];

  try {
    const q = query(
      collection(db, 'userTopicPerformance'),
      where('userId', '==', user.uid),
      where('courseId', '==', courseId)
    );
    const snap = await getDocs(q);
    const rows: TopicPerformance[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as any;
      rows.push({
        topic: String(data.topic || ''),
        attempts: Number(data.attempts || 0),
        correct: Number(data.correct || 0),
        accuracy: Number(data.accuracy || 0),
        lastUpdated: data.lastUpdated?.toDate ? data.lastUpdated.toDate() : null,
      });
    });

    return rows.sort((a, b) => {
      if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
      return b.attempts - a.attempts;
    });
  } catch (error) {
    console.error('Error loading weakness profile:', error);
    return [];
  }
}

export async function getProgressDashboard(courseId: string): Promise<ProgressDashboard> {
  const history = await getPracticeHistory(courseId);
  const topicPerformance = await getWeaknessProfile(courseId);

  if (history.length === 0) {
    return {
      readinessScore: 0,
      averageScore: 0,
      trendDelta: 0,
      courseRankingPercentile: 0,
      topicPerformance,
    };
  }

  const averageScore = Math.round(
    history.reduce((sum, item) => sum + item.score, 0) / history.length
  );

  const recentWindow = history.slice(0, 5);
  const olderWindow = history.slice(5, 10);
  const recentAvg =
    recentWindow.length > 0
      ? recentWindow.reduce((sum, item) => sum + item.score, 0) / recentWindow.length
      : averageScore;
  const olderAvg =
    olderWindow.length > 0
      ? olderWindow.reduce((sum, item) => sum + item.score, 0) / olderWindow.length
      : recentAvg;
  const trendDelta = Math.round(recentAvg - olderAvg);

  const weakPenalty =
    topicPerformance.length > 0
      ? Math.round(
          topicPerformance
            .slice(0, 3)
            .reduce((sum, topic) => sum + Math.max(0, 70 - topic.accuracy), 0) /
            Math.min(3, topicPerformance.length)
        )
      : 0;

  const readinessScore = Math.max(0, Math.min(100, averageScore + Math.round(trendDelta * 0.6) - weakPenalty));
  const courseRankingPercentile = Math.max(1, Math.min(99, Math.round(readinessScore * 0.92 + 4)));

  return {
    readinessScore,
    averageScore,
    trendDelta,
    courseRankingPercentile,
    topicPerformance,
  };
}

