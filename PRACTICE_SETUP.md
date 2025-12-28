# Practice System Setup Guide

## Overview
The practice system is now fully integrated with AI-powered question generation and Firestore for storing practice sessions and results.

## Features Implemented

### 1. AI Practice Question Generation
- **Service**: `lib/aiService.ts`
- **Functionality**: 
  - Generates practice questions using OpenAI API
  - Falls back to mock questions if API key is not set
  - Supports multiple question types: True/False, Multiple Choice, Open-ended
  - Extracts course file information to generate relevant questions

### 2. Practice Session Management
- **Service**: `lib/practiceService.ts`
- **Firestore Collections**:
  - `practiceSessions`: Stores practice session data (questions, course info)
  - `practiceResults`: Stores completed practice results (scores, answers, weak topics)

### 3. Updated Screens
- **AI Practice Setup** (`app/ai-practice-setup.tsx`): Now generates real questions
- **AI Practice Test** (`app/ai-practice-test.tsx`): Loads questions from Firestore and saves answers
- **Practice Results** (`app/practice-results.tsx`): Displays real results and weak topics
- **Course Details** (`app/course/[courseId].tsx`): Shows real practice statistics

## Setup Instructions

### Option 1: Using OpenAI API (Recommended)

1. **Get OpenAI API Key**:
   - Go to https://platform.openai.com/api-keys
   - Create a new API key
   - Copy the key

2. **Add API Key to Your Project**:
   - Create a `.env` file in the root directory (if using Expo)
   - Add: `EXPO_PUBLIC_OPENAI_API_KEY=your_api_key_here`
   - Or use Expo Constants: `expo install expo-constants`
   - Then access via: `Constants.expoConfig?.extra?.openAIKey`

3. **Update `lib/aiService.ts`**:
   - The code already checks for `process.env.EXPO_PUBLIC_OPENAI_API_KEY`
   - If using Expo Constants, update line 5 in `lib/aiService.ts`:
     ```typescript
     import Constants from 'expo-constants';
     const OPENAI_API_KEY = Constants.expoConfig?.extra?.openAIKey || '';
     ```

### Option 2: Using Mock Questions (No API Key Required)

- The system will automatically use mock questions if no API key is found
- Mock questions are generated based on course name and practice type
- This is perfect for testing and development

## Firestore Security Rules

Make sure your Firestore rules allow:
- Read/write to `practiceSessions` for authenticated users
- Read/write to `practiceResults` for authenticated users

The rules in `firestore.rules` should already include these permissions.

## How It Works

### 1. Generating Practice Questions
1. User selects course, practice type, and number of questions
2. System fetches course files from Firestore
3. AI generates questions based on course content (or uses mock questions)
4. Questions are saved to `practiceSessions` collection
5. User is navigated to practice test screen

### 2. Taking Practice Test
1. Questions are loaded from Firestore session
2. User answers questions
3. On submit:
   - True/False and Multiple Choice: Direct comparison
   - Open-ended: AI evaluation (or simple keyword matching)
4. Results are saved to `practiceResults` collection
5. Weak topics are calculated from incorrect answers

### 3. Viewing Results
1. Results screen shows score, correct/incorrect answers
2. Weak topics are displayed (topics with incorrect answers)
3. User can practice again or go back to course

### 4. Course Statistics
1. Course details screen loads practice statistics from Firestore
2. Shows:
   - Total practices completed
   - Average score
   - Last practice date
   - Top 3 weak topics

## Testing

1. **Without API Key**:
   - The system will use mock questions
   - All features work, but questions are generic

2. **With API Key**:
   - Questions are generated based on course content
   - More relevant and personalized questions
   - Better learning experience

## Troubleshooting

### Questions Not Generating
- Check if course has files uploaded
- Verify API key is set correctly
- Check console for errors
- System will fall back to mock questions on error

### Results Not Saving
- Check Firestore permissions
- Verify user is authenticated
- Check console for errors

### Statistics Not Showing
- Ensure at least one practice session is completed
- Check Firestore for `practiceResults` documents
- Verify course ID matches

## Next Steps (Optional Enhancements)

1. **PDF Text Extraction**: Extract actual text from PDF files for better question generation
2. **Advanced AI Evaluation**: Improve open-ended question evaluation
3. **Practice Analytics**: Add more detailed analytics and insights
4. **Adaptive Learning**: Adjust question difficulty based on performance
5. **Question Bank**: Store generated questions for reuse

## Notes

- The system gracefully handles missing API keys by using mock questions
- All practice data is stored in Firestore for persistence
- Weak topics are automatically calculated from incorrect answers
- Practice statistics are aggregated from all practice sessions

