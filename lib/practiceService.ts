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

/**
 * Save a practice session to Firestore
 */
export async function savePracticeSession(
  courseId: string,
  courseName: string,
  practiceType: 'true-false' | 'open-questions' | 'mixed',
  numQuestions: number,
  questions: PracticeQuestion[]
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
        const topic = questions[index].topic;
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

