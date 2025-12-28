# OpenAI File API Setup Guide

## Overview

The practice system now uses **OpenAI File API** to upload course files directly to OpenAI, allowing GPT-4o to read the actual content of PDFs, text files, and other documents.

## How It Works

1. **File Upload**: Course files are uploaded to OpenAI's servers
2. **File Reading**: GPT-4o reads the actual content from the uploaded files
3. **Question Generation**: Questions are generated based on the real file content
4. **Auto Cleanup**: Files are automatically deleted from OpenAI after 24 hours

## Benefits

✅ **Accurate Questions**: Questions are based on actual file content, not just file names
✅ **Works with PDFs**: No need for PDF parsing libraries
✅ **Works with Word Docs**: OpenAI handles various file formats
✅ **Better Quality**: GPT-4o provides better question quality than GPT-4o-mini

## Requirements

1. **OpenAI API Key**: Must be set in environment variables
   ```
   EXPO_PUBLIC_OPENAI_API_KEY=your_api_key_here
   ```

2. **GPT-4o Model**: Uses `gpt-4o` when files are uploaded (more expensive but better quality)
   - Falls back to `gpt-4o-mini` if File API is not used

## Supported File Types

- ✅ PDF files (.pdf)
- ✅ Text files (.txt, .md)
- ✅ Word documents (.doc, .docx) - if OpenAI supports them
- ✅ Other formats supported by OpenAI File API

## Cost Considerations

- **File Upload**: Free (files are stored temporarily)
- **GPT-4o**: More expensive than GPT-4o-mini (~$5-15 per 1M input tokens)
- **Auto Cleanup**: Files are deleted after 24 hours automatically

## Fallback Behavior

If File API upload fails:
1. System tries to extract text directly (for .txt, .md files)
2. Falls back to using file names if extraction fails
3. Uses mock questions if no content is available

## Testing

1. Upload a PDF file to a course
2. Generate practice questions
3. Check console logs for:
   - "Attempting to upload files to OpenAI File API..."
   - "Successfully uploaded X file(s) to OpenAI"
4. Questions should be based on actual PDF content

## Troubleshooting

### Files Not Uploading
- Check OpenAI API key is set correctly
- Check file URLs are accessible
- Check console for error messages

### Questions Not Based on Content
- Verify files were uploaded (check console logs)
- Check if GPT-4o model is being used
- Verify file format is supported by OpenAI

### High Costs
- Files are auto-deleted after 24 hours
- Consider using GPT-4o-mini for non-file questions
- Monitor OpenAI usage dashboard

## API Limits

- **File Size**: Max 512 MB per file
- **File Retention**: 24 hours (auto-deleted)
- **Rate Limits**: Check OpenAI documentation

## Security

- Files are uploaded to OpenAI's secure servers
- Files are automatically deleted after 24 hours
- API key should be kept secure (use environment variables)

