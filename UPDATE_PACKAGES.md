# 📦 עדכון חבילות - הוראות

## ⚠️ חשוב לדעת

ה-warnings האלה **לא קריטיים** - האפליקציה אמורה לעבוד גם עם הגרסאות הישנות.

אבל אם תרצה לעדכן (מומלץ), זה יכול לשפר:
- ✅ תאימות טובה יותר עם Expo
- ✅ תיקוני באגים
- ✅ ביצועים טובים יותר

## 🔧 איך לעדכן

### שלב 1: עדכן את package.json
עדכנתי את `package.json` עם הגרסאות הנכונות.

### שלב 2: התקן את החבילות החדשות

הפעל את הפקודה הבאה בטרמינל:

```bash
npm install
```

או אם זה לא עובד, נסה:

```bash
npm install @react-native-async-storage/async-storage@2.2.0 expo@~54.0.30 expo-constants@~18.0.12 expo-document-picker@~14.0.8 expo-font@~14.0.10 expo-haptics@~15.0.8 expo-image@~3.0.11 expo-image-picker@~17.0.10 expo-linking@~8.0.11 expo-router@~6.0.21 expo-splash-screen@~31.0.13 expo-status-bar@~3.0.9 expo-symbols@~1.0.8 expo-system-ui@~6.0.9 expo-web-browser@~15.0.10
```

### שלב 3: הפעל מחדש

אחרי ההתקנה:

```bash
expo start -c
```

(ה-`-c` מנקה את ה-cache)

## ✅ אחרי העדכון

אחרי העדכון, ה-warnings אמורים להיעלם.

## ⚠️ אם יש בעיות

אם אחרי העדכון יש בעיות:
1. מחק את `node_modules`:
   ```bash
   rm -rf node_modules
   ```
2. מחק את `package-lock.json`:
   ```bash
   rm package-lock.json
   ```
3. התקן מחדש:
   ```bash
   npm install
   ```
4. הפעל מחדש:
   ```bash
   expo start -c
   ```

## 🎯 המלצה

אם האפליקציה עובדת טוב עכשיו, **אין חובה לעדכן**. ה-warnings האלה לא מפריעים לתפקוד.

אבל אם תרצה לעדכן (מומלץ), זה יכול לשפר את הביצועים והתאימות.

