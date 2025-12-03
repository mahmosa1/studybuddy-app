// app/(auth)/login.tsx
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import { auth, db } from '@/lib/firebaseConfig';
// אם הנתיב הזה לא עובד לך, תוכל להשתמש במקום זה:
// import Logo from '../../assets/studybuddy-logo.png';
import Logo from '../../assets/studybuddy-logo.png';

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
      const cred = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      const uid = cred.user.uid;

      // 2) Load user document from Firestore
      const userRef = doc(db, 'users', uid);
      const snap = await getDoc(userRef);

      if (!snap.exists()) {
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
        router.replace('/(auth)/pending-approval');
        return;
      }

      if (userData.status === 'blocked') {
        await signOut(auth);
        setError('Your account is blocked. Please contact support.');
        return;
      }

      // 4) Route by role (בינתיים כולם ל-(tabs))
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
      style={{ flex: 1, backgroundColor: '#f3f4f6' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header with logo */}
        <View style={styles.header}>
          <Image source={Logo} style={styles.logo} />
          <Text style={styles.appName}>StudyBuddy</Text>
          <Text style={styles.appTagline}>
            Your smart companion for better studying
          </Text>
        </View>

        {/* Card with form */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome back</Text>
          <Text style={styles.cardSubtitle}>
            Login to your StudyBuddy account
          </Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="example@student.com"
            placeholderTextColor="#9ca3af"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Your password"
            placeholderTextColor="#9ca3af"
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
        </View>

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

const ORANGE = '#f97316'; // צבע מרכזי – כמו הלוגו

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 12,
  },
  appName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  appTagline: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  card: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 22,
    // צל עדין
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    color: '#4b5563',
    marginBottom: 4,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  button: {
    marginTop: 24,
    backgroundColor: ORANGE,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkWrapper: {
    marginTop: 18,
  },
  linkText: {
    color: '#6b7280',
    fontSize: 13,
  },
  linkTextBold: {
    color: ORANGE,
    fontWeight: '600',
  },
  errorText: {
    marginTop: 10,
    color: '#dc2626',
    fontSize: 13,
  },
});
