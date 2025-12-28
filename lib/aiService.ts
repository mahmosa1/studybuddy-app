// lib/aiService.ts
// Service for generating practice questions using OpenAI API

import { collection, getDocs, query, where } from 'firebase/firestore';
import { extractTextFromCourseFiles } from './fileContentExtractor';
import { db } from './firebaseConfig';

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

  // For React Native, we'll extract the text and send it directly
  // OpenAI File API has limitations in React Native with FormData/Blob
  // So we extract text and include it in the prompt instead
  console.log(`📄 Extracting text from PDF for OpenAI: ${fileName}`);
  
  // Return null to signal that we should use text extraction instead
  // The actual text extraction happens in generatePracticeQuestions
  return null;
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
  numQuestions: number
): Promise<PracticeQuestion[]> {
  try {
    // Get course files
    const files = await getCourseFiles(courseId);
    
    if (files.length === 0) {
      throw new Error('No course files found. Please upload course materials first.');
    }

    // Extract text content from PDF files (PRIMARY METHOD)
    // OpenAI File API has limitations in React Native, so we extract text and send it directly
    console.log('📝 Extracting text content from course files (PDFs)...');
    let fileContent = await extractTextFromCourseFiles(files);
    
    if (fileContent && fileContent.trim().length > 100) {
      console.log(`✅ Successfully extracted ${fileContent.length} characters from course files`);
      console.log(`📄 First 200 chars preview: ${fileContent.substring(0, 200)}...`);
    } else {
      console.warn('⚠️ No substantial text content extracted from files.');
      console.warn('💡 This might mean the PDF is scanned/image-based or encrypted.');
    }
    
    // File API is disabled in React Native (FormData/Blob limitations)
    let fileIds: string[] = [];
    let useFileAPI = false;
    
    // Build prompt for OpenAI
    const questionTypes = practiceType === 'mixed' 
      ? 'a mix of true/false, multiple choice, and open-ended questions'
      : practiceType === 'true-false'
      ? 'true/false questions'
      : 'open-ended questions';

    const fileList = files.map(f => `- ${f.name} (${f.mimeType || 'file'})`).join('\n');

    // Build prompt
    let prompt = `You are an educational AI assistant. Generate ${numQuestions} ${questionTypes} for a course called "${courseName}".

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

IMPORTANT: Generate practice questions based EXACTLY on this content. The questions must test understanding of the specific topics, concepts, facts, and information that appear in the content above. Do NOT generate generic questions - use the actual information from the files.`;
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

Return the questions in JSON format as an array of objects with this structure:
[
  {
    "question": "Question text here",
    "type": "true-false" | "multiple-choice" | "open",
    "options": ["Option A", "Option B", "Option C", "Option D"] (only for multiple-choice),
    "correctAnswer": "Correct answer here",
    "explanation": "Brief explanation",
    "topic": "Topic name"
  }
]

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
      return generateMockQuestionsWithContext(courseName, practiceType, numQuestions, fileInfo);
    }

    // Check if we should try OpenAI API or use fallback
    // If File API failed and no text content, but we have PDF files, still try OpenAI
    // (OpenAI might be able to infer from file URLs and course name)
    const hasPDFFiles = files.some(f => 
      f.mimeType?.includes('pdf') || f.url?.toLowerCase().endsWith('.pdf')
    );
    
    if (!useFileAPI && (!fileContent || fileContent.trim().length < 100) && !hasPDFFiles) {
      console.warn('No file content available and File API failed. Using mock questions based on course files.');
      return generateMockQuestionsWithContext(courseName, practiceType, numQuestions, fileInfo);
    }

    // Prepare messages for OpenAI
    const messages: any[] = [
      {
        role: 'system',
        content: 'You are an educational AI assistant that generates high-quality practice questions for students based on course materials.',
      },
    ];

    // Prepare request body
    const requestBody: any = {
      model: useFileAPI ? 'gpt-4o' : 'gpt-4o-mini', // gpt-4o supports file reading
      temperature: 0.7,
      max_tokens: 3000,
    };

    // If using File API, attach file IDs to the messages
    if (useFileAPI && fileIds.length > 0) {
      // Use file attachments format for GPT-4o
      // According to OpenAI API, when using files, the format should be:
      // content: [{ type: "text", text: "..." }, { type: "file", file: "file-xxx" }]
      const contentArray: any[] = [
        {
          type: 'text',
          text: prompt,
        },
      ];
      
      // Add file attachments - OpenAI expects "file" not "file_id" in content array
      fileIds.forEach(fileId => {
        contentArray.push({
          type: 'file',
          file: fileId, // OpenAI expects "file" in content array, not "file_id"
        });
      });
      
      messages.push({
        role: 'user',
        content: contentArray,
      });
    } else if (fileContent && fileContent.trim().length > 0) {
      // If we have extracted text content, use it directly
      messages.push({
        role: 'user',
        content: prompt,
      });
    } else {
      // Fallback: use file names
      messages.push({
        role: 'user',
        content: prompt,
      });
    }

    requestBody.messages = messages;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      console.error('Response status:', response.status);
      
      // Try to parse error for better message
      let errorMessage = 'Failed to generate questions. Please try again.';
      let isQuotaError = false;
      
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
          // Check if it's a quota/billing error
          if (errorMessage.toLowerCase().includes('quota') || 
              errorMessage.toLowerCase().includes('billing') || 
              errorMessage.toLowerCase().includes('exceeded')) {
            isQuotaError = true;
          }
        }
      } catch (e) {
        // If error is not JSON, use the text as is (limited length)
        errorMessage = errorText.substring(0, 200);
        if (errorMessage.toLowerCase().includes('quota') || 
            errorMessage.toLowerCase().includes('billing') || 
            errorMessage.toLowerCase().includes('exceeded')) {
          isQuotaError = true;
        }
      }
      
      // If quota error, fall back to mock questions instead of throwing
      if (isQuotaError) {
        console.warn('⚠️ OpenAI quota exceeded. Falling back to mock questions based on course files.');
        console.warn('💡 To use real AI questions, add credits to your OpenAI account: https://platform.openai.com/account/billing');
        return generateMockQuestionsWithContext(courseName, practiceType, numQuestions, fileInfo);
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
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
      questions = JSON.parse(jsonContent) as PracticeQuestion[];
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
    return questions.map((q, index) => ({
      ...q,
      id: `q${index + 1}`,
    }));
  } catch (error) {
    console.error('Error generating practice questions:', error);
    // Fallback to mock questions on error - get file info first
    try {
      const fallbackFileInfo = await getCourseFileInfo(courseId);
      return generateMockQuestionsWithContext(courseName, practiceType, numQuestions, fallbackFileInfo);
    } catch (fileError) {
      console.error('Error getting file info for fallback:', fileError);
      // If we can't get file info, use empty file info
      return generateMockQuestionsWithContext(courseName, practiceType, numQuestions, {
        fileNames: [],
        fileTypes: [],
        fileCount: 0,
      });
    }
  }
}

/**
 * Mock question generator (fallback) - improved with file context
 */
function generateMockQuestionsWithContext(
  courseName: string,
  practiceType: 'true-false' | 'open-questions' | 'mixed',
  numQuestions: number,
  fileInfo: { fileNames: string[]; fileTypes: string[]; fileCount: number }
): PracticeQuestion[] {
  const questions: PracticeQuestion[] = [];
  const types = practiceType === 'mixed' 
    ? ['true-false', 'open', 'multiple-choice']
    : practiceType === 'true-false'
    ? ['true-false']
    : ['open'];

  // Extract topics from file names
  const extractTopicsFromFiles = (): string[] => {
    const topics: string[] = [];
    fileInfo.fileNames.forEach((fileName) => {
      // Try to extract meaningful topics from file names
      const nameLower = fileName.toLowerCase();
      if (nameLower.includes('algorithm') || nameLower.includes('algo')) {
        topics.push('Algorithms');
      }
      if (nameLower.includes('data') || nameLower.includes('structure')) {
        topics.push('Data Structures');
      }
      if (nameLower.includes('calculus') || nameLower.includes('math')) {
        topics.push('Calculus');
      }
      if (nameLower.includes('linear') || nameLower.includes('algebra')) {
        topics.push('Linear Algebra');
      }
      if (nameLower.includes('database') || nameLower.includes('db')) {
        topics.push('Databases');
      }
      if (nameLower.includes('network') || nameLower.includes('networking')) {
        topics.push('Networking');
      }
      if (nameLower.includes('programming') || nameLower.includes('code')) {
        topics.push('Programming');
      }
    });
    
    // Default topics if none found
    if (topics.length === 0) {
      return ['Introduction', 'Core Concepts', 'Advanced Topics', 'Applications'];
    }
    
    return [...new Set(topics)]; // Remove duplicates
  };

  const topics = extractTopicsFromFiles();

  for (let i = 0; i < numQuestions; i++) {
    const type = types[i % types.length] as PracticeQuestion['type'];
    const qNum = i + 1;
    const topic = topics[i % topics.length];

    if (type === 'true-false') {
      questions.push({
        id: `q${qNum}`,
        question: `Based on the course materials in ${courseName}, is the following statement true or false: The concept of ${topic} is fundamental to understanding ${courseName}.`,
        type: 'true-false',
        correctAnswer: 'True',
        explanation: `This question tests your understanding of ${topic} in ${courseName}.`,
        topic: topic,
      });
    } else if (type === 'open') {
      questions.push({
        id: `q${qNum}`,
        question: `Explain the importance of ${topic} in ${courseName} based on the course materials.`,
        type: 'open',
        correctAnswer: `${topic} is an important concept in ${courseName} that helps students understand the fundamental principles covered in the course materials.`,
        explanation: `This open-ended question allows you to demonstrate your understanding of ${topic}.`,
        topic: topic,
      });
    } else {
      questions.push({
        id: `q${qNum}`,
        question: `What is the primary focus of ${topic} in ${courseName}?`,
        type: 'multiple-choice',
        options: [
          `Understanding the basic principles of ${topic}`,
          `Advanced applications of ${topic}`,
          `Historical development of ${topic}`,
          `Practical implementation of ${topic}`,
        ],
        correctAnswer: `Understanding the basic principles of ${topic}`,
        explanation: `The correct answer focuses on understanding the basic principles, which is fundamental to ${courseName}.`,
        topic: topic,
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
  numQuestions: number
): PracticeQuestion[] {
  return generateMockQuestionsWithContext(
    courseName,
    practiceType,
    numQuestions,
    { fileNames: [], fileTypes: [], fileCount: 0 }
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
  // For now, return a simple evaluation
  // In production, you'd use AI to evaluate the answer
  if (!userAnswer || userAnswer.trim().length === 0) {
    return { score: 0, feedback: 'No answer provided' };
  }

  // Simple keyword matching (basic implementation)
  const userLower = userAnswer.toLowerCase();
  const correctLower = correctAnswer.toLowerCase();
  const userWords = userLower.split(/\s+/);
  const correctWords = correctLower.split(/\s+/);
  
  let matches = 0;
  userWords.forEach(word => {
    if (correctWords.includes(word) && word.length > 3) {
      matches++;
    }
  });

  const score = Math.min(100, Math.round((matches / Math.max(correctWords.length, 1)) * 100));
  
  return {
    score,
    feedback: score >= 70 
      ? 'Good answer! You covered the main points.'
      : score >= 50
      ? 'Partial answer. Try to include more key concepts.'
      : 'Your answer needs more detail. Review the material and try again.',
  };
}

