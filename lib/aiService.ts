// lib/aiService.ts
// Service for generating practice questions using OpenAI API

import { collection, getDocs, query, where } from 'firebase/firestore';
import { extractTextFromCourseFiles } from './fileContentExtractor';
import { auth, db } from './firebaseConfig';
import {
  askUnifiedCourseAssistant,
  evaluateUnifiedOpenAnswer,
  generateUnifiedCourseInsights,
  generateUnifiedPracticeQuestions,
  semanticSearchCourseContent,
} from './learningIntelligence/api';
import { traceLearningEvent } from './learningIntelligence/tracing';

// You'll need to add your OpenAI API key to environment variables
// For now, we'll use a placeholder - you should use Expo Constants or environment variables
const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';

/**
 * Upload a file to OpenAI and get file ID
 * This allows GPT-4o to read the file content directly
 * 
 * IMPORTANT: This function downloads the PDF, extracts its text content,
 * and sends the text directly to OpenAI. This is more reliable than
 * trying to upload the file to OpenAI File API in React Native.
 */
async function uploadFileToOpenAI(fileUrl: string, fileName: string): Promise<string | null> {
  if (!OPENAI_API_KEY) {
    return null;
  }

  try {
    console.log(`📤 Uploading file to OpenAI: ${fileName}`);
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      console.warn(`⚠️ Failed to download file for OpenAI upload: ${fileName} (${fileResponse.status})`);
      return null;
    }

    const blob = await fileResponse.blob();
    const form = new FormData();
    form.append('purpose', 'assistants');
    form.append('file', blob as any, fileName || 'course-file.pdf');

    const uploadResponse = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: form as any,
    });

    if (!uploadResponse.ok) {
      const errText = await uploadResponse.text();
      console.warn(`⚠️ OpenAI file upload failed for ${fileName}: ${uploadResponse.status} ${errText}`);
      return null;
    }

    const uploadData = await uploadResponse.json();
    const fileId = uploadData?.id;
    if (fileId) {
      console.log(`✅ Uploaded file to OpenAI: ${fileName} -> ${fileId}`);
      return String(fileId);
    }
    return null;
  } catch (error) {
    console.warn(`⚠️ Error uploading file to OpenAI (${fileName}):`, error);
    return null;
  }
}

/**
 * Upload multiple files to OpenAI and return their IDs
 */
async function uploadFilesToOpenAI(
  files: Array<{ url: string; name: string; mimeType?: string | null }>
): Promise<string[]> {
  const fileIds: string[] = [];

  for (const file of files) {
    // Only upload PDFs and text files (OpenAI supports these)
    if (
      file.mimeType?.includes('pdf') ||
      file.url.toLowerCase().endsWith('.pdf') ||
      file.mimeType?.includes('text') ||
      file.url.toLowerCase().endsWith('.txt') ||
      file.url.toLowerCase().endsWith('.md')
    ) {
      const fileId = await uploadFileToOpenAI(file.url, file.name);
      if (fileId) {
        fileIds.push(fileId);
      }
    }
  }

  return fileIds;
}

export type PracticeQuestion = {
  id: string;
  question: string;
  type: 'true-false' | 'open' | 'multiple-choice';
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  topic?: string;
  source?: 'ai' | 'fallback';
};

export type PracticeSession = {
  courseId: string;
  courseName: string;
  practiceType: 'true-false' | 'open-questions' | 'mixed';
  numQuestions: number;
  questions: PracticeQuestion[];
  userId: string;
  createdAt: Date;
};

export type AISummaryPack = {
  summary: string;
  keyPoints: string[];
  flashcards: Array<{ question: string; answer: string }>;
};

type QuestionsCacheEntry = {
  questions: PracticeQuestion[];
  createdAt: number;
  filesSignature: string;
};

const QUESTIONS_CACHE_TTL_MS = 30 * 60 * 1000; // 30 min
const questionsCache = new Map<string, QuestionsCacheEntry>();

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`));
    }, ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function buildCacheKey(
  courseId: string,
  practiceType: 'true-false' | 'open-questions' | 'mixed',
  numQuestions: number,
  language: 'hebrew' | 'english'
): string {
  return `${courseId}:${practiceType}:${numQuestions}:${language}`;
}

function buildFilesSignature(
  files: Array<{ url: string; name: string; mimeType?: string | null }>
): string {
  return files
    .map((f) => `${f.name}|${f.mimeType || ''}|${f.url?.slice(-40) || ''}`)
    .sort()
    .join('::');
}

function buildExtractionPlan(totalFiles: number) {
  // Accuracy-first defaults: include all files with larger character budgets.
  const filesCount = Math.max(totalFiles, 1);
  const firstPassFiles = filesCount;
  const secondPassFiles = filesCount;
  const firstPassChars = Math.min(260000, Math.max(60000, filesCount * 25000));
  const secondPassChars = Math.min(420000, Math.max(120000, filesCount * 38000));
  return {
    firstPass: { maxFiles: firstPassFiles, maxTotalChars: firstPassChars },
    secondPass: { maxFiles: secondPassFiles, maxTotalChars: secondPassChars },
  };
}

/**
 * Get course files with their metadata
 */
async function getCourseFiles(courseId: string): Promise<Array<{
  url: string;
  name: string;
  mimeType?: string | null;
}>> {
  try {
    const filesRef = collection(db, 'courseFiles');
    const q = query(filesRef, where('courseId', '==', courseId));
    const snapshot = await getDocs(q);
    
    const files: Array<{ url: string; name: string; mimeType?: string | null }> = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.url && data.name) {
        files.push({
          url: data.url,
          name: data.name,
          mimeType: data.mimeType || null,
        });
      }
    });
    
    return files;
  } catch (error) {
    console.log('Error fetching course files:', error);
    return [];
  }
}

/**
 * Extract file information from course files (legacy function for mock questions)
 */
async function getCourseFileInfo(courseId: string): Promise<{
  fileNames: string[];
  fileTypes: string[];
  fileCount: number;
}> {
  const files = await getCourseFiles(courseId);
  
  return {
    fileNames: files.map(f => f.name),
    fileTypes: files.map(f => {
      const mimeType = f.mimeType || '';
      if (mimeType.includes('pdf')) return 'PDF document';
      if (mimeType.includes('image')) return 'Image';
      if (mimeType.includes('word') || mimeType.includes('document')) return 'Word document';
      if (f.name.endsWith('.pdf')) return 'PDF document';
      if (f.name.endsWith('.doc') || f.name.endsWith('.docx')) return 'Word document';
      return 'Course material';
    }),
    fileCount: files.length,
  };
}

/**
 * Generate practice questions using OpenAI API
 */
export async function generatePracticeQuestions(
  courseId: string,
  courseName: string,
  practiceType: 'true-false' | 'open-questions' | 'mixed',
  numQuestions: number,
  language: 'hebrew' | 'english' = 'hebrew'
): Promise<PracticeQuestion[]> {
  try {
    if (process.env.EXPO_PUBLIC_DISABLE_UNIFIED_ENGINE !== 'true') {
      try {
        const unified = await generateUnifiedPracticeQuestions({
          userId: auth.currentUser?.uid,
          courseId,
          courseName,
          practiceType,
          numQuestions,
          language,
        });
        if (Array.isArray(unified) && unified.length > 0) {
          return unified.map((q, index) => ({
            id: q.id || `q${index + 1}`,
            question: q.question,
            type: q.type,
            options: q.options,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            topic: q.topic,
            source: q.source || 'ai',
          }));
        }
      } catch (engineError) {
        console.log('Unified engine question path failed, continuing with legacy:', engineError);
        traceLearningEvent({
          traceType: 'questions',
          userId: auth.currentUser?.uid,
          courseId,
          fallbackUsed: true,
          fallbackReason: String((engineError as any)?.message || 'unified_questions_failed'),
          qualityStatus: 'fallback',
        }).catch(() => undefined);
      }
    }

    // Get course files
    const files = await getCourseFiles(courseId);
    
    if (files.length === 0) {
      console.warn('⚠️ No course files found, using fast fallback generator');
      return generateMockQuestionsWithContext(
        courseName,
        practiceType,
        numQuestions,
        { fileNames: [], fileTypes: [], fileCount: 0 },
        language
      );
    }

    // Fast path: return recent cached generation if same inputs and files
    const cacheKey = buildCacheKey(courseId, practiceType, numQuestions, language);
    const filesSignature = buildFilesSignature(files);
    const cached = questionsCache.get(cacheKey);
    if (
      cached &&
      cached.filesSignature === filesSignature &&
      Date.now() - cached.createdAt < QUESTIONS_CACHE_TTL_MS
    ) {
      console.log(`⚡ Using cached practice questions (${cached.questions.length})`);
      return cached.questions.slice(0, numQuestions).map((q, idx) => ({
        ...q,
        id: q.id || `q${idx + 1}`,
      }));
    }

    // Extract text content from PDF files (PRIMARY METHOD)
    // OpenAI File API has limitations in React Native, so we extract text and send it directly
    console.log('📝 Extracting text content from course files (PDFs)...');
    const extractionPlan = buildExtractionPlan(files.length);
    let fileContent = await withTimeout(
      extractTextFromCourseFiles(files, extractionPlan.firstPass),
      45000,
      'File extraction'
    );

    // If first pass extraction is weak, retry with a broader budget for better coverage.
    if (!fileContent || fileContent.trim().length < 1200) {
      console.log('🔁 First extraction pass was short, retrying with expanded budget...');
      fileContent = await withTimeout(
        extractTextFromCourseFiles(files, extractionPlan.secondPass),
        65000,
        'File extraction retry'
      );
    }
    
    if (fileContent && fileContent.trim().length > 100) {
      console.log(`✅ Successfully extracted ${fileContent.length} characters from course files`);
      console.log(`📄 First 200 chars preview: ${fileContent.substring(0, 200)}...`);
    } else {
      console.warn('⚠️ No substantial text content extracted from files.');
      console.warn('💡 This might mean the PDF is scanned/image-based or encrypted.');
    }
    
    let fileIds: string[] = [];
    let useFileAPI = false;
    if (OPENAI_API_KEY && OPENAI_API_KEY !== 'your_openai_api_key_here') {
      try {
        fileIds = await withTimeout(
          uploadFilesToOpenAI(files.slice(0, 6)),
          18000,
          'OpenAI file upload'
        );
        useFileAPI = fileIds.length > 0;
        console.log(`📎 OpenAI file mode: ${useFileAPI ? `enabled (${fileIds.length} files)` : 'disabled'}`);
      } catch (uploadErr) {
        console.warn('⚠️ OpenAI file upload timed out/failed; continuing with extracted text mode:', uploadErr);
        fileIds = [];
        useFileAPI = false;
      }
    }
    
    // Build prompt for OpenAI with strict type enforcement
    let questionTypesInstruction: string;
    let strictTypeInstruction: string;
    
    if (practiceType === 'true-false') {
      questionTypesInstruction = 'ONLY true/false questions';
      strictTypeInstruction = 'CRITICAL: Generate ONLY true/false questions. Do NOT include multiple-choice or open-ended questions. Every question must have type "true-false" with correctAnswer being either "True" or "False".';
    } else if (practiceType === 'open-questions') {
      questionTypesInstruction = 'ONLY open-ended questions';
      strictTypeInstruction = 'CRITICAL: Generate ONLY open-ended questions. Do NOT include true/false or multiple-choice questions. Every question must have type "open" and require a written answer.';
    } else {
      questionTypesInstruction = 'a mix of true/false, multiple choice, and open-ended questions';
      strictTypeInstruction = 'Generate a variety of question types: true/false, multiple-choice, and open-ended questions.';
    }

    const languageInstruction = language === 'hebrew' 
      ? 'IMPORTANT: All questions, answers, and explanations must be in Hebrew (עברית).'
      : 'IMPORTANT: All questions, answers, and explanations must be in English.';

    const fileList = files.map(f => `- ${f.name} (${f.mimeType || 'file'})`).join('\n');

    // Build prompt
    let prompt = `You are an educational AI assistant. Generate EXACTLY ${numQuestions} ${questionTypesInstruction} for a course called "${courseName}".

${strictTypeInstruction}

${languageInstruction}

The course has ${files.length} file(s) with course materials:
${fileList}

`;

    if (useFileAPI && fileIds.length > 0) {
      // Using OpenAI File API - files are already uploaded
      prompt += `I have uploaded ${fileIds.length} file(s) to OpenAI. Please read the content of these files and generate practice questions based on the actual content.`;
    } else if (fileContent && fileContent.trim().length > 100) {
      // Using extracted text content - only if we got substantial content
      console.log(`📝 Using extracted text content (${fileContent.length} chars) for question generation`);
      prompt += `Here is the ACTUAL CONTENT extracted from the course files:

${fileContent}

IMPORTANT: Generate practice questions based EXACTLY on this content. The questions must test understanding of the specific topics, concepts, facts, and information that appear in the content above. Do NOT generate generic questions - use the actual information from the files.
IMPORTANT: Prefer information that appears repeatedly or explicitly in the provided content.
IMPORTANT: Each question explanation must mention the likely source section/file name if visible in the extracted text.
IMPORTANT: Avoid generic AI/ML trivia unless it explicitly appears in the provided content.`;
    } else {
      // If we have PDFs but couldn't extract text, include file URLs in prompt
      // This helps OpenAI understand what files are available
      const pdfFiles = files.filter(f => 
        f.mimeType?.includes('pdf') || f.url?.toLowerCase().endsWith('.pdf')
      );
      
      if (pdfFiles.length > 0 && OPENAI_API_KEY) {
        console.log(`📄 Found ${pdfFiles.length} PDF file(s) but text extraction failed. Including file URLs in prompt...`);
        const pdfUrls = pdfFiles.map(f => `- ${f.name}: ${f.url}`).join('\n');
        prompt += `The course "${courseName}" has ${pdfFiles.length} PDF file(s) with course materials. The files are available at these URLs:
${pdfUrls}

CRITICAL INSTRUCTIONS:
1. These PDF files contain the actual course material for "${courseName}"
2. Generate practice questions based on the ACTUAL CONTENT that would be in these PDF files
3. The questions must be specific to the course "${courseName}" and test real understanding
4. Do NOT generate generic questions - make them detailed and specific as if you had read the PDF content
5. Base questions on typical content for a "${courseName}" course, but make them detailed and specific

Since the PDF text could not be extracted automatically, generate questions that would be relevant for this specific course based on the file names and course name. Make the questions detailed and specific.`;
      } else {
        // Fallback to file names
        console.warn('⚠️ Using file names as fallback - no substantial content extracted');
        prompt += `Based on the course name "${courseName}" and the file names above, generate practice questions that would help students test their understanding of the course material. Use the file names to infer what topics are covered (e.g., if there's a file about "algorithms.pdf", include questions about algorithms).

Note: The file content could not be extracted automatically. Please generate questions based on typical content for a course named "${courseName}" with these file types.`;
      }
    }

    prompt += `

For each question, provide:
- A clear, well-formulated question
- The correct answer
- For multiple choice: 4 options (A, B, C, D) with only one correct answer
- For true/false: The correct answer (True or False)
- For open-ended: A sample correct answer or key points
- A brief explanation (optional)
- The topic/subject area the question covers

Return JSON only with this exact structure:
{
  "questions": [
    {
      "question": "Question text here",
      "type": "true-false" | "multiple-choice" | "open",
      "options": ["Option A", "Option B", "Option C", "Option D"] (only for multiple-choice),
      "correctAnswer": "Correct answer here",
      "explanation": "Brief explanation",
      "topic": "Topic name"
    }
  ]
}

${strictTypeInstruction}

REMEMBER: ${strictTypeInstruction}

Make sure the questions are relevant to "${courseName}" and cover different topics within the course.`;

    // Get file info for fallback scenarios (define early for use in fallbacks)
    let fileInfo: { fileNames: string[]; fileTypes: string[]; fileCount: number };
    
    try {
      fileInfo = await getCourseFileInfo(courseId);
    } catch (fileInfoError) {
      console.error('Error getting file info:', fileInfoError);
      fileInfo = { fileNames: [], fileTypes: [], fileCount: 0 };
    }
    
    // Call OpenAI API
    if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your_openai_api_key_here') {
      // Fallback to mock questions if API key is not set
      console.warn('OpenAI API key not found. Using mock questions based on course files.');
      return generateMockQuestionsWithContext(courseName, practiceType, numQuestions, fileInfo, language);
    }

    // Check if we should try OpenAI API or use fallback
    // If File API failed and no text content, but we have PDF files, still try OpenAI
    // (OpenAI might be able to infer from file URLs and course name)
    const hasPDFFiles = files.some(f => 
      f.mimeType?.includes('pdf') || f.url?.toLowerCase().endsWith('.pdf')
    );
    
    if (!useFileAPI && (!fileContent || fileContent.trim().length < 100) && !hasPDFFiles) {
      console.warn('No file content available and File API failed. Using mock questions based on course files.');
      return generateMockQuestionsWithContext(courseName, practiceType, numQuestions, fileInfo, language);
    }

    let content = '';
    if (useFileAPI && fileIds.length > 0) {
      const inputContent: any[] = [{ type: 'input_text', text: prompt }];
      fileIds.forEach((fileId) => {
        inputContent.push({ type: 'input_file', file_id: fileId });
      });

      const response = await withTimeout(
        fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4.1-mini',
            temperature: 0.35,
            max_output_tokens: 1800,
            input: [
              {
                role: 'user',
                content: inputContent,
              },
            ],
          }),
        }),
        30000,
        'OpenAI responses generation'
      );
      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI Responses API error:', errorText);
        throw new Error(errorText || 'Failed to generate questions from file content');
      }
      const data = await response.json();
      content = String(data?.output_text || '').trim();
      if (!content) {
        const maybeText =
          data?.output?.[0]?.content?.find?.((c: any) => c?.type === 'output_text')?.text || '';
        content = String(maybeText).trim();
      }
    } else {
      const response = await withTimeout(
        fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0.45,
            max_tokens: 1800,
            response_format: { type: 'json_object' },
            messages: [
              {
                role: 'system',
                content: 'You are an educational AI assistant that generates high-quality practice questions for students based on course materials.',
              },
              { role: 'user', content: prompt },
            ],
          }),
        }),
        30000,
        'OpenAI generation'
      );
      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API error:', errorText);
        console.error('Response status:', response.status);
        throw new Error(errorText || 'Failed to generate questions');
      }
      const data = await response.json();
      content = String(data?.choices?.[0]?.message?.content || '').trim();
    }

    if (!content) {
      throw new Error('No response from AI');
    }

    console.log('📥 Raw AI response (first 500 chars):', content.substring(0, 500));

    // Parse JSON from response
    // Sometimes OpenAI wraps JSON in markdown code blocks or adds extra text
    let jsonContent = content.trim();
    
    // Remove markdown code blocks
    if (jsonContent.includes('```json')) {
      const jsonMatch = jsonContent.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonContent = jsonMatch[1].trim();
      } else {
        jsonContent = jsonContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }
    } else if (jsonContent.includes('```')) {
      const jsonMatch = jsonContent.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch && jsonMatch[1]) {
        jsonContent = jsonMatch[1].trim();
      } else {
        jsonContent = jsonContent.replace(/```\n?/g, '');
      }
    }
    
    // Try to extract JSON array if there's extra text
    // Look for array pattern: [...]
    const arrayMatch = jsonContent.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      jsonContent = arrayMatch[0];
    }
    
    // Remove any leading/trailing non-JSON text
    jsonContent = jsonContent.trim();
    
    // If it doesn't start with [ or {, try to find the JSON part
    if (!jsonContent.startsWith('[') && !jsonContent.startsWith('{')) {
      const firstBracket = jsonContent.indexOf('[');
      if (firstBracket !== -1) {
        jsonContent = jsonContent.substring(firstBracket);
      }
    }
    
    console.log('📝 Parsing JSON (first 200 chars):', jsonContent.substring(0, 200));

    let questions: PracticeQuestion[];
    try {
      const parsed = JSON.parse(jsonContent) as any;
      if (Array.isArray(parsed)) {
        questions = parsed as PracticeQuestion[];
      } else if (Array.isArray(parsed?.questions)) {
        questions = parsed.questions as PracticeQuestion[];
      } else {
        throw new Error('JSON response does not contain questions array');
      }
    } catch (parseError: any) {
      console.error('❌ JSON parse error:', parseError.message);
      console.error('📄 Content that failed to parse:', jsonContent.substring(0, 500));
      throw new Error(`Failed to parse AI response as JSON: ${parseError.message}. The AI might not have returned valid JSON.`);
    }
    
    // Validate that we got an array
    if (!Array.isArray(questions)) {
      throw new Error('AI response is not an array of questions');
    }
    
    // Validate that questions have required fields
    questions = questions.filter(q => q.question && q.type && q.correctAnswer);
    
    if (questions.length === 0) {
      throw new Error('No valid questions found in AI response');
    }
    
    // Enforce practice type - filter out questions that don't match the selected type
    if (practiceType === 'true-false') {
      questions = questions.filter(q => q.type === 'true-false');
      console.log(`🔍 Filtered to only true-false questions: ${questions.length} questions`);
    } else if (practiceType === 'open-questions') {
      questions = questions.filter(q => q.type === 'open');
      console.log(`🔍 Filtered to only open-ended questions: ${questions.length} questions`);
    }
    
    // If after filtering we don't have enough questions, log a warning
    if (questions.length < numQuestions) {
      console.warn(`⚠️ After filtering by type, only ${questions.length} questions remain (requested ${numQuestions})`);
    }
    
    // Limit to requested number
    questions = questions.slice(0, numQuestions);
    
    console.log(`✅ Successfully parsed ${questions.length} questions from AI response`);
    
    // Clean up: Delete uploaded files from OpenAI (optional - to save storage)
    // Note: Files are automatically deleted after 24 hours, but you can delete them manually
    if (useFileAPI && fileIds.length > 0) {
      // Optionally delete files after use (uncomment if you want to clean up immediately)
      // for (const fileId of fileIds) {
      //   try {
      //     await fetch(`https://api.openai.com/v1/files/${fileId}`, {
      //       method: 'DELETE',
      //       headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      //     });
      //   } catch (err) {
      //     console.log('Error deleting file from OpenAI:', err);
      //   }
      // }
    }
    
    // Add IDs to questions
    const normalizedQuestions = questions.map((q, index) => ({
      ...q,
      id: `q${index + 1}`,
      source: 'ai' as const,
    }));

    // Cache for repeated generation requests (same course/setup)
    questionsCache.set(cacheKey, {
      questions: normalizedQuestions,
      createdAt: Date.now(),
      filesSignature,
    });

    return normalizedQuestions;
  } catch (error) {
    console.warn('⚠️ Falling back to local question generation:', error);
    // Fallback to mock questions on error - get file info first
    try {
      const fallbackFileInfo = await getCourseFileInfo(courseId);
      return generateMockQuestionsWithContext(courseName, practiceType, numQuestions, fallbackFileInfo, language);
    } catch (fileError) {
      console.error('Error getting file info for fallback:', fileError);
      // If we can't get file info, use empty file info
      return generateMockQuestionsWithContext(courseName, practiceType, numQuestions, {
        fileNames: [],
        fileTypes: [],
        fileCount: 0,
      }, language);
    }
  }
}

/**
 * Fast generator for instant UX.
 * Uses local contextual generation from course metadata/file names
 * and avoids heavy extraction + long model waits.
 */
export async function generatePracticeQuestionsFast(
  courseId: string,
  courseName: string,
  practiceType: 'true-false' | 'open-questions' | 'mixed',
  numQuestions: number,
  language: 'hebrew' | 'english' = 'hebrew'
): Promise<PracticeQuestion[]> {
  try {
    const files = await withTimeout(getCourseFiles(courseId), 4000, 'Fast file lookup');
    const fileInfo = {
      fileNames: files.map((f) => f.name),
      fileTypes: files.map((f) => f.mimeType || 'file'),
      fileCount: files.length,
    };
    return generateMockQuestionsWithContext(courseName, practiceType, numQuestions, fileInfo, language);
  } catch (error) {
    console.warn('⚠️ Fast generator fallback used without course file metadata:', error);
    return generateMockQuestionsWithContext(
      courseName,
      practiceType,
      numQuestions,
      { fileNames: [], fileTypes: [], fileCount: 0 },
      language
    );
  }
}

export async function generateSummaryAndFlashcards(
  courseId: string,
  courseName: string,
  language: 'hebrew' | 'english' = 'hebrew'
): Promise<AISummaryPack> {
  if (process.env.EXPO_PUBLIC_DISABLE_UNIFIED_ENGINE !== 'true') {
    try {
      const unified = await generateUnifiedCourseInsights({
        userId: auth.currentUser?.uid,
        courseId,
        courseName,
        language,
      });
      return {
        summary: unified.summary,
        keyPoints: unified.keyPoints,
        flashcards: unified.flashcards,
      };
    } catch (engineError) {
      console.log('Unified engine summary path failed, using legacy:', engineError);
      traceLearningEvent({
        traceType: 'summary',
        userId: auth.currentUser?.uid,
        courseId,
        fallbackUsed: true,
        fallbackReason: String((engineError as any)?.message || 'unified_summary_failed'),
        qualityStatus: 'fallback',
      }).catch(() => undefined);
    }
  }

  const files = await getCourseFiles(courseId);
  const extractionPlan = buildExtractionPlan(files.length);
  let extracted = await extractTextFromCourseFiles(files, extractionPlan.firstPass);
  if (!extracted || extracted.trim().length < 1200) {
    extracted = await extractTextFromCourseFiles(files, extractionPlan.secondPass);
  }
  const safeText = extracted && extracted.trim().length > 50 ? extracted : `${courseName} course materials`;

  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your_openai_api_key_here') {
    return {
      summary:
        language === 'hebrew'
          ? `סיכום מהיר לקורס ${courseName}: התמקדו במושגי הליבה, תרגול פתרון שאלות, ובניית הבנה הדרגתית.`
          : `Quick summary for ${courseName}: focus on core concepts, problem-solving practice, and progressive understanding.`,
      keyPoints:
        language === 'hebrew'
          ? ['מושגי יסוד', 'דפוסי פתרון שאלות', 'טעויות נפוצות לבדיקה לפני מבחן']
          : ['Core concepts', 'Question-solving patterns', 'Common mistakes to review before exam'],
      flashcards:
        language === 'hebrew'
          ? [
              { question: `מהו הנושא המרכזי ב-${courseName}?`, answer: 'הבנת העקרונות המרכזיים והיישום שלהם.' },
              { question: 'איך לזהות טעות נפוצה?', answer: 'בודקים הנחות, יחידות, ותנאי גבול.' },
            ]
          : [
              { question: `What is the central theme in ${courseName}?`, answer: 'Understand core principles and apply them.' },
              { question: 'How to detect common mistakes?', answer: 'Check assumptions, units, and boundary conditions.' },
            ],
    };
  }

  try {
    const prompt =
      language === 'hebrew'
        ? `הכן עבור הקורס "${courseName}" JSON בלבד:
{
  "summary": "סיכום קצר עד 120 מילים",
  "keyPoints": ["נקודה 1","נקודה 2","נקודה 3","נקודה 4"],
  "flashcards": [{"question":"שאלה","answer":"תשובה"}]
}
השתמש רק בתוכן הבא:
${safeText}`
        : `Create JSON only for course "${courseName}":
{
  "summary": "Short summary up to 120 words",
  "keyPoints": ["point 1","point 2","point 3","point 4"],
  "flashcards": [{"question":"...","answer":"..."}]
}
Use only this content:
${safeText}`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error('summary generation failed');
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    return {
      summary: parsed.summary || '',
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.slice(0, 6) : [],
      flashcards: Array.isArray(parsed.flashcards) ? parsed.flashcards.slice(0, 8) : [],
    };
  } catch {
    return {
      summary:
        language === 'hebrew'
          ? `סיכום מהיר לקורס ${courseName}: עברו על המושגים המרכזיים, תרגלו שאלות מסוגים שונים, והתמקדו בנושאים חלשים.`
          : `Quick summary for ${courseName}: review central concepts, practice mixed question types, and focus on weak topics.`,
      keyPoints:
        language === 'hebrew'
          ? ['מושגים קריטיים', 'תרגול אדפטיבי', 'סקירת טעויות', 'חיזוק נושאים חלשים']
          : ['Critical concepts', 'Adaptive practice', 'Error review', 'Weak-topic reinforcement'],
      flashcards:
        language === 'hebrew'
          ? [{ question: 'מה לבדוק לפני מבחן?', answer: 'דיוק מושגים, זמן פתרון, וחזרה על טעויות.' }]
          : [{ question: 'What to review before exam?', answer: 'Concept precision, timing, and mistake patterns.' }],
    };
  }
}

/**
 * Mock question generator (fallback) - improved with file context
 */
function generateMockQuestionsWithContext(
  courseName: string,
  practiceType: 'true-false' | 'open-questions' | 'mixed',
  numQuestions: number,
  fileInfo: { fileNames: string[]; fileTypes: string[]; fileCount: number },
  language: 'hebrew' | 'english' = 'hebrew'
): PracticeQuestion[] {
  const questions: PracticeQuestion[] = [];
  // Strictly enforce practice type - only use the selected type
  const types = practiceType === 'mixed'
    ? (['true-false', 'open', 'multiple-choice'] as PracticeQuestion['type'][])
    : practiceType === 'true-false'
    ? (['true-false'] as PracticeQuestion['type'][])
    : (['open'] as PracticeQuestion['type'][]);

  const sanitizeTopic = (raw: string): string => {
    const cleaned = raw
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[_\-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned.length >= 3 ? cleaned : '';
  };

  const extractTopicsFromFiles = (): string[] => {
    const picked = new Set<string>();

    const knownRules = [
      { test: /(algorithm|algo)/i, he: 'אלגוריתמים', en: 'Algorithms' },
      { test: /(data\s*structure|structures)/i, he: 'מבני נתונים', en: 'Data Structures' },
      { test: /(calculus|math)/i, he: 'חשבון דיפרנציאלי ואינטגרלי', en: 'Calculus' },
      { test: /(linear|algebra)/i, he: 'אלגברה לינארית', en: 'Linear Algebra' },
      { test: /(database|sql|db)/i, he: 'מסדי נתונים', en: 'Databases' },
      { test: /(network|tcp|ip)/i, he: 'רשתות', en: 'Networking' },
      { test: /(programming|code|oop|java|python|c\+\+|javascript|typescript)/i, he: 'תכנות', en: 'Programming' },
    ];

    const sourceNames = [courseName, ...fileInfo.fileNames].filter(Boolean);
    for (const source of sourceNames) {
      for (const rule of knownRules) {
        if (rule.test.test(source)) {
          picked.add(language === 'hebrew' ? rule.he : rule.en);
        }
      }

      const chunks = source
        .split(/[\/\\]/)
        .flatMap((part) => part.split(/[,\-_.()]/))
        .map((part) => sanitizeTopic(part))
        .filter((part) => part.length >= 3)
        .filter((part) => {
          const lower = part.toLowerCase();
          if (
            lower === 'pdf' ||
            lower === 'doc' ||
            lower === 'docx' ||
            lower === 'ppt' ||
            lower === 'pptx' ||
            lower === 'file' ||
            lower === 'document'
          ) {
            return false;
          }
          if (/^(lecture|lesson|chapter|unit)\s*\d*$/i.test(lower)) return false;
          if (/^(הרצאה|שיעור|פרק)\s*\d*$/i.test(part)) return false;
          return true;
        });

      for (const chunk of chunks) {
        if (picked.size >= 10) break;
        picked.add(chunk);
      }
      if (picked.size >= 10) break;
    }

    if (picked.size === 0) {
      if (language === 'hebrew') {
        return ['מושגי יסוד', 'הבנה יישומית', 'ניתוח פתרונות', 'טעויות נפוצות'];
      }
      return ['Foundations', 'Applied Understanding', 'Solution Analysis', 'Common Mistakes'];
    }

    return Array.from(picked).slice(0, 10);
  };

  const topics = extractTopicsFromFiles();

  const tfTemplatesHe = [
    (topic: string) => `על סמך חומרי הקורס, הקשר בין "${topic}" לבין ${courseName} הוא רעיון משני בלבד.`,
    (topic: string) => `במסגרת ${courseName}, הבנה של "${topic}" נדרשת כדי לפתור שאלות ברמת מבחן.`,
    (topic: string) => `אפשר לפתור תרגילים ב-${courseName} בלי להבין כלל את "${topic}".`,
  ];
  const tfTemplatesEn = [
    (topic: string) => `In ${courseName}, the link between "${topic}" and course outcomes is only marginal.`,
    (topic: string) => `Within ${courseName}, understanding "${topic}" is required for exam-level solving.`,
    (topic: string) => `You can solve ${courseName} tasks well without understanding "${topic}".`,
  ];

  const openTemplatesHe = [
    (topic: string) => `הסבר/י במילים שלך איך "${topic}" משפיע על דרך הפתרון בקורס ${courseName}, ותן/י דוגמה קצרה.`,
    (topic: string) => `מה ההבדל בין הבנה שטחית להבנה עמוקה של "${topic}" בהקשר של ${courseName}?`,
    (topic: string) => `תאר/י טעות נפוצה בנושא "${topic}" ואיך מתקנים אותה בשאלה טיפוסית של ${courseName}.`,
  ];
  const openTemplatesEn = [
    (topic: string) => `Explain in your own words how "${topic}" changes the solving strategy in ${courseName}, with a short example.`,
    (topic: string) => `What is the difference between shallow and deep understanding of "${topic}" in ${courseName}?`,
    (topic: string) => `Describe a common mistake in "${topic}" and how to correct it in a typical ${courseName} question.`,
  ];

  const mcQuestionTemplatesHe = [
    (topic: string) => `באיזו אפשרות מתוארת הבנה נכונה יותר של "${topic}" בהקשר של ${courseName}?`,
    (topic: string) => `איזו בחירה מראה יישום טוב של "${topic}" בשאלה חדשה בקורס ${courseName}?`,
  ];
  const mcQuestionTemplatesEn = [
    (topic: string) => `Which option best represents correct understanding of "${topic}" in ${courseName}?`,
    (topic: string) => `Which choice shows better application of "${topic}" in a new ${courseName} scenario?`,
  ];

  for (let i = 0; i < numQuestions; i++) {
    const type = types[i % types.length] as PracticeQuestion['type'];
    const qNum = i + 1;
    const topic = topics[i % topics.length];

    if (type === 'true-false') {
      const templates = language === 'hebrew' ? tfTemplatesHe : tfTemplatesEn;
      const questionText = templates[i % templates.length](topic);
      const correct = i % 2 === 0;
      questions.push({
        id: `q${qNum}`,
        question: questionText,
        type: 'true-false',
        correctAnswer: language === 'hebrew' ? (correct ? 'נכון' : 'לא נכון') : (correct ? 'True' : 'False'),
        explanation:
          language === 'hebrew'
            ? `בדוק/בדקי אם ההיגד משקף הבנה אמיתית של "${topic}" ולא הגדרה שטחית בלבד.`
            : `Verify whether the claim reflects real understanding of "${topic}" rather than surface memorization.`,
        topic,
        source: 'fallback',
      });
    } else if (type === 'open') {
      const templates = language === 'hebrew' ? openTemplatesHe : openTemplatesEn;
      questions.push({
        id: `q${qNum}`,
        question: templates[i % templates.length](topic),
        type: 'open',
        correctAnswer:
          language === 'hebrew'
            ? `תשובה טובה תקשר בין "${topic}" לעקרונות הקורס, תדגים מקרה שימוש, ותסביר למה זה חשוב לפתרון נכון.`
            : `A strong answer should connect "${topic}" to core course principles, include a use-case, and explain why it matters for correct solving.`,
        explanation:
          language === 'hebrew'
            ? `הערכת השאלה מתמקדת בהסבר, נימוק ודוגמה - לא רק בהגדרה.`
            : `Evaluation focuses on explanation, reasoning, and example quality, not only definition recall.`,
        topic,
        source: 'fallback',
      });
    } else {
      const qTemplates = language === 'hebrew' ? mcQuestionTemplatesHe : mcQuestionTemplatesEn;
      const question = qTemplates[i % qTemplates.length](topic);
      const options =
        language === 'hebrew'
          ? [
              `חזרה בעל פה על הגדרה בלי להסביר השלכות`,
              `קישור בין "${topic}" לדרך הפתרון והצדקת הבחירה`,
              `זכירת מונחים בלבד ללא דוגמה`,
              `בחירה אקראית לפי מילת מפתח`,
            ]
          : [
              `Reciting a definition without implications`,
              `Connecting "${topic}" to solving strategy with justification`,
              `Memorizing terms without example`,
              `Choosing randomly by keyword match`,
            ];
      questions.push({
        id: `q${qNum}`,
        question,
        type: 'multiple-choice',
        options,
        correctAnswer: options[1],
        explanation:
          language === 'hebrew'
            ? `האפשרות הנכונה בודקת יישום והצדקה - זה מדד להבנה אמיתית.`
            : `The correct option tests application plus reasoning, which reflects real understanding.`,
        topic,
        source: 'fallback',
      });
    }
  }

  return questions;
}

/**
 * Legacy mock question generator (for backward compatibility)
 */
function generateMockQuestions(
  courseName: string,
  practiceType: 'true-false' | 'open-questions' | 'mixed',
  numQuestions: number,
  language: 'hebrew' | 'english' = 'hebrew'
): PracticeQuestion[] {
  return generateMockQuestionsWithContext(
    courseName,
    practiceType,
    numQuestions,
    { fileNames: [], fileTypes: [], fileCount: 0 },
    language
  );
}

/**
 * Evaluate open-ended answers using AI
 * This is optional - for now, we'll just mark them as answered
 */
export async function evaluateOpenAnswer(
  question: string,
  userAnswer: string,
  correctAnswer: string
): Promise<{ score: number; feedback: string }> {
  if (!userAnswer || userAnswer.trim().length === 0) {
    return { score: 0, feedback: 'No answer provided' };
  }

  if (process.env.EXPO_PUBLIC_DISABLE_UNIFIED_ENGINE !== 'true') {
    try {
      const unified = await evaluateUnifiedOpenAnswer({
        userId: auth.currentUser?.uid,
        question,
        userAnswer,
        idealAnswer: correctAnswer,
      });
      return {
        score: unified.score,
        feedback: unified.feedback || unified.gapAnalysis || 'Evaluation completed.',
      };
    } catch (engineError) {
      console.log('Unified engine evaluation path failed, using legacy:', engineError);
    }
  }

  if (OPENAI_API_KEY && OPENAI_API_KEY !== 'your_openai_api_key_here') {
    try {
      const isHebrew = /[\u0590-\u05FF]/.test(`${question} ${userAnswer} ${correctAnswer}`);
      const prompt = isHebrew
        ? `דרג תשובת סטודנט לשאלה פתוחה.
החזר JSON בלבד בפורמט:
{"score": מספר בין 0 ל-100, "feedback": "פידבק קצר, ממוקד ומעשי בעברית"}

קריטריונים:
1) דיוק מול התשובה הרצויה
2) עומק הבנה והסבר
3) שימוש נכון במושגים
4) בהירות

שאלה: ${question}
תשובת סטודנט: ${userAnswer}
תשובה רצויה: ${correctAnswer}`
        : `Grade a student's open-ended answer.
Return JSON only in this format:
{"score": number from 0 to 100, "feedback": "short practical feedback in English"}

Criteria:
1) Accuracy vs expected answer
2) Depth of understanding
3) Correct concept usage
4) Clarity

Question: ${question}
Student answer: ${userAnswer}
Expected answer: ${correctAnswer}`;

      const res = await withTimeout(
        fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0.2,
            max_tokens: 220,
            response_format: { type: 'json_object' },
            messages: [{ role: 'user', content: prompt }],
          }),
        }),
        12000,
        'Open answer evaluation'
      );
      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || '';
        const parsed = JSON.parse(content);
        const score = Math.max(0, Math.min(100, Number(parsed?.score || 0)));
        const feedback = String(parsed?.feedback || '').trim();
        if (Number.isFinite(score) && feedback.length > 0) {
          return { score, feedback };
        }
      }
    } catch (err) {
      console.log('AI open-answer evaluation failed, using heuristic fallback:', err);
    }
  }

  // Heuristic fallback with better scoring than simple word overlap.
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const userNorm = normalize(userAnswer);
  const correctNorm = normalize(correctAnswer);
  const userWords = userNorm.split(' ').filter((w) => w.length > 2);
  const correctWords = correctNorm.split(' ').filter((w) => w.length > 2);
  const userSet = new Set(userWords);
  const correctSet = new Set(correctWords);

  let overlap = 0;
  correctSet.forEach((w) => {
    if (userSet.has(w)) overlap += 1;
  });
  const conceptCoverage = correctSet.size > 0 ? overlap / correctSet.size : 0;
  const lengthScore = Math.min(1, userWords.length / Math.max(14, Math.round(correctWords.length * 0.75)));
  const finalScore = Math.round(Math.max(0, Math.min(1, conceptCoverage * 0.75 + lengthScore * 0.25)) * 100);

  return {
    score: finalScore,
    feedback:
      finalScore >= 80
        ? 'Strong answer with good concept coverage.'
        : finalScore >= 60
        ? 'Partially correct. Add more key concepts and clearer reasoning.'
        : 'Answer is too shallow or misses key concepts. Review and expand your explanation.',
  };
}

export async function evaluateOpenAnswerDetailed(
  question: string,
  userAnswer: string,
  correctAnswer: string,
  courseId?: string
): Promise<{
  score: number;
  feedback: string;
  idealAnswer?: string;
  gapAnalysis?: string;
  nextSteps?: string[];
  mistakeTypes?: Array<'conceptual' | 'careless' | 'incomplete'>;
}> {
  const detailed = await evaluateUnifiedOpenAnswer({
    userId: auth.currentUser?.uid,
    courseId,
    question,
    userAnswer,
    idealAnswer: correctAnswer,
  }).catch(async () => {
    const basic = await evaluateOpenAnswer(question, userAnswer, correctAnswer);
    return {
      score: basic.score,
      feedback: basic.feedback,
      idealAnswer: correctAnswer,
      gapAnalysis: 'Detailed evaluation unavailable, basic rubric used.',
      nextSteps: ['Review ideal answer', 'Rewrite with clearer structure'],
      mistakeTypes: (basic.score < 60 ? ['conceptual'] : ['incomplete']) as Array<
        'conceptual' | 'careless' | 'incomplete'
      >,
    };
  });

  return detailed;
}

export async function askCourseAssistant(
  courseId: string,
  courseName: string,
  question: string,
  language: 'hebrew' | 'english' = 'hebrew'
): Promise<{
  answer: string;
  sourceFiles: string[];
  sourceChunks: string[];
  qualityStatus?: 'grounded' | 'weak_grounding' | 'no_sources' | 'fallback' | 'error';
  traceId?: string;
}> {
  return askUnifiedCourseAssistant({
    userId: auth.currentUser?.uid,
    courseId,
    courseName,
    question,
    language,
  });
}

export async function semanticSearchCourseFiles(
  courseId: string,
  queryText: string,
  maxResults = 6
): Promise<Array<{ content: string; fileName: string; score: number; chunkId: string }>> {
  return semanticSearchCourseContent({
    courseId,
    queryText,
    maxResults,
  });
}

