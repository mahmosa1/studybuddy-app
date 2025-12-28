# How to Deploy Firestore Security Rules

## Problem
You're getting "Missing or insufficient permissions" errors because Firestore security rules haven't been deployed.

## Solution

### Option 1: Deploy via Firebase Console (Easiest)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `studybuddy-898b1`
3. Click on **Firestore Database** in the left menu
4. Click on the **Rules** tab
5. Copy the contents of `firestore.rules` file
6. Paste it into the rules editor
7. Click **Publish**

### Option 2: Deploy via Firebase CLI

1. Install Firebase CLI (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Initialize Firebase in your project (if not already done):
   ```bash
   firebase init firestore
   ```
   - Select your project
   - Use `firestore.rules` as the rules file

4. Deploy the rules:
   ```bash
   firebase deploy --only firestore:rules
   ```

### Option 3: Quick Fix (Temporary - For Development Only)

⚠️ **WARNING: This is INSECURE and should only be used for development!**

If you need a quick fix for testing, you can temporarily use these rules in Firebase Console:

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

This allows any authenticated user to read/write everything. **DO NOT use in production!**

## After Deployment

1. Wait a few seconds for rules to propagate
2. Restart your app
3. Try logging in again

## Verify Rules Are Active

1. Go to Firebase Console → Firestore → Rules
2. You should see your deployed rules
3. Check the timestamp to confirm they're updated

