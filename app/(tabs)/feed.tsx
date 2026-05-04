// app/(tabs)/feed.tsx
import { useUser } from '@/lib/UserContext';
import { db } from '@/lib/firebaseConfig';
import { createActivityNotification } from '@/lib/notificationService';
import { uploadFeedAttachmentToSupabase } from '@/lib/upload';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import {
    addDoc,
    arrayRemove,
    arrayUnion,
    collection,
    doc,
    getDoc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
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
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

const PRIMARY_GREEN = '#047857';
const ACCENT_GREEN = '#10b981';

type StudyPost = {
  id: string;
  authorUid?: string;
  authorName: string;
  authorAvatarUrl?: string;
  authorInstitution: string;
  courseName?: string;
  type: 'Summary' | 'Tip' | 'Question' | 'Exam Info';
  title: string;
  content: string;
  tags: string[];
  attachments?: Array<{
    name: string;
    url: string;
    mimeType?: string | null;
    size?: number | null;
  }>;
  likesCount: number;
  commentsCount: number;
  savesCount: number;
  createdAt: string;
  isLiked?: boolean;
  isSaved?: boolean;
  visibility?: 'public' | 'institution';
};

type CourseOption = {
  id: string;
  name: string;
};

type FeedAttachment = {
  name: string;
  url: string;
  mimeType?: string | null;
  size?: number | null;
};

type ActivityNotificationItem = {
  id: string;
  actorName: string;
  actorAvatarUrl?: string;
  type: 'follow' | 'post_like' | 'post_comment' | 'comment_like';
  text?: string;
  postId?: string;
  createdAtLabel: string;
  createdAtMs: number;
  read: boolean;
};

const TYPE_COLORS: Record<StudyPost['type'], string> = {
  Summary: '#3b82f6',
  Tip: '#f59e0b',
  Question: '#8b5cf6',
  'Exam Info': '#ef4444',
};

export default function StudentFeedScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { role, firebaseUser } = useUser();
  const [posts, setPosts] = useState<StudyPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [showCoursePicker, setShowCoursePicker] = useState(false);
  const [userInstitution, setUserInstitution] = useState('');
  const [selectedType, setSelectedType] = useState<StudyPost['type']>('Summary');
  const [selectedCourse, setSelectedCourse] = useState<CourseOption | null>(null);
  const [visibility, setVisibility] = useState<'public' | 'institution'>('public');
  const [attachments, setAttachments] = useState<FeedAttachment[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newTags, setNewTags] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [notifications, setNotifications] = useState<ActivityNotificationItem[]>([]);
  const [notificationsUnreadCount, setNotificationsUnreadCount] = useState(0);
  const [notificationsFilter, setNotificationsFilter] = useState<'all' | 'follows' | 'comments' | 'likes'>('all');

  const relativeTime = (date: Date): string => {
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const notificationText = (item: ActivityNotificationItem) => {
    if (item.type === 'follow') return t('feed.notifications.items.follow', { name: item.actorName });
    if (item.type === 'post_like') return t('feed.notifications.items.postLike', { name: item.actorName });
    if (item.type === 'post_comment') return t('feed.notifications.items.postComment', { name: item.actorName });
    if (item.type === 'comment_like') return t('feed.notifications.items.commentLike', { name: item.actorName });
    return t('feed.notifications.items.newActivity');
  };

  const filteredNotifications = useMemo(() => {
    if (notificationsFilter === 'all') return notifications;
    if (notificationsFilter === 'follows') {
      return notifications.filter((n) => n.type === 'follow');
    }
    if (notificationsFilter === 'comments') {
      return notifications.filter((n) => n.type === 'post_comment');
    }
    return notifications.filter((n) => n.type === 'post_like' || n.type === 'comment_like');
  }, [notifications, notificationsFilter]);

  const groupedNotifications = useMemo(() => {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const today: ActivityNotificationItem[] = [];
    const yesterday: ActivityNotificationItem[] = [];
    const last7Days: ActivityNotificationItem[] = [];
    const earlier: ActivityNotificationItem[] = [];

    filteredNotifications.forEach((item) => {
      const diff = now - item.createdAtMs;
      if (diff < oneDay) today.push(item);
      else if (diff < oneDay * 2) yesterday.push(item);
      else if (diff < oneDay * 7) last7Days.push(item);
      else earlier.push(item);
    });

    return [
      { title: t('feed.notifications.sections.today'), data: today },
      { title: t('feed.notifications.sections.yesterday'), data: yesterday },
      { title: t('feed.notifications.sections.last7Days'), data: last7Days },
      { title: t('feed.notifications.sections.earlier'), data: earlier },
    ].filter((section) => section.data.length > 0);
  }, [filteredNotifications, t]);

  useEffect(() => {
    const loadContext = async () => {
      if (!firebaseUser) return;
      try {
        const [userDoc, coursesSnap] = await Promise.all([
          getDoc(doc(db, 'users', firebaseUser.uid)),
          getDocs(query(collection(db, 'courses'), where('ownerUid', '==', firebaseUser.uid))),
        ]);
        if (userDoc.exists()) {
          const data = userDoc.data() as any;
          setUserInstitution(data?.institution || '');
        }
        const list: CourseOption[] = [];
        coursesSnap.forEach((courseDoc) => {
          const data = courseDoc.data() as any;
          if (data?.name) {
            list.push({ id: courseDoc.id, name: data.name });
          }
        });
        setCourses(list);
      } catch (err) {
        console.log('feed context error:', err);
      }
    };
    loadContext();
  }, [firebaseUser]);

  useEffect(() => {
    const postsRef = collection(db, 'feedPosts');
    const q = query(postsRef, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      async (snap) => {
        const list = await Promise.all(
          snap.docs.map(async (d) => {
          const data = d.data() as any;
          const likedBy: string[] = data.likedBy || [];
          const savedBy: string[] = data.savedBy || [];
          const postVisibility = (data.visibility || 'public') as 'public' | 'institution';
          const postInstitution = data.authorInstitution || '';
          const canSeePost =
            postVisibility === 'public' ||
            !postInstitution ||
            (userInstitution && postInstitution === userInstitution);
          if (!canSeePost) return null;

          let authorAvatarUrl = data.authorAvatarUrl || '';
          if (!authorAvatarUrl && data.authorUid) {
            try {
              const authorSnap = await getDoc(doc(db, 'users', data.authorUid));
              if (authorSnap.exists()) {
                const authorData = authorSnap.data() as any;
                authorAvatarUrl = authorData?.profilePictureUrl || '';
              }
            } catch {
              // Keep fallback icon if user lookup fails.
            }
          }

          return {
            id: d.id,
            authorUid: data.authorUid || '',
            authorName: data.authorName || 'User',
            authorAvatarUrl,
            authorInstitution: data.authorInstitution || '',
            courseName: data.courseName || '',
            type: (data.type || 'Summary') as StudyPost['type'],
            title: data.title || '',
            content: data.content || '',
            tags: data.tags || [],
            likesCount: likedBy.length,
            commentsCount: Number(data.commentsCount || 0),
            savesCount: savedBy.length,
            createdAt: data.createdAt?.toDate ? relativeTime(data.createdAt.toDate()) : 'Just now',
            isLiked: firebaseUser ? likedBy.includes(firebaseUser.uid) : false,
            isSaved: firebaseUser ? savedBy.includes(firebaseUser.uid) : false,
            visibility: postVisibility,
          } as StudyPost;
        })
        );
        setPosts(list.filter(Boolean) as StudyPost[]);
        setLoadingPosts(false);
      },
      (err) => {
        console.log('feed load error:', err);
        setLoadingPosts(false);
      }
    );
    return unsub;
  }, [firebaseUser, userInstitution]);

  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(
      collection(db, 'chatThreads'),
      where('members', 'array-contains', firebaseUser.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      let total = 0;
      snap.forEach((d) => {
        const data = d.data() as any;
        total += Number(data?.unreadCountBy?.[firebaseUser.uid] || 0);
      });
      setChatUnreadCount(total);
    });
    return unsub;
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(
      collection(db, 'activityNotifications'),
      where('recipientUid', '==', firebaseUser.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: ActivityNotificationItem[] = snap.docs
        .map((d) => {
          const data = d.data() as any;
          const createdAtDate = data?.createdAt?.toDate ? data.createdAt.toDate() : null;
          return {
            id: d.id,
            actorName: data?.actorName || 'User',
            actorAvatarUrl: data?.actorAvatarUrl || '',
            type: (data?.type || 'follow') as ActivityNotificationItem['type'],
            text: data?.text || '',
            postId: data?.postId || '',
            createdAtLabel: createdAtDate ? relativeTime(createdAtDate) : 'Just now',
            createdAtMs: createdAtDate ? createdAtDate.getTime() : 0,
            read: !!data?.read,
          };
        })
        .sort((a, b) => b.createdAtMs - a.createdAtMs)
        .slice(0, 30);
      setNotifications(list);
      setNotificationsUnreadCount(list.filter((n) => !n.read).length);
    });
    return unsub;
  }, [firebaseUser]);

  // Redirect if not student
  if (role !== 'student') {
    return null;
  }

  const handleLike = (postId: string) => {
    if (!firebaseUser) return;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    const willLike = !post.isLiked;
    const ref = doc(db, 'feedPosts', postId);
    updateDoc(ref, {
      likedBy: post.isLiked ? arrayRemove(firebaseUser.uid) : arrayUnion(firebaseUser.uid),
    })
      .then(async () => {
        if (!willLike || !post.authorUid) return;
        let actorName = 'User';
        let actorAvatarUrl = '';
        try {
          const actorSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (actorSnap.exists()) {
            const actorData = actorSnap.data() as any;
            actorName = actorData.fullName || actorData.username || actorName;
            actorAvatarUrl = actorData.profilePictureUrl || '';
          }
        } catch {
          // Keep fallback actor info for notification.
        }
        await createActivityNotification({
          recipientUid: post.authorUid,
          actorUid: firebaseUser.uid,
          actorName,
          actorAvatarUrl,
          type: 'post_like',
          postId,
        });
      })
      .catch((err) => console.log('like error', err));
  };

  const handleSave = (postId: string) => {
    if (!firebaseUser) return;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    const ref = doc(db, 'feedPosts', postId);
    updateDoc(ref, {
      savedBy: post.isSaved ? arrayRemove(firebaseUser.uid) : arrayUnion(firebaseUser.uid),
    }).catch((err) => console.log('save error', err));
  };

  const handleReport = (postId: string) => {
    if (!firebaseUser) return;
    addDoc(collection(db, 'feedReports'), {
      postId,
      reporterUid: firebaseUser.uid,
      createdAt: serverTimestamp(),
    }).then(() => {
      Alert.alert('Reported', 'Post reported successfully.');
    }).catch((err) => console.log('report error', err));
  };

  const handleOpenNotifications = async () => {
    setShowNotificationsModal(true);
    if (!firebaseUser) return;
    const unread = notifications.filter((n) => !n.read);
    if (!unread.length) return;
    try {
      await Promise.all(
        unread.map((n) =>
          updateDoc(doc(db, 'activityNotifications', n.id), {
            read: true,
          })
        )
      );
    } catch (err) {
      console.log('mark notifications read error', err);
    }
  };

  const handlePublishPost = async () => {
    if (!firebaseUser) return;
    if (!newTitle.trim() || !newContent.trim()) {
      Alert.alert(t('common.error'), 'Title and content are required.');
      return;
    }
    try {
      setPublishing(true);
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};
      await addDoc(collection(db, 'feedPosts'), {
        authorUid: firebaseUser.uid,
        authorName: userData.fullName || userData.username || 'User',
        authorAvatarUrl: userData.profilePictureUrl || '',
        authorInstitution: userData.institution || '',
        type: selectedType,
        courseId: selectedCourse?.id || '',
        courseName: selectedCourse?.name || '',
        visibility,
        title: newTitle.trim(),
        content: newContent.trim(),
        tags: newTags
          .split(',')
          .map((v) => v.trim().replace(/^#/, ''))
          .filter(Boolean)
          .slice(0, 8),
        attachments,
        likedBy: [],
        savedBy: [],
        commentsCount: 0,
        createdAt: serverTimestamp(),
      });
      setNewTitle('');
      setNewContent('');
      setNewTags('');
      setSelectedType('Summary');
      setSelectedCourse(null);
      setVisibility('public');
      setAttachments([]);
      setShowCoursePicker(false);
      setShowCreateModal(false);
    } catch (err) {
      console.log('publish error:', err);
      Alert.alert(t('common.error'), 'Failed to publish post.');
    } finally {
      setPublishing(false);
    }
  };

  const handlePickAttachment = async () => {
    if (!firebaseUser) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (result.canceled) return;
      setUploadingAttachment(true);
      const uploaded: FeedAttachment[] = [];
      for (const asset of result.assets || []) {
        if (!asset.uri) continue;
        const url = await uploadFeedAttachmentToSupabase(
          asset.uri,
          firebaseUser.uid,
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
      if (!uploaded.length) {
        Alert.alert(t('common.error'), 'Failed to upload attachments.');
        return;
      }
      setAttachments((prev) => [...prev, ...uploaded].slice(0, 5));
    } catch (err) {
      console.log('pick attachment error', err);
      Alert.alert(t('common.error'), 'Failed to upload attachments.');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const renderPost = ({ item }: { item: StudyPost }) => (
    <TouchableOpacity
      style={styles.postCard}
      onPress={() => router.push(`/feed/post/${item.id}` as any)}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={styles.postHeader}>
        <TouchableOpacity
          style={styles.authorInfo}
          onPress={(e) => {
            e.stopPropagation();
            if (!item.authorUid) return;
            router.push(`/user-profile/${item.authorUid}` as any);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.avatar}>
            {item.authorAvatarUrl ? (
              <Image source={{ uri: item.authorAvatarUrl }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={20} color={PRIMARY_GREEN} />
            )}
          </View>
          <View style={styles.authorDetails}>
            <Text style={styles.authorName}>{item.authorName}</Text>
            <Text style={styles.authorInstitution}>{item.authorInstitution}</Text>
          </View>
        </TouchableOpacity>
        <View style={[styles.typeBadge, { backgroundColor: TYPE_COLORS[item.type] }]}>
          <Text style={styles.typeBadgeText}>{t(`feed.postType.${item.type.toLowerCase().replace(' ', '')}`)}</Text>
        </View>
      </View>

      {/* Course Name */}
      {item.courseName && (
        <View style={styles.courseTag}>
          <Ionicons name="book" size={14} color={PRIMARY_GREEN} />
          <Text style={styles.courseTagText}>{item.courseName}</Text>
        </View>
      )}

      {/* Title */}
      <Text style={styles.postTitle}>{item.title}</Text>

      {/* Content Preview */}
      <Text style={styles.postContent} numberOfLines={3}>
        {item.content}
      </Text>

      {/* Tags */}
      {item.tags.length > 0 && (
        <View style={styles.tagsContainer}>
          {item.tags.slice(0, 3).map((tag, idx) => (
            <View key={idx} style={styles.tag}>
              <Text style={styles.tagText}>#{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Stats and Actions */}
      <View style={styles.postFooter}>
        <View style={styles.stats}>
          <TouchableOpacity
            style={styles.statItem}
            onPress={(e) => {
              e.stopPropagation();
              handleLike(item.id);
            }}
            activeOpacity={0.75}
          >
            <Ionicons
              name={item.isLiked ? 'heart' : 'heart-outline'}
              size={18}
              color={item.isLiked ? '#ef4444' : '#6b7280'}
            />
            <Text style={styles.statText}>{item.likesCount}</Text>
          </TouchableOpacity>
          <View style={styles.statItem}>
            <Ionicons
              name="chatbubble-outline"
              size={17}
              color="#6b7280"
            />
            <Text style={styles.statText}>{item.commentsCount}</Text>
          </View>
          <TouchableOpacity
            style={styles.statItem}
            onPress={(e) => {
              e.stopPropagation();
              handleSave(item.id);
            }}
            activeOpacity={0.75}
          >
            <Ionicons
              name={item.isSaved ? 'bookmark' : 'bookmark-outline'}
              size={18}
              color={item.isSaved ? '#fbbf24' : '#6b7280'}
            />
            <Text style={styles.statText}>{item.savesCount}</Text>
          </TouchableOpacity>
          <Text style={styles.timeText}>{item.createdAt}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerSide}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="add-circle" size={24} color={PRIMARY_GREEN} />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>StudyFeed</Text>
        <View style={[styles.headerSide, styles.headerSideRight]}>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={handleOpenNotifications}
            >
              <Ionicons name="notifications-outline" size={24} color={PRIMARY_GREEN} />
              {notificationsUnreadCount > 0 && <View style={styles.headerNotificationDot} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => router.push('/chat' as any)}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={24} color={PRIMARY_GREEN} />
              {chatUnreadCount > 0 && (
                <View style={styles.chatUnreadBadge}>
                  <Text style={styles.chatUnreadBadgeText}>
                    {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Feed */}
      {loadingPosts ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>{t('common.loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.feedContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>{t('feed.noPosts')}</Text>
            </View>
          }
        />
      )}

      <Modal
        visible={showNotificationsModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowNotificationsModal(false)}
      >
        <View style={styles.notificationsScreen}>
          <View style={styles.notificationsHeader}>
            <TouchableOpacity onPress={() => setShowNotificationsModal(false)}>
              <Ionicons name="arrow-back" size={22} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.notificationsTitle}>{t('feed.notifications.title')}</Text>
            <View style={styles.notificationsHeaderSpacer} />
          </View>

          <View style={styles.notificationsTabsRow}>
            <TouchableOpacity
              style={[styles.notificationTab, notificationsFilter === 'all' && styles.notificationTabActive]}
              onPress={() => setNotificationsFilter('all')}
            >
              <Text style={[styles.notificationTabText, notificationsFilter === 'all' && styles.notificationTabTextActive]}>
                {t('feed.notifications.filters.all')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.notificationTab, notificationsFilter === 'follows' && styles.notificationTabActive]}
              onPress={() => setNotificationsFilter('follows')}
            >
              <Text style={[styles.notificationTabText, notificationsFilter === 'follows' && styles.notificationTabTextActive]}>
                {t('feed.notifications.filters.follows')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.notificationTab, notificationsFilter === 'comments' && styles.notificationTabActive]}
              onPress={() => setNotificationsFilter('comments')}
            >
              <Text style={[styles.notificationTabText, notificationsFilter === 'comments' && styles.notificationTabTextActive]}>
                {t('feed.notifications.filters.comments')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.notificationTab, notificationsFilter === 'likes' && styles.notificationTabActive]}
              onPress={() => setNotificationsFilter('likes')}
            >
              <Text style={[styles.notificationTabText, notificationsFilter === 'likes' && styles.notificationTabTextActive]}>
                {t('feed.notifications.filters.likes')}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.notificationsBody}>
            {groupedNotifications.length ? (
              groupedNotifications.map((section) => (
                <View key={section.title}>
                  <Text style={styles.notificationsSectionTitle}>{section.title}</Text>
                  {section.data.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.notificationRow}
                      onPress={() => {
                        setShowNotificationsModal(false);
                        if (item.postId) router.push(`/feed/post/${item.postId}` as any);
                      }}
                      activeOpacity={0.78}
                    >
                      <View style={styles.notificationAvatarWrap}>
                        {item.actorAvatarUrl ? (
                          <Image source={{ uri: item.actorAvatarUrl }} style={styles.notificationAvatar} />
                        ) : (
                          <Ionicons name="person" size={14} color={PRIMARY_GREEN} />
                        )}
                      </View>
                      <View style={styles.notificationTextWrap}>
                        <Text style={styles.notificationText} numberOfLines={2}>
                          {notificationText(item)}
                        </Text>
                        {!!item.text && item.type === 'post_comment' && (
                          <Text style={styles.notificationSubText} numberOfLines={1}>
                            &quot;{item.text}&quot;
                          </Text>
                        )}
                      </View>
                      <View style={styles.notificationMeta}>
                        <Text style={styles.notificationTime}>{item.createdAtLabel}</Text>
                        {!item.read && <View style={styles.notificationUnreadDot} />}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ))
            ) : (
              <Text style={styles.notificationsEmpty}>{t('feed.notifications.empty')}</Text>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Create Post Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('feed.createPost')}</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.label}>{t('feed.course')} ({t('common.optional')})</Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => setShowCoursePicker((prev) => !prev)}
                activeOpacity={0.8}
              >
                <Text style={selectedCourse ? styles.inputValue : styles.inputPlaceholder}>
                  {selectedCourse?.name || t('feed.selectCourse')}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#6b7280" />
              </TouchableOpacity>
              {showCoursePicker && (
                <View style={styles.pickerList}>
                  <TouchableOpacity
                    style={styles.pickerItem}
                    onPress={() => {
                      setSelectedCourse(null);
                      setShowCoursePicker(false);
                    }}
                  >
                    <Text style={styles.pickerItemText}>{t('feed.selectCourse')}</Text>
                  </TouchableOpacity>
                  {courses.map((course) => (
                    <TouchableOpacity
                      key={course.id}
                      style={styles.pickerItem}
                      onPress={() => {
                        setSelectedCourse(course);
                        setShowCoursePicker(false);
                      }}
                    >
                      <Text style={styles.pickerItemText}>{course.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={styles.label}>{t('feed.titleLabel')} *</Text>
              <TextInput
                style={styles.textInput}
                placeholder={t('feed.titlePlaceholder')}
                placeholderTextColor="#9ca3af"
                selectionColor={PRIMARY_GREEN}
                cursorColor={PRIMARY_GREEN}
                value={newTitle}
                onChangeText={setNewTitle}
              />

              <Text style={styles.label}>{t('feed.contentLabel')} *</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder={t('feed.contentPlaceholder')}
                placeholderTextColor="#9ca3af"
                selectionColor={PRIMARY_GREEN}
                cursorColor={PRIMARY_GREEN}
                multiline
                numberOfLines={6}
                value={newContent}
                onChangeText={setNewContent}
              />

              <Text style={styles.label}>{t('feed.postTypeLabel')} *</Text>
              <View style={styles.typeOptions}>
                {(['Summary', 'Tip', 'Question', 'Exam Info'] as StudyPost['type'][]).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeOption, selectedType === type && styles.typeOptionActive]}
                    onPress={() => setSelectedType(type)}
                  >
                    <Text style={[styles.typeOptionText, selectedType === type && styles.typeOptionTextActive]}>
                      {t(`feed.postType.${type.toLowerCase().replace(' ', '')}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>{t('feed.tags')} ({t('common.optional')})</Text>
              <TextInput
                style={styles.textInput}
                placeholder={t('feed.tagsPlaceholder')}
                placeholderTextColor="#9ca3af"
                selectionColor={PRIMARY_GREEN}
                cursorColor={PRIMARY_GREEN}
                value={newTags}
                onChangeText={setNewTags}
              />

              <Text style={styles.label}>{t('feed.visibility')}</Text>
              <View style={styles.visibilityOptions}>
                <TouchableOpacity
                  style={[styles.visibilityOption, visibility === 'public' && styles.visibilityOptionActive]}
                  onPress={() => setVisibility('public')}
                >
                  <Ionicons name="globe" size={20} color={visibility === 'public' ? PRIMARY_GREEN : '#6b7280'} />
                  <Text
                    style={[
                      styles.visibilityOptionText,
                      visibility !== 'public' && styles.visibilityOptionTextInactive
                    ]}
                  >
                    {t('feed.public')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.visibilityOption, visibility === 'institution' && styles.visibilityOptionActive]}
                  onPress={() => setVisibility('institution')}
                >
                  <Ionicons
                    name="school"
                    size={20}
                    color={visibility === 'institution' ? PRIMARY_GREEN : '#6b7280'}
                  />
                  <Text
                    style={[
                      styles.visibilityOptionText,
                      visibility !== 'institution' && styles.visibilityOptionTextInactive
                    ]}
                  >
                    {t('feed.institutionOnly')}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Attachments ({t('common.optional')})</Text>
              <TouchableOpacity
                style={styles.attachButton}
                onPress={handlePickAttachment}
                disabled={uploadingAttachment}
              >
                {uploadingAttachment ? (
                  <ActivityIndicator size="small" color={PRIMARY_GREEN} />
                ) : (
                  <Ionicons name="attach" size={18} color={PRIMARY_GREEN} />
                )}
                <Text style={styles.attachButtonText}>
                  {uploadingAttachment ? 'Uploading...' : 'Add Attachment'}
                </Text>
              </TouchableOpacity>
              {attachments.length > 0 && (
                <View style={styles.attachmentsList}>
                  {attachments.map((file, idx) => (
                    <View key={`${file.url}-${idx}`} style={styles.attachmentChip}>
                      <Text style={styles.attachmentChipText} numberOfLines={1}>
                        {file.name}
                      </Text>
                      <TouchableOpacity
                        onPress={() =>
                          setAttachments((prev) => prev.filter((_, i) => i !== idx))
                        }
                      >
                        <Ionicons name="close-circle" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={[styles.publishButton, publishing && styles.publishButtonDisabled]}
                onPress={handlePublishPost}
                disabled={publishing}
              >
                <Text style={styles.publishButtonText}>{t('feed.publishPost')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerSide: {
    width: 108,
  },
  headerSideRight: {
    alignItems: 'flex-end',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    fontStyle: 'italic',
    letterSpacing: 0.2,
    color: '#111827',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    padding: 4,
    position: 'relative',
  },
  headerNotificationDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#ef4444',
  },
  chatUnreadBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  chatUnreadBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  feedContent: {
    padding: 16,
    paddingBottom: 100,
  },
  postCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  authorDetails: {
    flex: 1,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  authorInstitution: {
    fontSize: 12,
    color: '#6b7280',
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  courseTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 12,
  },
  courseTagText: {
    fontSize: 12,
    fontWeight: '500',
    color: PRIMARY_GREEN,
    marginLeft: 4,
  },
  postTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  postContent: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
    marginBottom: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  tag: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
    color: '#6b7280',
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  timeText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  notificationsScreen: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingTop: 58,
  },
  notificationsTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 10,
  },
  notificationTab: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  notificationTabActive: {
    backgroundColor: '#dbeafe',
  },
  notificationTabText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  notificationTabTextActive: {
    color: '#1d4ed8',
  },
  notificationsBody: {
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  notificationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    marginBottom: 10,
  },
  notificationsHeaderSpacer: {
    width: 22,
  },
  notificationsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  notificationsSectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginTop: 14,
    marginBottom: 8,
  },
  notificationsEmpty: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 28,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f9fafb',
  },
  notificationAvatarWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f3f4f6',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 17,
  },
  notificationTextWrap: {
    flex: 1,
  },
  notificationText: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '600',
  },
  notificationSubText: {
    marginTop: 2,
    color: '#6b7280',
    fontSize: 12,
  },
  notificationMeta: {
    alignItems: 'flex-end',
    minWidth: 40,
    gap: 5,
  },
  notificationTime: {
    color: '#9ca3af',
    fontSize: 11,
  },
  notificationUnreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  // Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingTop: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalBody: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputPlaceholder: {
    fontSize: 14,
    color: '#9ca3af',
  },
  inputValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  pickerList: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  pickerItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  pickerItemText: {
    fontSize: 14,
    color: '#111827',
  },
  textInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  typeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  typeOptionActive: {
    backgroundColor: '#ecfdf5',
    borderColor: PRIMARY_GREEN,
  },
  typeOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
  },
  typeOptionTextActive: {
    color: PRIMARY_GREEN,
    fontWeight: '700',
  },
  visibilityOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  visibilityOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  visibilityOptionActive: {
    backgroundColor: '#f0fdf4',
    borderColor: PRIMARY_GREEN,
  },
  visibilityOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: PRIMARY_GREEN,
  },
  visibilityOptionTextInactive: {
    color: '#6b7280',
  },
  attachButton: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#d1fae5',
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    paddingVertical: 12,
  },
  attachButtonText: {
    color: PRIMARY_GREEN,
    fontSize: 14,
    fontWeight: '600',
  },
  attachmentsList: {
    marginTop: 10,
    gap: 8,
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
    gap: 8,
  },
  attachmentChipText: {
    flex: 1,
    color: '#374151',
    fontSize: 13,
  },
  publishButton: {
    backgroundColor: PRIMARY_GREEN,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  publishButtonDisabled: {
    opacity: 0.6,
  },
  publishButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
});

