// app/(tabs)/search.tsx
import { auth, db } from '@/lib/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query as firestoreQuery, getDocs, where } from 'firebase/firestore';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
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
};

export default function SearchScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [mode, setMode] = useState<SearchMode>('users');
  const [query, setQuery] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [studyBuddyResults, setStudyBuddyResults] = useState<StudyBuddyResult[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) {
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
        const searchLower = query.toLowerCase();
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
        const searchLower = query.toLowerCase();
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
            studyBuddyResultsList.push({
              id: userDoc.id,
              username: userData.username,
              fullName: userData.fullName,
              course: matchingUserCourses[0], // Show first matching course
              institution: userData.institution,
              availability: userPreferredTime,
              profilePictureUrl: userData.profilePictureUrl || null,
            });
          }
        });

        setStudyBuddyResults(studyBuddyResultsList);
      }
    } catch (err) {
      console.log('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

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

  const renderStudyBuddyResult = ({ item }: { item: StudyBuddyResult }) => (
    <TouchableOpacity
      style={styles.resultCard}
      onPress={() => router.push(`/user-profile/${item.id}` as any)}
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
        <Ionicons name="chevron-forward" size={20} color="#4b5563" />
      </View>
      {item.institution && (
        <View style={styles.studyBuddyFooter}>
          <Ionicons name="location-outline" size={14} color="#6b7280" />
          <Text style={styles.studyBuddyFooterText}>{item.institution}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

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
              color={mode === 'users' ? '#ffffff' : '#6b7280'}
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
              color={mode === 'studybuddy' ? '#ffffff' : '#6b7280'}
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
        </View>

        {/* Filters / inputs */}
        <View style={styles.formBox}>
          <View style={styles.inputContainer}>
            <Ionicons name="search-outline" size={20} color="#6b7280" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={query}
              onChangeText={setQuery}
              placeholder={
                mode === 'users' ? t('search.searchPlaceholder') : t('search.searchPlaceholderBuddy')
              }
              placeholderTextColor="#6b7280"
            />
          </View>

          {mode === 'studybuddy' && (
            <View style={styles.inputContainer}>
              <Ionicons name="time-outline" size={20} color="#6b7280" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t('search.preferredTimePlaceholder')}
                placeholderTextColor="#6b7280"
                value={preferredTime}
                onChangeText={setPreferredTime}
              />
            </View>
          )}

          <TouchableOpacity
            style={[styles.searchButton, loading && styles.searchButtonDisabled]}
            onPress={handleSearch}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="search" size={20} color="#ffffff" />
                <Text style={styles.searchButtonText}>{t('search.search')}</Text>
              </>
            )}
          </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    marginBottom: 14,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    color: '#111827',
    fontSize: 15,
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
});

export { };

