# 🧪 מדריך לבדיקת התרגול

## ✅ מה לבדוק

### 1. בדיקת יצירת תרגול
1. **לך לקורס שיש בו קבצים** (PDF, טקסט, וכו')
2. **לחץ על "Practice"** (בדף הקורס או מהבית)
3. **בחר:**
   - קורס (אם יש כמה)
   - סוג תרגול (True/False, Open Questions, Mixed)
   - מספר שאלות (10, 20, 30)
4. **לחץ על "Generate Practice"**

### 2. מה אמור לקרות
- ✅ הודעת טעינה: "Generating practice questions..."
- ✅ בקונסול תראה:
  - "Attempting to upload files to OpenAI File API..."
  - "Successfully uploaded X file(s) to OpenAI" (אם יש קבצים)
  - או "File API upload failed, falling back to text extraction"
- ✅ מעבר למסך התרגול עם שאלות

### 3. בדיקת התרגול עצמו
1. **ענה על השאלות**
2. **לחץ על "Submit"**
3. **בדוק:**
   - מעבר למסך תוצאות
   - ציון נכון
   - תשובות נכונות/שגויות
   - נושאים חלשים

### 4. בדיקת תוצאות
1. **בדוק את הציון** - אמור להיות בין 0-100%
2. **בדוק את הסיכום:**
   - מספר תשובות נכונות
   - מספר תשובות שגויות
   - סה"כ שאלות
3. **בדוק נושאים חלשים:**
   - רשימת נושאים שצריך לשפר
   - כפתור "Practice These Topics Again"

## 🔍 בדיקת הקונסול

### הודעות שצריכות להופיע:
```
✅ "Attempting to upload files to OpenAI File API..."
✅ "Successfully uploaded X file(s) to OpenAI"
✅ "Successfully extracted text from PDF" (אם יש PDFs)
```

### אם יש שגיאה:
- **"OpenAI quota exceeded"** → המערכת תעבור ל-mock questions
- **"Failed to generate questions"** → בדוק את ה-API key
- **"No course files found"** → העלה קבצים לקורס

## ⚠️ ה-Warning על החבילות

ה-warning הזה **לא קריטי** - האפליקציה אמורה לעבוד גם עם הגרסאות הישנות.

אם תרצה לעדכן (אופציונלי):
```bash
npm install @react-native-async-storage/async-storage@2.2.0 expo@~54.0.30 expo-constants@~18.0.12 expo-document-picker@~14.0.8 expo-font@~14.0.10 expo-haptics@~15.0.8 expo-image@~3.0.11 expo-image-picker@~17.0.10 expo-linking@~8.0.11 expo-router@~6.0.21 expo-splash-screen@~31.0.13 expo-status-bar@~3.0.9 expo-symbols@~1.0.8 expo-system-ui@~6.0.9 expo-web-browser@~15.0.10
```

אבל **זה לא חובה** - האפליקציה עובדת גם בלי זה.

## 🎯 מה לבדוק עכשיו

1. ✅ **ה-API key מוגדר** - בדוק שיש קובץ `.env` עם המפתח
2. ✅ **יש credits ב-OpenAI** - יש לך $10.00
3. ✅ **יש קבצים בקורס** - העלה PDF או קובץ טקסט
4. ✅ **נסה ליצור תרגול** - בדוק שהכל עובד

## 📝 אם יש בעיות

1. **שגיאת quota** → המערכת תעבור ל-mock questions (זה בסדר)
2. **שגיאת API key** → בדוק את קובץ `.env`
3. **שגיאת קבצים** → ודא שיש קבצים בקורס
4. **שגיאת טעינה** → הפעל מחדש עם `expo start -c`

## 🎉 אחרי שהכל עובד

- השאלות יהיו מבוססות על התוכן האמיתי מהקבצים
- GPT-4o יקרא את התוכן וייצור שאלות רלוונטיות
- התוצאות יישמרו ב-Firestore
- תוכל לראות סטטיסטיקות בקורס

**נסה עכשיו ותגיד לי מה קורה!** 🚀

