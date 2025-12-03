// app/(auth)/register-role.tsx
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import Logo from '@/assets/studybuddy-logo.png';

export default function RegisterRoleScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Header with logo */}
      <View style={styles.header}>
        <View style={styles.logoWrapper}>
          <Image source={Logo} style={styles.logo} />
        </View>
        <Text style={styles.appName}>StudyBuddy</Text>
        <Text style={styles.appTagline}>
          Your smart companion for better studying
        </Text>
      </View>

      {/* Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Create your account</Text>
        <Text style={styles.cardSubtitle}>
          Choose your role to continue
        </Text>

        <TouchableOpacity
          style={[styles.button, styles.studentButton]}
          onPress={() => router.push('/(auth)/register-student')}
        >
          <Text style={styles.buttonTextPrimary}>I am a Student</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.lecturerButton]}
          onPress={() => router.push('/(auth)/register-lecturer')}
        >
          <Text style={styles.buttonTextSecondary}>I am a Lecturer</Text>
        </TouchableOpacity>
      </View>

      {/* Link back to login */}
      <TouchableOpacity
        onPress={() => router.push('/(auth)/login')}
        style={styles.linkWrapper}
      >
        <Text style={styles.linkText}>
          Already have an account?{' '}
          <Text style={styles.linkTextBold}>Login</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const ORANGE = '#ff8b0a';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
    paddingHorizontal: 24,
    paddingTop: 80,
  },

  // header
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  appName: {
    marginTop: 16,
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  appTagline: {
    marginTop: 4,
    fontSize: 13,
    color: '#6b7280',
  },

  // card
  card: {
    marginTop: 24,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 20,
  },

  // buttons
  button: {
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    marginBottom: 12,
  },
  studentButton: {
    backgroundColor: ORANGE,
  },
  lecturerButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: ORANGE,
  },
  buttonTextPrimary: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextSecondary: {
    color: ORANGE,
    fontSize: 16,
    fontWeight: '600',
  },

  // link
  linkWrapper: {
    marginTop: 24,
    alignItems: 'center',
  },
  linkText: {
    color: '#6b7280',
    fontSize: 13,
  },
  linkTextBold: {
    color: ORANGE,
    fontWeight: '600',
  },
});
