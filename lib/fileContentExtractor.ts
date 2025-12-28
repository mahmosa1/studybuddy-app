// lib/fileContentExtractor.ts
// Service for extracting text content from course files

import { supabase } from './supabaseClient';

// Helper to convert ArrayBuffer to Uint8Array
function arrayBufferToUint8Array(buffer: ArrayBuffer): Uint8Array {
  return new Uint8Array(buffer);
}

/**
 * Basic PDF text extraction from bytes
 * Extracts text from PDF structure - improved version with better parsing
 */
function extractTextFromPDFBytes(bytes: Uint8Array): string {
  try {
    // Convert bytes to string to search for text patterns
    // Try multiple encodings to handle different PDF formats
    let pdfString = '';
    
    try {
      const textDecoder = new TextDecoder('utf-8', { fatal: false });
      pdfString = textDecoder.decode(bytes);
    } catch (e) {
      // Fallback to latin1 if utf-8 fails
      const textDecoder = new TextDecoder('latin1', { fatal: false });
      pdfString = textDecoder.decode(bytes);
    }
    
    let text = '';
    const extractedStrings: string[] = [];
    
    // Method 1: Extract text from PDF text objects (between parentheses)
    // This is the most common way PDFs store text
    const textMatches = pdfString.match(/\((.*?)\)/g);
    if (textMatches && textMatches.length > 0) {
      textMatches.forEach(match => {
        let extracted = match.slice(1, -1); // Remove parentheses
        
        // Handle PDF escape sequences
        extracted = extracted.replace(/\\n/g, ' ');
        extracted = extracted.replace(/\\r/g, ' ');
        extracted = extracted.replace(/\\t/g, ' ');
        extracted = extracted.replace(/\\f/g, ' ');
        extracted = extracted.replace(/\\(.)/g, '$1');
        
        // Decode octal sequences (e.g., \101 = 'A', \040 = space)
        extracted = extracted.replace(/\\(\d{1,3})/g, (match, octal) => {
          try {
            return String.fromCharCode(parseInt(octal, 8));
          } catch {
            return match;
          }
        });
        
        // Only keep substantial text (more than 2 chars, not just numbers/symbols)
        if (extracted.length > 2 && !extracted.match(/^[\s\d\W]+$/)) {
          extractedStrings.push(extracted);
        }
      });
    }
    
    // Method 2: Extract from BT...ET blocks (text objects)
    const btEtMatches = pdfString.match(/BT\s*([\s\S]*?)\s*ET/gs);
    if (btEtMatches && btEtMatches.length > 0) {
      btEtMatches.forEach(block => {
        const blockText = block.match(/\((.*?)\)/g);
        if (blockText) {
          blockText.forEach(m => {
            let content = m.slice(1, -1);
            content = content.replace(/\\(.)/g, '$1');
            content = content.replace(/\\(\d{1,3})/g, (match, octal) => {
              try {
                return String.fromCharCode(parseInt(octal, 8));
              } catch {
                return match;
              }
            });
            if (content.length > 2 && !content.match(/^[\s\d\W]+$/)) {
              extractedStrings.push(content);
            }
          });
        }
      });
    }
    
    // Method 3: Try to find text in stream objects (for compressed PDFs)
    // This is more complex and may not work for all PDFs
    if (extractedStrings.length < 10) {
      const streamMatches = pdfString.match(/stream\s*([\s\S]{0,5000}?)\s*endstream/g);
      if (streamMatches && streamMatches.length > 0) {
        streamMatches.forEach(stream => {
          // Try to find text patterns in streams
          const streamText = stream.match(/\((.*?)\)/g);
          if (streamText) {
            streamText.forEach(m => {
              let content = m.slice(1, -1);
              if (content.length > 3 && !content.match(/^[\s\d\W]+$/)) {
                extractedStrings.push(content);
              }
            });
          }
        });
      }
    }
    
    // Combine all extracted strings
    text = extractedStrings
      .filter(s => s.trim().length > 0)
      .join(' ')
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/[^\w\s.,;:!?()\-'"]/g, ' ') // Remove special chars but keep punctuation
      .replace(/\s+/g, ' ') // Clean up again
      .trim();
    
    // Only return if we got substantial text
    if (text.length < 100) {
      console.log(`⚠️ Extracted only ${text.length} characters from PDF - not enough for reliable extraction`);
      return ''; // Not enough text
    }
    
    console.log(`✅ Extracted ${text.length} characters from PDF`);
    return text;
  } catch (error) {
    console.error('Error parsing PDF bytes:', error);
    return '';
  }
}

/**
 * Extract text from a file URL
 * Supports PDF, text files, and images (OCR would be needed for images)
 */
export async function extractTextFromFile(
  fileUrl: string,
  mimeType?: string | null
): Promise<string> {
  try {
    // For PDFs, extract text using PDF parsing
    if (mimeType?.includes('pdf') || fileUrl.toLowerCase().endsWith('.pdf')) {
      const pdfText = await extractTextFromPDF(fileUrl);
      if (pdfText && pdfText.trim().length > 50) {
        // Only return if we got substantial text
        return pdfText;
      }
      // If extraction failed, return empty (not file name) so system knows to use fallback
      console.log('⚠️ PDF text extraction returned insufficient text');
      return '';
    }
    
    // For text files
    if (mimeType?.includes('text') || 
        fileUrl.toLowerCase().endsWith('.txt') ||
        fileUrl.toLowerCase().endsWith('.md')) {
      return await extractTextFromTextFile(fileUrl);
    }
    
    // For Word documents (would need a library like mammoth)
    if (mimeType?.includes('word') || 
        mimeType?.includes('document') ||
        fileUrl.toLowerCase().endsWith('.docx') ||
        fileUrl.toLowerCase().endsWith('.doc')) {
      // For now, return file name as content
      // In production, use a library like mammoth to extract text
      return `Word document: ${fileUrl.split('/').pop() || 'document'}`;
    }
    
    // For other file types, return file name
    return `File: ${fileUrl.split('/').pop() || 'file'}`;
  } catch (error) {
    console.error('Error extracting text from file:', error);
    return '';
  }
}

/**
 * Extract text from PDF file
 * Attempts to extract text from PDF structure
 */
async function extractTextFromPDF(fileUrl: string): Promise<string> {
  try {
    console.log('📄 Attempting to extract text from PDF:', fileUrl.split('/').pop() || 'PDF');
    
    // Download the PDF file
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    console.log(`📦 Downloaded PDF: ${arrayBuffer.byteLength} bytes`);
    
    // Try to extract text using PDF structure parsing
    const text = extractTextFromPDFBytes(uint8Array);
    
    if (text && text.trim().length > 100) {
      // Only return if we got substantial text (more than 100 chars)
      const finalText = text.substring(0, 50000); // Limit to 50k chars
      console.log(`✅ Successfully extracted ${finalText.length} characters from PDF`);
      return finalText;
    }
    
    // If extraction failed or got minimal text, return empty
    console.log(`⚠️ Could not extract substantial text from PDF (got ${text?.length || 0} chars)`);
    console.log(`💡 PDF might be scanned/image-based, encrypted, or in an unsupported format`);
    return '';
  } catch (error) {
    console.error('❌ Error extracting text from PDF:', error);
    return '';
  }
}

/**
 * Extract text from text file
 */
async function extractTextFromTextFile(fileUrl: string): Promise<string> {
  try {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error('Failed to download text file');
    }
    
    const text = await response.text();
    // Limit text length to avoid token limits
    return text.substring(0, 10000); // First 10,000 characters
  } catch (error) {
    console.error('Error extracting text from text file:', error);
    return '';
  }
}

/**
 * Get file content from Supabase storage path
 */
export async function getFileContentFromSupabase(
  filePath: string
): Promise<string> {
  try {
    // Download file from Supabase
    const { data, error } = await supabase.storage
      .from('studybuddy-files')
      .download(filePath);
    
    if (error) {
      console.error('Error downloading file from Supabase:', error);
      return '';
    }
    
    if (!data) {
      return '';
    }
    
    // Convert blob to text (for text files)
    const text = await data.text();
    return text.substring(0, 10000); // Limit to 10,000 characters
  } catch (error) {
    console.error('Error getting file content:', error);
    return '';
  }
}

/**
 * Extract text from multiple course files
 * Returns combined text content from all files
 */
export async function extractTextFromCourseFiles(
  files: Array<{ url: string; name: string; mimeType?: string | null }>
): Promise<string> {
  const extractedTexts: string[] = [];
  
  console.log(`📚 Extracting text from ${files.length} file(s)...`);
  
  for (const file of files) {
    if (!file.url) {
      console.log(`⚠️ Skipping ${file.name} - no URL`);
      continue;
    }
    
    try {
      console.log(`📄 Processing: ${file.name} (${file.mimeType || 'unknown type'})`);
      const text = await extractTextFromFile(file.url, file.mimeType);
      
      if (text && text.trim().length > 0) {
        // Only add if we got actual content (not just file name)
        if (!text.startsWith('File:') && 
            !text.startsWith('PDF file:') && 
            !text.startsWith('Word document:') &&
            text.trim().length > 50) { // At least 50 characters
          extractedTexts.push(`\n\n--- Content from ${file.name} ---\n${text}`);
          console.log(`✅ Extracted ${text.length} characters from ${file.name}`);
        } else {
          console.log(`⚠️ Skipping ${file.name} - insufficient content (${text.length} chars)`);
        }
      } else {
        console.log(`⚠️ No text extracted from ${file.name}`);
      }
    } catch (error) {
      console.error(`❌ Error extracting text from ${file.name}:`, error);
      // Continue with other files
    }
  }
  
  // Combine all text, limit total length
  const combinedText = extractedTexts.join('\n');
  const finalText = combinedText.substring(0, 50000); // Limit to 50,000 characters total
  
  console.log(`📊 Total extracted: ${finalText.length} characters from ${extractedTexts.length} file(s)`);
  
  return finalText;
}

