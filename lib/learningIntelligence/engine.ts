import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { extractTextFromCourseFiles } from '@/lib/fileContentExtractor';
import { buildLearningContext } from './contextBuilder';
import { learningCache } from './cache';
import { learningIntelligenceConfig } from './config';
import { ensureCourseIndexed, retrieveRelevantChunks, semanticSearch } from './retrieval';
import { traceLearningEvent } from './tracing';
import {
  AILanguage,
  AIResponseQualityStatus,
  AIQuestionType,
  CourseInsights,
  LearningIntelligenceQuestion,
  OpenAnswerEvaluation,
  StudyPlan,
  StudyPlanItem,
  WeaknessSignal,
} from './types';

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';

function pickWeakTopics(weakTopics: WeaknessSignal[]): string[] {
  return [...weakTopics]
    .sort((a, b) => b.predictedRisk - a.predictedRisk)
    .slice(0, 6)
    .map((t) => t.topic);
}

async function chatCompletionJSON(prompt: string, temperature = 0.3, maxTokens = 1500): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`chat completion failed: ${res.status} ${errorText}`);
  }
  const data = await res.json();
  return String(data?.choices?.[0]?.message?.content || '');
}

function parseJSONBlock(content: string): any {
  const arrMatch = content.match(/\[[\s\S]*\]/);
  if (arrMatch) return JSON.parse(arrMatch[0]);
  const objMatch = content.match(/\{[\s\S]*\}/);
  if (objMatch) return JSON.parse(objMatch[0]);
  return JSON.parse(content);
}

function isGenericAnswer(text: string): boolean {
  const value = (text || '').trim().toLowerCase();
  if (!value || value.length < 40) return true;
  const genericPatterns = [
    'as an ai',
    'it depends',
    'cannot determine',
    'not enough information',
    'general overview',
    'באופן כללי',
    'באופן עקרוני',
  ];
  return genericPatterns.some((pattern) => value.includes(pattern));
}

function buildContextKeywords(input: string): string[] {
  const stop = new Set([
    'the', 'and', 'for', 'with', 'that', 'this', 'from', 'your', 'course', 'about',
    'של', 'עם', 'את', 'זה', 'היא', 'אני', 'אתה', 'הקורס', 'למידה',
  ]);
  return (input || '')
    .toLowerCase()
    .split(/[^a-zA-Z\u0590-\u05FF0-9]+/)
    .filter((word) => word.length >= 5 && !stop.has(word))
    .slice(0, 120);
}

function hasContextReference(answer: string, contextText: string, courseName: string): boolean {
  const answerLower = (answer || '').toLowerCase();
  if (!answerLower) return false;
  if (courseName && answerLower.includes(courseName.toLowerCase().slice(0, 8))) return true;
  const keywords = buildContextKeywords(contextText);
  return keywords.some((keyword) => answerLower.includes(keyword));
}

function classifyQuality(params: {
  hasCourseFiles: boolean;
  sourcesRetrieved: number;
  text: string;
  contextText?: string;
  courseName?: string;
  fallbackUsed?: boolean;
  errored?: boolean;
}): AIResponseQualityStatus {
  if (params.errored) return 'error';
  if (params.fallbackUsed) return 'fallback';
  if (params.hasCourseFiles && params.sourcesRetrieved === 0) return 'no_sources';
  if (isGenericAnswer(params.text)) return 'weak_grounding';
  if (
    params.hasCourseFiles &&
    params.sourcesRetrieved > 0 &&
    !hasContextReference(params.text, params.contextText || '', params.courseName || '')
  ) {
    return 'weak_grounding';
  }
  return 'grounded';
}

export class LearningIntelligenceEngine {
  async generatePracticeQuestions(params: {
    userId?: string;
    courseId: string;
    courseName: string;
    practiceType: AIQuestionType;
    numQuestions: number;
    language: AILanguage;
  }): Promise<LearningIntelligenceQuestion[]> {
    const started = Date.now();
    try {
      const cacheKey = learningCache.createKey([
        'questions',
        params.userId,
        params.courseId,
        params.practiceType,
        params.numQuestions,
        params.language,
      ]);
      const cached = learningCache.get<LearningIntelligenceQuestion[]>(cacheKey);
      if (cached) return cached;

      const context = await buildLearningContext({
        userId: params.userId,
        courseId: params.courseId,
        courseName: params.courseName,
      });
      await ensureCourseIndexed(params.courseId, context.files);
      const relevant = await retrieveRelevantChunks({
        courseId: params.courseId,
        queryText: `Generate ${params.practiceType} questions for ${params.courseName}`,
        maxChunks: 5,
      });
      const weakTopics = pickWeakTopics(context.weakTopics);
      const sourceText = relevant.map((r) => `[${r.fileName}] ${r.content}`).join('\n\n').slice(0, 12000);

      if (!OPENAI_API_KEY || !sourceText.trim()) {
        throw new Error('engine could not generate questions without model or retrieval context');
      }

      const prompt = `
Return JSON only.
Generate ${params.numQuestions} ${params.practiceType} study questions in ${params.language}.
Course: ${params.courseName}
Weak topics to emphasize: ${weakTopics.join(', ') || 'none'}

Schema:
[
  {
    "id": "q1",
    "question": "...",
    "type": "true-false | open | multiple-choice",
    "options": ["..."],
    "correctAnswer": "...",
    "explanation": "...",
    "topic": "...",
    "difficulty": "easy | medium | hard"
  }
]

Use only course sources below:
${sourceText}
`.trim();

      const content = await chatCompletionJSON(prompt, 0.35, 1600);
      const parsed = parseJSONBlock(content);
      const questions = (Array.isArray(parsed) ? parsed : parsed?.questions || [])
        .slice(0, params.numQuestions)
        .map((q: any, idx: number) => ({
          id: String(q?.id || `q${idx + 1}`),
          question: String(q?.question || ''),
          type: (q?.type || 'open') as LearningIntelligenceQuestion['type'],
          options: Array.isArray(q?.options) ? q.options.map((v: any) => String(v)) : undefined,
          correctAnswer: String(q?.correctAnswer || ''),
          explanation: q?.explanation ? String(q.explanation) : undefined,
          topic: q?.topic ? String(q.topic) : undefined,
          source: 'ai' as const,
          difficulty: (q?.difficulty || 'medium') as 'easy' | 'medium' | 'hard',
        }))
        .filter((q: LearningIntelligenceQuestion) => q.question && q.correctAnswer);

      learningCache.set(cacheKey, questions, learningIntelligenceConfig.cacheTtlMs.questions);
      await traceLearningEvent({
        traceType: 'questions',
        userId: params.userId,
        courseId: params.courseId,
        latencyMs: Date.now() - started,
        sourceChunkIds: relevant.map((c) => c.id),
        sourceFileIds: relevant.map((c) => c.fileId),
        model: 'gpt-4o-mini',
        fallbackUsed: false,
        qualityStatus: classifyQuality({
          hasCourseFiles: context.files.length > 0,
          sourcesRetrieved: relevant.length,
          text: questions.map((q) => `${q.question} ${q.correctAnswer} ${q.topic || ''}`).join(' '),
          contextText: sourceText,
          courseName: params.courseName,
        }),
      });
      return questions;
    } catch (error: any) {
      await traceLearningEvent({
        traceType: 'questions',
        userId: params.userId,
        courseId: params.courseId,
        latencyMs: Date.now() - started,
        errorCode: String(error?.message || 'questions_engine_error'),
        qualityStatus: 'error',
      });
      throw error;
    }
  }

  async generateCourseInsights(params: {
    userId?: string;
    courseId: string;
    courseName: string;
    language: AILanguage;
  }): Promise<CourseInsights> {
    const started = Date.now();
    try {
      const cacheKey = learningCache.createKey(['insights', params.courseId, params.language]);
      const cached = learningCache.get<CourseInsights>(cacheKey);
      if (cached) return cached;

      const context = await buildLearningContext({
        userId: params.userId,
        courseId: params.courseId,
        courseName: params.courseName,
      });
      const extracted = await extractTextFromCourseFiles(context.files, {
        maxFiles: 10,
        maxTotalChars: 130000,
      });
      if (!OPENAI_API_KEY || !extracted.trim()) {
        throw new Error('engine insights unavailable without content/model');
      }

    const prompt = `
Return JSON only:
{
  "summary": "short summary",
  "keyPoints": ["..."],
  "flashcards": [{"question":"...","answer":"..."}],
  "quizSeeds": [{"question":"...","topic":"..."}],
  "keyConcepts": ["..."]
}
Language: ${params.language}
Course: ${params.courseName}
Content:
${extracted.slice(0, 15000)}
`.trim();

      const content = await chatCompletionJSON(prompt, 0.3, 1400);
      const parsed = parseJSONBlock(content);
      const insights: CourseInsights = {
      summary: String(parsed?.summary || ''),
      keyPoints: Array.isArray(parsed?.keyPoints) ? parsed.keyPoints.slice(0, 8).map((v: any) => String(v)) : [],
      flashcards: Array.isArray(parsed?.flashcards)
        ? parsed.flashcards.slice(0, 10).map((f: any) => ({ question: String(f?.question || ''), answer: String(f?.answer || '') }))
        : [],
      quizSeeds: Array.isArray(parsed?.quizSeeds)
        ? parsed.quizSeeds.slice(0, 8).map((q: any) => ({ question: String(q?.question || ''), topic: q?.topic ? String(q.topic) : undefined }))
        : [],
      keyConcepts: Array.isArray(parsed?.keyConcepts) ? parsed.keyConcepts.slice(0, 12).map((v: any) => String(v)) : [],
    };

      await addDoc(collection(db, 'courseFileInsights'), {
      courseId: params.courseId,
      summary: insights.summary,
      keyPoints: insights.keyPoints,
      flashcards: insights.flashcards,
      quizSeeds: insights.quizSeeds,
      keyConcepts: insights.keyConcepts,
      createdAt: serverTimestamp(),
    });

      learningCache.set(cacheKey, insights, learningIntelligenceConfig.cacheTtlMs.summary);
      await traceLearningEvent({
        traceType: 'summary',
        userId: params.userId,
        courseId: params.courseId,
        latencyMs: Date.now() - started,
        model: 'gpt-4o-mini',
        qualityStatus: classifyQuality({
          hasCourseFiles: context.files.length > 0,
          sourcesRetrieved: extracted.trim() ? 1 : 0,
          text: `${insights.summary} ${insights.keyPoints.join(' ')}`,
          contextText: extracted.slice(0, 3000),
          courseName: params.courseName,
        }),
      });
      return insights;
    } catch (error: any) {
      await traceLearningEvent({
        traceType: 'summary',
        userId: params.userId,
        courseId: params.courseId,
        latencyMs: Date.now() - started,
        errorCode: String(error?.message || 'summary_engine_error'),
        qualityStatus: 'error',
      });
      throw error;
    }
  }

  async askCourseAssistant(params: {
    userId?: string;
    courseId: string;
    courseName: string;
    question: string;
    language: AILanguage;
  }): Promise<{
    answer: string;
    sourceFiles: string[];
    sourceChunks: string[];
    qualityStatus: AIResponseQualityStatus;
    traceId?: string;
  }> {
    const started = Date.now();
    try {
      const context = await buildLearningContext({
        userId: params.userId,
        courseId: params.courseId,
        courseName: params.courseName,
      });
      await ensureCourseIndexed(params.courseId, context.files);
      const chunks = await retrieveRelevantChunks({
        courseId: params.courseId,
        queryText: params.question,
        maxChunks: 5,
      });
      const source = chunks.map((c) => `[${c.fileName}] ${c.content}`).join('\n\n');
      if (!OPENAI_API_KEY || !source.trim()) {
        throw new Error('course assistant unavailable without retrieval context');
      }
      const weakFocus = pickWeakTopics(context.weakTopics).slice(0, 3).join(', ');
      const prompt = `
Answer in ${params.language}. Keep answer concise and practical.
Course: ${params.courseName}
User weak areas: ${weakFocus || 'unknown'}
Question: ${params.question}
Use only sources:
${source}
`.trim();
      const content = await chatCompletionJSON(prompt, 0.25, 900);
      const answer = content.trim();
      const qualityStatus = classifyQuality({
        hasCourseFiles: context.files.length > 0,
        sourcesRetrieved: chunks.length,
        text: answer,
        contextText: source,
        courseName: params.courseName,
      });
      const traceId = await traceLearningEvent({
        traceType: 'chat',
        userId: params.userId,
        courseId: params.courseId,
        latencyMs: Date.now() - started,
        sourceFileIds: chunks.map((c) => c.fileId),
        sourceChunkIds: chunks.map((c) => c.id),
        model: 'gpt-4o-mini',
        qualityStatus,
      });
      return {
        answer,
        sourceFiles: chunks.map((c) => c.fileName),
        sourceChunks: chunks.map((c) => c.id),
        qualityStatus,
        traceId: traceId || undefined,
      };
    } catch (error: any) {
      await traceLearningEvent({
        traceType: 'chat',
        userId: params.userId,
        courseId: params.courseId,
        latencyMs: Date.now() - started,
        errorCode: String(error?.message || 'chat_engine_error'),
        qualityStatus: 'error',
      });
      throw error;
    }
  }

  async evaluateOpenAnswer(params: {
    userId?: string;
    courseId?: string;
    question: string;
    userAnswer: string;
    idealAnswer: string;
    language?: AILanguage;
  }): Promise<OpenAnswerEvaluation> {
    const started = Date.now();
    const maybeChunks =
      params.courseId && params.question
        ? await retrieveRelevantChunks({ courseId: params.courseId, queryText: params.question, maxChunks: 3 })
        : [];
    const sourceText = maybeChunks.map((c) => c.content).join('\n\n').slice(0, 6000);

    if (!OPENAI_API_KEY) {
      const overlap = params.userAnswer
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .filter((w) => params.idealAnswer.toLowerCase().includes(w)).length;
      const score = Math.max(5, Math.min(95, Math.round((overlap / Math.max(1, params.idealAnswer.split(/\s+/).length)) * 100)));
      return {
        score,
        feedback: score >= 70 ? 'Good conceptual match. Add clearer structure.' : 'Answer is partially aligned. Review core concepts and provide evidence.',
        idealAnswer: params.idealAnswer,
        gapAnalysis: 'Heuristic evaluation used because model was unavailable.',
        nextSteps: ['Review weak concepts', 'Use precise terms', 'Provide one concrete example'],
        mistakeTypes: score < 50 ? ['conceptual'] : ['incomplete'],
      };
    }

    const prompt = `
Return JSON only:
{
  "score": 0-100,
  "feedback": "...",
  "idealAnswer": "...",
  "gapAnalysis": "...",
  "nextSteps": ["..."],
  "mistakeTypes": ["conceptual|careless|incomplete"]
}
Question: ${params.question}
StudentAnswer: ${params.userAnswer}
ReferenceAnswer: ${params.idealAnswer}
Sources:
${sourceText || 'N/A'}
`.trim();
    const content = await chatCompletionJSON(prompt, 0.2, 900);
    const parsed = parseJSONBlock(content);
    const evaluation: OpenAnswerEvaluation = {
      score: Number(parsed?.score || 0),
      feedback: String(parsed?.feedback || ''),
      idealAnswer: String(parsed?.idealAnswer || params.idealAnswer),
      gapAnalysis: String(parsed?.gapAnalysis || ''),
      nextSteps: Array.isArray(parsed?.nextSteps) ? parsed.nextSteps.map((v: any) => String(v)) : [],
      mistakeTypes: Array.isArray(parsed?.mistakeTypes) ? parsed.mistakeTypes : [],
      sourceChunkIds: maybeChunks.map((c) => c.id),
    };
    await traceLearningEvent({
      traceType: 'evaluation',
      userId: params.userId,
      courseId: params.courseId,
      latencyMs: Date.now() - started,
      sourceChunkIds: maybeChunks.map((c) => c.id),
      model: 'gpt-4o-mini',
    });
    return evaluation;
  }

  async generateStudyPlan(params: {
    userId: string;
    courseId?: string;
    availableMinutesPerDay?: number;
    language?: AILanguage;
  }): Promise<StudyPlan> {
    const courseId = params.courseId || '';
    const context = await buildLearningContext({
      userId: params.userId,
      courseId,
      courseName: 'Study Plan',
    });
    const weak = [...context.weakTopics].sort((a, b) => b.predictedRisk - a.predictedRisk).slice(0, 6);
    const baseMinutes = Math.max(10, Math.floor((params.availableMinutesPerDay || 60) / Math.max(1, weak.length)));

    const items: StudyPlanItem[] = weak.map((w, idx) => ({
      topic: w.topic,
      priority: idx < 2 ? 'high' : idx < 4 ? 'medium' : 'low',
      estimatedMinutes: baseMinutes,
      recommendation: `Practice ${w.topic} with mixed and open questions, then review mistakes.`,
      targetAccuracy: Math.min(95, Math.max(70, 100 - Math.round(w.predictedRisk / 2))),
    }));

    const plan: StudyPlan = {
      userId: params.userId,
      courseId: params.courseId,
      generatedAt: Date.now(),
      availableMinutesPerDay: params.availableMinutesPerDay,
      items,
    };

    await addDoc(collection(db, 'studyPlans'), {
      ...plan,
      createdAt: serverTimestamp(),
    });
    await traceLearningEvent({
      traceType: 'study_plan',
      userId: params.userId,
      courseId: params.courseId,
      sourceFileIds: context.files.map((f) => String(f.id || '')),
    });
    return plan;
  }

  async runSemanticSearch(params: {
    courseId: string;
    queryText: string;
    maxResults?: number;
  }) {
    const results = await semanticSearch({
      courseId: params.courseId,
      searchTerm: params.queryText,
      maxResults: params.maxResults,
    });
    await traceLearningEvent({
      traceType: 'semantic_search',
      courseId: params.courseId,
      sourceChunkIds: results.map((r) => r.chunkId),
    });
    return results;
  }
}

export const learningIntelligenceEngine = new LearningIntelligenceEngine();

