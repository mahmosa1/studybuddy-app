# 🔴 URGENT: Fix Firestore Permissions Error

## The Problem
You're getting "Missing or insufficient permissions" because Firestore security rules haven't been deployed to Firebase.

## ⚡ Quick Fix (2 Minutes)

### Step 1: Open Firebase Console
1. Go to: https://console.firebase.google.com/
2. Select project: **studybuddy-898b1**

### Step 2: Navigate to Firestore Rules
1. Click **"Firestore Database"** in left menu
2. Click **"Rules"** tab at the top

### Step 3: Copy & Paste Rules
1. Open the file `firestore.rules` in your project
2. **Copy ALL the content** from `firestore.rules`
3. **Paste it** into the Firebase Console rules editor
4. Click **"Publish"** button

### Step 4: Wait & Restart
1. Wait 10-15 seconds for rules to deploy
2. **Restart your app** (stop and start again)
3. Try logging in

---

## 📋 What to Copy

Copy everything from `firestore.rules` file - it should start with:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    ...
  }
}
```

---

## ✅ Verification

After deploying, you should see:
- ✅ No more "Missing or insufficient permissions" errors
- ✅ Login works
- ✅ User data loads correctly

---

## 🆘 If Still Not Working

If you still get errors after deploying:

1. **Check the rules were published:**
   - Go back to Firebase Console → Firestore → Rules
   - You should see your rules there
   - Check the timestamp shows "Just now" or recent time

2. **Try this temporary permissive rule (FOR TESTING ONLY):**
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```
   ⚠️ **WARNING:** This allows any authenticated user to read/write everything. Only use for testing!

3. **Clear app cache:**
   - Stop the app completely
   - Clear Expo cache: `expo start -c`
   - Try again

---

## 📸 Visual Guide

1. Firebase Console → Your Project
2. Left Sidebar → "Firestore Database"
3. Top Tabs → "Rules"
4. Paste your rules → "Publish"

That's it! 🎉

