import { addDoc, collection, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { extractTextFromCourseFiles } from '@/lib/fileContentExtractor';
import { CourseFileRef, RetrievalChunk, SemanticSearchResult } from './types';
import { learningIntelligenceConfig } from './config';

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';

function splitIntoChunks(text: string, size = 1200): string[] {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const chunks: string[] = [];
  for (let i = 0; i < normalized.length; i += size) {
    chunks.push(normalized.slice(i, i + size));
  }
  return chunks;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return -1;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (!normA || !normB) return -1;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function createEmbedding(text: string): Promise<number[] | null> {
  if (!OPENAI_API_KEY) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.slice(0, 6000),
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const embedding = data?.data?.[0]?.embedding;
    return Array.isArray(embedding) ? embedding.map((v: any) => Number(v || 0)) : null;
  } catch (error) {
    console.log('createEmbedding error:', error);
    return null;
  }
}

export async function upsertCourseFileChunks(params: {
  courseId: string;
  file: CourseFileRef;
  chunks: string[];
}): Promise<void> {
  const { courseId, file, chunks } = params;
  for (let i = 0; i < chunks.length; i++) {
    const content = chunks[i];
    const embedding = await createEmbedding(content);
    await addDoc(collection(db, 'courseFileChunks'), {
      courseId,
      fileId: file.id || '',
      fileName: file.name,
      fileUrl: file.url,
      chunkIndex: i,
      content,
      embedding: embedding || [],
      createdAt: serverTimestamp(),
    });
  }
}

export async function ensureCourseIndexed(courseId: string, files: CourseFileRef[]): Promise<void> {
  if (!files.length) return;
  const existing = await getDocs(query(collection(db, 'courseFileChunks'), where('courseId', '==', courseId)));
  if (!existing.empty) return;

  await addDoc(collection(db, 'courseFileJobs'), {
    courseId,
    status: 'running',
    createdAt: serverTimestamp(),
  });

  for (const file of files.slice(0, 8)) {
    const extracted = await extractTextFromCourseFiles([file], { maxFiles: 1, maxTotalChars: 90000 });
    const chunks = splitIntoChunks(extracted, learningIntelligenceConfig.retrieval.maxChunkLength).slice(0, 18);
    if (chunks.length) {
      await upsertCourseFileChunks({ courseId, file, chunks });
    }
  }

  await addDoc(collection(db, 'courseFileJobs'), {
    courseId,
    status: 'completed',
    createdAt: serverTimestamp(),
  });
}

export async function retrieveRelevantChunks(params: {
  courseId: string;
  queryText: string;
  maxChunks?: number;
}): Promise<RetrievalChunk[]> {
  const { courseId, queryText, maxChunks = learningIntelligenceConfig.retrieval.maxChunks } = params;
  const queryEmbedding = await createEmbedding(queryText);
  const snap = await getDocs(query(collection(db, 'courseFileChunks'), where('courseId', '==', courseId)));
  const chunks = snap.docs.map((docSnap) => {
    const d = docSnap.data() as any;
    return {
      id: docSnap.id,
      fileId: String(d?.fileId || ''),
      fileName: String(d?.fileName || 'File'),
      chunkIndex: Number(d?.chunkIndex || 0),
      content: String(d?.content || ''),
      embedding: Array.isArray(d?.embedding) ? d.embedding.map((v: any) => Number(v || 0)) : [],
    } as RetrievalChunk;
  });

  if (!queryEmbedding) {
    return chunks.slice(0, maxChunks);
  }

  return chunks
    .map((chunk) => ({
      ...chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding || []),
    }))
    .sort((a, b) => Number(b.score || -1) - Number(a.score || -1))
    .slice(0, maxChunks);
}

export async function semanticSearch(params: {
  courseId: string;
  searchTerm: string;
  maxResults?: number;
}): Promise<SemanticSearchResult[]> {
  const relevant = await retrieveRelevantChunks({
    courseId: params.courseId,
    queryText: params.searchTerm,
    maxChunks: params.maxResults || 8,
  });

  return relevant.map((chunk) => ({
    content: chunk.content,
    fileName: chunk.fileName,
    score: Number(chunk.score || 0),
    chunkId: chunk.id,
  }));
}

