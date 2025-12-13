// app/(tabs)/profile.tsx
import { auth, db } from '@/lib/firebaseConfig';
import { saveLanguage } from '@/lib/i18n';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type UserProfile = {
  username?: string;
  fullName?: string;
  email: string;
  institution?: string;
  fieldOfStudy?: string;
  phone?: string;
  role?: string;
  profilePictureUrl?: string | null;
};

type CourseHighlight = {
  id: string;
  name: string;
};

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [courses, setCourses] = useState<CourseHighlight[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [preferredTime, setPreferredTime] = useState<string>('');
  const [selectedCoursesForBuddy, setSelectedCoursesForBuddy] = useState<Set<string>>(new Set());
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState('en');
  
  // Initialize i18n hook
  const { t, i18n } = useTranslation();
  
  // Sync current language with i18n
  useEffect(() => {
    setCurrentLanguage(i18n.language);
  }, [i18n.language]);

  const loadProfileData = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) {
      router.replace('/(auth)/login');
      return;
    }

    try {
      setLoading(true);

      // --- User profile ---
      const snap = await getDoc(doc(db, 'users', user.uid));

      if (snap.exists()) {
        const data = snap.data() as any;
        setProfile({
          username: data.username,
          fullName: data.fullName,
          email: data.email,
          institution: data.institution,
          fieldOfStudy: data.fieldOfStudy,
          phone: data.phone,
          role: data.role,
          profilePictureUrl: data.profilePictureUrl,
        });
        
        // Load study buddy preferences
        setPreferredTime(data.preferredTime || '');
        setSelectedCoursesForBuddy(new Set(data.studyBuddyCourses || []));
      } else {
        setProfile({
          email: user.email ?? '',
        });
      }

      // --- Courses for highlights ---
      const q = query(
        collection(db, 'courses'),
        where('ownerUid', '==', user.uid),
      );
      const coursesSnap = await getDocs(q);
      const list: CourseHighlight[] = [];
      coursesSnap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        list.push({
          id: docSnap.id,
          name: data.name ?? 'Course',
        });
      });
      setCourses(list);

      // Load followers/following counts (stub - replace with real queries later)
      // Mock: In real app, query 'follows' collection where followerId == user.uid (following)
      // and where followingId == user.uid (followers)
      setFollowersCount(0); // TODO: Replace with real query
      setFollowingCount(0); // TODO: Replace with real query
    } catch (err) {
      console.log('Load profile error:', err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Load profile when screen comes into focus (e.g., after editing)
  useFocusEffect(
    useCallback(() => {
      loadProfileData();
    }, [loadProfileData])
  );

  // Also listen to auth state changes (for logout/login)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace('/(auth)/login');
      } else {
        loadProfileData();
      }
    });

    return unsub;
  }, [router, loadProfileData]);

  const getInitials = () => {
    if (!profile) return '?';
    if (profile.fullName) {
      const parts = profile.fullName.split(' ').filter(Boolean);
      if (parts.length === 1) return parts[0][0]?.toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    if (profile.username) return profile.username[0]?.toUpperCase();
    if (profile.email) return profile.email[0]?.toUpperCase();
    return '?';
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/(auth)/login');
    } catch (err) {
      console.log('Logout error:', err);
    }
  };

  const handleEditProfile = () => {
    router.push('/edit-profile');
  };

  const renderCourseHighlight = ({ item }: { item: CourseHighlight }) => {
    const initial = item.name ? item.name[0]?.toUpperCase() : '?';

    return (
      <View style={styles.highlightItem}>
        <View style={styles.highlightCircle}>
          <Text style={styles.highlightInitial}>{initial}</Text>
        </View>
        <Text style={styles.highlightLabel} numberOfLines={1}>
          {item.name}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color="#047857" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>Failed to load profile.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with gradient effect */}
        <View style={styles.headerSection}>
          <View style={styles.headerBackground} />
          <Text style={styles.headerTitle}>{t('profile.title')}</Text>
        </View>

        {/* Language Section - At the top */}
        <View style={styles.languageSectionTop}>
          <TouchableOpacity
            style={styles.languageButtonTop}
            onPress={() => setShowLanguageModal(true)}
          >
            <Ionicons name="language" size={18} color={PRIMARY_GREEN} />
            <Text style={styles.languageButtonTextTop}>
              {currentLanguage === 'he' ? 'עברית' : 'EN'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            {profile.profilePictureUrl ? (
              <Image
                source={{ uri: profile.profilePictureUrl }}
                style={styles.avatarImage}
              />
            ) : (
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{getInitials()}</Text>
              </View>
            )}
            <View style={styles.avatarBadge}>
              <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
            </View>
          </View>

          {/* Name and Info */}
          <View style={styles.profileInfo}>
            <Text style={styles.nameText}>
              {profile.fullName ?? profile.username ?? 'Student'}
            </Text>
            <Text style={styles.usernameText}>@{profile.username || 'username'}</Text>

            {/* Info Cards */}
            <View style={styles.infoCards}>
              {profile.fieldOfStudy && (
                <View style={styles.infoCard}>
                  <Ionicons name="school-outline" size={16} color="#047857" />
                  <Text style={styles.infoText}>{profile.fieldOfStudy}</Text>
                </View>
              )}
              {profile.institution && (
                <View style={styles.infoCard}>
                  <Ionicons name="location-outline" size={16} color={ACCENT_GREEN} />
                  <Text style={styles.infoText}>{profile.institution}</Text>
                </View>
              )}
              {profile.role && (
                <View style={[styles.infoCard, styles.roleBadge]}>
                  <Ionicons name="person-circle-outline" size={16} color="#ffffff" />
                  <Text style={[styles.infoText, styles.roleText]}>
                    {t(`auth.${profile.role}`)}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <TouchableOpacity
              style={styles.statCard}
              onPress={() => {
                // TODO: Navigate to followers list
                console.log('Show followers');
              }}
            >
              <Text style={styles.statNumber}>{followersCount}</Text>
              <Text style={styles.statLabel}>{t('profile.followers')}</Text>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <TouchableOpacity
              style={styles.statCard}
              onPress={() => {
                // TODO: Navigate to following list
                console.log('Show following');
              }}
            >
              <Text style={styles.statNumber}>{followingCount}</Text>
              <Text style={styles.statLabel}>{t('profile.following')}</Text>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{courses.length}</Text>
              <Text style={styles.statLabel}>{t('profile.courses')}</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonsRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.editButton]}
              onPress={handleEditProfile}
            >
              <Ionicons name="create-outline" size={18} color="#111827" />
              <Text style={styles.editButtonText}>{t('profile.editProfile')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.logoutButton]}
              onPress={handleLogout}
            >
              <Ionicons name="log-out-outline" size={18} color="#ffffff" />
              <Text style={styles.actionButtonText}>{t('auth.logout')}</Text>
            </TouchableOpacity>
          </View>

        </View>

        {/* Courses Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="book-outline" size={20} color={ACCENT_GREEN} />
            <Text style={styles.sectionTitle}>{t('profile.myCourses')}</Text>
          </View>
          {courses.length > 0 ? (
            <FlatList
              data={courses}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              renderItem={renderCourseHighlight}
              contentContainerStyle={styles.coursesList}
            />
          ) : (
            <View style={styles.emptyCoursesCard}>
              <Ionicons name="book-outline" size={48} color="#4b5563" />
              <Text style={styles.emptyCoursesText}>
                {t('profile.noCoursesYet')}
              </Text>
            </View>
          )}
        </View>

        {/* Study Buddy Preferences Section - Only for students */}
        {profile?.role === 'student' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="people-circle-outline" size={20} color={ACCENT_GREEN} />
              <Text style={styles.sectionTitle}>{t('profile.studyBuddyPreferences')}</Text>
              <TouchableOpacity
                style={styles.editButtonSmall}
                onPress={() => setShowPreferencesModal(true)}
              >
                <Ionicons name="create-outline" size={18} color={ACCENT_GREEN} />
              </TouchableOpacity>
            </View>
            <View style={styles.preferencesCard}>
              {preferredTime ? (
                <View style={styles.preferenceItem}>
                  <Ionicons name="time-outline" size={16} color="#6b7280" />
                  <Text style={styles.preferenceText}>{t('profile.preferredTimeLabel')}: {preferredTime}</Text>
                </View>
              ) : (
                <Text style={styles.preferenceEmptyText}>{t('profile.noPreferredTime')}</Text>
              )}
              {selectedCoursesForBuddy.size > 0 ? (
                <View style={styles.preferenceItem}>
                  <Ionicons name="book-outline" size={16} color="#6b7280" />
                  <Text style={styles.preferenceText}>
                    {selectedCoursesForBuddy.size === 1 
                      ? t('profile.availableInCourses', { count: selectedCoursesForBuddy.size })
                      : t('profile.availableInCoursesPlural', { count: selectedCoursesForBuddy.size })}
                  </Text>
                </View>
              ) : (
                <Text style={styles.preferenceEmptyText}>{t('profile.noCoursesSelected')}</Text>
              )}
              <TouchableOpacity
                style={styles.configureButton}
                onPress={() => setShowPreferencesModal(true)}
              >
                <Ionicons name="settings-outline" size={16} color="#ffffff" />
                <Text style={styles.configureButtonText}>{t('profile.configurePreferences')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Activity Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="time-outline" size={20} color={ACCENT_GREEN} />
            <Text style={styles.sectionTitle}>{t('profile.recentActivity')}</Text>
          </View>
          <View style={styles.emptyActivityCard}>
            <Ionicons name="document-text-outline" size={48} color="#4b5563" />
            <Text style={styles.emptyActivityTitle}>{t('profile.noActivityYet')}</Text>
            <Text style={styles.emptyActivityText}>
              {t('profile.activityMessage')}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Language Selection Modal */}
      <Modal
        visible={showLanguageModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
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
                  await saveLanguage('en');
                  i18n.changeLanguage('en');
                  setCurrentLanguage('en');
                  setShowLanguageModal(false);
                }}
              >
                <Ionicons
                  name={currentLanguage === 'en' ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={currentLanguage === 'en' ? PRIMARY_GREEN : '#9ca3af'}
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
                  await saveLanguage('he');
                  i18n.changeLanguage('he');
                  setCurrentLanguage('he');
                  setShowLanguageModal(false);
                }}
              >
                <Ionicons
                  name={currentLanguage === 'he' ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={currentLanguage === 'he' ? PRIMARY_GREEN : '#9ca3af'}
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
        </View>
      </Modal>

      {/* Study Buddy Preferences Modal */}
      {showPreferencesModal && (
        <Modal
          visible={showPreferencesModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowPreferencesModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('profile.studyBuddyPreferences')}</Text>
                <TouchableOpacity
                  onPress={() => setShowPreferencesModal(false)}
                  style={styles.modalCloseButton}
                >
                  <Ionicons name="close" size={24} color="#6b7280" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSubtitle}>
                {t('profile.setPreferencesMessage')}
              </Text>

              <Text style={styles.modalLabel}>{t('profile.preferredTime')} *</Text>
              <View style={styles.timeOptionsContainer}>
                {['Morning', 'Afternoon', 'Evening', 'Night', 'Weekends', 'Flexible'].map((time) => (
                  <TouchableOpacity
                    key={time}
                    style={[
                      styles.timeOptionButton,
                      preferredTime === time && styles.timeOptionButtonSelected,
                    ]}
                    onPress={() => setPreferredTime(time)}
                  >
                    <Text
                      style={[
                        styles.timeOptionText,
                        preferredTime === time && styles.timeOptionTextSelected,
                      ]}
                    >
                      {t(`profile.time.${time.toLowerCase()}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>{t('profile.selectCoursesForBuddy')} *</Text>
              <Text style={styles.modalHelperText}>
                {t('profile.chooseCoursesMessage')}
              </Text>
              <ScrollView style={styles.coursesSelectionContainer}>
                {courses.length === 0 ? (
                  <Text style={styles.noCoursesText}>
                    {t('profile.noCoursesAvailable')}
                  </Text>
                ) : (
                  courses.map((course) => (
                    <TouchableOpacity
                      key={course.id}
                      style={[
                        styles.courseCheckbox,
                        selectedCoursesForBuddy.has(course.id) && styles.courseCheckboxSelected,
                      ]}
                      onPress={() => {
                        const newSet = new Set(selectedCoursesForBuddy);
                        if (newSet.has(course.id)) {
                          newSet.delete(course.id);
                        } else {
                          newSet.add(course.id);
                        }
                        setSelectedCoursesForBuddy(newSet);
                      }}
                    >
                      <Ionicons
                        name={selectedCoursesForBuddy.has(course.id) ? 'checkbox' : 'checkbox-outline'}
                        size={24}
                        color={selectedCoursesForBuddy.has(course.id) ? ACCENT_GREEN : '#6b7280'}
                      />
                      <Text
                        style={[
                          styles.courseCheckboxText,
                          selectedCoursesForBuddy.has(course.id) && styles.courseCheckboxTextSelected,
                        ]}
                      >
                        {course.name}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={() => setShowPreferencesModal(false)}
                >
                  <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalSaveButton]}
                  onPress={async () => {
                    if (!preferredTime) {
                      Alert.alert(t('common.error'), t('profile.selectTimeRequired'));
                      return;
                    }
                    if (selectedCoursesForBuddy.size === 0) {
                      Alert.alert(t('common.error'), t('profile.selectCourseRequired'));
                      return;
                    }

                    const user = auth.currentUser;
                    if (!user) return;

                    try {
                      setSavingPreferences(true);
                      await updateDoc(doc(db, 'users', user.uid), {
                        preferredTime: preferredTime,
                        studyBuddyCourses: Array.from(selectedCoursesForBuddy),
                      });
                      setShowPreferencesModal(false);
                      Alert.alert(t('common.success'), t('profile.preferencesUpdated'));
                    } catch (err) {
                      console.log('Error saving preferences:', err);
                      Alert.alert(t('common.error'), t('profile.preferencesSaveError'));
                    } finally {
                      setSavingPreferences(false);
                    }
                  }}
                  disabled={savingPreferences}
                >
                  {savingPreferences ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.modalSaveText}>{t('common.save')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
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
  scrollContent: {
    paddingBottom: 40,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSection: {
    height: 160,
    backgroundColor: '#047857',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    justifyContent: 'flex-end',
    paddingBottom: 28,
    paddingHorizontal: 24,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
  },
  headerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#047857',
    opacity: 0.1,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  profileCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginTop: -70,
    borderRadius: 32,
    padding: 32,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
    marginBottom: 28,
    borderWidth: 1.5,
    borderColor: '#e0e7ff',
    overflow: 'hidden',
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 6,
    borderColor: '#047857',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#dbeafe',
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  avatarImage: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 5,
    borderColor: '#047857',
  },
  avatarText: {
    color: '#047857',
    fontSize: 46,
    fontWeight: '800',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: '35%',
    backgroundColor: '#ffffff',
    borderRadius: 15,
    padding: 2,
  },
  profileInfo: {
    alignItems: 'center',
    marginBottom: 20,
  },
  nameText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  usernameText: {
    fontSize: 15,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 16,
  },
  infoCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  roleBadge: {
    backgroundColor: ACCENT_GREEN,
  },
  infoText: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '600',
  },
  roleText: {
    color: '#ffffff',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#374151',
    marginBottom: 20,
  },
  statCard: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#374151',
  },
  statNumber: {
    fontSize: 26,
    fontWeight: '700',
    color: '#047857',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
  },
  editButton: {
    backgroundColor: ACCENT_GREEN,
    borderWidth: 1,
    borderColor: ACCENT_GREEN,
    shadowColor: ACCENT_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  logoutButton: {
    backgroundColor: '#047857',
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  coursesList: {
    paddingHorizontal: 4,
  },
  highlightItem: {
    alignItems: 'center',
    marginRight: 16,
  },
  highlightCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: ACCENT_GREEN,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginBottom: 8,
    shadowColor: ACCENT_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  highlightInitial: {
    fontSize: 26,
    fontWeight: '700',
    color: ACCENT_GREEN,
  },
  highlightLabel: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '600',
    maxWidth: 80,
    textAlign: 'center',
  },
  emptyCoursesCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#374151',
    borderStyle: 'dashed',
  },
  emptyCoursesText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '500',
  },
  emptyActivityCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  emptyActivityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyActivityText: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
  },
  highlightsEmptyText: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    padding: 20,
  },
  errorText: {
    color: '#047857',
    fontSize: 14,
  },
  editButtonSmall: {
    padding: 4,
    marginLeft: 'auto',
  },
  preferencesCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  preferenceText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  preferenceValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  preferenceValueText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  preferenceEmptyText: {
    fontSize: 13,
    color: '#6b7280',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  configureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT_GREEN,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
    gap: 8,
    shadowColor: ACCENT_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  configureButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
  },
  modalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  modalHelperText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 12,
  },
  timeOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  timeOptionButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#374151',
    backgroundColor: '#f9fafb',
  },
  timeOptionButtonSelected: {
    backgroundColor: '#dbeafe',
    borderColor: '#047857',
  },
  timeOptionText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  timeOptionTextSelected: {
    color: '#047857',
    fontWeight: '600',
  },
  coursesSelectionContainer: {
    maxHeight: 200,
    marginBottom: 24,
  },
  noCoursesText: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    paddingVertical: 20,
  },
  courseCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#f9fafb',
    gap: 12,
  },
  courseCheckboxSelected: {
    backgroundColor: '#dbeafe',
    borderColor: '#047857',
  },
  courseCheckboxText: {
    fontSize: 14,
    color: '#6b7280',
  },
  courseCheckboxTextSelected: {
    color: '#111827',
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  modalSaveButton: {
    backgroundColor: ACCENT_GREEN,
    shadowColor: ACCENT_GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  modalCancelText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
  },
  modalSaveText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  languageOptions: {
    paddingVertical: 8,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
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
  languageSectionTop: {
    position: 'absolute',
    top: 70,
    right: 20,
    zIndex: 10,
  },
  languageButtonTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: PRIMARY_GREEN,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  languageButtonTextTop: {
    fontSize: 13,
    fontWeight: '600',
    color: PRIMARY_GREEN,
  },
});
