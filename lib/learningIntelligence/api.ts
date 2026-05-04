import { learningIntelligenceEngine } from './engine';
import { AILanguage, AIQuestionType } from './types';

export async function generateUnifiedPracticeQuestions(input: {
  userId?: string;
  courseId: string;
  courseName: string;
  practiceType: AIQuestionType;
  numQuestions: number;
  language: AILanguage;
}) {
  return learningIntelligenceEngine.generatePracticeQuestions(input);
}

export async function generateUnifiedCourseInsights(input: {
  userId?: string;
  courseId: string;
  courseName: string;
  language: AILanguage;
}) {
  return learningIntelligenceEngine.generateCourseInsights(input);
}

export async function askUnifiedCourseAssistant(input: {
  userId?: string;
  courseId: string;
  courseName: string;
  question: string;
  language: AILanguage;
}) {
  return learningIntelligenceEngine.askCourseAssistant(input);
}

export async function evaluateUnifiedOpenAnswer(input: {
  userId?: string;
  courseId?: string;
  question: string;
  userAnswer: string;
  idealAnswer: string;
  language?: AILanguage;
}) {
  return learningIntelligenceEngine.evaluateOpenAnswer(input);
}

export async function generateUnifiedStudyPlan(input: {
  userId: string;
  courseId?: string;
  availableMinutesPerDay?: number;
  language?: AILanguage;
}) {
  return learningIntelligenceEngine.generateStudyPlan(input);
}

export async function semanticSearchCourseContent(input: {
  courseId: string;
  queryText: string;
  maxResults?: number;
}) {
  return learningIntelligenceEngine.runSemanticSearch(input);
}

export async function startCourseFileIntelligenceJob(input: {
  userId?: string;
  courseId: string;
  courseName: string;
  fileId?: string;
}) {
  const insights = await generateUnifiedCourseInsights({
    userId: input.userId,
    courseId: input.courseId,
    courseName: input.courseName,
    language: 'english',
  });
  return insights;
}

