# 🔑 הגדרת OpenAI API Key - הוראות מהירות

## ✅ API Key שלך

**⚠️ חשוב:** הוסף את ה-API key שלך לקובץ `.env` (לא כאן!)

**🔒 אבטחה:** לעולם אל תשתף את ה-API key שלך בקוד או ב-GitHub!

## 📝 שלבים להגדרה

### שלב 1: צור קובץ `.env`

1. פתח את התיקייה: `/Users/mahmodsanalla/Desktop/studybuddy`
2. צור קובץ חדש בשם `.env` (בדיוק עם הנקודה בהתחלה)
3. הוסף את השורה הבאה (החלף `your_openai_api_key_here` ב-API key שלך מ-OpenAI):

```
EXPO_PUBLIC_OPENAI_API_KEY=your_openai_api_key_here
```

### שלב 2: הפעל מחדש את האפליקציה

1. עצור את האפליקציה (Ctrl+C בטרמינל)
2. הפעל מחדש:
   ```bash
   npm start
   ```
   או
   ```bash
   expo start -c
   ```
   (ה-`-c` מנקה את ה-cache)

### שלב 3: בדוק שזה עובד

1. פתח את הקונסול באפליקציה
2. נסה ליצור תרגול חדש
3. אתה אמור לראות:
   - ✅ "Attempting to upload files to OpenAI File API..."
   - ✅ "Successfully uploaded X file(s) to OpenAI"

## ⚠️ אם יש שגיאה

אם אתה רואה שגיאה כמו "Failed to generate questions":
1. ודא שהקובץ `.env` נמצא בתיקייה הראשית
2. ודא שהשורה מתחילה ב-`EXPO_PUBLIC_OPENAI_API_KEY=`
3. ודא שאין רווחים לפני או אחרי ה-`=`
4. הפעל מחדש עם `expo start -c`

## 🔒 אבטחה

- ✅ הקובץ `.env` כבר ב-`.gitignore` - לא יועלה ל-Git
- ⚠️ **אל תשתף את המפתח הזה** - הוא פרטי ויש לו גישה לחשבון שלך
- 💡 אם המפתח נחשף, מחק אותו מ-OpenAI וצור חדש

## 📍 מיקום הקובץ

```
/Users/mahmodsanalla/Desktop/studybuddy/
├── .env          ← כאן! (קובץ חדש)
├── app/
├── lib/
├── package.json
└── ...
```

## 🎯 אחרי ההגדרה

אחרי שתגדיר את ה-API key ותפעיל מחדש:
- המערכת תעלה קבצים ל-OpenAI
- GPT-4o יקרא את התוכן האמיתי מהקבצים
- השאלות יהיו מבוססות על התוכן האמיתי!

🎉 **זה הכל!**

