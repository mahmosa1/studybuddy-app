// app/user-profile/[userId].tsx
import { auth, db } from '@/lib/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type UserProfile = {
  username?: string;
  fullName?: string;
  email?: string;
  institution?: string;
  fieldOfStudy?: string;
  department?: string;
  role?: string;
  profilePictureUrl?: string | null;
};

type CourseHighlight = {
  id: string;
  name: string;
};

export default function UserProfileScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ userId?: string }>();
  const userId = params.userId;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [courses, setCourses] = useState<CourseHighlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isOwnProfile, setIsOwnProfile] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      const currentUser = auth.currentUser;
      if (currentUser && currentUser.uid === userId) {
        setIsOwnProfile(true);
      }

      try {
        // Load user profile
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setProfile({
            username: data.username,
            fullName: data.fullName,
            email: data.email,
            institution: data.institution,
            fieldOfStudy: data.fieldOfStudy,
            department: data.department,
            role: data.role,
            profilePictureUrl: data.profilePictureUrl,
          });
        }

        // Load user's courses
        const coursesQuery = query(
          collection(db, 'courses'),
          where('ownerUid', '==', userId)
        );
        const coursesSnap = await getDocs(coursesQuery);
        const coursesList: CourseHighlight[] = [];
        coursesSnap.forEach((docSnap) => {
          const courseData = docSnap.data();
          coursesList.push({
            id: docSnap.id,
            name: courseData.name ?? 'Course',
          });
        });
        setCourses(coursesList);

        // Load followers/following counts (stub - replace with real queries later)
        // Mock: In real app, query 'follows' collection
        setFollowersCount(0); // TODO: Replace with real query
        setFollowingCount(0); // TODO: Replace with real query

        // Check if current user is following this user (stub)
        if (currentUser && currentUser.uid !== userId) {
          // TODO: Check if currentUser.uid follows userId in 'follows' collection
          setIsFollowing(false); // Mock: replace with real check
        }
      } catch (err) {
        console.log('Error loading user profile:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [userId]);

  const getInitials = () => {
    if (!profile) return '?';
    if (profile.fullName) {
      const parts = profile.fullName.split(' ').filter(Boolean);
      if (parts.length === 1) return parts[0][0]?.toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    if (profile.username) return profile.username[0]?.toUpperCase();
    return '?';
  };

  const handleFollow = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser || !userId || currentUser.uid === userId) {
      return;
    }

    try {
      // TODO: Implement follow/unfollow logic
      // For now, just toggle the state
      setIsFollowing(!isFollowing);
      if (!isFollowing) {
        setFollowersCount((prev) => prev + 1);
        // TODO: Add document to 'follows' collection
        // await addDoc(collection(db, 'follows'), {
        //   followerId: currentUser.uid,
        //   followingId: userId,
        //   createdAt: serverTimestamp(),
        // });
      } else {
        setFollowersCount((prev) => Math.max(0, prev - 1));
        // TODO: Remove document from 'follows' collection
      }
    } catch (err) {
      console.log('Follow/unfollow error:', err);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color="#047857" size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>User not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Section */}
        <View style={styles.headerSection}>
          <View style={styles.headerBackground} />
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
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
            {profile.role === 'lecturer' && (
              <View style={styles.avatarBadge}>
                <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
              </View>
            )}
          </View>

          {/* Name and Info */}
          <View style={styles.profileInfo}>
            <Text style={styles.nameText}>
              {profile.fullName || profile.username || 'User'}
            </Text>
            <Text style={styles.usernameText}>@{profile.username || 'username'}</Text>

            {/* Info Cards */}
            <View style={styles.infoCards}>
              {profile.fieldOfStudy && (
                <View style={styles.infoCard}>
                  <Ionicons name="school-outline" size={16} color={ACCENT_GREEN} />
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
                    {profile.role.toUpperCase()}
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

          {/* Follow Button (only if not own profile) */}
          {!isOwnProfile && (
            <TouchableOpacity
              style={[
                styles.followButton,
                isFollowing && styles.followButtonFollowing,
              ]}
              onPress={handleFollow}
            >
              <Ionicons
                name={isFollowing ? 'checkmark' : 'add'}
                size={18}
                color={isFollowing ? '#111827' : '#ffffff'}
              />
              <Text
                style={[
                  styles.followButtonText,
                  isFollowing && styles.followButtonTextFollowing,
                ]}
              >
                {isFollowing ? t('profile.following') : t('profile.follow')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Courses Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="book-outline" size={20} color={ACCENT_GREEN} />
            <Text style={styles.sectionTitle}>
              {profile.role === 'lecturer' ? t('profile.teaching') : t('profile.learning')}
            </Text>
          </View>
          {courses.length > 0 ? (
            <FlatList
              data={courses}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => {
                // Only allow navigation to course files if it's the user's own profile
                if (isOwnProfile) {
                  return (
                    <TouchableOpacity
                      style={styles.courseItem}
                      onPress={() => router.push(`/course/${item.id}` as any)}
                    >
                      <View style={styles.courseCircle}>
                        <Text style={styles.courseInitial}>
                          {item.name[0]?.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.courseLabel} numberOfLines={1}>
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  );
                } else {
                  // For other users' profiles, show courses but make them non-clickable
                  return (
                    <View style={[styles.courseItem, styles.courseItemDisabled]}>
                      <View style={[styles.courseCircle, styles.courseCircleDisabled]}>
                        <Text style={styles.courseInitial}>
                          {item.name[0]?.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.courseLabel} numberOfLines={1}>
                        {item.name}
                      </Text>
                    </View>
                  );
                }
              }}
              contentContainerStyle={styles.coursesList}
            />
          ) : (
            <View style={styles.emptyCoursesCard}>
              <Ionicons name="book-outline" size={48} color="#4b5563" />
              <Text style={styles.emptyCoursesText}>
                No courses to display
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const ACCENT_GREEN = '#047857';

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
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    justifyContent: 'flex-end',
    paddingBottom: 20,
    paddingHorizontal: 24,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 20,
  },
  headerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.1,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginTop: -50,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
    marginBottom: 20,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: ACCENT_GREEN,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#dbeafe',
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: ACCENT_GREEN,
  },
  avatarText: {
    color: ACCENT_GREEN,
    fontSize: 42,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  roleBadge: {
    backgroundColor: '#047857',
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
    fontSize: 24,
    fontWeight: '700',
    color: ACCENT_GREEN,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#047857',
    gap: 8,
  },
  followButtonFollowing: {
    backgroundColor: '#374151',
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  followButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  followButtonTextFollowing: {
    color: '#111827',
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
  courseItem: {
    alignItems: 'center',
    marginRight: 16,
  },
  courseItemDisabled: {
    opacity: 0.8,
  },
  courseCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: ACCENT_GREEN,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#dbeafe',
    marginBottom: 8,
  },
  courseCircleDisabled: {
    borderColor: '#4b5563',
    backgroundColor: '#f9fafb',
  },
  courseInitial: {
    fontSize: 24,
    fontWeight: '700',
    color: ACCENT_GREEN,
  },
  courseLabel: {
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
  emptyText: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    paddingVertical: 20,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
  },
});

