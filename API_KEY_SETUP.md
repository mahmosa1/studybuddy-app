# 🔑 הגדרת OpenAI API Key

## איפה לשים את ה-API Key?

### שלב 1: צור קובץ `.env` בפרויקט

1. פתח את התיקייה הראשית של הפרויקט (`/Users/mahmodsanalla/Desktop/studybuddy`)
2. צור קובץ חדש בשם `.env` (בדיוק עם הנקודה בהתחלה)
3. הוסף את השורה הבאה:

```
EXPO_PUBLIC_OPENAI_API_KEY=sk-your-actual-api-key-here
```

**דוגמה:**
```
EXPO_PUBLIC_OPENAI_API_KEY=sk-your-actual-api-key-here
```

### שלב 2: קבל את ה-API Key מ-OpenAI

1. לך ל: https://platform.openai.com/api-keys
2. התחבר לחשבון שלך
3. לחץ על "Create new secret key"
4. העתק את המפתח (הוא מתחיל ב-`sk-`)
5. הדבק בקובץ `.env` במקום `your-actual-api-key-here`

### שלב 3: ודא שהקובץ לא נשלח ל-Git

הקובץ `.env` כבר צריך להיות ב-`.gitignore`. אם לא, הוסף אותו:

```
.env
```

### שלב 4: הפעל מחדש את האפליקציה

אחרי הוספת ה-API key:
1. עצור את האפליקציה (Ctrl+C)
2. הפעל מחדש: `npm start` או `expo start`
3. נקה את ה-cache אם צריך: `expo start -c`

## 📁 מיקום הקובץ

הקובץ `.env` צריך להיות בתיקייה הראשית של הפרויקט:

```
studybuddy/
├── .env          ← כאן!
├── app/
├── lib/
├── package.json
└── ...
```

## ✅ איך לבדוק שזה עובד?

1. פתח את הקונסול באפליקציה
2. נסה ליצור תרגול חדש
3. אתה אמור לראות:
   - "Attempting to upload files to OpenAI File API..."
   - "Successfully uploaded X file(s) to OpenAI"
4. אם אתה רואה "OpenAI API key not found" → ה-API key לא הוגדר נכון

## ⚠️ חשוב!

- **אל תשתף את ה-API key** - הוא פרטי ויש לו גישה לחשבון שלך
- **אל תעלה את `.env` ל-Git** - ודא שהוא ב-`.gitignore`
- **השתמש ב-`EXPO_PUBLIC_`** - זה מאפשר גישה מה-client-side ב-Expo

## 🔄 אם זה לא עובד

1. ודא שהקובץ נקרא בדיוק `.env` (לא `.env.txt` או משהו אחר)
2. ודא שהשורה מתחילה ב-`EXPO_PUBLIC_OPENAI_API_KEY=`
3. ודא שאין רווחים לפני או אחרי ה-`=`
4. הפעל מחדש את האפליקציה עם `expo start -c` (נקה cache)
5. בדוק את הקונסול לשגיאות

## 💰 עלויות

- GPT-4o: ~$5-15 לכל מיליון tokens
- העלאת קבצים: חינם
- קבצים נמחקים אוטומטית אחרי 24 שעות

## 📝 דוגמה לקובץ `.env` מלא

```
EXPO_PUBLIC_OPENAI_API_KEY=sk-your-actual-api-key-here
```

זה הכל! 🎉

