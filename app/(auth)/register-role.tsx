// app/(auth)/register-role.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function RegisterRoleScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons name="school" size={48} color="#ffffff" />
          </View>
          <Text style={styles.headerTitle}>{t('auth.studybuddy')}</Text>
          <Text style={styles.headerSubtitle}>
            {t('auth.tagline')}
          </Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconContainer}>
              <Ionicons name="person-add" size={24} color={PRIMARY_GREEN} />
            </View>
            <Text style={styles.cardTitle}>{t('auth.createAccount')}</Text>
          </View>
          <Text style={styles.cardSubtitle}>
            {t('auth.chooseRole')}
          </Text>

          <TouchableOpacity
            style={styles.studentButton}
            onPress={() => router.push('/(auth)/register-student')}
          >
            <View style={styles.buttonContent}>
              <View style={styles.buttonIconContainer}>
                <Ionicons name="school-outline" size={24} color="#ffffff" />
              </View>
              <View style={styles.buttonTextContainer}>
                <Text style={styles.buttonTextPrimary}>{t('auth.iAmStudent')}</Text>
                <Text style={styles.buttonSubtext}>{t('auth.studentDescription')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#ffffff" />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.lecturerButton}
            onPress={() => router.push('/(auth)/register-lecturer')}
          >
            <View style={styles.buttonContent}>
              <View style={[styles.buttonIconContainer, styles.lecturerIconContainer]}>
                <Ionicons name="person-outline" size={24} color={ACCENT_GREEN} />
              </View>
              <View style={styles.buttonTextContainer}>
                <Text style={styles.buttonTextSecondary}>{t('auth.iAmLecturer')}</Text>
                <Text style={styles.buttonSubtextSecondary}>{t('auth.lecturerDescription')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={ACCENT_GREEN} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Link back to login */}
        <TouchableOpacity
          onPress={() => router.push('/(auth)/login')}
          style={styles.linkWrapper}
        >
          <Text style={styles.linkText}>
            {t('auth.alreadyHaveAccount')}{' '}
            <Text style={styles.linkTextBold}>{t('auth.login')}</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const PRIMARY_GREEN = '#047857';
const ACCENT_GREEN = '#047857';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    backgroundColor: PRIMARY_GREEN,
    paddingTop: 80,
    paddingBottom: 40,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: -30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: ACCENT_GREEN,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: ACCENT_GREEN,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#ffffff',
    opacity: 0.9,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
    marginTop: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: ACCENT_GREEN,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 10,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
  },
  studentButton: {
    backgroundColor: PRIMARY_GREEN,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: PRIMARY_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  lecturerButton: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: PRIMARY_GREEN,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: ACCENT_GREEN,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  lecturerIconContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: ACCENT_GREEN,
  },
  buttonTextContainer: {
    flex: 1,
  },
  buttonTextPrimary: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  buttonTextSecondary: {
    color: PRIMARY_GREEN,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  buttonSubtext: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
  },
  buttonSubtextSecondary: {
    color: '#6b7280',
    fontSize: 13,
  },
  linkWrapper: {
    marginTop: 24,
    alignItems: 'center',
    marginHorizontal: 20,
  },
  linkText: {
    color: '#6b7280',
    fontSize: 14,
  },
  linkTextBold: {
    color: ACCENT_GREEN,
    fontWeight: '700',
  },
});
