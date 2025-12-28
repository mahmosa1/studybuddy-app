# PDF Text Extraction Setup

## Current Implementation

The system now attempts to extract text from PDF files using a basic text extraction method that:
1. Downloads the PDF file
2. Searches for text patterns in the PDF structure
3. Extracts text from PDF text objects

## How It Works

### Method 1: Basic PDF Parsing (Current)
- Extracts text from PDF text objects (between parentheses)
- Extracts text from BT...ET blocks
- Works for simple PDFs with text layers
- May not work for scanned PDFs or complex PDFs

### Method 2: Backend API (Recommended for Production)
You can set up a backend API endpoint that uses proper PDF parsing libraries:

**Environment Variable:**
```
EXPO_PUBLIC_PDF_EXTRACTION_API=https://your-api.com/extract-pdf
```

**API Endpoint Format:**
```javascript
POST /extract-pdf
Body: { fileUrl: "https://..." }
Response: { text: "extracted text..." }
```

**Backend Implementation (Node.js example):**
```javascript
const pdf = require('pdf-parse');
const fetch = require('node-fetch');

app.post('/extract-pdf', async (req, res) => {
  const { fileUrl } = req.body;
  const response = await fetch(fileUrl);
  const buffer = await response.buffer();
  const data = await pdf(buffer);
  res.json({ text: data.text });
});
```

## Limitations

1. **Scanned PDFs**: Won't extract text (would need OCR)
2. **Complex PDFs**: May miss some text
3. **Encrypted PDFs**: Won't work
4. **Large PDFs**: May be slow

## Testing

1. Upload a simple PDF with text (not scanned)
2. Generate practice questions
3. Check console logs for extraction status
4. Questions should be based on extracted text

## Improving Extraction

For better results, consider:
1. Using a backend service with `pdf-parse` library
2. Using OCR for scanned PDFs (Tesseract.js)
3. Using cloud services (Google Cloud Vision, AWS Textract)

## Current Status

✅ Basic PDF text extraction implemented
✅ Falls back to file names if extraction fails
✅ Works for simple PDFs with text layers
⚠️ May not work for scanned or complex PDFs

