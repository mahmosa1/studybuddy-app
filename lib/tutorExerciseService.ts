import { auth, db } from '@/lib/firebaseConfig';
import type {
  TutorApprovedCourseRef,
  TutorExerciseDoc,
  TutorExerciseQuestion,
  TutorExerciseQuestionType,
  TutorExerciseStatus,
} from '@/shared/types/tutorExercise';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

const COLLECTION = 'tutorExercises';
const SUBMISSIONS_COLLECTION = 'tutorExerciseSubmissions';

export const TUTOR_EXERCISE_SUBMIT_ERROR = {
  NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',
  EXERCISE_NOT_FOUND: 'EXERCISE_NOT_FOUND',
  EXERCISE_NOT_PUBLISHED: 'EXERCISE_NOT_PUBLISHED',
  COURSE_MISMATCH: 'COURSE_MISMATCH',
  ALREADY_SUBMITTED: 'ALREADY_SUBMITTED',
  ANSWERS_INCOMPLETE: 'ANSWERS_INCOMPLETE',
} as const;

export type TutorExerciseQuestionStudentView = {
  id: string;
  text: string;
  options?: string[];
};

/** Published exercise fields safe for students (no correct answers). */
export type PublishedTutorExerciseForStudent = Omit<TutorExerciseDoc, 'questions'> & {
  questions: TutorExerciseQuestionStudentView[];
};

export type TutorExerciseSubmissionAnswer = {
  questionId: string;
  questionText: string;
  answer: string;
};

export type TutorExerciseSubmissionStatus = 'submitted' | 'graded';

export type TutorExerciseSubmissionDoc = {
  id: string;
  exerciseId: string;
  courseId: string;
  courseName: string;
  tutorUid: string;
  tutorName: string;
  studentUid: string;
  studentName: string;
  answers: TutorExerciseSubmissionAnswer[];
  status: TutorExerciseSubmissionStatus;
  submittedAt?: unknown;
  updatedAt?: unknown;
  grade: unknown;
  feedback: unknown;
  gradedAt?: unknown | null;
  totalQuestions?: number;
  questionType?: TutorExerciseQuestionType;
};

function toStudentExerciseView(doc: TutorExerciseDoc): PublishedTutorExerciseForStudent {
  return {
    ...doc,
    questions: doc.questions.map((q) => ({
      id: q.id,
      text: q.text,
      ...(q.options && q.options.length > 0 ? { options: q.options } : {}),
    })),
  };
}

function submissionDocId(exerciseId: string, studentUid: string): string {
  return `${exerciseId}_${studentUid}`;
}

function mapSubmissionDoc(id: string, data: Record<string, unknown>): TutorExerciseSubmissionDoc {
  const answersRaw = Array.isArray(data.answers) ? data.answers : [];
  const answers: TutorExerciseSubmissionAnswer[] = answersRaw.map((a: any) => ({
    questionId: String(a?.questionId || ''),
    questionText: String(a?.questionText || ''),
    answer: String(a?.answer ?? ''),
  }));
  const rawStatus = data.status === 'graded' ? 'graded' : 'submitted';
  return {
    id,
    exerciseId: String(data.exerciseId || ''),
    courseId: String(data.courseId || ''),
    courseName: String(data.courseName || ''),
    tutorUid: String(data.tutorUid || ''),
    tutorName: String(data.tutorName || ''),
    studentUid: String(data.studentUid || ''),
    studentName: String(data.studentName || ''),
    answers,
    status: rawStatus,
    submittedAt: data.submittedAt,
    updatedAt: data.updatedAt,
    grade: data.grade ?? null,
    feedback: data.feedback ?? null,
    gradedAt: data.gradedAt ?? null,
    totalQuestions: typeof data.totalQuestions === 'number' ? data.totalQuestions : undefined,
    questionType: data.questionType as TutorExerciseQuestionType | undefined,
  };
}

function tsToMs(value: unknown): number {
  if (value && typeof (value as { toMillis?: () => number }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  return 0;
}

function mapExerciseDoc(id: string, data: Record<string, unknown>): TutorExerciseDoc {
  const questionsRaw = Array.isArray(data.questions) ? data.questions : [];
  const questions: TutorExerciseQuestion[] = questionsRaw.map((q: any) => ({
    id: String(q?.id || ''),
    text: String(q?.text || ''),
    correctAnswer: String(q?.correctAnswer || ''),
    options: Array.isArray(q?.options) ? q.options.map((o: unknown) => String(o)) : undefined,
  }));

  return {
    id,
    courseId: String(data.courseId || ''),
    courseName: String(data.courseName || ''),
    tutorUid: String(data.tutorUid || ''),
    tutorName: String(data.tutorName || ''),
    title: String(data.title || ''),
    instructions: String(data.instructions || ''),
    questionType: (data.questionType as TutorExerciseQuestionType) || 'open_text',
    questions,
    status: (data.status as TutorExerciseStatus) === 'published' ? 'published' : 'draft',
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    publishedAt: data.publishedAt ?? null,
  };
}

function serializeQuestionsForFirestore(questions: TutorExerciseQuestion[]) {
  return questions.map((q) => ({
    id: q.id,
    text: q.text,
    correctAnswer: q.correctAnswer,
    ...(q.options && q.options.length > 0 ? { options: q.options } : {}),
  }));
}

export async function getTutorExerciseById(exerciseId: string): Promise<TutorExerciseDoc | null> {
  const snap = await getDoc(doc(db, COLLECTION, exerciseId));
  if (!snap.exists()) return null;
  return mapExerciseDoc(snap.id, snap.data() as Record<string, unknown>);
}

export type TutorExerciseContentPatch = {
  title: string;
  instructions: string;
  questions: TutorExerciseQuestion[];
};

export async function updateTutorExercise(exerciseId: string, patch: TutorExerciseContentPatch): Promise<void> {
  await updateDoc(doc(db, COLLECTION, exerciseId), {
    title: patch.title,
    instructions: patch.instructions,
    questions: serializeQuestionsForFirestore(patch.questions),
    updatedAt: serverTimestamp(),
  });
}

/** Publish a draft: persists current content and sets status + publishedAt (single document update). */
export async function publishTutorExercise(exerciseId: string, patch: TutorExerciseContentPatch): Promise<void> {
  await updateDoc(doc(db, COLLECTION, exerciseId), {
    title: patch.title,
    instructions: patch.instructions,
    questions: serializeQuestionsForFirestore(patch.questions),
    status: 'published',
    publishedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function fetchTutorApprovedCourses(uid: string): Promise<TutorApprovedCourseRef[]> {
  const snap = await getDoc(doc(db, 'users', uid));
  const raw = snap.data()?.tutorApprovedCourses;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e: any) => e && e.courseId)
    .map((e: any) => ({
      courseId: String(e.courseId),
      courseName: String(e.courseName || ''),
    }));
}

export async function fetchTutorDisplayName(uid: string): Promise<string> {
  const snap = await getDoc(doc(db, 'users', uid));
  const data = snap.data() as Record<string, unknown> | undefined;
  if (!data) return '';
  const fullName = typeof data.fullName === 'string' ? data.fullName.trim() : '';
  if (fullName) return fullName;
  const username = typeof data.username === 'string' ? data.username.trim() : '';
  if (username) return username;
  return auth.currentUser?.email?.split('@')[0] || '';
}

export async function listTutorExercisesForTutor(tutorUid: string): Promise<TutorExerciseDoc[]> {
  const q = query(collection(db, COLLECTION), where('tutorUid', '==', tutorUid));
  const snap = await getDocs(q);
  const out: TutorExerciseDoc[] = [];
  snap.forEach((d) => {
    out.push(mapExerciseDoc(d.id, d.data() as Record<string, unknown>));
  });
  out.sort((a, b) => {
    const bm = Math.max(tsToMs(b.updatedAt), tsToMs(b.publishedAt), tsToMs(b.createdAt));
    const am = Math.max(tsToMs(a.updatedAt), tsToMs(a.publishedAt), tsToMs(a.createdAt));
    return bm - am;
  });
  return out;
}

/** Published exercises visible to students on the course page (query: courseId + status). */
export async function listPublishedTutorExercisesForCourse(courseId: string): Promise<TutorExerciseDoc[]> {
  const q = query(
    collection(db, COLLECTION),
    where('courseId', '==', courseId),
    where('status', '==', 'published'),
  );
  const snap = await getDocs(q);
  const out: TutorExerciseDoc[] = [];
  snap.forEach((d) => {
    out.push(mapExerciseDoc(d.id, d.data() as Record<string, unknown>));
  });
  out.sort((a, b) => tsToMs(b.publishedAt) - tsToMs(a.publishedAt));
  return out;
}

export type SaveTutorExerciseInput = {
  courseId: string;
  courseName: string;
  tutorUid: string;
  tutorName: string;
  title: string;
  instructions: string;
  questionType: TutorExerciseQuestionType;
  questions: TutorExerciseQuestion[];
  status: TutorExerciseStatus;
};

export async function createTutorExercise(input: SaveTutorExerciseInput): Promise<string> {
  const now = serverTimestamp();
  const base: Record<string, unknown> = {
    courseId: input.courseId,
    courseName: input.courseName,
    tutorUid: input.tutorUid,
    tutorName: input.tutorName,
    title: input.title,
    instructions: input.instructions,
    questionType: input.questionType,
    questions: serializeQuestionsForFirestore(input.questions),
    status: input.status,
    createdAt: now,
    updatedAt: now,
  };
  if (input.status === 'published') {
    base.publishedAt = now;
  } else {
    base.publishedAt = null;
  }
  const ref = await addDoc(collection(db, COLLECTION), base);
  return ref.id;
}

/** Load a published exercise for a student route; validates course and status. */
export async function getPublishedTutorExerciseForStudent(
  courseId: string,
  exerciseId: string,
): Promise<PublishedTutorExerciseForStudent | null> {
  const snap = await getDoc(doc(db, COLLECTION, exerciseId));
  if (!snap.exists()) return null;
  const ex = mapExerciseDoc(snap.id, snap.data() as Record<string, unknown>);
  if (ex.courseId !== courseId || ex.status !== 'published') return null;
  return toStudentExerciseView(ex);
}

/**
 * Full published exercise (including correct answers) only when the student's submission
 * for this exercise is already graded. Otherwise returns null so clients never receive solutions early.
 */
export async function getPublishedExerciseWithSolutionsIfGraded(
  courseId: string,
  exerciseId: string,
  studentUid: string,
): Promise<TutorExerciseDoc | null> {
  const sub = await getStudentSubmissionForExercise(exerciseId, studentUid);
  if (!sub || sub.status !== 'graded') return null;
  const snap = await getDoc(doc(db, COLLECTION, exerciseId));
  if (!snap.exists()) return null;
  const ex = mapExerciseDoc(snap.id, snap.data() as Record<string, unknown>);
  if (ex.courseId !== courseId || ex.status !== 'published') return null;
  return ex;
}

/** One submission per student per exercise (deterministic document id). */
export async function getStudentSubmissionForExercise(
  exerciseId: string,
  studentUid: string,
): Promise<TutorExerciseSubmissionDoc | null> {
  if (!exerciseId || !studentUid) return null;
  const snap = await getDoc(doc(db, SUBMISSIONS_COLLECTION, submissionDocId(exerciseId, studentUid)));
  if (!snap.exists()) return null;
  return mapSubmissionDoc(snap.id, snap.data() as Record<string, unknown>);
}

/** Parallel reads for course list cards (small N per course). */
export async function getStudentSubmissionsForExerciseIds(
  exerciseIds: string[],
  studentUid: string,
): Promise<Record<string, TutorExerciseSubmissionDoc | null>> {
  const out: Record<string, TutorExerciseSubmissionDoc | null> = {};
  if (!studentUid || exerciseIds.length === 0) return out;
  const unique = [...new Set(exerciseIds.filter(Boolean))];
  const results = await Promise.all(
    unique.map((id) => getStudentSubmissionForExercise(id, studentUid)),
  );
  unique.forEach((id, i) => {
    out[id] = results[i];
  });
  return out;
}

export async function submitTutorExerciseSolution(params: {
  exerciseId: string;
  courseIdFromRoute: string;
  studentUid: string;
  studentName: string;
  answersByQuestionId: Record<string, string>;
}): Promise<void> {
  const { exerciseId, courseIdFromRoute, studentUid, studentName, answersByQuestionId } = params;
  if (!studentUid) {
    throw new Error(TUTOR_EXERCISE_SUBMIT_ERROR.NOT_AUTHENTICATED);
  }

  const subRef = doc(db, SUBMISSIONS_COLLECTION, submissionDocId(exerciseId, studentUid));
  const existing = await getDoc(subRef);
  if (existing.exists()) {
    throw new Error(TUTOR_EXERCISE_SUBMIT_ERROR.ALREADY_SUBMITTED);
  }

  const exSnap = await getDoc(doc(db, COLLECTION, exerciseId));
  if (!exSnap.exists()) {
    throw new Error(TUTOR_EXERCISE_SUBMIT_ERROR.EXERCISE_NOT_FOUND);
  }
  const exercise = mapExerciseDoc(exSnap.id, exSnap.data() as Record<string, unknown>);
  if (exercise.status !== 'published') {
    throw new Error(TUTOR_EXERCISE_SUBMIT_ERROR.EXERCISE_NOT_PUBLISHED);
  }
  if (exercise.courseId !== courseIdFromRoute) {
    throw new Error(TUTOR_EXERCISE_SUBMIT_ERROR.COURSE_MISMATCH);
  }

  if (exercise.questions.length === 0) {
    throw new Error(TUTOR_EXERCISE_SUBMIT_ERROR.ANSWERS_INCOMPLETE);
  }

  const answers: TutorExerciseSubmissionAnswer[] = [];
  for (const q of exercise.questions) {
    const raw = answersByQuestionId[q.id];
    const answer = typeof raw === 'string' ? raw.trim() : '';
    if (!answer) {
      throw new Error(TUTOR_EXERCISE_SUBMIT_ERROR.ANSWERS_INCOMPLETE);
    }
    answers.push({ questionId: q.id, questionText: q.text, answer });
  }

  await setDoc(subRef, {
    id: subRef.id,
    exerciseId: exercise.id,
    courseId: exercise.courseId,
    courseName: exercise.courseName,
    tutorUid: exercise.tutorUid,
    tutorName: exercise.tutorName,
    studentUid,
    studentName,
    answers,
    status: 'submitted',
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    grade: null,
    feedback: null,
    gradedAt: null,
    totalQuestions: exercise.questions.length,
    questionType: exercise.questionType,
  });
}

/** Submissions for one exercise, scoped to the owning tutor (query by tutorUid; filter exerciseId in app to avoid a composite index). */
export async function listSubmissionsForExercise(
  exerciseId: string,
  tutorUid: string,
): Promise<TutorExerciseSubmissionDoc[]> {
  if (!exerciseId || !tutorUid) return [];
  const q = query(collection(db, SUBMISSIONS_COLLECTION), where('tutorUid', '==', tutorUid));
  const snap = await getDocs(q);
  const out: TutorExerciseSubmissionDoc[] = [];
  snap.forEach((d) => {
    const mapped = mapSubmissionDoc(d.id, d.data() as Record<string, unknown>);
    if (mapped.exerciseId === exerciseId) {
      out.push(mapped);
    }
  });
  out.sort((a, b) => tsToMs(b.submittedAt) - tsToMs(a.submittedAt));
  return out;
}

export const TUTOR_EXERCISE_GRADE_ERROR = {
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_GRADE: 'INVALID_GRADE',
} as const;

export async function getSubmissionById(submissionId: string): Promise<TutorExerciseSubmissionDoc | null> {
  if (!submissionId) return null;
  const snap = await getDoc(doc(db, SUBMISSIONS_COLLECTION, submissionId));
  if (!snap.exists()) return null;
  return mapSubmissionDoc(snap.id, snap.data() as Record<string, unknown>);
}

export async function gradeTutorExerciseSubmission(
  submissionId: string,
  tutorUid: string,
  payload: { grade: number; feedback: string },
): Promise<void> {
  if (!tutorUid) {
    throw new Error(TUTOR_EXERCISE_GRADE_ERROR.FORBIDDEN);
  }
  const { grade, feedback } = payload;
  if (typeof grade !== 'number' || !Number.isFinite(grade) || grade < 0 || grade > 100) {
    throw new Error(TUTOR_EXERCISE_GRADE_ERROR.INVALID_GRADE);
  }
  const ref = doc(db, SUBMISSIONS_COLLECTION, submissionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error(TUTOR_EXERCISE_GRADE_ERROR.NOT_FOUND);
  }
  const data = snap.data() as Record<string, unknown>;
  if (String(data.tutorUid) !== tutorUid) {
    throw new Error(TUTOR_EXERCISE_GRADE_ERROR.FORBIDDEN);
  }
  await updateDoc(ref, {
    status: 'graded',
    grade,
    feedback: typeof feedback === 'string' ? feedback : '',
    gradedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
