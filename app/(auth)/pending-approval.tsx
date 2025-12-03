// app/(auth)/pending-approval.tsx
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { auth } from '@/lib/firebaseConfig';

// חשוב: אותו נתיב כמו ב-login.tsx
import Logo from '../../assets/studybuddy-logo.png';

export default function PendingApprovalScreen() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.log('Sign out error:', err);
    } finally {
      router.replace('/(auth)/login');
    }
  };

  return (
    <View style={styles.container}>
      {/* לוגו + שם האפליקציה */}
      <View style={styles.header}>
        <View style={styles.logoCircle}>
          <Image source={Logo} style={styles.logo} />
        </View>
        <Text style={styles.appName}>StudyBuddy</Text>
        <Text style={styles.appSubtitle}>
          Your smart companion for better studying
        </Text>
      </View>

      {/* כרטיס סטטוס */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your account is under review</Text>
        <Text style={styles.cardText}>
          We received your registration and it is currently waiting for admin
          approval. Once your account is approved, you will be able to log in
          and start using StudyBuddy.
        </Text>

        <View style={styles.badge}>
          <Text style={styles.badgeText}>Pending approval</Text>
        </View>

        <TouchableOpacity style={styles.button} onPress={handleLogout}>
          <Text style={styles.buttonText}>Back to login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const ORANGE = '#ff8a00';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f4f5',
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  logo: {
    width: 60,
    height: 60,
    resizeMode: 'contain',
  },
  appName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  appSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 16,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,138,0,0.09)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: ORANGE,
  },
  button: {
    marginTop: 4,
    backgroundColor: ORANGE,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});
