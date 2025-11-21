// app/(auth)/login.tsx
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity
} from 'react-native';

import { auth, db } from '@/lib/firebaseConfig';

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);

    if (!email || !password) {
      setError('Please fill email and password.');
      return;
    }

    try {
      setLoading(true);

      // 1) Login with Firebase Auth
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const uid = cred.user.uid;

      // 2) Load user document from Firestore
      const userRef = doc(db, 'users', uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
        // User exists in Auth but not in DB – treat as error
        await signOut(auth);
        setError('User data not found. Please contact support.');
        return;
      }

      const userData = snap.data() as {
        role: 'student' | 'lecturer' | 'admin';
        status: 'pending' | 'active' | 'blocked';
      };

      // 3) Check status
      if (userData.status === 'pending') {
        // Send to pending screen
        router.replace('/(auth)/pending-approval');
        return;
      }

      if (userData.status === 'blocked') {
        await signOut(auth);
        setError('Your account is blocked. Please contact support.');
        return;
      }

      // 4) Route by role (for now all go to (tabs) – later we will
      // split student / lecturer navigation)
      if (userData.role === 'student') {
        router.replace('/(tabs)');
      } else if (userData.role === 'lecturer') {
        router.replace('/(tabs)');
      } else if (userData.role === 'admin') {
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      console.log('Login error:', err);
      setError(err?.message ?? 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Login to your StudyBuddy account</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="example@student.com"
          placeholderTextColor="#6b7280"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Your password"
          placeholderTextColor="#6b7280"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[styles.button, loading && { opacity: 0.7 }]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/(auth)/register-role')}
          style={styles.linkWrapper}
        >
          <Text style={styles.linkText}>
            Don&apos;t have an account?{' '}
            <Text style={styles.linkTextBold}>Sign up</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
    backgroundColor: '#050816',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: 'white',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
    marginBottom: 32,
  },
  label: {
    fontSize: 13,
    color: '#e5e7eb',
    marginBottom: 4,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: 'white',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  button: {
    marginTop: 24,
    backgroundColor: '#4f46e5',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  linkWrapper: {
    marginTop: 24,
    alignItems: 'center',
  },
  linkText: {
    color: '#9ca3af',
  },
  linkTextBold: {
    color: '#a855f7',
    fontWeight: '600',
  },
  errorText: {
    marginTop: 10,
    color: '#f97373',
    fontSize: 13,
  },
});
