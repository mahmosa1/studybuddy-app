// firebaseConfig.ts
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDn5dNLL8LHNXqTPBKCFORJnx7W6OCXsBU",
  authDomain: "studybuddy-898b1.firebaseapp.com",
  projectId: "studybuddy-898b1",
  storageBucket: "studybuddy-898b1.firebasestorage.app",
  messagingSenderId: "984984472268",
  appId: "1:984984472268:web:8847d3fd2ee02beec85069"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();


export const auth = getAuth(app);
export const db = getFirestore(app);
