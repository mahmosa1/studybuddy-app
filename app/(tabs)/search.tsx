// app/(tabs)/search.tsx
import { auth, db } from '@/lib/firebaseConfig';
import { useUser } from '@/lib/UserContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query as firestoreQuery, getDocs, where } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

type SearchMode = 'users' | 'studybuddy';

type UserResult = {
  id: string;
  username?: string;
  fullName?: string;
  institution?: string;
  fieldOfStudy?: string;
  profilePictureUrl?: string | null;
};

type StudyBuddyResult = {
  id: string;
  username?: string;
  fullName?: string;
  course?: string;
  institution?: string;
  availability?: string;
  profilePictureUrl?: string | null;
  phone?: string | null;
  matchScore?: number;
};

export default function SearchScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { role } = useUser();
  const isHebrewUi = i18n.language === 'he';
  const [mode, setMode] = useState<SearchMode>('users');
  const [query, setQuery] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [showPreferredTimeOptions, setShowPreferredTimeOptions] = useState(false);
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [studyBuddyResults, setStudyBuddyResults] = useState<StudyBuddyResult[]>([]);
  const [loading, setLoading] = useState(false);

  // Force mode to 'users' if user is a lecturer
  useEffect(() => {
    if (role === 'lecturer' && mode === 'studybuddy') {
      setMode('users');
    }
  }, [role, mode]);

  const performSearch = useCallback(async (searchText: string) => {
    if (!searchText.trim()) {
      setUserResults([]);
      setStudyBuddyResults([]);
      return;
    }

    setLoading(true);
    try {
      if (mode === 'users') {
        // Search for active users by name or username
        const usersRef = collection(db, 'users');
        const usersQuery = firestoreQuery(
          usersRef,
          where('status', '==', 'active')
        );
        const usersSnap = await getDocs(usersQuery);
        
        const results: UserResult[] = [];
        const searchLower = searchText.toLowerCase();
        const currentUser = auth.currentUser;
        
        usersSnap.forEach((docSnap) => {
          // Skip current user in results
          if (currentUser && docSnap.id === currentUser.uid) {
            return;
          }

          const data = docSnap.data() as {
            username?: string;
            fullName?: string;
            institution?: string;
            fieldOfStudy?: string;
            profilePictureUrl?: string | null;
            role?: string;
          };

          // Only show students and lecturers, not admins
          if (data.role === 'admin') {
            return;
          }

          const username = (data.username || '').toLowerCase();
          const fullName = (data.fullName || '').toLowerCase();
          
          if (username.includes(searchLower) || fullName.includes(searchLower)) {
            results.push({
              id: docSnap.id,
              username: data.username,
              fullName: data.fullName,
              institution: data.institution,
              fieldOfStudy: data.fieldOfStudy,
              profilePictureUrl: data.profilePictureUrl,
            });
          }
        });
        setUserResults(results);
      } else {
        // Study buddy search: Find users who have set preferences matching the query
        const searchLower = searchText.toLowerCase();
        const currentUser = auth.currentUser;
        
        // First, find courses that match the search query
        const coursesRef = collection(db, 'courses');
        const coursesSnap = await getDocs(coursesRef);
        
        const matchingCourseIds: string[] = [];
        const courseNameMap: Map<string, string> = new Map(); // courseId -> courseName
        
        coursesSnap.forEach((courseDoc) => {
          const courseData = courseDoc.data();
          const courseName = (courseData.name || '').toLowerCase();
          
          if (courseName.includes(searchLower)) {
            matchingCourseIds.push(courseDoc.id);
            courseNameMap.set(courseDoc.id, courseData.name || 'Course');
          }
        });

        if (matchingCourseIds.length === 0) {
          setStudyBuddyResults([]);
          setLoading(false);
          return;
        }

        // Get all active students who have set study buddy preferences
        // Note: This requires a composite index in Firestore
        // For now, we'll filter in memory to avoid index requirement
        const usersRef = collection(db, 'users');
        const usersQuery = firestoreQuery(
          usersRef,
          where('status', '==', 'active')
        );
        const usersSnap = await getDocs(usersQuery);
        
        const studyBuddyResultsList: StudyBuddyResult[] = [];

        usersSnap.forEach((userDoc) => {
          // Skip current user
          if (currentUser && userDoc.id === currentUser.uid) {
            return;
          }

          const userData = userDoc.data();
          
          // Only show students (filter in memory to avoid index requirement)
          if (userData.role !== 'student') {
            return;
          }
          
          // Check if user has set study buddy preferences
          const userPreferredTime = userData.preferredTime || '';
          const userStudyBuddyCourses = userData.studyBuddyCourses || [];
          
          // User must have set preferences
          if (!userPreferredTime || userStudyBuddyCourses.length === 0) {
            return;
          }

          // Check if user's preferred time matches (if provided in search)
          if (preferredTime && userPreferredTime !== preferredTime) {
            return;
          }

          // Check if user has any of the matching courses in their study buddy courses
          const matchingUserCourses: string[] = [];
          userStudyBuddyCourses.forEach((userCourseId: string) => {
            if (matchingCourseIds.includes(userCourseId)) {
              const courseName = courseNameMap.get(userCourseId);
              if (courseName) {
                matchingUserCourses.push(courseName);
              }
            }
          });

          // Only include if user has at least one matching course
          if (matchingUserCourses.length > 0) {
            const score =
              matchingUserCourses.length * 2 +
              (preferredTime && userPreferredTime === preferredTime ? 2 : 0) +
              (userData.studyBuddyPhone ? 1 : 0);

            studyBuddyResultsList.push({
              id: userDoc.id,
              username: userData.username,
              fullName: userData.fullName,
              course: matchingUserCourses[0], // Show first matching course
              institution: userData.institution,
              availability: userPreferredTime,
              profilePictureUrl: userData.profilePictureUrl || null,
              phone: userData.studyBuddyPhone || null,
              matchScore: score,
            });
          }
        });

        studyBuddyResultsList.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
        setStudyBuddyResults(studyBuddyResultsList);
      }
    } catch (err) {
      console.log('Search error:', err);
    } finally {
      setLoading(false);
    }
  }, [mode, preferredTime]);

  const handleSearch = async () => {
    await performSearch(query);
  };

  useEffect(() => {
    const debounce = setTimeout(() => {
      performSearch(query);
    }, 180);

    return () => clearTimeout(debounce);
  }, [query, performSearch]);

  const renderUserResult = ({ item }: { item: UserResult }) => (
    <TouchableOpacity
      style={styles.resultCard}
      onPress={() => router.push(`/user-profile/${item.id}` as any)}
      activeOpacity={0.7}
    >
      <View style={styles.resultRow}>
        {item.profilePictureUrl ? (
          <Image
            source={{ uri: item.profilePictureUrl }}
            style={styles.resultAvatar}
          />
        ) : (
          <View style={styles.resultAvatarPlaceholder}>
            <Text style={styles.resultAvatarText}>
              {(item.username || item.fullName || 'U')[0].toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.resultInfo}>
          <Text style={styles.resultTitle}>
            {item.fullName || item.username || 'User'}
          </Text>
          <View style={styles.resultMeta}>
            {item.fieldOfStudy && (
              <View style={styles.resultTag}>
                <Ionicons name="school-outline" size={14} color={ACCENT_GREEN} />
                <Text style={styles.resultSubtitle}>{item.fieldOfStudy}</Text>
              </View>
            )}
            {item.institution && (
              <View style={styles.resultTag}>
                <Ionicons name="location-outline" size={14} color={ACCENT_GREEN} />
                <Text style={styles.resultSubtitle}>{item.institution}</Text>
              </View>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#4b5563" />
      </View>
    </TouchableOpacity>
  );

  const handleWhatsAppMessage = (phone: string, userName: string) => {
    // Remove any non-digit characters and ensure proper format
    const cleanPhone = phone.replace(/\D/g, '');
    // Add country code if not present (assuming Israel +972)
    const formattedPhone = cleanPhone.startsWith('0') 
      ? `972${cleanPhone.substring(1)}` 
      : cleanPhone.startsWith('972') 
      ? cleanPhone 
      : `972${cleanPhone}`;
    
    // Pre-filled message in Hebrew and English
    const message = t('search.whatsAppDefaultMessage', { 
      name: userName,
      defaultValue: `שלום ${userName}, מצאתי אותך דרך StudyBuddy ואשמח ללמוד יחד!\n\nHello ${userName}, I found you through StudyBuddy and would love to study together!`
    });
    const encodedMessage = encodeURIComponent(message);
    
    Alert.alert(
      t('search.sendWhatsAppMessage'),
      t('search.whatsAppConfirmation', { name: userName, phone }),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('search.openWhatsApp'),
          onPress: () => {
            const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
            Linking.openURL(whatsappUrl).catch((err) => {
              console.error('Error opening WhatsApp:', err);
              Alert.alert(t('common.error'), t('search.whatsAppError'));
            });
          },
        },
      ]
    );
  };

  const renderStudyBuddyResult = ({ item }: { item: StudyBuddyResult }) => {
    // If no phone number, show message
    if (!item.phone) {
      return (
        <View style={styles.resultCard}>
          <View style={styles.studyBuddyHeader}>
            {item.profilePictureUrl ? (
              <Image
                source={{ uri: item.profilePictureUrl }}
                style={styles.studyBuddyAvatarImage}
              />
            ) : (
              <View style={styles.studyBuddyAvatar}>
                <Text style={styles.studyBuddyInitial}>
                  {(item.username || item.fullName || 'U')[0].toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.studyBuddyInfo}>
              <Text style={styles.resultTitle}>
                {item.fullName || item.username || 'User'}
              </Text>
              <View style={styles.studyBuddyTags}>
                {item.course && (
                  <View style={styles.studyBuddyTag}>
                    <Ionicons name="book" size={12} color={ACCENT_GREEN} />
                    <Text style={styles.studyBuddyTagText}>{item.course}</Text>
                  </View>
                )}
                {item.availability && (
                  <View style={styles.studyBuddyTag}>
                    <Ionicons name="time" size={12} color={ACCENT_GREEN} />
                    <Text style={styles.studyBuddyTagText}>
                      {t(`profile.time.${item.availability.toLowerCase()}`, { defaultValue: item.availability })}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
          {item.institution && (
            <View style={styles.studyBuddyFooter}>
              <Ionicons name="location-outline" size={14} color="#6b7280" />
              <Text style={styles.studyBuddyFooterText}>{item.institution}</Text>
            </View>
          )}
          <View style={styles.noPhoneMessage}>
            <Ionicons name="information-circle-outline" size={16} color="#6b7280" />
            <Text style={styles.noPhoneText}>{t('search.noPhoneNumber')}</Text>
          </View>
        </View>
      );
    }

    // If phone number exists, clicking the card goes directly to WhatsApp
    return (
      <TouchableOpacity
        style={styles.resultCard}
        onPress={() => handleWhatsAppMessage(item.phone!, item.fullName || item.username || 'User')}
        activeOpacity={0.7}
      >
        <View style={styles.studyBuddyHeader}>
          {item.profilePictureUrl ? (
            <Image
              source={{ uri: item.profilePictureUrl }}
              style={styles.studyBuddyAvatarImage}
            />
          ) : (
            <View style={styles.studyBuddyAvatar}>
              <Text style={styles.studyBuddyInitial}>
                {(item.username || item.fullName || 'U')[0].toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.studyBuddyInfo}>
            <Text style={styles.resultTitle}>
              {item.fullName || item.username || 'User'}
            </Text>
            <View style={styles.studyBuddyTags}>
              {item.course && (
                <View style={styles.studyBuddyTag}>
                  <Ionicons name="book" size={12} color={ACCENT_GREEN} />
                  <Text style={styles.studyBuddyTagText}>{item.course}</Text>
                </View>
              )}
              {item.availability && (
                <View style={styles.studyBuddyTag}>
                  <Ionicons name="time" size={12} color={ACCENT_GREEN} />
                  <Text style={styles.studyBuddyTagText}>
                    {t(`profile.time.${item.availability.toLowerCase()}`, { defaultValue: item.availability })}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
        </View>
        {item.institution && (
          <View style={styles.studyBuddyFooter}>
            <Ionicons name="location-outline" size={14} color="#6b7280" />
            <Text style={styles.studyBuddyFooterText}>{item.institution}</Text>
          </View>
        )}
        <View style={styles.whatsappHint}>
          <Ionicons name="arrow-forward-circle-outline" size={16} color="#25D366" />
          <Text style={styles.whatsappHintText}>{t('search.tapToMessage')}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={styles.headerSection}>
          <View style={styles.headerBackground} />
          <View style={styles.headerContent}>
            <View style={styles.headerIconContainer}>
              <Ionicons name="search" size={32} color={ACCENT_GREEN} />
            </View>
            <Text style={styles.title}>{t('search.discover')}</Text>
            <Text style={styles.subtitle}>
              {t('search.discoverSubtitle')}
            </Text>
          </View>
        </View>

        {/* Mode toggle */}
        <View style={styles.modeContainer}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              mode === 'users' && styles.modeButtonActive,
            ]}
            onPress={() => setMode('users')}
          >
            <Ionicons
              name={mode === 'users' ? 'people' : 'people-outline'}
              size={20}
              color={mode === 'users' ? '#ffffff' : '#3b82f6'}
            />
            <Text
              style={[
                styles.modeText,
                mode === 'users' && styles.modeTextActive,
              ]}
            >
              {t('search.users')}
            </Text>
          </TouchableOpacity>

          {role !== 'lecturer' && (
            <TouchableOpacity
              style={[
                styles.modeButton,
                mode === 'studybuddy' && styles.modeButtonActive,
              ]}
              onPress={() => setMode('studybuddy')}
            >
              <Ionicons
                name={mode === 'studybuddy' ? 'people-circle' : 'people-circle-outline'}
                size={20}
                color={mode === 'studybuddy' ? '#ffffff' : '#3b82f6'}
              />
              <Text
                style={[
                  styles.modeText,
                  mode === 'studybuddy' && styles.modeTextActive,
                ]}
              >
                {t('search.studyBuddy')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filters / inputs */}
        <View style={styles.formBox}>
          <View style={[styles.searchInlineRow, isHebrewUi && styles.searchInlineRowRtl]}>
            <View style={[styles.inputContainer, isHebrewUi && styles.inputContainerRtl]}>
              <Ionicons
                name="search-outline"
                size={20}
                color="#3b82f6"
                style={[styles.inputIcon, isHebrewUi && styles.inputIconRtl]}
              />
              <TextInput
                style={[styles.input, isHebrewUi ? styles.inputTextRtl : styles.inputTextLtr]}
                value={query}
                onChangeText={setQuery}
                placeholder={
                  mode === 'users' ? t('search.searchPlaceholder') : t('search.searchPlaceholderBuddy')
                }
                placeholderTextColor="#6b7280"
                textAlign={isHebrewUi ? 'right' : 'left'}
              />
            </View>
            <TouchableOpacity
              style={[styles.searchIconButton, loading && styles.searchButtonDisabled]}
              onPress={handleSearch}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Ionicons name="search" size={20} color="#ffffff" />
              )}
            </TouchableOpacity>
          </View>

          {mode === 'studybuddy' && (
            <View style={styles.preferredTimeContainer}>
              <TouchableOpacity
                style={styles.preferredTimeButton}
                onPress={() => setShowPreferredTimeOptions(!showPreferredTimeOptions)}
              >
                <Ionicons name="time-outline" size={20} color="#ef4444" />
                <Text style={[
                  styles.preferredTimeButtonText,
                  !preferredTime && styles.preferredTimeButtonTextPlaceholder
                ]}>
                  {preferredTime 
                    ? t(`profile.time.${preferredTime.toLowerCase()}`, { defaultValue: preferredTime })
                    : t('profile.preferredTime')}
                </Text>
                <Ionicons 
                  name={showPreferredTimeOptions ? "chevron-up" : "chevron-down"} 
                  size={20} 
                  color="#6b7280" 
                />
              </TouchableOpacity>
              <Modal
                visible={showPreferredTimeOptions}
                transparent
                animationType="fade"
                onRequestClose={() => setShowPreferredTimeOptions(false)}
              >
                <TouchableOpacity
                  style={styles.modalOverlay}
                  activeOpacity={1}
                  onPress={() => setShowPreferredTimeOptions(false)}
                >
                  <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>{t('profile.preferredTime')}</Text>
                      <TouchableOpacity onPress={() => setShowPreferredTimeOptions(false)}>
                        <Ionicons name="close" size={24} color="#6b7280" />
                      </TouchableOpacity>
                    </View>
                    <ScrollView style={styles.optionsList}>
                      {['Morning', 'Afternoon', 'Evening', 'Night', 'Weekends', 'Flexible'].map((time) => (
                        <TouchableOpacity
                          key={time}
                          style={[
                            styles.listOptionButton,
                            preferredTime === time && styles.listOptionButtonSelected,
                          ]}
                          onPress={() => {
                            setPreferredTime(preferredTime === time ? '' : time);
                            setShowPreferredTimeOptions(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.listOptionText,
                              preferredTime === time && styles.listOptionTextSelected,
                            ]}
                          >
                            {t(`profile.time.${time.toLowerCase()}`, { defaultValue: time })}
                          </Text>
                          {preferredTime === time && (
                            <Ionicons name="checkmark" size={20} color={ACCENT_GREEN} />
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </TouchableOpacity>
              </Modal>
            </View>
          )}

        </View>

        {/* Results */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={PRIMARY_GREEN} size="large" />
            <Text style={styles.loadingText}>{t('search.searching')}</Text>
          </View>
        ) : mode === 'users' ? (
          userResults.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={64} color="#4b5563" />
              <Text style={styles.emptyTitle}>{t('search.noResults')}</Text>
              <Text style={styles.emptyText}>
                {t('search.noResultsMessage')}
              </Text>
            </View>
          ) : (
            <View style={styles.resultsContainer}>
              <Text style={styles.resultsHeader}>
                {userResults.length === 1 
                  ? t('search.resultsFound', { count: userResults.length })
                  : t('search.resultsFoundPlural', { count: userResults.length })}
              </Text>
              {userResults.map((item) => (
                <View key={item.id}>
                  {renderUserResult({ item })}
                </View>
              ))}
            </View>
          )
        ) : (
          studyBuddyResults.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color="#4b5563" />
              <Text style={styles.emptyTitle}>{t('search.noStudyBuddies')}</Text>
              <Text style={styles.emptyText}>
                {t('search.noStudyBuddiesMessage')}
              </Text>
            </View>
          ) : (
            <View style={styles.resultsContainer}>
              <Text style={styles.resultsHeader}>
                {studyBuddyResults.length === 1 
                  ? t('search.resultsFound', { count: studyBuddyResults.length })
                  : t('search.resultsFoundPlural', { count: studyBuddyResults.length })}
              </Text>
              {studyBuddyResults.length >= 3 && (
                <View style={styles.matchSuggestionBanner}>
                  <Ionicons name="sparkles-outline" size={16} color="#047857" />
                  <Text style={styles.matchSuggestionText}>
                    {t('search.matchSuggestionTop3', { count: 3 })}
                  </Text>
                </View>
              )}
              {studyBuddyResults.map((item) => (
                <View key={item.id}>
                  {renderStudyBuddyResult({ item })}
                </View>
              ))}
            </View>
          )
        )}
      </ScrollView>
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
  headerSection: {
    height: 200,
    backgroundColor: PRIMARY_GREEN,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 70,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: PRIMARY_GREEN,
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
    opacity: 0.1,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 3,
    borderColor: ACCENT_GREEN,
    shadowColor: ACCENT_GREEN,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: '#ffffff',
    marginTop: 10,
    marginBottom: 6,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.95,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  modeContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 8,
    marginHorizontal: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    justifyContent: 'center',
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 16,
    gap: 8,
  },
  modeButtonActive: {
    backgroundColor: PRIMARY_GREEN,
  },
  modeText: {
    color: '#6b7280',
    fontSize: 15,
    fontWeight: '600',
  },
  modeTextActive: {
    color: '#ffffff',
  },
  formBox: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 24,
    marginHorizontal: 24,
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    overflow: 'hidden',
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  inputContainerRtl: {
    flexDirection: 'row-reverse',
  },
  inputIcon: {
    marginRight: 8,
  },
  inputIconRtl: {
    marginRight: 0,
    marginLeft: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    color: '#111827',
    fontSize: 15,
  },
  inputTextRtl: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  inputTextLtr: {
    writingDirection: 'ltr',
    textAlign: 'left',
  },
  searchInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  searchInlineRowRtl: {
    flexDirection: 'row-reverse',
  },
  searchIconButton: {
    width: 34,
    height: 44,
    borderRadius: 12,
    backgroundColor: PRIMARY_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PRIMARY_GREEN,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  searchButton: {
    marginTop: 12,
    backgroundColor: PRIMARY_GREEN,
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    shadowColor: PRIMARY_GREEN,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  searchButtonDisabled: {
    opacity: 0.7,
  },
  matchSuggestionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  matchSuggestionText: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  emptyState: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 48,
    alignItems: 'center',
    marginHorizontal: 24,
    marginTop: 20,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    fontWeight: '500',
  },
  resultsContainer: {
    marginHorizontal: 24,
    marginTop: 12,
  },
  resultsHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  resultCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
    borderWidth: 2,
    borderColor: ACCENT_GREEN,
  },
  resultAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: ACCENT_GREEN,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  resultAvatarText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
  },
  resultInfo: {
    flex: 1,
  },
  resultTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  resultMeta: {
    gap: 4,
  },
  resultTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resultSubtitle: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '500',
  },
  studyBuddyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  studyBuddyAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: ACCENT_GREEN,
    borderWidth: 2,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  studyBuddyAvatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: ACCENT_GREEN,
    marginRight: 12,
  },
  studyBuddyInitial: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
  },
  studyBuddyInfo: {
    flex: 1,
  },
  studyBuddyTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  studyBuddyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    borderWidth: 1.5,
    borderColor: ACCENT_GREEN,
  },
  studyBuddyTagText: {
    color: ACCENT_GREEN,
    fontSize: 12,
    fontWeight: '600',
  },
  studyBuddyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  studyBuddyFooterText: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '500',
  },
  studyBuddyTouchable: {
    flex: 1,
  },
  whatsappButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
  },
  whatsappButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  noPhoneMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
  },
  noPhoneText: {
    color: '#6b7280',
    fontSize: 13,
    fontStyle: 'italic',
  },
  whatsappHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    marginTop: 12,
    gap: 8,
  },
  whatsappHintText: {
    color: '#25D366',
    fontSize: 13,
    fontWeight: '600',
  },
  preferredTimeContainer: {
    marginBottom: 14,
  },
  preferredTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  preferredTimeButtonText: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
  },
  preferredTimeButtonTextPlaceholder: {
    color: '#6b7280',
    fontWeight: '400',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    width: '85%',
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  optionsList: {
    maxHeight: 300,
  },
  listOptionButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  listOptionButtonSelected: {
    backgroundColor: '#f0fdf4',
  },
  listOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  listOptionTextSelected: {
    color: ACCENT_GREEN,
    fontWeight: '600',
  },
});

export { };

