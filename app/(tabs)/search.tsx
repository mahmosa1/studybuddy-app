// app/(tabs)/search.tsx
import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { layout, radius, spacing } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { auth, db } from '@/lib/firebaseConfig';
import { getInstitutionProfileLabel } from '@/lib/institutionUtils';
import { submitTutorSupportRequest, TutorSupportRequestStatus } from '@/lib/tutorSupportRequestService';
import { useUser } from '@/lib/UserContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query as firestoreQuery,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
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

type SearchMode = 'users' | 'studybuddy' | 'tutors';

type UserResult = {
  id: string;
  username?: string;
  fullName?: string;
  institution?: string;
  fieldOfStudy?: string;
  profilePictureUrl?: string | null;
  role?: string;
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

type TutorResult = {
  id: string;
  username?: string;
  fullName?: string;
  profilePictureUrl?: string | null;
  courseId: string;
  courseName: string;
  requestStatus?: TutorSupportRequestStatus;
};

export default function SearchScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const { role } = useUser();
  const isHebrewUi = i18n.language === 'he';
  const [mode, setMode] = useState<SearchMode>('users');
  const [query, setQuery] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [showPreferredTimeOptions, setShowPreferredTimeOptions] = useState(false);
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [studyBuddyResults, setStudyBuddyResults] = useState<StudyBuddyResult[]>([]);
  const [tutorResults, setTutorResults] = useState<TutorResult[]>([]);
  const [loading, setLoading] = useState(false);

  // Force mode to 'users' if user is a lecturer
  useEffect(() => {
    if (role === 'lecturer' && mode === 'studybuddy') {
      setMode('users');
    }
  }, [role, mode]);

  const modeOptions: { key: SearchMode; label: string; icon: string }[] = [
    { key: 'users', label: t('search.users'), icon: 'people-outline' },
    ...(role !== 'lecturer'
      ? [
          { key: 'studybuddy' as SearchMode, label: t('search.studyBuddy'), icon: 'people-circle-outline' },
          { key: 'tutors' as SearchMode, label: t('search.tutors'), icon: 'ribbon-outline' },
        ]
      : []),
  ];

  const performSearch = useCallback(async (searchText: string) => {
    if (!searchText.trim()) {
      setUserResults([]);
      setStudyBuddyResults([]);
      setTutorResults([]);
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
            institutionName?: string;
            institutionShortName?: string;
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
              institution: getInstitutionProfileLabel(data) || undefined,
              fieldOfStudy: data.fieldOfStudy,
              profilePictureUrl: data.profilePictureUrl,
              role: data.role,
            });
          }
        });
        setUserResults(results);
      } else if (mode === 'studybuddy') {
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
              institution: getInstitutionProfileLabel(userData) || undefined,
              availability: userPreferredTime,
              profilePictureUrl: userData.profilePictureUrl || null,
              phone: userData.studyBuddyPhone || null,
              matchScore: score,
            });
          }
        });

        studyBuddyResultsList.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
        setStudyBuddyResults(studyBuddyResultsList);
      } else {
        const searchLower = searchText.toLowerCase();
        const currentUser = auth.currentUser;
        const usersRef = collection(db, 'users');
        const usersQuery = firestoreQuery(
          usersRef,
          where('status', '==', 'active'),
          where('role', '==', 'student')
        );
        const usersSnap = await getDocs(usersQuery);

        const tutors: TutorResult[] = [];
        usersSnap.forEach((userDoc) => {
          if (currentUser && userDoc.id === currentUser.uid) return;
          const userData = userDoc.data() as any;
          const approvedCourses = Array.isArray(userData.tutorApprovedCourses) ? userData.tutorApprovedCourses : [];
          approvedCourses.forEach((c: any) => {
            const courseName = String(c?.courseName || '');
            const courseId = String(c?.courseId || '');
            if (!courseId || !courseName) return;
            if (!courseName.toLowerCase().includes(searchLower)) return;
            tutors.push({
              id: userDoc.id,
              username: userData.username,
              fullName: userData.fullName,
              profilePictureUrl: userData.profilePictureUrl || null,
              courseId,
              courseName,
            });
          });
        });

        if (currentUser) {
          const requestsQ = firestoreQuery(
            collection(db, 'tutorSupportRequests'),
            where('studentUid', '==', currentUser.uid),
          );
          const requestsSnap = await getDocs(requestsQ);
          const latestStatusByPair = new Map<string, { status: TutorSupportRequestStatus; createdAtMs: number }>();
          requestsSnap.forEach((d) => {
            const data = d.data() as any;
            const tutorUid = String(data?.tutorUid || '');
            const courseId = String(data?.courseId || '');
            const status = String(data?.status || 'pending') as TutorSupportRequestStatus;
            const createdAtMs = data?.createdAt?.toMillis?.() ?? 0;
            if (!tutorUid || !courseId) return;
            const key = `${tutorUid}__${courseId}`;
            const prev = latestStatusByPair.get(key);
            if (!prev || createdAtMs >= prev.createdAtMs) {
              latestStatusByPair.set(key, { status, createdAtMs });
            }
          });
          tutors.forEach((t) => {
            const key = `${t.id}__${t.courseId}`;
            const status = latestStatusByPair.get(key)?.status;
            if (status) t.requestStatus = status;
          });
        }

        tutors.sort((a, b) =>
          (a.fullName || a.username || '').localeCompare(b.fullName || b.username || '')
        );
        setTutorResults(tutors);
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

  const renderUserResult = ({ item }: { item: UserResult }) => {
    const displayName = item.fullName || item.username || 'User';
    const showUsernameLine =
      !!item.username && (!!item.fullName ? item.username !== item.fullName : displayName !== item.username);

    return (
      <TouchableOpacity
        onPress={() => router.push(`/user-profile/${item.id}` as any)}
        activeOpacity={0.88}
        style={styles.resultCardWrap}
      >
        <AppCard style={[styles.resultCard, styles.userResultCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={[styles.resultRow, styles.resultRowUser, isHebrewUi && styles.rtlRow]}>
            {item.profilePictureUrl ? (
              <Image source={{ uri: item.profilePictureUrl }} style={[styles.resultAvatar, { borderColor: colors.border }]} />
            ) : (
              <View style={[styles.resultAvatarPlaceholder, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                <Text style={[styles.resultAvatarText, { color: colors.primary }]}>
                  {(item.username || item.fullName || 'U')[0].toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.resultInfo}>
              <Text
                style={[
                  styles.userResultName,
                  { color: colors.textPrimary },
                  !isHebrewUi && { letterSpacing: -0.15 },
                  isHebrewUi && styles.rtlText,
                ]}
                numberOfLines={1}
              >
                {displayName}
              </Text>
              {showUsernameLine ? (
                <Text style={[styles.userResultUsername, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]} numberOfLines={1}>
                  @{item.username}
                </Text>
              ) : null}
            </View>
          </View>
        </AppCard>
      </TouchableOpacity>
    );
  };

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

  const openDirectChat = async (targetUid: string, targetName: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    try {
      const sorted = [currentUser.uid, targetUid].sort();
      const chatId = `direct_${sorted[0]}_${sorted[1]}`;
      const threadRef = doc(db, 'chatThreads', chatId);
      const existing = await getDoc(threadRef);
      if (!existing.exists()) {
        await setDoc(threadRef, {
          type: 'direct',
          title: targetName || 'Chat',
          members: sorted,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastMessage: '',
          unreadCountBy: {
            [sorted[0]]: 0,
            [sorted[1]]: 0,
          },
        });
      }
      router.push(`/chat/${chatId}` as any);
    } catch (e) {
      console.log('open direct chat error', e);
      Alert.alert(t('common.error'), t('chat.createFailed', { defaultValue: 'Could not open chat.' }));
    }
  };

  const handleRequestTutorSupport = async (item: TutorResult) => {
    const res = await submitTutorSupportRequest({
      tutorUid: item.id,
      tutorName: item.fullName || item.username || 'Tutor',
      courseId: item.courseId,
      courseName: item.courseName,
    });
    if (!res.ok) {
      if (res.reason === 'pending_exists') {
        Alert.alert(t('common.error'), t('search.tutorRequestAlreadyPending'));
      } else if (res.reason === 'accepted_exists') {
        Alert.alert(t('common.success'), t('search.tutorRequestAlreadyAccepted'));
      } else {
        Alert.alert(t('common.error'), t('search.tutorRequestFailed'));
      }
      return;
    }
    Alert.alert(t('common.success'), t('search.tutorRequestSent'));
  };

  const renderTutorResult = ({ item }: { item: TutorResult }) => (
    <AppCard style={[styles.tutorCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View style={[styles.tutorTopRow, styles.resultRowAlignStart, isHebrewUi && styles.rtlRow]}>
        <TouchableOpacity onPress={() => router.push(`/user-profile/${item.id}` as any)} activeOpacity={0.85}>
          {item.profilePictureUrl ? (
            <Image source={{ uri: item.profilePictureUrl }} style={[styles.tutorAvatarImg, { borderColor: colors.border }]} />
          ) : (
            <View style={[styles.tutorAvatarPh, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <Text style={[styles.tutorInitial, { color: colors.primary }]}>{(item.username || item.fullName || 'U')[0].toUpperCase()}</Text>
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.tutorInfo}>
          <Text style={[styles.resultTitle, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]} numberOfLines={1}>
            {item.fullName || item.username || 'Tutor'}
          </Text>
          {!!item.username && item.fullName && item.username !== item.fullName ? (
            <Text style={[styles.resultUsername, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]} numberOfLines={1}>
              @{item.username}
            </Text>
          ) : null}
          <View style={[styles.tutorChipsRow, isHebrewUi && styles.rtlRow]}>
            <View
              style={[
                styles.searchCompactChip,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                isHebrewUi && styles.searchCompactChipRtl,
              ]}
            >
              <Ionicons name="book-outline" size={11} color={colors.primary} />
              <Text style={[styles.searchCompactChipText, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]} numberOfLines={1}>
                {item.courseName}
              </Text>
            </View>
            <View
              style={[
                styles.searchCompactChip,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.primary },
                isHebrewUi && styles.searchCompactChipRtl,
              ]}
            >
              <Ionicons name="ribbon-outline" size={11} color={colors.primary} />
              <Text style={[styles.searchCompactChipText, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]} numberOfLines={1}>
                {t('search.tutorLabel')}
              </Text>
            </View>
          </View>
        </View>
      </View>
      {item.requestStatus === 'accepted' ? (
        <View style={[styles.tutorParticipatingBadge, { backgroundColor: `${colors.success}18`, borderColor: colors.success }]}>
          <Ionicons name="checkmark-circle" size={14} color={colors.success} />
          <Text style={[styles.tutorParticipatingText, { color: colors.success }, isHebrewUi && styles.rtlText]} numberOfLines={2}>
            {t('search.tutorRequestAcceptedState')}
          </Text>
        </View>
      ) : item.requestStatus === 'pending' ? (
        <View style={[styles.tutorPendingBadge, { backgroundColor: `${colors.warning}22`, borderColor: colors.warning }]}>
          <Ionicons name="time-outline" size={14} color={colors.warning} />
          <Text style={[styles.tutorPendingText, { color: colors.warning }, isHebrewUi && styles.rtlText]} numberOfLines={2}>
            {t('search.tutorRequestPendingState')}
          </Text>
        </View>
      ) : (
        <TouchableOpacity style={[styles.requestTutorButton, { backgroundColor: colors.primary }]} onPress={() => handleRequestTutorSupport(item)} activeOpacity={0.88}>
          <Ionicons name="paper-plane-outline" size={15} color={colors.textOnPrimary} />
          <Text style={[styles.requestTutorButtonText, { color: colors.textOnPrimary }, isHebrewUi && styles.rtlText]} numberOfLines={1}>
            {t('search.requestTutorSupport')}
          </Text>
        </TouchableOpacity>
      )}
    </AppCard>
  );

  const renderStudyBuddyResult = ({ item }: { item: StudyBuddyResult }) => {
    const showHighMatch = (item.matchScore ?? 0) >= 5;
    return (
      <AppCard style={[styles.buddyCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <View style={[styles.buddyTopRow, styles.resultRowAlignStart, isHebrewUi && styles.rtlRow]}>
          {item.profilePictureUrl ? (
            <Image source={{ uri: item.profilePictureUrl }} style={[styles.buddyAvatarImg, { borderColor: colors.border }]} />
          ) : (
            <View style={[styles.buddyAvatarPh, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <Text style={[styles.buddyInitial, { color: colors.primary }]}>{(item.username || item.fullName || 'U')[0].toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.buddyMain}>
            <Text style={[styles.resultTitle, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]} numberOfLines={1}>
              {item.fullName || item.username || 'User'}
            </Text>
            {!!item.username && item.fullName && item.username !== item.fullName ? (
              <Text style={[styles.resultUsername, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]} numberOfLines={1}>
                @{item.username}
              </Text>
            ) : null}
            {showHighMatch ? (
              <View style={[styles.buddyMatchPill, { backgroundColor: `${colors.success}16`, borderColor: colors.success }]}>
                <Ionicons name="sparkles" size={12} color={colors.success} />
                <Text style={[styles.buddyMatchPillText, { color: colors.success }, isHebrewUi && styles.rtlText]} numberOfLines={1}>
                  {t('search.highCompatibility')}
                </Text>
              </View>
            ) : null}
            <View style={[styles.buddyChipsRow, isHebrewUi && styles.rtlRow]}>
              {item.course ? (
                <View
                  style={[
                    styles.searchCompactChip,
                    { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                    isHebrewUi && styles.searchCompactChipRtl,
                  ]}
                >
                  <Ionicons name="book-outline" size={11} color={colors.primary} />
                  <Text style={[styles.searchCompactChipText, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]} numberOfLines={1}>
                    {item.course}
                  </Text>
                </View>
              ) : null}
              {item.availability ? (
                <View
                  style={[
                    styles.searchCompactChip,
                    { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                    isHebrewUi && styles.searchCompactChipRtl,
                  ]}
                >
                  <Ionicons name="time-outline" size={11} color={colors.accent} />
                  <Text style={[styles.searchCompactChipText, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]} numberOfLines={1}>
                    {t(`profile.time.${item.availability.toLowerCase()}`, { defaultValue: item.availability })}
                  </Text>
                </View>
              ) : null}
              {item.institution ? (
                <View
                  style={[
                    styles.searchCompactChip,
                    { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                    isHebrewUi && styles.searchCompactChipRtl,
                  ]}
                >
                  <Ionicons name="location-outline" size={11} color={colors.accent} />
                  <Text style={[styles.searchCompactChipText, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]} numberOfLines={1}>
                    {item.institution}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
        {item.phone ? (
          <View style={[styles.buddyActionsRow, isHebrewUi && styles.rtlRow]}>
            <TouchableOpacity
              style={[styles.whatsappButton, styles.buddyActionHalf]}
              onPress={() => handleWhatsAppMessage(item.phone!, item.fullName || item.username || 'User')}
              activeOpacity={0.88}
            >
              <Ionicons name="logo-whatsapp" size={16} color="#ffffff" />
              <Text style={styles.whatsappButtonText} numberOfLines={1}>
                {t('search.openWhatsApp')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chatButton, styles.buddyActionHalf, { backgroundColor: colors.primary }]}
              onPress={() => openDirectChat(item.id, item.fullName || item.username || 'User')}
              activeOpacity={0.88}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.textOnPrimary} />
              <Text style={[styles.chatButtonText, { color: colors.textOnPrimary }]} numberOfLines={1}>
                {t('search.sendInAppMessage')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={[styles.noPhoneMessage, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <Ionicons name="information-circle-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.noPhoneText, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>{t('search.noPhoneNumber')}</Text>
            </View>
            <TouchableOpacity
              style={[styles.chatButton, styles.chatButtonFull, { backgroundColor: colors.primary }]}
              onPress={() => openDirectChat(item.id, item.fullName || item.username || 'User')}
              activeOpacity={0.88}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={15} color={colors.textOnPrimary} />
              <Text style={[styles.chatButtonText, { color: colors.textOnPrimary }]} numberOfLines={1}>
                {t('search.sendInAppMessage')}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </AppCard>
    );
  };

  return (
    <AppScreen>
      <View style={[styles.pageHeader, { borderBottomColor: colors.border }]}>
        <Text style={[styles.pageTitle, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>{t('search.title')}</Text>
        <Text style={[styles.pageSubtitle, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>{t('search.discoverSubtitle')}</Text>
      </View>
      <View style={[styles.topDecorWrap, { borderBottomColor: colors.border }]}>
        <View style={[styles.topDecorPrimary, { backgroundColor: colors.primary }]} />
        <View style={[styles.topDecorAccent, { backgroundColor: colors.accent }]} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <AppCard style={[styles.modeCard, { borderColor: colors.border }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.modeSegments, isHebrewUi && styles.modeSegmentsRtl]}
          >
            {modeOptions.map((m) => {
              const selected = mode === m.key;
              return (
                <TouchableOpacity
                  key={m.key}
                  onPress={() => setMode(m.key)}
                  activeOpacity={0.88}
                  style={[
                    styles.modeSegment,
                    {
                      backgroundColor: selected ? colors.primary : colors.surfaceMuted,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Ionicons name={m.icon as any} size={16} color={selected ? colors.textOnPrimary : colors.textSecondary} />
                  <Text
                    style={[
                      styles.modeSegmentLabel,
                      { color: selected ? colors.textOnPrimary : colors.textPrimary },
                      isHebrewUi && styles.rtlText,
                    ]}
                    numberOfLines={1}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </AppCard>

        <AppCard style={[styles.formCard, { borderColor: colors.border }]}>
          <View style={[styles.searchBarShell, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
            <View style={[styles.searchBarInner, isHebrewUi && styles.rtlRow]}>
              <Ionicons name="search-outline" size={18} color={colors.textSecondary} style={styles.searchBarIcon} />
              <TextInput
                style={[styles.searchBarInput, { color: colors.textPrimary }, isHebrewUi ? styles.inputTextRtl : styles.inputTextLtr]}
                value={query}
                onChangeText={setQuery}
                placeholder={
                  mode === 'users'
                    ? t('search.searchPlaceholder')
                    : mode === 'studybuddy'
                      ? t('search.searchPlaceholderBuddy')
                      : t('search.searchPlaceholderTutor')
                }
                placeholderTextColor={colors.textSecondary}
                textAlign={isHebrewUi ? 'right' : 'left'}
                returnKeyType="search"
                onSubmitEditing={handleSearch}
              />
            </View>
          </View>

          {mode === 'studybuddy' ? (
            <View style={styles.preferredTimeContainer}>
              <TouchableOpacity
                style={[styles.preferredTimeButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
                onPress={() => setShowPreferredTimeOptions(!showPreferredTimeOptions)}
                activeOpacity={0.88}
              >
                <Ionicons name="time-outline" size={18} color={colors.primary} />
                <Text
                  style={[
                    styles.preferredTimeButtonText,
                    { color: preferredTime ? colors.textPrimary : colors.textSecondary },
                    isHebrewUi && styles.rtlText,
                  ]}
                >
                  {preferredTime
                    ? t(`profile.time.${preferredTime.toLowerCase()}`, { defaultValue: preferredTime })
                    : t('profile.preferredTime')}
                </Text>
                <Ionicons
                  name={showPreferredTimeOptions ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
              <Modal visible={showPreferredTimeOptions} transparent animationType="fade" onRequestClose={() => setShowPreferredTimeOptions(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowPreferredTimeOptions(false)}>
                  <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                      <Text style={[styles.modalTitle, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
                        {t('profile.preferredTime')}
                      </Text>
                      <TouchableOpacity onPress={() => setShowPreferredTimeOptions(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close" size={22} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                    <ScrollView style={styles.optionsList}>
                      {['Morning', 'Afternoon', 'Evening', 'Night', 'Weekends', 'Flexible'].map((time) => (
                        <TouchableOpacity
                          key={time}
                          style={[
                            styles.listOptionButton,
                            { borderBottomColor: colors.border },
                            preferredTime === time && { backgroundColor: colors.surfaceElevated },
                          ]}
                          onPress={() => {
                            setPreferredTime(preferredTime === time ? '' : time);
                            setShowPreferredTimeOptions(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.listOptionText,
                              { color: colors.textPrimary },
                              preferredTime === time && { color: colors.primary, fontWeight: '700' as const },
                              isHebrewUi && styles.rtlText,
                            ]}
                          >
                            {t(`profile.time.${time.toLowerCase()}`, { defaultValue: time })}
                          </Text>
                          {preferredTime === time ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </TouchableOpacity>
              </Modal>
            </View>
          ) : null}
        </AppCard>

        {loading ? (
          <AppCard style={[styles.stateCard, { borderColor: colors.border }]}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={[styles.loadingText, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>{t('search.searching')}</Text>
          </AppCard>
        ) : mode === 'users' ? (
          userResults.length === 0 ? (
            <AppCard style={[styles.stateCard, { borderColor: colors.border }]}>
              <Ionicons name="search-outline" size={32} color={colors.textSecondary} style={{ alignSelf: 'center' }} />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>{t('search.noResults')}</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>{t('search.noResultsMessage')}</Text>
            </AppCard>
          ) : (
            <View style={styles.resultsBlock}>
              <Text style={[styles.resultsHeader, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
                {userResults.length === 1
                  ? t('search.resultsFound', { count: userResults.length })
                  : t('search.resultsFoundPlural', { count: userResults.length })}
              </Text>
              {userResults.map((item) => (
                <View key={item.id}>{renderUserResult({ item })}</View>
              ))}
            </View>
          )
        ) : mode === 'studybuddy' ? (
          studyBuddyResults.length === 0 ? (
            <AppCard style={[styles.stateCard, { borderColor: colors.border }]}>
              <Ionicons name="people-outline" size={32} color={colors.textSecondary} style={{ alignSelf: 'center' }} />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>{t('search.noStudyBuddies')}</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>{t('search.noStudyBuddiesMessage')}</Text>
            </AppCard>
          ) : (
            <View style={styles.resultsBlock}>
              <Text style={[styles.resultsHeader, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
                {studyBuddyResults.length === 1
                  ? t('search.resultsFound', { count: studyBuddyResults.length })
                  : t('search.resultsFoundPlural', { count: studyBuddyResults.length })}
              </Text>
              {studyBuddyResults.length >= 3 ? (
                <View style={[styles.matchSuggestionBanner, { backgroundColor: `${colors.success}14`, borderColor: colors.success }]}>
                  <Ionicons name="sparkles-outline" size={16} color={colors.success} />
                  <Text style={[styles.matchSuggestionText, { color: colors.success }, isHebrewUi && styles.rtlText]}>
                    {t('search.matchSuggestionTop3', { count: 3 })}
                  </Text>
                </View>
              ) : null}
              {studyBuddyResults.map((item) => (
                <View key={item.id} style={styles.cardSpacer}>
                  {renderStudyBuddyResult({ item })}
                </View>
              ))}
            </View>
          )
        ) : tutorResults.length === 0 ? (
          <AppCard style={[styles.stateCard, { borderColor: colors.border }]}>
            <Ionicons name="ribbon-outline" size={32} color={colors.textSecondary} style={{ alignSelf: 'center' }} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>{t('search.noTutorResults')}</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>{t('search.noTutorResultsMessage')}</Text>
          </AppCard>
        ) : (
          <View style={styles.resultsBlock}>
            <Text style={[styles.resultsHeader, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
              {tutorResults.length === 1
                ? t('search.resultsFound', { count: tutorResults.length })
                : t('search.resultsFoundPlural', { count: tutorResults.length })}
            </Text>
            {tutorResults.map((item) => (
              <View key={`${item.id}-${item.courseId}`} style={styles.cardSpacer}>
                {renderTutorResult({ item })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: layout.headerTopPadding,
    paddingBottom: layout.headerBottomPadding,
    borderBottomWidth: 1,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  pageSubtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  topDecorWrap: {
    position: 'relative',
    overflow: 'hidden',
    height: 22,
    marginHorizontal: layout.screenPadding,
    marginTop: 0,
    marginBottom: 0,
    borderBottomWidth: 1,
  },
  topDecorPrimary: {
    position: 'absolute',
    width: 128,
    height: 128,
    borderRadius: 64,
    top: -108,
    right: -14,
    opacity: 0.055,
  },
  topDecorAccent: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
    top: -88,
    left: -8,
    opacity: 0.07,
  },
  scrollContent: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xl,
  },
  modeCard: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  modeSegments: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 0,
    flexGrow: 1,
  },
  modeSegmentsRtl: {
    flexDirection: 'row-reverse',
  },
  modeSegment: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minHeight: 36,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  modeSegmentLabel: {
    fontSize: 12,
    fontWeight: '700',
    maxWidth: 120,
    textAlign: 'center',
  },
  formCard: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchBarShell: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  searchBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  searchBarIcon: {
    marginEnd: spacing.xs,
  },
  searchBarInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '600',
  },
  inputTextRtl: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  inputTextLtr: {
    writingDirection: 'ltr',
    textAlign: 'left',
  },
  preferredTimeContainer: {
    marginTop: spacing.sm,
  },
  preferredTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  preferredTimeButtonText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: radius.lg,
    width: '88%',
    maxHeight: '72%',
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    flex: 1,
    marginEnd: spacing.sm,
  },
  optionsList: {
    maxHeight: 320,
  },
  listOptionButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listOptionText: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginEnd: spacing.sm,
  },
  stateCard: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: spacing.sm,
    marginBottom: 2,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 17,
  },
  resultsBlock: {
    marginTop: 0,
  },
  resultsHeader: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
    marginBottom: 2,
    letterSpacing: 0.15,
  },
  cardSpacer: {
    marginBottom: spacing.xs,
  },
  resultCardWrap: {
    marginBottom: 3,
  },
  resultCard: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
  userResultCard: {
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  resultRowUser: {
    gap: 6,
  },
  resultRowAlignStart: {
    alignItems: 'flex-start',
  },
  resultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
  },
  resultAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultAvatarText: {
    fontSize: 14,
    fontWeight: '800',
  },
  resultInfo: {
    flex: 1,
    minWidth: 0,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 0,
  },
  userResultName: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '800',
  },
  userResultUsername: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
    marginBottom: 0,
  },
  resultUsername: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 0,
  },
  searchCompactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '100%',
  },
  searchCompactChipRtl: {
    flexDirection: 'row-reverse',
  },
  searchCompactChipText: {
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
  },
  resultSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
  },
  buddyCard: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  buddyTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: 0,
  },
  buddyMain: {
    flex: 1,
    minWidth: 0,
  },
  buddyMatchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  buddyMatchPillText: {
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 1,
  },
  buddyChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 4,
    alignItems: 'center',
  },
  buddyActionsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  buddyActionHalf: {
    flex: 1,
    minWidth: 0,
    marginTop: 0,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
  },
  buddyAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
  },
  buddyAvatarPh: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buddyInitial: {
    fontSize: 18,
    fontWeight: '800',
  },
  tutorCard: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  tutorTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  tutorChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 6,
    alignItems: 'center',
  },
  tutorAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
  },
  tutorAvatarPh: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tutorInitial: {
    fontSize: 18,
    fontWeight: '800',
  },
  tutorInfo: {
    flex: 1,
    minWidth: 0,
  },
  whatsappButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    gap: 6,
  },
  whatsappButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    gap: 6,
  },
  chatButtonFull: {
    alignSelf: 'stretch',
  },
  chatButtonText: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  requestTutorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingVertical: 10,
    gap: 6,
    marginTop: spacing.xs,
  },
  requestTutorButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  tutorParticipatingBadge: {
    marginTop: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tutorParticipatingText: {
    fontSize: 12,
    fontWeight: '800',
    flex: 1,
  },
  tutorPendingBadge: {
    marginTop: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tutorPendingText: {
    fontSize: 12,
    fontWeight: '800',
    flex: 1,
  },
  noPhoneMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    gap: 6,
    borderWidth: 1,
  },
  noPhoneText: {
    fontSize: 12,
    fontWeight: '600',
    fontStyle: 'italic',
    flex: 1,
    textAlign: 'center',
  },
  matchSuggestionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginBottom: spacing.xs,
  },
  matchSuggestionText: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  rtlRow: {
    flexDirection: 'row-reverse',
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});

