# AI Features Audit — StudyBuddy

מסמך זה מסכם את כל מה שנמצא בקוד הנוגע ל-AI, עיבוד קבצים, מגבלות, וזרימות — ללא שינוי בקוד. שמות טכניים (קבצים, routes, collections, APIs) נשארים באנגלית.

---

## 1. Executive Summary

הפרויקט משלב **OpenAI** (בעיקר `gpt-4o-mini`, ובנתיב legacy גם `gpt-4.1-mini` ל-Responses API עם קבצים) דרך **קריאות HTTP ישירות מהאפליקציה (React Native / Expo)** עם מפתח `EXPO_PUBLIC_OPENAI_API_KEY` — כלומר המפתח נחשף ללקוח אם מוגדר ב-build.

יש שני מסלולים מרכזיים:

1. **Legacy / `lib/aiService.ts`** — חילוץ טקסט מקובצי קורס (`extractTextFromCourseFiles`), קריאות Chat Completions / Responses, fallback ל-`generateMockQuestionsWithContext` (שאלות מקומיות לפי שם קורס/קבצים, מסומנות > `source: 'fallback'`).
2. **Unified Learning Intelligence / `lib/learningIntelligence/*`** — אינדוקס לקורס ב-`courseFileChunks` עם embeddings (`text-embedding-3-small`), retrieval לפי cosine similarity, מנוע ב-`engine.ts`, וכתיבת traces ל-`ragTraces`. מופעל כברירת מחדל אלא אם `EXPO_PUBLIC_DISABLE_UNIFIED_ENGINE === 'true'`.

**עיבוד קבצים:** העלאה ל-**Supabase Storage** (`studybuddy-files`), מטא-דאטה ב-**Firestore** `courseFiles`. חילוץ טקסט בצד הלקוח: PDF ע"י פרסור בסיסי של בתים, TXT/MD מלא עד גבול תווים, DOCX — **לא נפרס** (מוחזר placeholder טקסטואלי בלבד).

**Semantic search / study plan (API):** קיימים ב-`lib/learningIntelligence/api.ts` אך **לא נמצא שימוש במסכי האפליקציה** (רק ייצוא פונקציות).

**מסך Practice tab:** `app/(tabs)/practice.tsx` משתמש ב-**נתוני mock** לרשימת סשנים — לא מחובר ל-`practiceResults` האמיתי.

---

## 2. AI Feature Map

| Feature | UI Route / מיקום | קבצים עיקריים | Service / פונקציות | מקור נתונים | סטטוס |
|--------|-------------------|---------------|---------------------|-------------|--------|
| AI Practice setup + מבחן | `/ai-practice-setup`, `/ai-practice-test`; גישה מ-`/courses/ai-hub`, `/(tabs)/practice`, `/(tabs)/index`, `/courses/statistics` | `app/ai-practice-setup.tsx`, `app/ai-practice-test.tsx` | `generatePracticeQuestions`, `generatePracticeQuestionsFast`, `savePracticeSession` | `courses` (בעלות), `courseFiles`, OpenAI | **מיושם** — תלוי מפתח, קבצים, ומסלול unified/legacy |
| תוצאות תרגול + weak topics | `/practice-results` | `app/practice-results.tsx` | `getProgressDashboard`, `getPracticeHistory`, שאילתת `practiceResults` | `practiceResults`, `userTopicPerformance` | **מיושם** (תצוגה); fallback טקסט כשאין `sessionId` |
| AI Summary + Flashcards | מסך קורס — כפתור "AI Summary + Flashcards" | `app/course/[courseId]/index.tsx` | `generateSummaryAndFlashcards` → `generateUnifiedCourseInsights` / legacy | `courseFiles` + חילוץ טקסט; במנוע unified גם כתיבה ל-`courseFileInsights` | **מיושם** עם fallback טקסטואלי בלי מפתח/תוכן |
| Ask AI / עוזר קורס | מודאל במסך קורס | `app/course/[courseId]/index.tsx` | `askCourseAssistant` → `askUnifiedCourseAssistant` | `courseFileChunks` + `userTopicPerformance` + `practiceResults` | **מיושם** — מבוסס RAG chunks כשהאינדוקס קיים |
| Semantic search (תוכן קורס) | **לא נמצא UI** | — | `semanticSearchCourseFiles` / `semanticSearchCourseContent` | `courseFileChunks` | **API בלבד** — לא מחובר למסכים |
| Weak topics / Study insights | כרטיס "Study Insights" במסך קורס (תנאי `showStudyInsights`) | `app/course/[courseId]/index.tsx` | `getPracticeStats` | `practiceResults` (אגרגציה) | **מיושם** — **לא AI**; סטטיסטיקה מבוססת תוצאות |
| Learning Intelligence engine | שירות פנימי | `lib/learningIntelligence/engine.ts`, `api.ts`, `retrieval.ts`, `contextBuilder.ts` | `LearningIntelligenceEngine` | Firestore + OpenAI | **מיושם** |
| Study plan (AI-ish structure) | **לא נמצא UI** | `lib/learningIntelligence/engine.ts` | `generateStudyPlan` | `userTopicPerformance`, `studyPlans` | **חלקי** — כתיבה ל-`studyPlans`, ללא מסך שזוהה |
| Open answer grading | במהלך `/ai-practice-test` | `app/ai-practice-test.tsx` | `evaluateOpenAnswer`, `evaluateOpenAnswerDetailed` | OpenAI + אופציונלי chunks | **מיושם** עם heuristics fallback |
| Admin AI diagnostics | `/admin/ai-diagnostics` (Expo Router) | `app/admin/ai-diagnostics.tsx` | `onSnapshot` על `ragTraces` | `ragTraces` | **מיושם** — קריאת traces אמיתית |
| Admin דירוג תשובות AI | מודאל Ask AI — כפתורי good/bad | `app/course/[courseId]/index.tsx` | `addDoc` → `aiEvaluations` | `aiEvaluations` | **חלקי** — רק אם `role === 'admin'` **ו**-`__DEV__` |
| OpenAI File upload (אופציונלי) | בתוך `generatePracticeQuestions` כש-flag מופעל | `lib/aiService.ts` | `uploadFilesToOpenAI`, `/v1/responses` | OpenAI Files API | **אופציונלי** — `EXPO_PUBLIC_ENABLE_OPENAI_FILE_UPLOAD === 'true'` |
| מסלול "אינטליגנציה אחרי העלאה" | אחרי העלאת קובץ קורס | `app/course/[courseId]/index.tsx`, `app/lecturer/course/[courseId].tsx` | `startCourseFileIntelligenceJob` → `generateUnifiedCourseInsights` | `courseFiles` → insights ב-`courseFileInsights` | **מיושם** — מריץ insights (לא re-chunk מלא של כל הקבצים בנפרד) |

---

## 3. AI Practice Flow

### נקודת כניסה

- משתמש מגיע ל-**`/ai-practice-setup`** דרך: `courses/ai-hub`, טאב `/(tabs)/practice`, כרטיס ב-`/(tabs)/index`, או `courses/statistics`.

### בחירות משתמש (`app/ai-practice-setup.tsx`)

- **קורס:** נטענים רק קורסים שבהם `courses.ownerUid == auth.uid` (בעל הקורס). אין בחירת "נושא" או קובץ ספציפי — נבחר קורס שלם.
- **סוג תרגול:** `practiceType` — `true-false` | `open-questions` | `mixed`.
- **שפה:** `hebrew` | `english`.
- **מספר שאלות:** `numQuestions` (ברירת מחדל 10).
- **Adaptive mode / Exam mode:** נשמרים ב-`practiceSessions`; במסך המבחן משפיעים על זרימת השאלות.
- **תנאי:** חייב להיות לפחות מסמך אחד ב-`courseFiles` עבור `courseId` — אחרת Alert ולא ממשיכים.

### מה קורה בלחיצה על יצירה

1. נקראים `generatePracticeQuestions` (timeout ~50s) מ-`lib/aiService.ts`.
2. אם נכשל/איטי — `generatePracticeQuestionsFast` (~22s) ו-Alert "fast mode".
3. **`generatePracticeQuestions` (סדר לוגי):**
   - אם unified לא מבוטל: ניסיון `generateUnifiedPracticeQuestions` → `learningIntelligenceEngine.generatePracticeQuestions`:
     - `buildLearningContext` — קבצים מ-`courseFiles`, חולשות מ-`userTopicPerformance`, היסטוריה מ-`practiceResults`.
     - `ensureCourseIndexed(courseId, files)` — אם **אין עדיין** מסמכים ב-`courseFileChunks` לקורס, מחלץ טקסט (עד 8 קבצים), מפצל ל-chunks, יוצר embeddings, `addDoc` ל-`courseFileChunks`, לוגים ב-`courseFileJobs`.
     - `retrieveRelevantChunks` — עד 5 chunks רלוונטיים לפי embedding query.
     - קריאת `gpt-4o-mini` עם JSON של שאלות; `traceLearningEvent` → `ragTraces`.
   - אם unified נכשל או ריק: ממשיכים ל-**legacy path** ב-`aiService.ts`: `getCourseFiles`, חילוץ טקסט `extractTextFromCourseFiles` עם תקציבי תווים (עד מאות אלפי תווים לפי מספר קבצים), cache בזיכרון (Map) ל-30 דקות.
   - אופציונלי: `EXPO_PUBLIC_ENABLE_OPENAI_FILE_UPLOAD` — העלאת PDF/txt/md ל-OpenAI Files + `gpt-4.1-mini` דרך `/v1/responses`.
   - בלי מפתח / בלי תוכן מספק: **`generateMockQuestionsWithContext`** — שאלות עם `source: 'fallback'`.

4. **`savePracticeSession`** (`lib/practiceService.ts`) — `addDoc` ל-`practiceSessions` עם השאלות, `generationMode` (`ai` | `fallback`).

5. ניווט ל-**`/ai-practice-test`** עם `sessionId` ופרמטרים.

### במהלך ואחרי המבחן (`app/ai-practice-test.tsx`)

- שאלות נטענות מ-`practiceSessions/{sessionId}`.
- שאלות פתוחות: `evaluateOpenAnswer` (unified או legacy OpenAI, אחר כך heuristic מילים).
- בסיום: **`savePracticeResults`** → `practiceResults`, עדכון `practiceSessions.status`, **`updateTopicPerformanceProfile`** → `userTopicPerformance`.

### חישוב ציון / weak topics

- ציון כולל באחוזים לפי תשובות נכונות / AI score לשאלות פתוחות (לוגיקה במסך המבחן).
- **`weakTopics` ב-`practiceResults`:** נושאים שבהם הייתה תשובה שגויה, לפי `questions[i].topic` (מנורמל ב-`practiceService.ts`) — **לא מודל AI נפרד**, אלא נגזרות מהשאלות והתשובות.

---

## 4. File Upload and AI Processing Flow

### איפה מעלים

1. **`app/course/[courseId]/index.tsx`** — `DocumentPicker.getDocumentAsync({ type: '*/*' })` → `uploadCourseFileToSupabase` → `addDoc` `courseFiles` → `startCourseFileIntelligenceJob`.
2. **`app/lecturer/course/[courseId].tsx`** — אותה תבנית.

### אחסון

- **קובץ בינארי:** Supabase bucket **`studybuddy-files`**, נתיב `course-files/{courseId}/{timestamp}.{ext}`.
- **מטא-דאטה:** Firestore **`courseFiles`** — `courseId`, `ownerUid`, `name`, `size`, `mimeType`, `url`, `createdAt`.

### חילוץ טקסט (`lib/fileContentExtractor.ts`)

- הורדה ב-`fetch(fileUrl)` מהמכשיר.
- **PDF:** פרסור ידני של בתים `( ... )` / בלוקים — **לא** ספריית pdf.js/mupdf; כשל ב-PDF סרוק/מוצפן נפוץ.
- **TXT / MD:** עד **10,000** תווים לקובץ.
- **DOCX/DOC:** מוחזר מחרוזת placeholder (`Word document: ...`) — **אין פענוח תוכן אמיתי**.
- **תמונות / OCR:** לא מיושם (הערה בקוד בלבד).

### אינדוקס / RAG (`lib/learningIntelligence/retrieval.ts`)

- **`ensureCourseIndexed`:** אם כבר קיימים מסמכים ב-`courseFileChunks` עם אותו `courseId`, הפונקציה **יוצאת מיד** — **לא מעדכנת** קבצים חדשים שנוספו אחרי האינדוקס הראשון.
- אחרת: לכל קובץ (עד 8): חילוץ עד ~90k תווים, `splitIntoChunks` (גודל מקטע מ-`learningIntelligenceConfig.retrieval.maxChunkLength` = **1500**), עד **18** מקטעים לקובץ, לכל מקטע `createEmbedding` (`text-embedding-3-small`, קלט עד 6000 תווים) ו-`addDoc` ל-**`courseFileChunks`** (לא ל-`courseFileInsights`).
- **`courseFileJobs`:** רשומות `status: 'running'` / `'completed'` סביב אותו תהליך.

### איך AI "קורא" קבצים

| מסלול | מקור הקשר |
|--------|-----------|
| Unified (שאלות, צ'אט, הערכה עם courseId) | עד N chunks מ-`courseFileChunks` לפי דמיון embedding לשאילתה |
| Legacy `generatePracticeQuestions` | טקסט מאוחד מ-`extractTextFromCourseFiles` (מוגבל בתקציב תווים ומספר קבצים) |
| OpenAI File API (אופציונלי) | קבצים שהועלו ל-OpenAI + prompt |

---

## 5. Large File Handling and Limits

### מגבלת גודל העלאה בקוד האפליקציה

- ב-**`lib/upload.ts`** אין בדיקת `asset.size` לפני העלאה — **לא נמצא בקוד מגבלת גודל ברורה** ברמת הלקוח לקובצי קורס.
- הגודל עלול להיות מוגבל רק ע"י **מדיניות Supabase Storage** (מחוץ לריפו זה — לא נסרק כאן).

### מגבלות בעת חילוץ / שליחה ל-AI

| שלב | מגבלה (מהקוד) |
|-----|----------------|
| PDF אחרי חילוץ בסיסי | קיצוץ ל-**50,000** תווים לקובץ (`extractTextFromPDF`) |
| טקסט לפני regex כבד | **100,000** תווים (`MAX_TEXT_LENGTH` ב-PDF bytes path) |
| `extractTextFromCourseFiles` | `maxTotalChars` (ברירת מחדל 15000 אם לא הועבר), `maxFiles` (ברירת מחדל 2) — ב-`aiService` יש תוכניות חילוץ גדולות יותר (למשל עד ~420k תווים בסבב שני) |
| Unified insights prompt | `extracted.slice(0, 15000)` ב-`engine.ts` |
| Unified questions context | `sourceText` עד **12,000** תווים |
| Chat assistant sources | מחרוזת מקטעים ללא slice גלובלי נפרד — מוגבל ע"י תוכן המקטעים שנבחרו |
| Embeddings API | `text.slice(0, 6000)` לפני שליחה |
| Legacy chat completion | `max_tokens` / `max_output_tokens` בערכים כגון **1800**, **1400**, **1200** לפי הנתיב |

### התנהגות כשהקובץ גדול מדי לזיכרון / רשת

- אין טיפול ייעודי "file too large" ב-UI מעבר לכשל העלאה הכללי מ-Supabase.
- PDF כבד יורד במלואו ל-`arrayBuffer` — סיכון לזיכרון במכשירים חלשים.

### Fallback

- חוסר תוכן מחילוץ → הנחיות prompt עם שמות קבצים/URLs או mock questions.

---

## 6. File Types and Parsing Support

| סוג קובץ | נתמך לקריאת תוכן? | איך מפורס | מגבלות |
|----------|-------------------|-----------|---------|
| PDF | חלקי | פרסור טקסט גולמי מתוך bytes | נכשל לרוב ב-PDF סרוק/מוצפן; אין pdf.js |
| TXT / MD | כן | `response.text()` | עד 10,000 תווים |
| DOCX / DOC | **לא (תוכן)** | מוחזר placeholder | הערה בקוד: צריך ספרייה כמו mammoth — **לא ב-package.json** |
| תמונה | העלאה בלבד | אין OCR | לא נקרא ל-AI כטקסט |
| אודיו / וידאו / אחר | העלאה אפשרית דרך picker | לא מפורס לטקסט | |

**ספריות:** אין תלות npm ייעודית ל-PDF/DOCX ב-`package.json` — הפרסור הוא **בצד הלקוח** ב-JavaScript בלבד.

---

## 7. AI Provider / Model / API Calls

| פריט | ערך מהקוד |
|------|-----------|
| Provider | **OpenAI** (`https://api.openai.com/v1/...`) |
| מודלים | `gpt-4o-mini` (רוב הזרימות), `gpt-4.1-mini` (Responses + קבצים), `text-embedding-3-small` (embeddings) |
| מפתח | `process.env.EXPO_PUBLIC_OPENAI_API_KEY` — **בלקוח** (Expo public) |
| Flags | `EXPO_PUBLIC_ENABLE_OPENAI_FILE_UPLOAD`, `EXPO_PUBLIC_DISABLE_UNIFIED_ENGINE` |
| Rate limits / retry | אין retry מובנה מערכתי; timeouts מקומיים ב-`withTimeout` ב-`aiService` / במסכים |
| כשל רשת / API | מעבר ל-fallback mock, Alert במסכים, `traceLearningEvent` עם `fallbackUsed` / `qualityStatus` במקרים מסוימים |

---

## 8. Data Collections and Storage

רק אוספים שמופיעים בקוד כחלק מזרימות AI/תרגול/אינדוקס (Firestore):

| Collection | מטרה עיקרית | שדות חשובים (לא ממצים) | כותבים (דוגמאות) | קוראים |
|------------|-------------|-------------------------|-------------------|--------|
| `courseFiles` | מטא-דאטה + URL לקבצי קורס | `courseId`, `url`, `name`, `mimeType`, `size`, `ownerUid` | `course/[courseId]/index`, `lecturer/course/[courseId]` | `aiService`, `contextBuilder`, `ai-practice-setup` |
| `courseFileChunks` | מקטעי טקסט + `embedding` ל-RAG | `courseId`, `fileId`, `fileName`, `content`, `chunkIndex`, `embedding` | `retrieval.ts` (`upsertCourseFileChunks`) | `retrieveRelevantChunks`, semantic search |
| `courseFileJobs` | לוג סטטוס אינדוקס | `courseId`, `status` | `ensureCourseIndexed` | לא נמצא UI ייעודי |
| `courseFileInsights` | תוצאות insights אחרי מנוע unified | `summary`, `keyPoints`, `flashcards`, `quizSeeds`, `keyConcepts` | `engine.generateCourseInsights` | לא נמצא קריאת UI בקוד שנסרק |
| `practiceSessions` | סשן תרגול פעיל | `questions`, `userId`, `practiceType`, `generationMode` | `savePracticeSession` | `ai-practice-test` |
| `practiceResults` | תוצאות סופיות | `score`, `answers`, `weakTopics` | `savePracticeResults` | `practice-results`, `contextBuilder`, סטטיסטיקה |
| `userTopicPerformance` | פרופיל נושאים לפי ניסיונות | `topic`, `accuracy`, `predictedRisk`, … | `updateTopicPerformanceProfile` | `contextBuilder`, מנוע |
| `ragTraces` | traces לדיאגנוסטיקה | `traceType`, `latencyMs`, `sourceChunkIds`, `qualityStatus`, `fallbackUsed`, … | `tracing.ts`, `engine.ts`, `aiService` (במקרי fallback) | `admin/ai-diagnostics.tsx` |
| `aiEvaluations` | דירוג אדמין לתשובת AI | `question`, `answer`, `rating`, `traceId`, … | `course/[courseId]/index` (מוגבל admin+__DEV__) | לא נסרק קורא נוסף |
| `studyPlans` | תוכנית לימודים מבוססת חולשות | `items`, `userId`, `courseId` | `engine.generateStudyPlan` | לא נמצא UI |

**שים לב:** `studyTasks` / `studySessions` / `dailyStatistics` קשורים ל-`studyJournalService` — יומן למידה, **לא** זוהו כמנוע AI בקוד שנבדק.

---

## 9. Diagnostics, Tracing, and Evaluation

### מסך `app/admin/ai-diagnostics.tsx`

- **Route:** `/admin/ai-diagnostics` (Expo Router).
- **גישה:** רק משתמש עם `role === 'admin'` (אחרת `Redirect` — יש לוודא בקוד המסך).
- **תוכן:** רשימת עד 120 מסמכים מ-`ragTraces` עם `orderBy('createdAt','desc')`, סינון לפי `traceType`, `courseId`, `fallbackUsed`, `cacheHit`, `qualityStatus`.
- **שדות שמוצגים:** כולל `latencyMs`, `sourceChunkIds`, `sourceFileIds`, `errorCode`, `fallbackReason`, וכו'.
- **חיבור ל-AI:** ה-traces נכתבים ממסלולי המנוע והשירותים בעת קריאות אמיתיות; אין סימולציה במסך עצמו.

### הערכות (`aiEvaluations`)

- כפתורי thumbs ב-Ask AI שומרים ל-`aiEvaluations` **רק** כש-`role === 'admin' && __DEV__`** — בפרודקשן בנייה רגילה כנראה **לא פעיל**.

---

## 10. Risks and Limitations

### עובד היטב (כשהתנאים מתקיימים)

- זרימת תרגול end-to-end: יצירה → שמירת סשן → מבחן → שמירת תוצאות → עדכון `userTopicPerformance`.
- Ask AI עם RAG כש-`courseFileChunks` מאוכלס ומפתח תקין.
- דיאגנוסטיקה למנהלים מ-`ragTraces`.

### חלקי / בעייתי

- **אינדוקס חד-פעמי:** קיום כלשהו של `courseFileChunks` לקורס מונע אינדוקס מחדש — קבצים חדשים עלולים **לא** להיכנס ל-RAG.
- **DOCX:** לא נסרק לטקסט — תוכן לא נכנס ל-AI באמת.
- **`semanticSearchCourseFiles` / `generateUnifiedStudyPlan`:** ללא UI.
- **טאב Practice:** נתוני mock — מטעה ביחס להיסטוריה אמיתית.
- **`courseFiles` rules vs שדה `ownerUid`:** ב-`firestore.rules` תנאי `create` מזכיר `uploadedBy`, בעוד האפליקציה שולחת `ownerUid` — אם הכללים בפרודקשן תואמים לקובץ ב-repo, ייתכן כשל יצירה או פער אבטחה; **יש לאמת מול הסביבה המפרסת** (לא שינינו rules במסמך זה).

### סיכונים

- **מפתח OpenAI בלקוח** — חשיפה, שימוש לרעה, עלות.
- **הזיות** — כשאין תוכן מספק, ה-prompt מבקש "שאלות ספציפיות" לפי שם קורס בלבד.
- **אין ציטוט מקור אוטומטי למשתמש קצה** בכל המסכים — חלק מהמידע על מקטעים מוצג במסך הקורס דרך `sourceChunksCount` / שמות קבצים ב-Ask AI.
- **ביצועים:** הורדת PDF גדול + embeddings סדרתיים ב-`upsertCourseFileChunks` — איטי ועלול לחסום UI אם לא ברקע נפרד.

### מה לא לטעון בדמו

- "חיפוש סמנטי במסך החיפוש" — **לא קיים** ב-UI.
- "תוכנית לימודים AI מלאה" — נכתבת ל-`studyPlans` אבל **אין מסך** שזוהה.
- "הטאב Practice מציג היסטוריה אמיתית" — **לא**; mock.
- "כל קובץ קורס נסרק ונכנס ל-RAG" — DOCX לא; PDF מוגבל; אינדוקס חד-פעמי.

---

## 11. Recommendations

### Must fix לפני דמו (או להגדרת ציפיות)

1. **להחליף קריאות OpenAI ל-backend מאובטח** (Edge Function / Cloud Function) — מפתח לא ב-`EXPO_PUBLIC_*`.
2. **לתקן / ליישר** את שדה יצירת `courseFiles` עם `firestore.rules` (או לעדכן rules בנפרד — מחוץ להיקף המסמך).
3. **אינדוקס מחדש:** לפחות hash של קבצים או `fileId` ב-chunks, או מחיקת chunks ישנים כשמוסיפים קבצים — כדי ש-RAG ישקף חומר עדכני.
4. **הודעות משתמש** למגבלות גודל קובץ (לפי מדיניות Supabase) ולכשל חילוץ PDF.

### Nice to have

5. ספריית PDF אמיתית (pdf.js / native) ו-OCR אופציונלי לסריקות.
6. DOCX באמצעות mammoth או המרה שרתית.
7. חיבור `semanticSearchCourseFiles` למסך חיפוש או מסך קורס.
8. החלפת mock ב-`/(tabs)/practice.tsx` ב-שאילתה ל-`practiceResults`.

### גרסה עתידית

9. ציטוט מקור (קטע + שם קובץ + מספר עמוד אם זמין).
10. בדיקות אוטומטיות לזרימות AI (mock HTTP + Firestore emulator).
11. מדיניות rate limit ו-retry עם backoff.

---

## 12. Files Inspected

- `package.json`
- `lib/aiService.ts`
- `lib/practiceService.ts`
- `lib/fileContentExtractor.ts`
- `lib/upload.ts`
- `lib/supabaseClient.ts` (אזכור עקיף דרך upload)
- `lib/firebaseConfig.ts` (אזכור)
- `lib/learningIntelligence/engine.ts`
- `lib/learningIntelligence/api.ts`
- `lib/learningIntelligence/retrieval.ts`
- `lib/learningIntelligence/contextBuilder.ts`
- `lib/learningIntelligence/tracing.ts`
- `lib/learningIntelligence/config.ts`
- `lib/learningIntelligence/types.ts`
- `lib/learningIntelligence/cache.ts` (אזכור במנוע)
- `app/ai-practice-setup.tsx`
- `app/ai-practice-test.tsx`
- `app/practice-results.tsx`
- `app/(tabs)/practice.tsx`
- `app/(tabs)/index.tsx` (ניווט ל-AI practice)
- `app/course/[courseId]/index.tsx`
- `app/lecturer/course/[courseId].tsx`
- `app/courses/ai-hub.tsx`
- `app/courses/statistics.tsx`
- `app/admin/ai-diagnostics.tsx`
- `firestore.rules`
- `OPENAI_FILE_API_SETUP.md` (קיים בריפו; לא נדרש לתוכן הדוח אך רלוונטי ל-File API)

**קבצים מהרשימה המקורית שלא קיימים כפי ששמם:** לא נדרשו נתיבים נוספים מעבר ללמעלה.

---

## סיכום סיום (קצר)

1. **נוצר קובץ** `AI_FEATURES_AUDIT.md`.
2. **יכולות AI שנמצאו:** תרגול AI (setup + test), סיכום + פלאשקארדים, Ask AI עם RAG, הערכת תשובות פתוחות, אינדוקס chunks+embeddings, traces לאדמין, insights ל-`courseFileInsights`, תוכנית לימודים ב-API בלבד, semantic search ב-API בלבד.
3. **סטטוס עיבוד קבצים:** העלאה ל-Supabase + מטא-דאטה ב-Firestore; חילוץ PDF/TXT בצד לקוח; DOCX ללא תוכן; RAG דרך `courseFileChunks` עם מגבלות אינדוקס חד-פעמי.
4. **מגבלת גודל קובץ:** לא נמצאה בקוד אפליקציה מפורשת; מגבלות טקסט/טוקנים בחילוץ ובפרומפטים כמפורט בסעיף 5.
5. **סיכונים עיקריים:** מפתח בלקוח, אינדוקס שלא מתעדכן, PDF/DOCX חלשים, הזיות בלי תוכן, טאב Practice עם mock.
6. **צעד מומלץ הבא:** העברת OpenAI לשרת מאובטח + תיקון מדיניות אינדוקס/קבצים.
