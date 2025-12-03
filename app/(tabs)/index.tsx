// app/(tabs)/index.tsx
import { useRouter } from 'expo-router';
import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function StudentHomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* App name in center */}
        <Text style={styles.appTitle}>StudyBuddy</Text>

        {/* Main heading */}
        <Text style={styles.title}>Welcome back 👋</Text>
        <Text style={styles.subtitle}>
          Manage your courses, upload study materials and (soon) practice with AI.
        </Text>

        <View style={styles.cardsWrapper}>
          {/* Quick action: Start Practice (future AI screen) */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Start Practice</Text>
            <Text style={styles.cardText}>
              In the future, you&apos;ll be able to generate smart practice
              exams based on your course materials.
            </Text>
            <TouchableOpacity
              style={[styles.buttonBase, styles.buttonDisabled]}
              disabled
            >
              <Text style={styles.buttonDisabledText}>Coming soon</Text>
            </TouchableOpacity>
          </View>

          {/* Quick action: My Courses */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>My Courses</Text>
            <Text style={styles.cardText}>
              View your courses, upload files and manage your study materials.
            </Text>
            <TouchableOpacity
              style={[styles.buttonBase, styles.buttonPrimary]}
              onPress={() => router.push('/(tabs)/courses')}
            >
              <Text style={styles.buttonPrimaryText}>Go to My Courses</Text>
            </TouchableOpacity>
          </View>

          {/* Quick action: Find Study Buddy */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Find a Study Buddy</Text>
            <Text style={styles.cardText}>
              Search for students who study the same subjects and match your
              schedule.
            </Text>
            <TouchableOpacity
              style={[styles.buttonBase, styles.buttonOutline]}
              onPress={() => router.push('/(tabs)/search')}
            >
              <Text style={styles.buttonOutlineText}>Open Search</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const PRIMARY_ORANGE = '#f97316'; // כתום כמו בלוגו / לוגין

const styles = StyleSheet.create({
  // רקע בהיר (כמו במסך הלוגין)
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },

  // שם האפליקציה – באמצע
  appTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: PRIMARY_ORANGE,
    textAlign: 'center',
    marginBottom: 16,
  },

  // כותרת ראשית
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 24,
  },

  cardsWrapper: {
    rowGap: 16,
  },

  // כרטיסים לבנים עם צל עדין
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  cardText: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 14,
  },

  // בסיס לכפתורים – כדי שלא נעתיק קוד
  buttonBase: {
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignSelf: 'flex-start',
  },

  // כפתור "coming soon" – ניטרלי
  buttonDisabled: {
    backgroundColor: '#e5e7eb',
  },
  buttonDisabledText: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '600',
  },

  // כפתור ראשי כתום (primary)
  buttonPrimary: {
    backgroundColor: PRIMARY_ORANGE,
  },
  buttonPrimaryText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },

  // כפתור Outline כתום
  buttonOutline: {
    borderWidth: 1,
    borderColor: PRIMARY_ORANGE,
    backgroundColor: '#ffffff',
  },
  buttonOutlineText: {
    color: PRIMARY_ORANGE,
    fontSize: 13,
    fontWeight: '600',
  },
});

export { };

