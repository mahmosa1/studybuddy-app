# Practice Question Generation - File Content Extraction

## Current Status

The practice system now attempts to extract text content from course files to generate more accurate questions. However, there are limitations:

### ✅ What Works Now

1. **Text Files (.txt, .md)**: Full text extraction works perfectly
2. **File Names**: System uses file names to infer topics
3. **File Types**: System recognizes different file types

### ⚠️ Current Limitations

1. **PDF Files**: Cannot extract text content in React Native without native modules
2. **Word Documents (.doc, .docx)**: Cannot extract text content in React Native
3. **Images**: Would require OCR (not implemented)

## Solutions for Better Content Extraction

### Option 1: Backend Service (Recommended)

Create a backend API that:
1. Receives file URLs
2. Downloads files from Supabase
3. Extracts text using server-side libraries:
   - `pdf-parse` for PDFs
   - `mammoth` for Word documents
   - `tesseract.js` for OCR (images)
4. Returns extracted text to the app

**Example Backend Endpoint:**
```javascript
POST /api/extract-text
Body: { fileUrl: "...", mimeType: "application/pdf" }
Response: { text: "extracted text content..." }
```

### Option 2: OpenAI File API

Use OpenAI's file upload API:
1. Upload files to OpenAI
2. Use `gpt-4o` with file reading capability
3. Generate questions based on file content

**Limitations:**
- Requires uploading files to OpenAI (privacy concerns)
- Costs more API calls
- File size limits

### Option 3: React Native Native Modules

Use native modules for PDF parsing:
- `react-native-pdf` - requires native setup
- `react-native-fs` + PDF parsing library
- More complex setup, but works client-side

### Option 4: Hybrid Approach (Current)

1. Extract text from .txt/.md files ✅
2. Use file names to infer topics ✅
3. For PDFs/Word: Use file names + course name
4. Generate questions based on available information

## Current Implementation

The system now:
1. ✅ Extracts text from text files
2. ✅ Uses file names to extract topics
3. ✅ Sends file content to OpenAI (if available)
4. ✅ Falls back to file names if content unavailable

## Recommendations

For production, implement **Option 1 (Backend Service)**:
- Most reliable
- Works with all file types
- Better privacy (files stay on your server)
- Can cache extracted text

## Testing

To test the current implementation:
1. Upload a `.txt` file to a course
2. Generate practice questions
3. Questions should be based on the text content

For PDFs/Word:
- Questions will be based on file names and course name
- Still relevant, but not as specific as full content extraction

