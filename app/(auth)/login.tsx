// app/(auth)/login.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

import { auth, db } from '@/lib/firebaseConfig';
import { saveLanguage } from '@/lib/i18n';

export default function LoginScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language);

  useEffect(() => {
    setCurrentLanguage(i18n.language);
  }, [i18n.language]);

  // Check if user is already logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCheckingAuth(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (!snap.exists()) {
          setCheckingAuth(false);
          return;
        }

        const data = snap.data() as {
          role: 'student' | 'lecturer' | 'admin';
          status: 'pending' | 'active' | 'blocked' | 'rejected';
        };

        // If user is already logged in, redirect them
        if (data.status === 'pending' || data.status === 'rejected') {
          router.replace('/(auth)/pending-approval');
          return;
        }

        if (data.status === 'blocked') {
          await signOut(auth);
          setCheckingAuth(false);
          return;
        }

        // User is active, redirect to tabs
        if (data.status === 'active') {
          router.replace('/(tabs)');
          return;
        }
      } catch (err) {
        console.log('Error checking auth state:', err);
      } finally {
        setCheckingAuth(false);
      }
    });

    return unsubscribe;
  }, [router]);

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
        status: 'pending' | 'active' | 'blocked' | 'rejected';
      };

      // 3) Check status
      if (userData.status === 'pending' || userData.status === 'rejected') {
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

  // Show loading while checking authentication
  if (checkingAuth) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={PRIMARY_GREEN} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#f9fafb' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Language Switcher Button - Top Right */}
        <View style={styles.languageButtonContainer}>
          <TouchableOpacity
            style={styles.languageButton}
            onPress={() => setShowLanguageModal(true)}
          >
            <Ionicons name="language" size={18} color={PRIMARY_GREEN} />
          </TouchableOpacity>
        </View>

        {/* Header with gradient */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons name="school" size={48} color="#ffffff" />
          </View>
          <Text style={styles.headerTitle}>{t('home.title')}</Text>
          <Text style={styles.headerSubtitle}>
            {t('home.tagline')}
          </Text>
        </View>

        {/* Card with form */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconContainer}>
              <Ionicons name="log-in" size={24} color={PRIMARY_GREEN} />
            </View>
            <Text style={styles.cardTitle}>{t('auth.login')}</Text>
          </View>
          <Text style={styles.cardSubtitle}>
            {t('auth.login')} {t('common.to')} {t('home.title')}
          </Text>

          <View style={styles.inputGroup}>
            <Ionicons name="mail-outline" size={20} color="#6b7280" style={styles.inputIcon} />
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>{t('auth.email')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('auth.email')}
                placeholderTextColor="#6b7280"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Ionicons name="lock-closed-outline" size={20} color="#6b7280" style={styles.inputIcon} />
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>{t('auth.password')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('auth.password')}
                placeholderTextColor="#6b7280"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.buttonText}>{t('auth.login')}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => router.push('/(auth)/register-role')}
          style={styles.linkWrapper}
        >
          <Text style={styles.linkText}>
            {t('auth.dontHaveAccount')}{' '}
            <Text style={styles.linkTextBold}>{t('auth.register')}</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Language Selection Modal */}
      <Modal
        visible={showLanguageModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowLanguageModal(false)}
        >
          <View style={styles.languageModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('profile.selectLanguage')}</Text>
              <TouchableOpacity
                onPress={() => setShowLanguageModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>
            <View style={styles.languageOptions}>
              <TouchableOpacity
                style={[
                  styles.languageOption,
                  currentLanguage === 'en' && styles.languageOptionSelected,
                ]}
                onPress={async () => {
                  await i18n.changeLanguage('en');
                  await saveLanguage('en');
                  setCurrentLanguage('en');
                  setShowLanguageModal(false);
                }}
              >
                <Ionicons
                  name={currentLanguage === 'en' ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={currentLanguage === 'en' ? PRIMARY_GREEN : '#6b7280'}
                />
                <Text
                  style={[
                    styles.languageOptionText,
                    currentLanguage === 'en' && styles.languageOptionTextSelected,
                  ]}
                >
                  {t('profile.english')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.languageOption,
                  currentLanguage === 'he' && styles.languageOptionSelected,
                ]}
                onPress={async () => {
                  await i18n.changeLanguage('he');
                  await saveLanguage('he');
                  setCurrentLanguage('he');
                  setShowLanguageModal(false);
                }}
              >
                <Ionicons
                  name={currentLanguage === 'he' ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={currentLanguage === 'he' ? PRIMARY_GREEN : '#6b7280'}
                />
                <Text
                  style={[
                    styles.languageOptionText,
                    currentLanguage === 'he' && styles.languageOptionTextSelected,
                  ]}
                >
                  {t('profile.hebrew')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const PRIMARY_GREEN = '#047857';
const ACCENT_GREEN = '#047857';
const GREY = '#4b5563';
const GREY_LIGHT = '#374151';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  header: {
    backgroundColor: PRIMARY_GREEN,
    paddingTop: 100,
    paddingBottom: 50,
    alignItems: 'center',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    marginBottom: -40,
    shadowColor: PRIMARY_GREEN,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
    overflow: 'hidden',
  },
  logoContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: ACCENT_GREEN,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: ACCENT_GREEN,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  headerTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 8,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.95,
    textAlign: 'center',
    paddingHorizontal: 20,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  card: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    borderRadius: 32,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.15,
    shadowRadius: 32,
    elevation: 12,
    marginTop: 30,
    borderWidth: 1.5,
    borderColor: '#e0e7ff',
    overflow: 'hidden',
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
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    marginLeft: 12,
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 28,
    fontWeight: '500',
    lineHeight: 22,
  },
  inputGroup: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  inputIcon: {
    marginTop: 28,
    marginRight: 12,
  },
  inputWrapper: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#111827',
    borderWidth: 1.5,
    borderColor: '#374151',
    fontSize: 16,
    fontWeight: '500',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    marginLeft: 8,
    color: '#ef4444',
    fontSize: 13,
    flex: 1,
  },
  button: {
    flexDirection: 'row',
    marginTop: 28,
    backgroundColor: PRIMARY_GREEN,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PRIMARY_GREEN,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
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
  languageButtonContainer: {
    position: 'absolute',
    top: 60,
    right: 16,
    zIndex: 10,
  },
  languageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: PRIMARY_GREEN,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  languageModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    width: '85%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalCloseButton: {
    padding: 4,
  },
  languageOptions: {
    gap: 12,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: '#f9fafb',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  languageOptionSelected: {
    backgroundColor: '#f0fdf4',
    borderColor: PRIMARY_GREEN,
    borderWidth: 2,
  },
  languageOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginLeft: 12,
  },
  languageOptionTextSelected: {
    color: PRIMARY_GREEN,
    fontWeight: '600',
  },
});
