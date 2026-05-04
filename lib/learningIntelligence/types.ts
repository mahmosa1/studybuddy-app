export type AIQuestionType = 'true-false' | 'open-questions' | 'mixed';
export type AILanguage = 'hebrew' | 'english';

export type LearningIntelligenceQuestion = {
  id: string;
  question: string;
  type: 'true-false' | 'open' | 'multiple-choice';
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  topic?: string;
  source?: 'ai' | 'fallback';
  difficulty?: 'easy' | 'medium' | 'hard';
};

export type CourseFileRef = {
  id?: string;
  courseId: string;
  name: string;
  url: string;
  mimeType?: string | null;
  size?: number | null;
};

export type WeaknessSignal = {
  topic: string;
  attempts: number;
  correct: number;
  accuracy: number;
  confidence: number;
  predictedRisk: number;
};

export type LearningContext = {
  userId?: string;
  courseId: string;
  courseName: string;
  files: CourseFileRef[];
  weakTopics: WeaknessSignal[];
  recentScores: number[];
  recentQuestions: Array<{ question: string; topic?: string; isCorrect?: boolean }>;
};

export type RetrievalChunk = {
  id: string;
  fileId: string;
  fileName: string;
  chunkIndex: number;
  content: string;
  embedding?: number[];
  score?: number;
};

export type CourseInsights = {
  summary: string;
  keyPoints: string[];
  flashcards: Array<{ question: string; answer: string }>;
  quizSeeds: Array<{ question: string; topic?: string }>;
  keyConcepts: string[];
};

export type SemanticSearchResult = {
  content: string;
  fileName: string;
  score: number;
  chunkId: string;
};

export type StudyPlanItem = {
  topic: string;
  priority: 'high' | 'medium' | 'low';
  estimatedMinutes: number;
  recommendation: string;
  targetAccuracy: number;
};

export type StudyPlan = {
  userId: string;
  courseId?: string;
  generatedAt: number;
  availableMinutesPerDay?: number;
  items: StudyPlanItem[];
};

export type OpenAnswerEvaluation = {
  score: number;
  feedback: string;
  idealAnswer?: string;
  gapAnalysis?: string;
  nextSteps?: string[];
  mistakeTypes?: Array<'conceptual' | 'careless' | 'incomplete'>;
  sourceChunkIds?: string[];
};

export type AIResponseQualityStatus =
  | 'grounded'
  | 'weak_grounding'
  | 'no_sources'
  | 'fallback'
  | 'error';

export type TracePayload = {
  traceType: 'questions' | 'summary' | 'chat' | 'evaluation' | 'study_plan' | 'semantic_search' | 'file_pipeline';
  userId?: string;
  courseId?: string;
  sessionId?: string;
  model?: string;
  latencyMs?: number;
  sourceFileIds?: string[];
  sourceChunkIds?: string[];
  fallbackUsed?: boolean;
  fallbackReason?: string;
  errorCode?: string;
  promptHash?: string;
  qualityStatus?: AIResponseQualityStatus;
};

