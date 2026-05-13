export type TutorExerciseQuestionType = 'open_text' | 'multiple_choice' | 'true_false';

export type TutorExerciseQuestion = {
  id: string;
  text: string;
  correctAnswer: string;
  options?: string[];
};

export type TutorExerciseStatus = 'draft' | 'published';

export type TutorExerciseDoc = {
  id: string;
  courseId: string;
  courseName: string;
  tutorUid: string;
  tutorName: string;
  title: string;
  instructions: string;
  questionType: TutorExerciseQuestionType;
  questions: TutorExerciseQuestion[];
  status: TutorExerciseStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
  publishedAt?: unknown | null;
};

export type TutorApprovedCourseRef = {
  courseId: string;
  courseName: string;
};
