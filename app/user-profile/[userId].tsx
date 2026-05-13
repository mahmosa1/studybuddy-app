// app/user-profile/[userId].tsx
import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppHeader } from '@/frontend/components/ui/AppHeader';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { layout, radius, spacing } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { auth, db } from '@/lib/firebaseConfig';
import { createActivityNotification } from '@/lib/notificationService';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
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
  studyBuddyPhone?: string | null;
};

type CourseHighlight = {
  id: string;
  name: string;
};

type FeedPostPreview = {
  id: string;
  title: string;
  createdAtLabel: string;
  likesCount: number;
  commentsCount: number;
};

const relativeTime = (date: Date) => {
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

export default function UserProfileScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const isHebrewUi = i18n.language === 'he';
  const params = useLocalSearchParams<{ userId?: string }>();
  const userId = params.userId;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [courses, setCourses] = useState<CourseHighlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowedByViewedUser, setIsFollowedByViewedUser] = useState(false);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [feedPosts, setFeedPosts] = useState<FeedPostPreview[]>([]);
  const [loadingFeedPosts, setLoadingFeedPosts] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }

      const currentUser = auth.currentUser;
      setIsOwnProfile(!!(currentUser && currentUser.uid === userId));

      try {
        const followsRef = collection(db, 'follows');
        setIsFollowing(false);
        setIsFollowedByViewedUser(false);

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
            studyBuddyPhone: data.studyBuddyPhone || null,
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

        // Load followers/following counts
        const [followersSnap, followingSnap] = await Promise.all([
          getDocs(query(followsRef, where('followingId', '==', userId))),
          getDocs(query(followsRef, where('followerId', '==', userId))),
        ]);
        setFollowersCount(followersSnap.size);
        setFollowingCount(followingSnap.size);

        // Check if current user follows this user, and if this user follows current user
        if (currentUser && currentUser.uid !== userId) {
          const outgoingId = `${currentUser.uid}_${userId}`;
          const incomingId = `${userId}_${currentUser.uid}`;
          const [followDoc, reverseFollowDoc] = await Promise.all([
            getDoc(doc(db, 'follows', outgoingId)),
            getDoc(doc(db, 'follows', incomingId)),
          ]);
          setIsFollowing(followDoc.exists());
          setIsFollowedByViewedUser(reverseFollowDoc.exists());
        }
      } catch (err) {
        console.log('Error loading user profile:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    if (!isOwnProfile && !isFollowing) {
      setFeedPosts([]);
      return;
    }
    setLoadingFeedPosts(true);
    const q = query(
      collection(db, 'feedPosts'),
      where('authorUid', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const posts: FeedPostPreview[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          posts.push({
            id: d.id,
            title: data.title || 'Post',
            createdAtLabel: data.createdAt?.toDate ? relativeTime(data.createdAt.toDate()) : 'Just now',
            likesCount: Array.isArray(data.likedBy) ? data.likedBy.length : 0,
            commentsCount: Number(data.commentsCount || 0),
          });
        });
        setFeedPosts(posts);
        setLoadingFeedPosts(false);
      },
      () => setLoadingFeedPosts(false)
    );
    return unsub;
  }, [userId, isFollowing, isOwnProfile]);

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
      const followDocId = `${currentUser.uid}_${userId}`;
      const followRef = doc(db, 'follows', followDocId);

      if (!isFollowing) {
        let actorName = 'User';
        let actorAvatarUrl = '';
        try {
          const actorSnap = await getDoc(doc(db, 'users', currentUser.uid));
          if (actorSnap.exists()) {
            const actorData = actorSnap.data() as any;
            actorName = actorData.fullName || actorData.username || actorName;
            actorAvatarUrl = actorData.profilePictureUrl || '';
          }
        } catch {
          // Keep graceful fallback for notification actor info.
        }

        await setDoc(followRef, {
          followerId: currentUser.uid,
          followingId: userId,
          createdAt: serverTimestamp(),
        });
        await createActivityNotification({
          recipientUid: userId,
          actorUid: currentUser.uid,
          actorName,
          actorAvatarUrl,
          type: 'follow',
        });
        setIsFollowing(true);
        setFollowersCount((prev) => prev + 1);
      } else {
        await deleteDoc(followRef);
        setIsFollowing(false);
        setFollowersCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.log('Follow/unfollow error:', err);
    }
  };

  const headerTitle = profile?.fullName || profile?.username || t('userProfile.title');

  if (loading) {
    return (
      <AppScreen>
        <AppHeader title={t('userProfile.title')} onBack={() => router.back()} />
        <View style={[styles.topDecorWrap, { borderBottomColor: colors.border }]}>
          <View style={[styles.topDecorPrimary, { backgroundColor: colors.primary }]} />
          <View style={[styles.topDecorAccent, { backgroundColor: colors.accent }]} />
        </View>
        <View style={styles.centerFill}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </AppScreen>
    );
  }

  if (!profile) {
    return (
      <AppScreen>
        <AppHeader title={t('userProfile.title')} onBack={() => router.back()} />
        <View style={[styles.topDecorWrap, { borderBottomColor: colors.border }]}>
          <View style={[styles.topDecorPrimary, { backgroundColor: colors.primary }]} />
          <View style={[styles.topDecorAccent, { backgroundColor: colors.accent }]} />
        </View>
        <View style={styles.centerFill}>
          <AppCard style={[styles.notFoundCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Ionicons name="person-outline" size={40} color={colors.textSecondary} />
            <Text style={[styles.notFoundText, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
              {t('userProfile.userNotFound')}
            </Text>
          </AppCard>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <AppHeader title={headerTitle} onBack={() => router.back()} />
      <View style={[styles.topDecorWrap, { borderBottomColor: colors.border }]}>
        <View style={[styles.topDecorPrimary, { backgroundColor: colors.primary }]} />
        <View style={[styles.topDecorAccent, { backgroundColor: colors.accent }]} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <AppCard style={[styles.heroCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatarInner}>
              {profile.profilePictureUrl ? (
                <Image
                  source={{ uri: profile.profilePictureUrl }}
                  style={[styles.avatarImage, { borderColor: colors.primary }]}
                />
              ) : (
                <View style={[styles.avatarCircle, { borderColor: colors.primary, backgroundColor: colors.surfaceMuted }]}>
                  <Text style={[styles.avatarText, { color: colors.primary }]}>{getInitials()}</Text>
                </View>
              )}
              {profile.role === 'lecturer' ? (
                <View style={[styles.avatarBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                </View>
              ) : null}
            </View>
          </View>

          <Text style={[styles.displayName, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]} numberOfLines={2}>
            {profile.fullName || profile.username || 'User'}
          </Text>
          <Text style={[styles.usernameLine, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]} numberOfLines={1}>
            @{profile.username || 'username'}
          </Text>

          <View style={[styles.profileInfoCards, isHebrewUi && styles.rtlRow]}>
            {profile.fieldOfStudy ? (
              <View
                style={[
                  styles.profileDetailCard,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                  isHebrewUi && styles.profileDetailCardRtl,
                ]}
              >
                <Ionicons name="school-outline" size={16} color={colors.primary} />
                <Text style={[styles.profileDetailCardText, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]} numberOfLines={2}>
                  {profile.fieldOfStudy}
                </Text>
              </View>
            ) : null}
            {profile.institution ? (
              <View
                style={[
                  styles.profileDetailCard,
                  { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                  isHebrewUi && styles.profileDetailCardRtl,
                ]}
              >
                <Ionicons name="location-outline" size={16} color={colors.accent} />
                <Text style={[styles.profileDetailCardText, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]} numberOfLines={2}>
                  {profile.institution}
                </Text>
              </View>
            ) : null}
            {profile.role && profile.role !== 'admin' ? (
              <View
                style={[
                  styles.profileDetailCard,
                  styles.profileRoleCard,
                  { backgroundColor: colors.primary, borderColor: colors.primary },
                  isHebrewUi && styles.profileDetailCardRtl,
                ]}
              >
                <Ionicons name="person-circle-outline" size={16} color={colors.textOnPrimary} />
                <Text style={[styles.profileDetailCardText, { color: colors.textOnPrimary }, isHebrewUi && styles.rtlText]} numberOfLines={1}>
                  {t(`auth.${profile.role}`)}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={[styles.statsRow, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
            <TouchableOpacity
              style={styles.statCell}
              onPress={() => {
                console.log('Show followers');
              }}
              activeOpacity={0.85}
            >
              <Text style={[styles.statNumber, { color: colors.primary }, isHebrewUi && styles.rtlText]}>{followersCount}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>{t('profile.followers')}</Text>
            </TouchableOpacity>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity
              style={styles.statCell}
              onPress={() => {
                console.log('Show following');
              }}
              activeOpacity={0.85}
            >
              <Text style={[styles.statNumber, { color: colors.primary }, isHebrewUi && styles.rtlText]}>{followingCount}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>{t('profile.following')}</Text>
            </TouchableOpacity>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statCell}>
              <Text style={[styles.statNumber, { color: colors.primary }, isHebrewUi && styles.rtlText]}>{courses.length}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>{t('profile.courses')}</Text>
            </View>
          </View>

          {!isOwnProfile ? (
            <TouchableOpacity
              style={[
                styles.followButton,
                isFollowing ? [styles.followButtonMuted, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }] : { backgroundColor: colors.primary },
              ]}
              onPress={handleFollow}
              activeOpacity={0.88}
            >
              <Ionicons
                name={isFollowing ? 'checkmark' : 'person-add-outline'}
                size={18}
                color={isFollowing ? colors.textPrimary : colors.textOnPrimary}
              />
              <Text
                style={[
                  styles.followButtonLabel,
                  isFollowing ? { color: colors.textPrimary } : { color: colors.textOnPrimary },
                  isHebrewUi && styles.rtlText,
                ]}
              >
                {isFollowing
                  ? t('profile.following')
                  : isFollowedByViewedUser
                    ? t('profile.followBack')
                    : t('profile.follow')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </AppCard>

        <AppCard style={[styles.sectionCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={[styles.sectionHeaderRow, isHebrewUi && styles.rtlRow]}>
            <Ionicons name="book-outline" size={20} color={colors.primary} />
            <Text style={[styles.sectionHeading, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
              {profile.role === 'lecturer' ? t('profile.teaching') : t('profile.learning')}
            </Text>
          </View>
          {courses.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.coursesRow}>
              {courses.map((item) => {
                const canOpenLecturerCourse = !isOwnProfile && profile.role === 'lecturer';

                if (isOwnProfile) {
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.courseItem}
                      onPress={() => router.push(`/course/${item.id}` as any)}
                      activeOpacity={0.88}
                    >
                      <View style={[styles.courseCircle, { borderColor: colors.primary, backgroundColor: colors.surface }]}>
                        <Text style={[styles.courseInitial, { color: colors.primary }]}>{item.name[0]?.toUpperCase()}</Text>
                      </View>
                      <Text style={[styles.courseLabel, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]} numberOfLines={1}>
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  );
                }

                if (canOpenLecturerCourse) {
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.courseItem}
                      onPress={() =>
                        router.push({
                          pathname: '/lecturer-course/[courseId]' as any,
                          params: { courseId: item.id, name: item.name },
                        })
                      }
                      activeOpacity={0.88}
                    >
                      <View style={[styles.courseCircle, { borderColor: colors.primary, backgroundColor: colors.surface }]}>
                        <Text style={[styles.courseInitial, { color: colors.primary }]}>{item.name[0]?.toUpperCase()}</Text>
                      </View>
                      <View style={[styles.courseLabelRow, isHebrewUi && styles.rtlRow]}>
                        <Text style={[styles.courseLabel, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Ionicons name={isHebrewUi ? 'chevron-back' : 'chevron-forward'} size={12} color={colors.primary} />
                      </View>
                    </TouchableOpacity>
                  );
                }

                return (
                  <View key={item.id} style={[styles.courseItem, styles.courseItemDisabled]}>
                    <View style={[styles.courseCircle, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
                      <Text style={[styles.courseInitial, { color: colors.textSecondary }]}>{item.name[0]?.toUpperCase()}</Text>
                    </View>
                    <Text style={[styles.courseLabel, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <View style={[styles.emptyCoursesCard, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <Ionicons name="book-outline" size={40} color={colors.textSecondary} />
              <Text style={[styles.emptyCoursesText, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
                {t('userProfile.noCourses')}
              </Text>
            </View>
          )}
        </AppCard>

        {(isOwnProfile || isFollowing) ? (
          <AppCard style={[styles.sectionCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <View style={[styles.sectionHeaderRow, isHebrewUi && styles.rtlRow]}>
              <Ionicons name="newspaper-outline" size={20} color={colors.primary} />
              <Text style={[styles.sectionHeading, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
                {t('userProfile.posts')}
              </Text>
            </View>
            {loadingFeedPosts ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
            ) : feedPosts.length ? (
              <View style={styles.feedList}>
                {feedPosts.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => router.push(`/feed/post/${p.id}` as any)}
                    activeOpacity={0.88}
                  >
                    <AppCard style={[styles.feedPostCard, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
                      <Text style={[styles.feedPostTitle, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]} numberOfLines={2}>
                        {p.title}
                      </Text>
                      <View style={[styles.feedPostStats, isHebrewUi && styles.rtlRow]}>
                        <View style={styles.feedPostStatItem}>
                          <Ionicons name="heart-outline" size={14} color={colors.textSecondary} />
                          <Text style={[styles.feedPostStatText, { color: colors.textSecondary }]}>{p.likesCount}</Text>
                        </View>
                        <View style={styles.feedPostStatItem}>
                          <Ionicons name="chatbubble-outline" size={14} color={colors.textSecondary} />
                          <Text style={[styles.feedPostStatText, { color: colors.textSecondary }]}>{p.commentsCount}</Text>
                        </View>
                      </View>
                      <Text style={[styles.feedPostTime, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>{p.createdAtLabel}</Text>
                    </AppCard>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={[styles.emptyFeedText, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
                {t('profile.noFeedPostsYet')}
              </Text>
            )}
          </AppCard>
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
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
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  centerFill: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: layout.screenPadding,
  },
  notFoundCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  notFoundText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  heroCard: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  avatarWrap: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarInner: {
    width: 112,
    height: 112,
    position: 'relative',
    alignSelf: 'center',
  },
  avatarCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 3,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '800',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: -2,
    end: -2,
    borderRadius: 14,
    borderWidth: 1,
    padding: 2,
  },
  displayName: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  usernameLine: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  profileInfoCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: spacing.md,
    maxWidth: '100%',
  },
  profileDetailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '100%',
  },
  profileDetailCardRtl: {
    flexDirection: 'row-reverse',
  },
  profileDetailCardText: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  profileRoleCard: {
    borderWidth: 0,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.md,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignSelf: 'stretch',
  },
  followButtonMuted: {
    borderWidth: 1,
  },
  followButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  sectionCard: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '800',
    flex: 1,
  },
  coursesRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: 2,
    paddingEnd: spacing.xs,
  },
  courseItem: {
    alignItems: 'center',
    width: 88,
  },
  courseItemDisabled: {
    opacity: 0.85,
  },
  courseCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  courseInitial: {
    fontSize: 26,
    fontWeight: '700',
  },
  courseLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'center',
    maxWidth: '100%',
  },
  courseLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 84,
  },
  emptyCoursesCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyCoursesText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  feedList: {
    gap: spacing.sm,
  },
  feedPostCard: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  feedPostTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  feedPostStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  feedPostStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  feedPostStatText: {
    fontSize: 12,
    fontWeight: '600',
  },
  feedPostTime: {
    marginTop: spacing.sm,
    fontSize: 12,
    fontWeight: '500',
  },
  emptyFeedText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  rtlRow: {
    flexDirection: 'row-reverse',
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
