// firebaseConfig.ts
import { getApp, getApps, initializeApp } from "firebase/app";
import { Auth, getAuth, initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyDn5dNLL8LHNXqTPBKCFORJnx7W6OCXsBU",
  authDomain: "studybuddy-898b1.firebaseapp.com",
  projectId: "studybuddy-898b1",
  storageBucket: "studybuddy-898b1.firebasestorage.app",
  messagingSenderId: "984984472268",
  appId: "1:984984472268:web:8847d3fd2ee02beec85069"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth with AsyncStorage persistence for React Native
// This ensures auth state persists between app sessions
let auth: Auth;
try {
  // Try to initialize with persistence (will fail if already initialized)
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage)
  });
} catch (e) {
  // Auth already initialized, get the existing instance
  // This can happen on hot reload or if auth was initialized elsewhere
  auth = getAuth(app);
}

export { auth };
export const db = getFirestore(app);
