# StudyBuddy — תוכנית בדיקות QA

מסמך זה מתאר חומר בדיקות מאורגן לפרויקט **StudyBuddy** (אפליקציית React Native / Expo + Firebase).  
התיאורים בעברית; שמות מסכים, נתיבים (`routes`) ושמות טכניים באנגלית לפי הקוד.

**הערות כלליות**

- אין במסמך זה יישום בדיקות אוטומטיות — רק רעיונות ותרחישים לביצוע ידני / עתידי אוטומציה.
- יש להתאים משתמשי בדיקה, נתוני Firestore וכללי אבטחה לסביבת ה-Staging/Production בהתאם למדיניות הארגון.

---

## סעיף 1 — בדיקות יחידה (Unit Tests)

בדיקות יחידה ממוקדות בפונקציות/שירותים/לוגיקה מבודדת (עם mock ל-Firebase כשצריך).

| מזהה | רכיב / פונקציה | מטרה | קלט / מצב | תוצאה צפויה | עדיפות |
|------|------------------|--------|-----------|--------------|--------|
| UT-01 | `lib/courseJoinRequestService.ts` — `requestToJoinCourse` | וידוא דחייה כשאין אימות | `studentUid` ריק / לא מחובר | `ok: false`, `reason: not_authenticated` | גבוהה |
| UT-02 | אותו שירות — `requestToJoinCourse` | מניעת בקשה לקורס עצמי | `lecturerUid === studentUid` | `ok: false`, `reason: owner_blocked` | גבוהה |
| UT-03 | אותו שירות — `requestToJoinCourse` | מניעת כפילות pending | כבר קיימת בקשה `pending` לאותו זוג course+student | `ok: false`, `reason: pending_exists` | גבוהה |
| UT-04 | `lib/tutorExerciseService.ts` — `submissionDocId` / מזהה מסמך | דטרמיניזם של מזהה הגשה | `exerciseId`, `studentUid` ידועים | מחרוזת `${exerciseId}_${studentUid}` | בינונית |
| UT-05 | `lib/tutorExerciseService.ts` — `mapSubmissionDoc` | מיפוי סטטוס | `status: 'graded'` / אחר | `TutorExerciseSubmissionDoc.status` מתאים (`graded` / `submitted`) | גבוהה |
| UT-06 | `frontend/services/participationService.ts` — `isUserSharedInCourse` | זיהוי שיתוף לפי `sharedWithUids` / `sharedWith` | מערכים עם/בלי `uid` של המשתמש | `true` / `false` לפי הצפי | גבוהה |
| UT-07 | אותו שירות — `resolveLecturerLabels` (לוגיקה פנימית) | שם מרצה כשאין בשדות הקורס אך יש `ownerUid` | mock `users/{ownerUid}` עם `fullName` | שם מוצג במקום `unknownLecturerLabel` | בינונית |
| UT-08 | `frontend/utils/format.ts` — פונקציות עזר (אם קיימות) | פורמט תאריכים/טקסטים ל-join requests | תאריכים ידועים | מחרוזת עקבית ל-HE/EN | נמוכה |
| UT-09 | לוגיקת סינון פוסטים ב-`app/(tabs)/feed.tsx` (חילוץ לפונקציה) | `followers` — רק עוקבים או מחבר | `visibility`, `authorUid`, `followingSet` | החלטת `canSeePost` נכונה | גבוהה |
| UT-10 | אותו מקור — `institution` | פוסט מוסד רק למשתמשים מאותו institution | `postInstitution` vs `userInstitution` | הצגה/הסתרה לפי כלל | גבוהה |
| UT-11 | `lib/practiceService.ts` (אם קיים `getPracticeStats`) | מבנה סטטיסטיקות | `courseId` תקין | אובייקט עם שדות צפויים / ערכי ברירת מחדל | בינונית |
| UT-12 | `lib/tutorExerciseService.ts` — `getPublishedExerciseWithSolutionsIfGraded` | אין פתרונות לפני ציון | submission לא `graded` | `null` | גבוהה |
| UT-13 | בדיקת תוויות i18n — מפתחות `courseJoin.*`, `feed.*` | קיום מפתחות אחרי שינויי UI | טעינת `he.json` / `en.json` | כל המפתחות בשימוש קיימים | נמוכה |
| UT-14 | `lib/feedAttachmentUtils.ts` — `attachmentLooksLikeImage` | זיהוי MIME/סיומת | URI / mime שונים | `true`/`false` צפוי | בינונית |
| UT-15 | `lib/tutorSupportRequestService.ts` — `submitTutorSupportRequest` | מניעת בקשה כשכבר accepted | mock קיים | `reason: accepted_exists` | בינונית |

**סה״כ רעיונות בדיקות יחידה בסעיף 1:** 15  

---

## סעיף 2 — בדיקות אינטגרציה (Integration Tests)

זרימות שחוצות מסך + שירות + Firestore (או סימולטור).

| מזהה | שם זרימה | תנאים מקדימים | שלבים | תוצאה צפויה | מסכים / שירותים | עדיפות |
|------|-----------|----------------|---------|--------------|-------------------|--------|
| IT-01 | הרשמה סטודנט → ממתין לאישור | אדמין יכול לאשר מאוחר יותר | מילוי `register-student` → שליחה → מעבר ל-`pending-approval` | סטטוס `pending` במסמך `users` | `(auth)/register-student`, `(auth)/pending-approval` | גבוהה |
| IT-02 | הרשמר מרצה + מסמכים → pending | — | `register-lecturer` → שליחה | משתמש `pending`, נתיב לאישור | `(auth)/register-lecturer` | גבוהה |
| IT-03 | התחברות פעילה → טאבים | משתמש `active` | `login` → הצלחה | ניתוב ל-`/(tabs)` לפי role | `(auth)/login`, `(tabs)/_layout` | גבוהה |
| IT-04 | שכחתי סיסמה | אימייל רשום ב-Firebase Auth | `forgot-password` → שליחת איפוס | הודעת הצלחה / מייל (לפי הגדרות) | `(auth)/forgot-password` | בינונית |
| IT-05 | סטודנט מבקש להצטרף לקורס מרצה | מרצה עוקב אחרי המרצה (לפי מסך `lecturer-course`) | פרופיל מרצה → קורס → Request join | מסמך ב-`courseJoinRequests` | `user-profile`, `lecturer-course/[courseId]`, `courseJoinRequestService` | גבוהה |
| IT-06 | מרצה מאשר join | בקשה `pending` | `lecturer/join-requests` → Approve | סטודנט רואה חומרים ב-`lecturer-course` או נתיב הקורס | `lecturer/join-requests`, `lecturer-course` | גבוהה |
| IT-07 | יצירת פוסט עם נראות followers | שני משתמשים, אחד עוקב אחרי | פוסט `followers` מחבר A, כניסה כ-B שלא עוקב | B לא רואה; עוקב — רואה | `(tabs)/feed`, `feedPosts` | גבוהה |
| IT-08 | יצירת פוסט + קורס בבעלות | רק קורסים `ownerUid` שלי ב-picker | פתיחת מודל יצירה → רשימת קורסים | אין קורסי "participating" בלבד | `(tabs)/feed` | גבוהה |
| IT-09 | מעקב הדדי / עקוב חזרה | A עוקב אחרי B, B לא אחרי A | כניסה לפרופיל A מ-B | כפתור "עקוב חזרה"; לחיצה → `follows` | `user-profile/[userId]` | בינונית |
| IT-10 | תרגיל מתגבר: הגשה → ציון | מרצה/מתגבר וסטודנט מאושרים | סטודנט ממלא ושולח → מתגבר מדרג ב-`submissions` | סטודנט רואה ציון במסך התרגיל ובכרטיס קורס | `course/.../tutor-exercises`, `tutor/exercises/.../submissions` | גבוהה |
| IT-11 | העלאת קובץ לקורס + אינדוקס | בעלים | `course/[courseId]` → העלאה | מסמך ב-`courseFiles`, טריגר intelligence (אם מוגדר) | `course/[courseId]/index` | בינונית |
| IT-12 | משתתף לא מוחק קובץ מרצה | סטודנט `studentNonOwnerCourse` | ניסיון מחיקה (אם UI נגיש בטעות) | מחיקה נחסמת ב-handler | `course/[courseId]/index` | גבוהה |
| IT-13 | התראות פעילות | לייק/תגובה | פעולה על פוסט | התראה ב-`feed` modal / `notifications` | `(tabs)/feed`, `createActivityNotification` | בינונית |
| IT-14 | צ'אט — שיחה חדשה / הודעה | שני משתמשים | שליחת הודעה | הודעה מופיעה ב-`chat/[chatId]` | `chat.tsx`, `chat/[chatId].tsx` | בינונית |
| IT-15 | אדמין — אישור משתמש pending | אדמין `active` | `admin/pending-approvals` | משתמש עובר ל-`active` | `admin/pending-approvals` | גבוהה |

**סה״כ בדיקות אינטגרציה בסעיף 2:** 15  

---

## סעיף 3 — תרחישי בדיקה ידניים (Manual Test Cases)

כל תרחיש כולל: מזהה, כותרת, תנאים, שלבים, נתונים, צפי, מקום לתוצאה בפועל, סטטוס, חומרה.

| מזהה | כותרת | תנאים מקדימים | שלבי בדיקה | נתוני בדיקה | תוצאה צפויה | תוצאה בפועל | סטטוס | חומרה אם נכשל |
|------|--------|---------------|-------------|-------------|-------------|-------------|--------|-----------------|
| TC-01 | התחברות סטודנט פעיל | משתמש `active`, role student | פתיחת Login → הזנת אימייל/סיסמה → שליחה | אימייל/סיסמה תקינים | מעבר ל-Home/טאבים | | Pass/Fail | גבוהה |
| TC-02 | דחיית התחברות — סיסמה שגויה | — | סיסמה שגויה | — | הודעת שגיאה, ללא מעבר | | Pass/Fail | בינונית |
| TC-03 | משתמש pending לא נכנס לאפליקציה | סטטוס pending | Login מוצלח Auth | — | ניתוב ל-`pending-approval` | | Pass/Fail | גבוהה |
| TC-04 | הרשמה סטודנט חדש | אימייל לא קיים | מילוי טופס `register-student` | פרטים חוקיים | מסמך user + pending | | Pass/Fail | גבוהה |
| TC-05 | הרשמה מרצה + קבצים | — | `register-lecturer` עם קבצים נדרשים | קבצים תקינים | שליחה + pending | | Pass/Fail | גבוהה |
| TC-06 | שכחתי סיסמה | אימייל קיים ב-Auth | `forgot-password` | אימייל | הודעת הצלחה | | Pass/Fail | בינונית |
| TC-07 | פיד — יצירת פוסט ציבורי | מחובר | + → מילוי כותרת/תוכן → Public → פרסום | תוכן קצר | פוסט מופיע ברשימה | | Pass/Fail | גבוהה |
| TC-08 | פיד — followers only | יש עוקב/לא עוקב | פרסום followers; כניסה כלא-עוקב | שני חשבונות | רק עוקב רואה | | Pass/Fail | גבוהה |
| TC-09 | פיד — institution | שני מוסדות שונים | פוסט institution; משתמש מוסד אחר | — | הסתרה מהפיד | | Pass/Fail | גבוהה |
| TC-10 | עריכת פוסט (אם קיימת) | בעלים | פתיחת `feed/post/[postId]` → עריכה | — | עדכון נשמר | | Pass/Fail | בינונית |
| TC-11 | לייק / שמירה / תגובה | פוסט קיים | לחיצות על UI | — | מונה/מצב מתעדכן | | Pass/Fail | בינונית |
| TC-12 | הקורסים שלי | סטודנט עם קורסים | `courses/my` | — | רשימת קורסים בבעלות | | Pass/Fail | בינונית |
| TC-13 | משתתף בקורסים | סטודנט עם שיתוף | `courses/participating` | — | מקור מרצה/מתגבר, ללא כפילות שם שגוי | | Pass/Fail | בינונית |
| TC-14 | פרטי קורס — קבצים | בעלים / משתתף | פתיחת `course/[courseId]` | — | משתתף: בלי מחיקה; בעלים: מחיקה | | Pass/Fail | גבוהה |
| TC-15 | תובנות לימוד — הסתרה למשתתף | קורס לא בבעלות | כניסה מ-participating | — | ללא כרטיס תובנות (לפי לוגיקה) | | Pass/Fail | בינונית |
| TC-16 | תרגילי מתגבר — רק מקור מתגבר | בקשת tutor accepted | מסך קורס | — | סעיף תרגילים מוצג רק כשמתאים | | Pass/Fail | בינונית |
| TC-17 | כרטיס תרגיל — סטטוס הגשה | הגשה/ציון | רענון מסך קורס | — | טקסט CTA מתאים | | Pass/Fail | בינונית |
| TC-18 | מרכז מתגבר | מרצה מאושר כמתגבר | `tutor/hub`, exercises | — | ניווט ויצירה/פרסום | | Pass/Fail | גבוהה |
| TC-19 | צפייה בהגשות ומתן ציון | הגשה קיימת | `tutor/exercises/.../submissions` | ציון 0–100 | נשמר, סטודנט רואה | | Pass/Fail | גבוהה |
| TC-20 | פרופיל ציבורי + מעקב | לא אותו משתמש | `user-profile/[userId]` | — | עקוב / עוקב אחרי / עקוב חזרה | | Pass/Fail | בינונית |
| TC-21 | פיד טאב למרצה/אדמין | role lecturer/admin | כניסה לטאבים | — | טאב Feed גלוי, תוכן נטען | | Pass/Fail | בינונית |
| TC-22 | צ'אט — ספירת לא נקרא | הודעות חדשות | כניסה ל-Chat | — | Badge מתעדכן | | Pass/Fail | נמוכה |
| TC-23 | אדמין — משתמשים | admin | `admin/users` | חיפוש/סינון | רשימה תקינה | | Pass/Fail | בינונית |
| TC-24 | אדמין — קורסים | admin | `admin/courses` | — | פעולות מותרות בלבד | | Pass/Fail | בינונית |
| TC-25 | AI / סיכום קורס (אם מופעל) | קבצים בקורס | מסך קורס → AI | שאלה קצרה | תשובה או הודעת שגיאה מבוקרת | | Pass/Fail | נמוכה |
| TC-26 | חיפוש (טאב Search) | נתונים קיימים | חיפוש קורס/משתמש | מחרוזת | תוצאות רלוונטיות | | Pass/Fail | נמוכה |
| TC-27 | שמירת פוסטים | פוסט ציבורי | `feed/saved` | לחיצת Save | מופיע ברשימה השמורה | | Pass/Fail | בינונית |
| TC-28 | עורך פוסט — תמונה מצורפת (אם קיים) | — | יצירה עם תמונה | קובץ קטן | תצוגה בפוסט | | Pass/Fail | בינונית |

**סה״כ תרחישים ידניים בסעיף 3:** 28  

---

## סעיף 4 — בדיקות GUI / חוויית משתמש

מיקוד במראה, RTL, מקלדת, רווחים, מצבי טעינה וריק.

| מזהה | מסך | רכיב / אזור | שלבים | תוצאה ויזואלית צפויה | RTL / רספונסיביות | עדיפות |
|------|-----|---------------|--------|---------------------|---------------------|--------|
| GUI-01 | `(tabs)/_layout` | Bottom tabs | מעבר בין טאבים | הדגשה עקבית, אייקונים לא נחתכים | בדיקת HE: סדר אייקונים והיפוך שורות אם רלוונטי | גבוהה |
| GUI-02 | `(tabs)/feed` | Create Post Modal | פתיחה במכשיר עם notch | כותרת מודל וכפתור סגירה בתוך safe area | מקלדת לא מסתירה שדות חובה | גבוהה |
| GUI-03 | `(tabs)/feed` | רשימת פוסטים | גלילה ארוכה | ריווח אחיד בין כרטיסים | טקסט עברי מיושר ימין | בינונית |
| GUI-04 | `courses/my` | Hero card | טעינה | רק תיאור (ללא כפילות כותרת) | כותרת ב-AppHeader בלבד | נמוכה |
| GUI-05 | `courses/participating` | כרטיס קורס | מקור מרצה/מתגבר | תגיות קריאות, שם מרצה לא "Unknown" כשיש נתונים | שורות מטא לא נשברות | בינונית |
| GUI-06 | `course/[courseId]` | כרטיס קבצים | עם/בלי כפתור מחיקה | משתתף: בלי אייקון אשפה | RTL בשורת קובץ | גבוהה |
| GUI-07 | `lecturer-course/[courseId]` | כפתור join / הודעת follow | לא עוקב אחרי מרצה | הודעת חסימה ברורה | טקסט בעברית קריא | גבוהה |
| GUI-08 | `user-profile/[userId]` | כפתור Follow | מצבי Follow / Following / Follow back | צבע primary למצב "לא עוקב", muted ל-"עוקב" | יישור טקסט ואייקון ב-HE | בינונית |
| GUI-09 | `chat` / `chat/[chatId]` | שדה הודעה + שליחה | פתיחת מקלדת | שדה נשאר גלוי / KeyboardAvoiding | RTL בבועות | בינונית |
| GUI-10 | `tutor/hub` | כרטיסים | — | empty state אם אין נתונים | — | בינונית |
| GUI-11 | `tutor/exercises/new` | טפסים ארוכים | גלילה | כפתורי שמירה נגישים | — | בינונית |
| GUI-12 | `admin/pending-approvals` | רשימה | מספר רב של פריטים | גלילה חלקה, ללא חפיפה לטאב תחתון | — | נמוכה |
| GUI-13 | `(auth)/login` | שדות + שגיאות | אימייל לא תקין | הודעת שגיאה קריאה | שדות לא צמודים לקצה המסך | גבוהה |
| GUI-14 | `feed/post/[postId]` | תגובות | הרחבת אזור | ריווח בין תגובות | RTL לשמות ותאריכים | בינונית |
| GUI-15 | `profile` (tabs) | מודל followers | פתיחה/סגירה | רקע וכותרת עקביים ל-AppCard | חיפוש במודל | בינונית |
| GUI-16 | `course/[courseId]/tutor-exercises/[exerciseId]` | שאלות + שליחה | מצב submitted vs graded | הודעות סטטוס ברורות | — | גבוהה |
| GUI-17 | מסכי שגיאה רשת | כללי | ניתוק רשת (סימולציה) | הודעה או retry, ללא קריסה | — | בינונית |
| GUI-18 | גודל טקסט מערכת (נגישות) | מערכת | הגדלת פונט ב-OS | טקסט לא חתוך בכפתורים | — | נמוכה |
| GUI-19 | אורך כותרת ארוך בפוסט | Feed card | כותרת 2 שורות+ | ellipsis או שבירת שורה מסודרת | — | נמוכה |
| GUI-20 | `image-viewer` / `attachment-viewer` | מסך מלא | סגירה ב-X | חזרה חלקה | כיוון סגירה ב-HE | נמוכה |

**סה״כ בדיקות GUI בסעיף 4:** 20  

---

## נספח — מפת מסכים עיקריים (Routes)

| אזור | נתיבים לדוגמה |
|------|----------------|
| Auth | `/(auth)/login`, `register-role`, `register-student`, `register-lecturer`, `forgot-password`, `pending-approval` |
| Tabs | `/(tabs)/index`, `search`, `feed`, `courses`, `profile`, `admin` (מוסתר לפי role) |
| קורסים | `courses/my`, `courses/participating`, `course/[courseId]`, `lecturer-course/[courseId]`, `lecturer/course/[courseId]` |
| פיד | `feed/post/[postId]`, `feed/saved` |
| מתגבר | `tutor/hub`, `tutor/apply`, `tutor/participants`, `tutor/exercises/...` |
| פרופיל | `user-profile/[userId]`, `edit-profile`, `profile/settings`, … |
| אדמין | `admin/users`, `admin/courses`, `admin/pending-approvals`, … |

---

## סיכום מנהלים

| סעיף | כמות |
|------|------|
| רעיונות Unit Tests | 15 |
| בדיקות Integration | 15 |
| תרחישי QA ידניים | 28 |
| בדיקות GUI | 20 |

**אישור:** מסמך זה נוצר בלבד; **לא בוצעו שינויים בקוד האפליקציה**.
