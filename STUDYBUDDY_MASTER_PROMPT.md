# פרומפט מאסטר — StudyBuddy (מצב מערכת מלא)

> מסמך זה מתאר את כל מה שקיים במערכת StudyBuddy לפי הקוד בפרויקט.  
> ניתן להשתמש בו לדוחות, לתיעוד, או כפרומפט ל-AI.  
> עודכן: מאי 2026

---

## הקשר כללי

**StudyBuddy** היא אפליקציית **React Native / Expo** (Expo Router, TypeScript) ללמידה אקדמית.

- **Backend:** Firebase Auth + Cloud Firestore
- **אחסון קבצים:** Supabase Storage (`studybuddy-files`)
- **AI:** OpenAI (`gpt-4o-mini`, embeddings, אופציונלי File API) — קריאות מצד הלקוח עם `EXPO_PUBLIC_OPENAI_API_KEY`
- **שפות UI:** עברית ואנגלית (`i18next`, `lib/locales/he.json`, `en.json`)
- **תפקידים (roles):** `student`, `lecturer`, `admin` (אין role נפרד `tutor` — מתגבר = סטודנט עם `tutorApprovedCourses` ב־`users`)

**ניווט ראשי:** `app/index.tsx` → לפי Auth + `users.status` → `login` / `pending-approval` / `/(tabs)`.

---

## 1. ארכיטקטורה ושכבות

| שכבה | נתיב / טכנולוגיה |
|------|------------------|
| UI Routes | `app/**` (Expo Router) |
| שירותים | `lib/*.ts`, `lib/learningIntelligence/*`, `frontend/services/*` |
| עיצוב | `frontend/components/ui/*`, `frontend/styles/designSystem.ts` |
| Auth | `lib/firebaseConfig.ts` — Firebase Auth + persistence |
| קבצים | `lib/upload.ts` → Supabase |
| AI legacy | `lib/aiService.ts` |
| AI unified | `lib/learningIntelligence/engine.ts`, `api.ts`, `retrieval.ts` |

---

## 2. אימות, הרשמה ומחזור חיים

### מסכים (`app/(auth)/`)

| Route | תפקיד |
|-------|--------|
| `login.tsx` | התחברות Email/Password |
| `register-role.tsx` | בחירת תפקיד: סטודנט / מרצה |
| `register-student.tsx` | הרשמה סטודנט: פרטים, תמונות (כרטיס סטודנט, פרופיל, סלפי אימות) → Supabase + `users` עם `status: pending` |
| `register-lecturer.tsx` | הרשמה מרצה + מסמכים |
| `forgot-password.tsx` | איפוס סיסמה (Firebase Auth) |
| `pending-approval.tsx` | ממתין לאישור / נדחה — ערעור ל־`appeals` |

### לוגיקה

- `users/{uid}`: `role`, `status` (`pending` | `active` | `blocked` | `rejected`), פרופיל, `institution`, `tutorApprovedCourses[]`, וכו'.
- `/(tabs)/_layout.tsx`: `pending`/`rejected` → `pending-approval`; `blocked` → login.

---

## 3. מעטפת אפליקציה — טאבים (`app/(tabs)/`)

| Tab | Route | מי רואה | תוכן עיקרי |
|-----|-------|---------|------------|
| בית | `index.tsx` | כולם (תוכן לפי role) | **סטודנט:** יומן למידה, טיימר, משימות, התראות חכמות, קיצורי דרך. **מרצה:** קורסים, הוספת קורס. **אדמין:** סטטיסטיקות משתמשים, קיצורים לאדמין |
| חיפוש | `search.tsx` | כולם | חיפוש משתמשים וקורסים; בקשת `tutorSupportRequests` |
| פיד | `feed.tsx` | student, lecturer, admin | פוסטים, יצירה, לייק/שמירה/תגובות, התראות, מעקב |
| קורסים | `courses.tsx` | כולם | Hub: הקורסים שלי, משתתף, AI Hub, מתגבר (אם מאושר), join requests (מרצה) |
| פרופיל | `profile.tsx` | כולם | פרופיל אישי, פוסטים שלי, עוקבים/נעקבים, עריכה, הגדרות |
| תרגול | `practice.tsx` | מוסתר (`href: null`) | **Mock** — רשימת תרגולים דמה (לא Firestore אמיתי) |
| אדמין | `admin.tsx` | מוסתר בטאב | Redirect ל־`admin/pending-approvals` |

---

## 4. בית — יומן למידה (סטודנט)

**קובץ:** `app/(tabs)/index.tsx` → `StudentHomeWithJournal`  
**שירות:** `lib/studyJournalService.ts`

### יכולות

- יעד יומי לימוד (שניות) — עריכה, progress bar
- טיימר לימוד (התחלה/השהיה/עצירה) → שמירה ב־`studySessions`
- משימות (`studyTasks`) — יצירה, סטטוס, מחיקה
- סטטיסטיקות (`dailyStatistics`, `getStudyStats`)
- התראות חכמות (`getSmartNotifications`) — למשל יעד נותר, נושא חלש
- קיצורי דרך: תרגול AI, קורסים, צ'אט

**Firestore:** `studyTasks`, `studySessions`, `dailyStatistics`.

---

## 5. קורסים

### Hub — `app/(tabs)/courses.tsx`

- **הקורסים שלי** → `courses/my.tsx` (קורסים ש־`ownerUid` = אני)
- **משתתף** (סטודנט) → `courses/participating.tsx` — קורסים משותפים (`participationService`)
- **AI Hub** → `courses/ai-hub.tsx` → `ai-practice-setup`
- **סטטיסטיקות תרגול** → `courses/statistics.tsx` — מ־`practiceResults`
- **מרצה:** `lecturer/join-requests`
- **מתגבר מאושר:** `tutor/hub`

### פרטי קורס — `app/course/[courseId]/index.tsx`

- צפייה/העלאה/מחיקת קבצים (`courseFiles` + Supabase `course-files/{courseId}/`)
- אחרי העלאה: `startCourseFileIntelligenceJob` → אינדוקס/insights
- **תובנות לימוד** (בעלים): `getPracticeStats` — תרגולים, נושאים חלשים
- **Ask AI** — מודאל, `askCourseAssistant`, מקורות/chunks, `qualityStatus`
- **AI Summary + Flashcards** — `generateSummaryAndFlashcards`
- **תרגילי מתגבר** (סטודנט עם `tutorSupport` מאושר): רשימה + ניווט לפתרון

### מרצה

- `lecturer/add-course.tsx` — יצירת `courses`
- `lecturer/course/[courseId].tsx` — ניהול קורס + העלאת קבצים (דומה לסטודנט בעלים)
- `lecturer/join-requests.tsx` — **אמיתי:** אישור/דחיית `courseJoinRequests`

### מרצה חיצוני (סטודנט רואה קורס מרצה)

- `lecturer-course/[courseId].tsx` — צפייה, בקשת join (תלוי מעקב אחרי מרצה)

### בקשות הצטרפות (סטודנט)

- `join-requests.tsx` — **כרגע Mock** (לא Firestore)
- זרימה אמיתית: `courseJoinRequestService` + `lecturer-course` / פרופיל מרצה

---

## 6. תרגול AI

| Route | תפקיד |
|-------|--------|
| `ai-practice-setup.tsx` | בחירת קורס (בעלים + קבצים), סוג שאלות, שפה, מספר שאלות, adaptive, exam mode |
| `ai-practice-test.tsx` | מבחן מ־`practiceSessions`; הערכת שאלות פתוחות (`evaluateOpenAnswer`) |
| `practice-results.tsx` | ציון, נושאים חלשים, dashboard (`getProgressDashboard`) |

**שירותים:** `lib/aiService.ts`, `lib/practiceService.ts`, `lib/learningIntelligence/api.ts`

### זרימה

1. `generatePracticeQuestions` / `generatePracticeQuestionsFast` → unified engine או legacy (חילוץ PDF/TXT מ־`courseFiles`)
2. `savePracticeSession` → `practiceSessions`
3. בסיום → `practiceResults` + `userTopicPerformance` (נושאים חלשים, accuracy, predictedRisk)

**Firestore:** `practiceSessions`, `practiceResults`, `userTopicPerformance`.

---

## 7. בינה מלאכותית (Learning Intelligence)

**מודול:** `lib/learningIntelligence/`

| יכולת | API / פונקציה | אחסון |
|--------|----------------|--------|
| שאלות תרגול מבוססות RAG | `generateUnifiedPracticeQuestions` | cache + `ragTraces` |
| סיכום + פלאשקארדים + quiz seeds | `generateUnifiedCourseInsights` | `courseFileInsights` |
| עוזר קורס (שאלה חופשית) | `askUnifiedCourseAssistant` | `ragTraces` |
| הערכת תשובה פתוחה | `evaluateUnifiedOpenAnswer` | traces |
| תוכנית לימוד | `generateUnifiedStudyPlan` | `studyPlans` (ללא UI ייעודי שנמצא) |
| חיפוש סמנטי | `semanticSearchCourseContent` | `courseFileChunks` (ללא UI ייעודי) |

**RAG:** `ensureCourseIndexed` → חילוץ טקסט → `courseFileChunks` + embeddings (`text-embedding-3-small`) → cosine similarity.

**הערה:** אינדוקס רץ פעם אחת לקורס אם כבר יש chunks (לא מעדכן אוטומטית קבצים חדשים).

**דיאגנוסטיקה:** `app/admin/ai-diagnostics.tsx` — קריאת `ragTraces` (latency, fallback, quality, chunks).

---

## 8. פיד חברתי (Feed)

**מסך ראשי:** `app/(tabs)/feed.tsx`

### יכולות

- יצירת פוסט: כותרת, תוכן, תגיות, סוג (Summary/Tip/Question/Exam Info), קורס מקושר (רק קורסים בבעלות), **נראות:** `public` | `institution` | `followers`
- קבצים מצורפים → Supabase `feed-files/{userId}/`
- פיד עם סינון נראות (עוקבים, מוסד)
- לייק, שמירה, תגובות (מונה), דיווח
- מודאל התראות (`activityNotifications`)
- ניווט לפרופיל מחבר

### פוסט בודד — `app/feed/post/[postId].tsx`

- תוכן מלא, לייק/שמירה/דיווח
- תגובות ב־subcollection `feedPosts/{id}/comments`
- לייק לתגובה, מחיקה (long press), שליחת תגובה + התראה לבעל הפוסט

### שמורים

- `app/feed/saved.tsx`

**Firestore:** `feedPosts`, `feedPosts/{id}/comments`, `feedReports`, `follows`, `activityNotifications`.

---

## 9. פרופיל, מעקב והגדרות

### `app/(tabs)/profile.tsx`

- תמונת פרופיל, שם, מוסד, תפקיד
- **הפוסטים שלי** — רשימה + עריכה (מודאל)
- **עוקבים / נעקב אחרי** — מודאל עם חיפוש
- מונה עדכוני מערכת (badge)
- קישור להגדרות ול־`system-updates`

### `app/user-profile/[userId].tsx`

- פרופיל ציבורי, עקוב / עוקב אחרי / עקוב חזרה
- קורסים של המשתמש (לפי הרשאות)
- פוסטים ציבוריים שלו

### הגדרות — `app/profile/`

| Route | תוכן |
|-------|------|
| `settings.tsx` | חשבון, העדפות Study Buddy, שפה, פוסטים שמורים, הגשת מתגבר (סטודנט), יציאה |
| `account-settings.tsx` | פרטי חשבון |
| `change-password.tsx` | שינוי סיסמה |
| `language.tsx` | HE/EN + AsyncStorage |
| `study-buddy-preferences.tsx` | העדפות שותף לימוד (סטודנט) |
| `system-updates.tsx` | עדכונים: `courseJoin`, `tutorSupport`, החלטות |

### `app/edit-profile.tsx`

- עריכת פרופיל + תמונה

---

## 10. חיפוש וצ'אט

### `app/(tabs)/search.tsx`

- חיפוש **משתמשים** ו**קורסים**
- שליחת **בקשת תמיכת מתגבר** (`tutorSupportRequests`)

### `app/chat.tsx`

- רשימת שיחות (`chatThreads`): direct, group, course
- יצירת שיחה חדשה (עוקבים / כל המשתמשים)
- **יצירת קבוצה** — שם, בחירת חברים

### `app/chat/[chatId].tsx`

- הודעות טקסט, **תמונה**, **הודעות קול** (הקלטה `expo-av`, `.m4a`, העלאה)
- unread, מידע קבוצה
- `chatThreads/{id}/messages`

---

## 11. מסלול מתגבר (Tutor)

**אין role `tutor`** — סטודנט עם אישור ב־`users.tutorApprovedCourses` ו/או `tutorApplications` מאושרות.

| Route | תפקיד |
|-------|--------|
| `tutor/apply.tsx` | מועמדות: קורס בבעלות, גיליון ציונים (Supabase), הצהרה → `tutorApplications` |
| `admin/tutor-applications.tsx` | אדמין מאשר/דוחה |
| `tutor/hub.tsx` | מרכז: משתתפים + תרגילים |
| `tutor/participants.tsx` | סטודנטים עם `tutorSupport` מאושר לפי קורס |
| `tutor/exercises/index.tsx` | רשימת תרגילים (סינון קורס) |
| `tutor/exercises/new.tsx` | יצירת תרגיל (שאלות: פתוחות / אמריקאיות / נכון-לא נכון) |
| `tutor/exercises/[exerciseId]/index.tsx` | עריכה, פרסום (`published`) |
| `tutor/exercises/.../submissions/index.tsx` | רשימת הגשות |
| `tutor/exercises/.../submissions/[submissionId].tsx` | ציון 0–100 + משוב |

### סטודנט

- `course/[courseId]/tutor-exercises/[exerciseId].tsx` — פתרון והגשה
- `tutorExerciseService.ts` → `tutorExercises`, `tutorExerciseSubmissions`

**תמיכת מתגבר:** `tutorSupportRequestService` — בקשה מחיפוש/פרופיל; סטודנט רואה תרגילים בקורס רק אחרי `accepted`.

---

## 12. אדמין

| Route | תפקיד |
|-------|--------|
| `admin/pending-approvals.tsx` | אישור משתמשים `pending` |
| `admin/users.tsx` | ניהול משתמשים |
| `admin/courses.tsx` | ניהול קורסים |
| `admin/appeals.tsx` | ערעורים |
| `admin/tutor-applications.tsx` | מועמדויות מתגבר |
| `admin/ai-diagnostics.tsx` | traces של AI (`ragTraces`) |

**בית אדמין** (`index.tsx` — `AdminHomeScreen`): מונים students/lecturers/pending appeals, ניווט למסכים.

---

## 13. מסכים עזר

| Route | תפקיד |
|-------|--------|
| `attachment-viewer.tsx` | צפייה בקבצים/תמונות מצורפות |
| `image-viewer.tsx` | תצוגת תמונה |
| `modal.tsx` | מודאל גנרי Expo |

---

## 14. אחסון קבצים (Supabase `studybuddy-files`)

| נתיב | שימוש |
|------|--------|
| `student-cards/` | הרשמת סטודנט |
| `profile-pictures/` | תמונות פרופיל |
| `verification-selfies/` | אימות |
| `lecturer-ids/`, `lecturer-profile-pictures/` | מרצה |
| `course-files/{courseId}/` | חומרי קורס |
| `feed-files/{userId}/` | מצורפי פיד |
| `tutor-grade-sheets/{userId}/` | גיליון ציונים למתגבר |

---

## 15. אוספי Firestore (מלא לפי קוד)

| Collection | מטרה |
|------------|------|
| `users` | פרופיל, role, status, tutorApprovedCourses |
| `courses` | קורסים (`ownerUid`, שם, מוסד…) |
| `courseFiles` | מטא-דאטה קבצי קורס + URL |
| `courseFileChunks` | מקטעי טקסט + embedding ל-RAG |
| `courseFileJobs` | סטטוס אינדוקס |
| `courseFileInsights` | סיכום/פלאשקארדים שנשמרו מהמנוע |
| `courseJoinRequests` | בקשות הצטרפות לקורס |
| `practiceSessions` | סשני תרגול AI |
| `practiceResults` | תוצאות תרגול |
| `userTopicPerformance` | ביצועים לפי נושא |
| `feedPosts` | פוסטים |
| `feedPosts/{id}/comments` | תגובות |
| `feedReports` | דיווחים |
| `follows` | מעקב (מזהה מורכב follower_following) |
| `activityNotifications` | התראות פעילות |
| `chatThreads` | שיחות |
| `chatThreads/{id}/messages` | הודעות |
| `tutorApplications` | מועמדות מתגבר |
| `tutorExercises` | תרגילי מתגבר |
| `tutorExerciseSubmissions` | הגשות (`{exerciseId}_{studentUid}`) |
| `tutorSupportRequests` | בקשת תמיכה ממתגבר |
| `appeals` | ערעורים |
| `studyTasks` | משימות יומן |
| `studySessions` | סשני טיימר |
| `dailyStatistics` | סטטיסטיקה יומית |
| `studyPlans` | תוכניות לימוד (מנוע) |
| `ragTraces` | traces ל-AI |
| `aiEvaluations` | דירוג תשובת AI (אדמין + `__DEV__` בלבד במסך קורס) |
| `studyBuddyPreferences` | העדפות שותף לימוד (אם בשימוש) |

---

## 16. משתני סביבה (AI)

- `EXPO_PUBLIC_OPENAI_API_KEY`
- `EXPO_PUBLIC_DISABLE_UNIFIED_ENGINE` — כיבוי מנוע מאוחד
- `EXPO_PUBLIC_ENABLE_OPENAI_FILE_UPLOAD` — העלאת קבצים ל-OpenAI בתרגול

---

## 17. מה מיושם מלא vs חלקי / Mock

| אזור | סטטוס |
|------|--------|
| Auth + pending + appeals | מיושם |
| קורסים, קבצים, AI בקורס | מיושם (עם מגבלות PDF/DOCX) |
| תרגול AI + תוצאות | מיושם |
| פיד + תגובות + מעקב | מיושם |
| צ'אט + קבוצות + קול/תמונה | מיושם |
| Join requests מרצה | מיושם |
| Join requests סטודנט (`join-requests.tsx`) | **Mock** |
| טאב Practice (`practice.tsx`) | **Mock** |
| Semantic search UI | **אין** |
| Study plan UI | **אין** |
| מפתח OpenAI בלקוח | **סיכון אבטחה** |
| אינדוקס chunks לקבצים חדשים | **חלקי** (לא re-index אוטומטי) |

---

## 18. פרומפט קצר לשימוש ב-AI (העתקה)

```
אתה מכיר את StudyBuddy — אפליקציית מובייל (Expo + TypeScript) ללמידה אקדמית.
תפקידים: student, lecturer, admin. מתגבר = סטודנט מאושר עם תרגילים ידניים.
Stack: Firebase Auth/Firestore, Supabase Storage, OpenAI (תרגול, RAG, Ask AI, סיכום).
מודולים: Auth, Home+StudyJournal, Courses+Files, AI Practice, Feed+Follow, Chat+Group+Voice,
Search+TutorSupport, Tutor apply/exercises/submissions, Admin approvals/appeals/AI diagnostics.
נתונים עיקריים: users, courses, courseFiles, courseFileChunks, practiceSessions/Results,
feedPosts, follows, chatThreads, tutorExercises/Submissions, courseJoinRequests, ragTraces.
RTL HE/EN. חלקים Mock: join-requests student screen, practice tab history.
```

---

## 19. קבצי תיעוד קשורים בפרויקט

| קובץ | תוכן |
|------|------|
| `STUDYBUDDY_FULL_PROJECT_AUDIT.md` | ביקורת פרויקט (ייתכן שחלקו לא מעודכן לגבי tutor/feed) |
| `AI_FEATURES_AUDIT.md` | ביקורת AI בעברית |
| `QA_TEST_PLAN.md` | תוכנית בדיקות |
| `INDEXES_REQUIRED.md` | אינדקסים נדרשים ל-Firestore |
| `scripts/qa-check.js` | סקריפט אימות מבנה + QA plan |

---

## סיכום

מסמך זה הוא **תיעוד מלא של המערכת הקיימת** — תפקידים, מסכים, זרימות, אוספי Firestore, AI, אחסון, והגבלות ידועות. לעדכון דוח אקדמי (User Stories) ראו גם סעיף 4 בדוח המקורי + הרחבות 28–55 שהוצעו בשיחה.
