// app/(tabs)/profile.tsx
import { auth, db } from '@/lib/firebaseConfig';
import { buildTutorUpdatesSignature, getTutorUpdatesSeenSignature } from '@/lib/profileSystemUpdates';
import { uploadFeedAttachmentToSupabase } from '@/lib/upload';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    query,
    updateDoc,
    where,
} from 'firebase/firestore';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
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

type MyFeedPost = {
  id: string;
  title: string;
  content: string;
  type?: string;
  courseId?: string;
  courseName?: string;
  tags?: string[];
  visibility?: 'public' | 'institution';
  attachments?: Array<{
    name: string;
    url: string;
    mimeType?: string | null;
    size?: number | null;
  }>;
  likesCount: number;
  savesCount: number;
  commentsCount: number;
  createdAtLabel: string;
  createdAtMs: number;
};

type FollowListItem = {
  uid: string;
  fullName: string;
  username: string;
  avatarUrl: string;
};

type TutorApprovedCourse = {
  courseId: string;
  courseName: string;
  approvedAt?: string;
};

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const hasLoadedOnceRef = useRef(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [courses, setCourses] = useState<CourseHighlight[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [myFeedPosts, setMyFeedPosts] = useState<MyFeedPost[]>([]);
  const [editingPost, setEditingPost] = useState<MyFeedPost | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingContent, setEditingContent] = useState('');
  const [editingType, setEditingType] = useState<'Summary' | 'Tip' | 'Question' | 'Exam Info'>('Summary');
  const [editingTagsInput, setEditingTagsInput] = useState('');
  const [editingVisibility, setEditingVisibility] = useState<'public' | 'institution'>('public');
  const [editingCourseId, setEditingCourseId] = useState('');
  const [editingCourseName, setEditingCourseName] = useState('');
  const [editingAttachments, setEditingAttachments] = useState<Array<{
    name: string;
    url: string;
    mimeType?: string | null;
    size?: number | null;
  }>>([]);
  const [showEditCoursePicker, setShowEditCoursePicker] = useState(false);
  const [uploadingEditAttachment, setUploadingEditAttachment] = useState(false);
  const [savingPostEdit, setSavingPostEdit] = useState(false);
  const [showFollowsModal, setShowFollowsModal] = useState(false);
  const [followsModalType, setFollowsModalType] = useState<'followers' | 'following'>('followers');
  const [followsSearch, setFollowsSearch] = useState('');
  const [followsLoading, setFollowsLoading] = useState(false);
  const [followsItems, setFollowsItems] = useState<FollowListItem[]>([]);
  const [tutorApprovedCourses, setTutorApprovedCourses] = useState<TutorApprovedCourse[]>([]);
  const [tutorUpdatesUnread, setTutorUpdatesUnread] = useState(false);

  // Initialize i18n hook
  const { t, i18n } = useTranslation();
  const isHebrewUi = i18n.language === 'he';
  
  const loadProfileData = useCallback(async (options?: { showLoader?: boolean }) => {
    const user = auth.currentUser;
    if (!user) {
      router.replace('/(auth)/login');
      return;
    }

    const shouldShowLoader = options?.showLoader ?? !hasLoadedOnceRef.current;

    try {
      if (shouldShowLoader) {
        setLoading(true);
      }

      // --- User profile ---
      const snap = await getDoc(doc(db, 'users', user.uid));

      let tutorList: TutorApprovedCourse[] = [];
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
        const tutorRaw = Array.isArray(data.tutorApprovedCourses) ? data.tutorApprovedCourses : [];
        tutorList = tutorRaw
          .filter((e: any) => e && e.courseId)
          .map((e: any) => ({
            courseId: String(e.courseId),
            courseName: String(e.courseName || 'Course'),
            approvedAt: e.approvedAt != null ? String(e.approvedAt) : undefined,
          }));
        setTutorApprovedCourses(tutorList);
      } else {
        setProfile({
          email: user.email ?? '',
        });
        setTutorApprovedCourses([]);
        tutorList = [];
      }
      const tutorSig = buildTutorUpdatesSignature(tutorList);
      const seenSig = await getTutorUpdatesSeenSignature(user.uid);
      setTutorUpdatesUnread(tutorList.length > 0 && seenSig !== tutorSig);

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

      // Load followers/following counts
      const followsRef = collection(db, 'follows');
      const [followersSnap, followingSnap] = await Promise.all([
        getDocs(query(followsRef, where('followingId', '==', user.uid))),
        getDocs(query(followsRef, where('followerId', '==', user.uid))),
      ]);
      setFollowersCount(followersSnap.size);
      setFollowingCount(followingSnap.size);

      // Load my feed posts for profile management
      let myPostsSnap;
      try {
        myPostsSnap = await getDocs(
          query(
            collection(db, 'feedPosts'),
            where('authorUid', '==', user.uid),
            orderBy('createdAt', 'desc'),
            limit(8)
          )
        );
      } catch (error: any) {
        // Fallback for environments where composite index is not ready yet.
        const needsIndex =
          typeof error?.message === 'string' &&
          error.message.toLowerCase().includes('requires an index');
        if (!needsIndex) throw error;
        myPostsSnap = await getDocs(
          query(
            collection(db, 'feedPosts'),
            where('authorUid', '==', user.uid),
          )
        );
      }
      const myPosts: MyFeedPost[] = [];
      myPostsSnap.forEach((postDoc) => {
        const data = postDoc.data() as any;
        const createdAt = data?.createdAt?.toDate ? data.createdAt.toDate() : null;
        const likedBy: string[] = data?.likedBy || [];
        const savedBy: string[] = data?.savedBy || [];
        myPosts.push({
          id: postDoc.id,
          title: data?.title || 'Untitled post',
          content: data?.content || '',
          type: data?.type || 'Summary',
          courseId: data?.courseId || '',
          courseName: data?.courseName || '',
          tags: Array.isArray(data?.tags) ? data.tags : [],
          visibility: (data?.visibility || 'public') as 'public' | 'institution',
          attachments: Array.isArray(data?.attachments) ? data.attachments : [],
          likesCount: likedBy.length,
          savesCount: savedBy.length,
          commentsCount: data?.commentsCount || 0,
          createdAtLabel: createdAt ? createdAt.toLocaleDateString() : '',
          createdAtMs: createdAt ? createdAt.getTime() : 0,
        });
      });
      myPosts.sort((a, b) => b.createdAtMs - a.createdAtMs);
      const finalPosts = myPosts.slice(0, 8);
      setMyFeedPosts(finalPosts);
    } catch (err) {
      console.log('Load profile error:', err);
    } finally {
      if (shouldShowLoader) {
        setLoading(false);
      }
      hasLoadedOnceRef.current = true;
    }
  }, [router]);

  // Load profile when screen comes into focus (e.g., after editing)
  useFocusEffect(
    useCallback(() => {
      loadProfileData({ showLoader: false });
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

  const filteredFollowsItems = followsItems.filter((item) => {
    const q = followsSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      item.fullName.toLowerCase().includes(q) ||
      item.username.toLowerCase().includes(q)
    );
  });

  const handleOpenPost = (postId: string) => {
    router.push(`/feed/post/${postId}` as any);
  };

  const loadFollowsList = useCallback(
    async (type: 'followers' | 'following') => {
      const user = auth.currentUser;
      if (!user) return;
      setFollowsLoading(true);
      try {
        const field = type === 'followers' ? 'followingId' : 'followerId';
        const targetField = type === 'followers' ? 'followerId' : 'followingId';
        const followsSnap = await getDocs(
          query(collection(db, 'follows'), where(field, '==', user.uid))
        );
        const ids = Array.from(
          new Set(
            followsSnap.docs
              .map((d) => (d.data() as any)?.[targetField] as string)
              .filter(Boolean)
          )
        );
        if (!ids.length) {
          setFollowsItems([]);
          return;
        }
        const userDocs = await Promise.all(ids.map((uid) => getDoc(doc(db, 'users', uid))));
        const list: FollowListItem[] = userDocs
          .map((snap, index) => {
            if (!snap.exists()) return null;
            const data = snap.data() as any;
            return {
              uid: ids[index],
              fullName: data?.fullName || data?.username || 'User',
              username: data?.username || '',
              avatarUrl: data?.profilePictureUrl || '',
            } as FollowListItem;
          })
          .filter(Boolean) as FollowListItem[];
        setFollowsItems(list);
      } catch (err) {
        console.log('load follows list error:', err);
        setFollowsItems([]);
      } finally {
        setFollowsLoading(false);
      }
    },
    []
  );

  const openFollowsModal = async (type: 'followers' | 'following') => {
    setFollowsModalType(type);
    setFollowsSearch('');
    setShowFollowsModal(true);
    await loadFollowsList(type);
  };

  const openEditPostModal = (post: MyFeedPost) => {
    setEditingPost(post);
    setEditingTitle(post.title);
    setEditingContent(post.content);
    setEditingType((post.type as any) || 'Summary');
    setEditingTagsInput((post.tags || []).join(', '));
    setEditingVisibility(post.visibility || 'public');
    setEditingCourseId(post.courseId || '');
    setEditingCourseName(post.courseName || '');
    setEditingAttachments(post.attachments || []);
    setShowEditCoursePicker(false);
  };

  const handleSavePostEdit = async () => {
    const user = auth.currentUser;
    if (!user || !editingPost) return;
    if (!editingTitle.trim() || !editingContent.trim()) {
      Alert.alert(t('common.error'), t('profile.postTitleAndContentRequired'));
      return;
    }
    try {
      setSavingPostEdit(true);
      await updateDoc(doc(db, 'feedPosts', editingPost.id), {
        courseId: editingCourseId || '',
        courseName: editingCourseName || '',
        title: editingTitle.trim(),
        content: editingContent.trim(),
        type: editingType,
        tags: editingTagsInput
          .split(',')
          .map((v) => v.trim().replace(/^#/, ''))
          .filter(Boolean)
          .slice(0, 8),
        visibility: editingVisibility,
        attachments: editingAttachments,
      });
      setMyFeedPosts((prev) =>
        prev.map((item) =>
          item.id === editingPost.id
            ? {
                ...item,
                title: editingTitle.trim(),
                content: editingContent.trim(),
                type: editingType,
                courseId: editingCourseId || '',
                courseName: editingCourseName || '',
                tags: editingTagsInput
                  .split(',')
                  .map((v) => v.trim().replace(/^#/, ''))
                  .filter(Boolean)
                  .slice(0, 8),
                visibility: editingVisibility,
                attachments: editingAttachments,
              }
            : item
        )
      );
      setEditingPost(null);
      setEditingTitle('');
      setEditingContent('');
      setEditingType('Summary');
      setEditingTagsInput('');
      setEditingVisibility('public');
      setEditingCourseId('');
      setEditingCourseName('');
      setEditingAttachments([]);
    } catch (err) {
      console.log('edit post error', err);
      Alert.alert(t('common.error'), t('profile.failedToUpdatePost'));
    } finally {
      setSavingPostEdit(false);
    }
  };

  const handleDeletePost = (post: MyFeedPost) => {
    Alert.alert(t('common.confirm'), t('profile.deletePostConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'feedPosts', post.id));
            setMyFeedPosts((prev) => prev.filter((p) => p.id !== post.id));
          } catch (err) {
            console.log('delete post error', err);
            Alert.alert(t('common.error'), t('profile.failedToDeletePost'));
          }
        },
      },
    ]);
  };

  const handlePickEditAttachment = async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (result.canceled) return;
      setUploadingEditAttachment(true);
      const uploaded: Array<{ name: string; url: string; mimeType?: string | null; size?: number | null }> = [];
      for (const asset of result.assets || []) {
        if (!asset.uri) continue;
        const url = await uploadFeedAttachmentToSupabase(
          asset.uri,
          user.uid,
          asset.mimeType ?? undefined
        );
        if (!url) continue;
        uploaded.push({
          name: asset.name || 'attachment',
          url,
          mimeType: asset.mimeType ?? null,
          size: asset.size ?? null,
        });
      }
      if (!uploaded.length) return;
      setEditingAttachments((prev) => [...prev, ...uploaded].slice(0, 5));
    } catch (err) {
      console.log('edit attachment upload error', err);
      Alert.alert(t('common.error'), t('profile.failedToUpdatePost'));
    } finally {
      setUploadingEditAttachment(false);
    }
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
          <Text style={[styles.headerTitle, isHebrewUi && styles.rtlText]}>{t('profile.title')}</Text>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileCardTopActions}>
            <TouchableOpacity
              style={styles.profileCardIconBtn}
              onPress={() => router.push('/profile/system-updates')}
              accessibilityRole="button"
              accessibilityLabel={t('profile.systemUpdatesButton')}
            >
              <Ionicons name="notifications-outline" size={22} color="#047857" />
              {tutorUpdatesUnread ? <View style={styles.updatesHeaderBadgeDot} /> : null}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.profileCardIconBtn}
              onPress={() => router.push('/profile/settings')}
              accessibilityRole="button"
              accessibilityLabel={t('profile.settingsTitle')}
            >
              <Ionicons name="settings-outline" size={22} color="#047857" />
            </TouchableOpacity>
          </View>
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
            {/* Avatar Badge - Reserved for future tutor verification */}
            {/* <View style={styles.avatarBadge}>
              <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
            </View> */}
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
              onPress={() => openFollowsModal('followers')}
            >
              <Text style={styles.statNumber}>{followersCount}</Text>
              <Text style={styles.statLabel}>{t('profile.followers')}</Text>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <TouchableOpacity
              style={styles.statCard}
              onPress={() => openFollowsModal('following')}
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

        </View>

        {profile?.role === 'student' && tutorApprovedCourses.length > 0 && (
          <View style={styles.section}>
            <View style={[styles.sectionHeader, isHebrewUi && styles.rtlRow]}>
              <Ionicons name="ribbon-outline" size={20} color={ACCENT_GREEN} />
              <Text style={[styles.sectionTitle, isHebrewUi && styles.rtlText]}>{t('profile.tutorApprovedTitle')}</Text>
            </View>
            <View style={styles.tutorApprovedCard}>
              {tutorApprovedCourses.map((c) => (
                <View key={c.courseId} style={[styles.tutorApprovedRow, isHebrewUi && styles.rtlRow]}>
                  <Ionicons name="checkmark-circle" size={18} color="#047857" />
                  <Text style={[styles.tutorApprovedCourseName, isHebrewUi && styles.rtlText]} numberOfLines={2}>
                    {c.courseName}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Courses Section */}
        <View style={styles.section}>
          <View style={[styles.sectionHeader, isHebrewUi && styles.rtlRow]}>
            <Ionicons name="book-outline" size={20} color={ACCENT_GREEN} />
            <Text style={[styles.sectionTitle, isHebrewUi && styles.rtlText]}>{t('profile.myCourses')}</Text>
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

        {/* My Feed Posts Section */}
        <View style={styles.section}>
          <View style={[styles.sectionHeader, isHebrewUi && styles.rtlRow]}>
            <Ionicons name="newspaper-outline" size={20} color={ACCENT_GREEN} />
            <Text style={[styles.sectionTitle, isHebrewUi && styles.rtlText]}>
              {t('profile.myFeedPosts')}
            </Text>
          </View>
          {myFeedPosts.length === 0 ? (
            <View style={styles.emptyActivityCard}>
              <Ionicons name="chatbox-ellipses-outline" size={40} color="#4b5563" />
              <Text style={[styles.emptyActivityTitle, isHebrewUi && styles.rtlText]}>
                {t('profile.noFeedPostsYet')}
              </Text>
            </View>
          ) : (
            <View style={styles.feedGrid}>
              {myFeedPosts.map((post) => (
                <TouchableOpacity
                  key={post.id}
                  style={styles.feedSquare}
                  activeOpacity={0.85}
                  onPress={() => handleOpenPost(post.id)}
                >
                  <View style={styles.feedSquareTopRow}>
                    <Text style={[styles.feedSquareTitle, isHebrewUi && styles.rtlText]} numberOfLines={3}>
                      {post.title || post.content}
                    </Text>
                    <TouchableOpacity
                      style={styles.feedSquareMenuBtn}
                      onPress={(e) => {
                        e.stopPropagation();
                        Alert.alert(
                          t('profile.feedPostOptions'),
                          post.title || '',
                          [
                            { text: t('feed.view'), onPress: () => handleOpenPost(post.id) },
                            { text: t('common.edit'), onPress: () => openEditPostModal(post) },
                            { text: t('common.delete'), style: 'destructive', onPress: () => handleDeletePost(post) },
                            { text: t('common.cancel'), style: 'cancel' },
                          ]
                        );
                      }}
                    >
                      <Ionicons name="ellipsis-vertical" size={14} color="#6b7280" />
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.feedSquareContentMeta, isHebrewUi && styles.rtlText]} numberOfLines={1}>
                    {t(`feed.postType.${String(post.type || 'summary').toLowerCase().replace(' ', '')}`)}
                  </Text>
                  <View style={[styles.feedSquareStats, isHebrewUi && styles.rtlRow]}>
                    <View style={styles.feedSquareStatItem}>
                      <Ionicons name="heart" size={11} color="#ef4444" />
                      <Text style={styles.feedSquareStatText}>{post.likesCount}</Text>
                    </View>
                    <View style={styles.feedSquareStatItem}>
                      <Ionicons name="chatbubble-ellipses-outline" size={11} color="#374151" />
                      <Text style={styles.feedSquareStatText}>{post.commentsCount}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Activity Section */}
        <View style={styles.section}>
          <View style={[styles.sectionHeader, isHebrewUi && styles.rtlRow]}>
            <Ionicons name="time-outline" size={20} color={ACCENT_GREEN} />
            <Text style={[styles.sectionTitle, isHebrewUi && styles.rtlText]}>{t('profile.recentActivity')}</Text>
          </View>
          <View style={styles.emptyActivityCard}>
            <Ionicons name="document-text-outline" size={48} color="#4b5563" />
            <Text style={[styles.emptyActivityTitle, isHebrewUi && styles.rtlText]}>{t('profile.noActivityYet')}</Text>
            <Text style={[styles.emptyActivityText, isHebrewUi && styles.rtlText]}>
              {t('profile.activityMessage')}
            </Text>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={showFollowsModal}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowFollowsModal(false)}
      >
        <View style={styles.followsScreen}>
          <View style={styles.followsTopHeader}>
            <TouchableOpacity
              onPress={() => setShowFollowsModal(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.followsTopTitle}>{profile?.username || 'username'}</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.followsTabsRow}>
            <TouchableOpacity
              style={styles.followTabItem}
              onPress={() => {
                setFollowsModalType('followers');
                loadFollowsList('followers');
              }}
            >
              <Text style={[styles.followTabNumber, followsModalType === 'followers' && styles.followTabNumberActive]}>
                {followersCount}
              </Text>
              <Text style={[styles.followTabLabel, followsModalType === 'followers' && styles.followTabLabelActive]}>
                {t('profile.followers')}
              </Text>
              {followsModalType === 'followers' && <View style={styles.followTabUnderline} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.followTabItem}
              onPress={() => {
                setFollowsModalType('following');
                loadFollowsList('following');
              }}
            >
              <Text style={[styles.followTabNumber, followsModalType === 'following' && styles.followTabNumberActive]}>
                {followingCount}
              </Text>
              <Text style={[styles.followTabLabel, followsModalType === 'following' && styles.followTabLabelActive]}>
                {t('profile.following')}
              </Text>
              {followsModalType === 'following' && <View style={styles.followTabUnderline} />}
            </TouchableOpacity>
          </View>

          <View style={styles.followsSearchWrap}>
            <Ionicons name="search" size={16} color="#6b7280" />
            <TextInput
              style={styles.followsSearchInput}
              placeholder={t('search.title')}
              placeholderTextColor="#9ca3af"
              value={followsSearch}
              onChangeText={setFollowsSearch}
            />
          </View>

          {followsLoading ? (
            <View style={styles.followsStateWrap}>
              <ActivityIndicator color="#047857" />
            </View>
          ) : filteredFollowsItems.length ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.followsListContent}>
              {filteredFollowsItems.map((item) => (
                <TouchableOpacity
                  key={item.uid}
                  style={styles.followRow}
                  onPress={() => {
                    setShowFollowsModal(false);
                    router.push(`/user-profile/${item.uid}` as any);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.followAvatarWrap}>
                    {item.avatarUrl ? (
                      <Image source={{ uri: item.avatarUrl }} style={styles.followAvatar} />
                    ) : (
                      <Ionicons name="person" size={18} color="#047857" />
                    )}
                  </View>
                  <View style={styles.followTextWrap}>
                    <Text style={styles.followName} numberOfLines={1}>{item.fullName}</Text>
                    {!!item.username && (
                      <Text style={styles.followUsername} numberOfLines={1}>@{item.username}</Text>
                    )}
                  </View>
                  {followsModalType === 'following' && (
                    <View style={styles.followingPill}>
                      <Text style={styles.followingPillText}>{t('profile.following')}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.followsStateWrap}>
                <Text style={styles.followsEmptyText}>{t('search.noResults')}</Text>
            </View>
          )}
        </View>
      </Modal>

      {/* Edit Feed Post Modal */}
      <Modal
        visible={!!editingPost}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingPost(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.postEditModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('profile.editFeedPost')}</Text>
              <TouchableOpacity
                onPress={() => setEditingPost(null)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.postEditModalBody}
              contentContainerStyle={styles.postEditModalBodyContent}
              showsVerticalScrollIndicator={false}
            >
            <Text style={styles.modalLabel}>{t('feed.titleLabel')}</Text>
            <TextInput
              style={styles.postEditInput}
              value={editingTitle}
              onChangeText={setEditingTitle}
              placeholder={t('feed.titlePlaceholder')}
              placeholderTextColor="#9ca3af"
              textAlign={isHebrewUi ? 'right' : 'left'}
            />
            <Text style={styles.modalLabel}>{t('feed.contentLabel')}</Text>
            <TextInput
              style={[styles.postEditInput, styles.postEditTextarea]}
              value={editingContent}
              onChangeText={setEditingContent}
              placeholder={t('feed.contentPlaceholder')}
              placeholderTextColor="#9ca3af"
              multiline
              textAlignVertical="top"
              textAlign={isHebrewUi ? 'right' : 'left'}
            />

            <Text style={styles.modalLabel}>{t('feed.course')} ({t('common.optional')})</Text>
            <TouchableOpacity
              style={styles.postEditSelect}
              onPress={() => setShowEditCoursePicker((prev) => !prev)}
            >
              <Text style={editingCourseName ? styles.postEditSelectValue : styles.postEditSelectPlaceholder}>
                {editingCourseName || t('feed.selectCourse')}
              </Text>
              <Ionicons name="chevron-down" size={18} color="#6b7280" />
            </TouchableOpacity>
            {showEditCoursePicker && (
              <View style={styles.postEditPickerList}>
                <TouchableOpacity
                  style={styles.postEditPickerItem}
                  onPress={() => {
                    setEditingCourseId('');
                    setEditingCourseName('');
                    setShowEditCoursePicker(false);
                  }}
                >
                  <Text style={styles.postEditPickerText}>{t('feed.selectCourse')}</Text>
                </TouchableOpacity>
                {courses.map((course) => (
                  <TouchableOpacity
                    key={course.id}
                    style={styles.postEditPickerItem}
                    onPress={() => {
                      setEditingCourseId(course.id);
                      setEditingCourseName(course.name);
                      setShowEditCoursePicker(false);
                    }}
                  >
                    <Text style={styles.postEditPickerText}>{course.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.modalLabel}>{t('feed.postTypeLabel')}</Text>
            <View style={styles.postEditTypeRow}>
              {(['Summary', 'Tip', 'Question', 'Exam Info'] as Array<'Summary' | 'Tip' | 'Question' | 'Exam Info'>).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.postEditTypeChip, editingType === type && styles.postEditTypeChipActive]}
                  onPress={() => setEditingType(type)}
                >
                  <Text style={[styles.postEditTypeText, editingType === type && styles.postEditTypeTextActive]}>
                    {t(`feed.postType.${type.toLowerCase().replace(' ', '')}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>{t('feed.tags')} ({t('common.optional')})</Text>
            <TextInput
              style={styles.postEditInput}
              value={editingTagsInput}
              onChangeText={setEditingTagsInput}
              placeholder={t('feed.tagsPlaceholder')}
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.modalLabel}>{t('feed.visibility')}</Text>
            <View style={styles.postEditVisibilityRow}>
              <TouchableOpacity
                style={[styles.postEditVisibilityBtn, editingVisibility === 'public' && styles.postEditVisibilityBtnActive]}
                onPress={() => setEditingVisibility('public')}
              >
                <Text
                  style={[
                    styles.postEditVisibilityText,
                    editingVisibility === 'public' && styles.postEditVisibilityTextActive
                  ]}
                >
                  {t('feed.public')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.postEditVisibilityBtn,
                  editingVisibility === 'institution' && styles.postEditVisibilityBtnActive
                ]}
                onPress={() => setEditingVisibility('institution')}
              >
                <Text
                  style={[
                    styles.postEditVisibilityText,
                    editingVisibility === 'institution' && styles.postEditVisibilityTextActive
                  ]}
                >
                  {t('feed.institutionOnly')}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Attachments ({t('common.optional')})</Text>
            <TouchableOpacity style={styles.postEditAttachBtn} onPress={handlePickEditAttachment}>
              {uploadingEditAttachment ? (
                <ActivityIndicator size="small" color="#047857" />
              ) : (
                <Ionicons name="attach" size={16} color="#047857" />
              )}
              <Text style={styles.postEditAttachText}>
                {uploadingEditAttachment ? t('common.uploading') : t('profile.addAttachment')}
              </Text>
            </TouchableOpacity>
            {editingAttachments.length > 0 && (
              <View style={styles.postEditAttachmentsList}>
                {editingAttachments.map((file, idx) => (
                  <View key={`${file.url}-${idx}`} style={styles.postEditAttachmentItem}>
                    <Text style={styles.postEditAttachmentText} numberOfLines={1}>
                      {file.name}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setEditingAttachments((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Ionicons name="close-circle" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setEditingPost(null)}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalSaveButton]}
                onPress={handleSavePostEdit}
                disabled={savingPostEdit}
              >
                {savingPostEdit ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.modalSaveText}>{t('common.save')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

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
    paddingHorizontal: 52,
  },
  profileCardTopActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
  },
  profileCardIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#d1fae5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  updatesHeaderBadgeDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    borderWidth: 1.5,
    borderColor: '#ffffff',
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
  myPostCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  myPostTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  myPostContent: {
    marginTop: 6,
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
  },
  myPostStatsRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  myPostStatText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  myPostDate: {
    marginLeft: 'auto',
    fontSize: 11,
    color: '#9ca3af',
  },
  myPostActionsRow: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  myPostActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingVertical: 8,
  },
  myPostDeleteBtn: {
    borderColor: '#fecaca',
    backgroundColor: '#fff1f2',
  },
  myPostActionText: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '600',
  },
  myPostDeleteText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '700',
  },
  feedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  feedSquare: {
    width: '31%',
    aspectRatio: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 14,
    padding: 10,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  feedSquareTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 4,
  },
  feedSquareTitle: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: '#111827',
    fontWeight: '700',
  },
  feedSquareMenuBtn: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedSquareContentMeta: {
    marginTop: 6,
    fontSize: 11.5,
    color: '#6b7280',
    fontWeight: '600',
  },
  feedSquareStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 6,
    marginTop: 6,
  },
  feedSquareStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  feedSquareStatText: {
    fontSize: 11,
    color: '#4b5563',
    fontWeight: '700',
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
  tutorApprovedCard: {
    backgroundColor: '#ecfdf5',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  tutorApprovedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d1fae5',
  },
  tutorApprovedCourseName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#064e3b',
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
  followsScreen: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingTop: 58,
  },
  followsTopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  followsTopTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  followsTabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginTop: 4,
  },
  followTabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    position: 'relative',
  },
  followTabNumber: {
    color: '#6b7280',
    fontSize: 20,
    fontWeight: '700',
  },
  followTabNumberActive: {
    color: '#111827',
  },
  followTabLabel: {
    marginTop: 2,
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '600',
  },
  followTabLabelActive: {
    color: '#111827',
  },
  followTabUnderline: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 0,
    height: 2.5,
    borderRadius: 1.5,
    backgroundColor: '#111827',
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
  followsSearchWrap: {
    marginTop: 10,
    marginBottom: 8,
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    backgroundColor: '#f9fafb',
  },
  followsSearchInput: {
    flex: 1,
    color: '#111827',
    fontSize: 14,
  },
  followsStateWrap: {
    minHeight: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  followsListContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  followsEmptyText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
  },
  followRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  followAvatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#f3f4f6',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  followAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 21,
  },
  followTextWrap: {
    flex: 1,
  },
  followName: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
  },
  followUsername: {
    marginTop: 1,
    color: '#6b7280',
    fontSize: 13,
  },
  followingPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
  },
  followingPillText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '700',
  },
  modalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
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
  postEditInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    color: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  postEditTextarea: {
    minHeight: 120,
  },
  postEditModalContent: {
    width: '92%',
    maxHeight: '86%',
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  postEditModalBody: {
    maxHeight: '78%',
  },
  postEditModalBodyContent: {
    paddingBottom: 8,
  },
  postEditSelect: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  postEditSelectValue: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '500',
  },
  postEditSelectPlaceholder: {
    color: '#9ca3af',
    fontSize: 14,
  },
  postEditPickerList: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    marginBottom: 12,
    overflow: 'hidden',
  },
  postEditPickerItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  postEditPickerText: {
    fontSize: 14,
    color: '#111827',
  },
  postEditTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  postEditTypeChip: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  postEditTypeChipActive: {
    borderColor: '#047857',
    backgroundColor: '#ecfdf5',
  },
  postEditTypeText: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '600',
  },
  postEditTypeTextActive: {
    color: '#047857',
  },
  postEditVisibilityRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  postEditVisibilityBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  postEditVisibilityBtnActive: {
    borderColor: '#047857',
    backgroundColor: '#ecfdf5',
  },
  postEditVisibilityText: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '600',
  },
  postEditVisibilityTextActive: {
    color: '#047857',
  },
  postEditAttachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#d1fae5',
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    paddingVertical: 10,
    marginBottom: 10,
  },
  postEditAttachText: {
    color: '#047857',
    fontSize: 13,
    fontWeight: '600',
  },
  postEditAttachmentsList: {
    gap: 8,
    marginBottom: 12,
  },
  postEditAttachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  postEditAttachmentText: {
    flex: 1,
    color: '#374151',
    fontSize: 12,
  },
  rtlRow: {
    flexDirection: 'row-reverse',
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
