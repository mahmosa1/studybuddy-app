// app/feed/post/[postId].tsx
import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppHeader } from '@/frontend/components/ui/AppHeader';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { layout, radius, spacing } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { useUser } from '@/lib/UserContext';
import { db } from '@/lib/firebaseConfig';
import { formatAuthorInstitutionLabel } from '@/lib/institutionUtils';
import { attachmentLooksLikeImage } from '@/lib/feedAttachmentUtils';
import { createActivityNotification } from '@/lib/notificationService';
import { pushAttachmentViewer } from '@/lib/openAttachmentViewer';
import { Ionicons } from '@expo/vector-icons';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type KeyboardEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  isLiked: boolean;
  isSaved: boolean;
  visibility?: 'public' | 'institution' | 'followers';
};

type PostComment = {
  id: string;
  authorName: string;
  authorUid: string;
  authorAvatarUrl?: string;
  text: string;
  createdAtLabel: string;
  likesCount: number;
  isLiked: boolean;
};

const relativeTime = (date: Date): string => {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export default function StudyPostDetailsScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors, mode } = useAppTheme();
  const isHebrewUi = i18n.language === 'he';
  const { firebaseUser } = useUser();
  const insets = useSafeAreaInsets();
  const { postId } = useLocalSearchParams<{ postId: string | string[] }>();
  const [post, setPost] = useState<StudyPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentAvatarByUid, setCommentAvatarByUid] = useState<Record<string, string>>({});
  const [loadingComments, setLoadingComments] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  /** Lifts the comment bar above the keyboard (single source of truth — avoids double shift with KeyboardAvoidingView). */
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const commentInputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: KeyboardEvent) => {
      setKeyboardHeight(Math.max(0, e.endCoordinates?.height ?? 0));
    };
    const onHide = () => setKeyboardHeight(0);
    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  const typeBadgeBorder = (type: StudyPost['type']) => {
    switch (type) {
      case 'Summary':
        return colors.primary;
      case 'Tip':
        return colors.warning;
      case 'Question':
        return colors.accent;
      case 'Exam Info':
        return colors.danger;
      default:
        return colors.border;
    }
  };

  const resolvedPostId = useMemo(
    () => (Array.isArray(postId) ? postId[0] : postId),
    [postId]
  );

  useEffect(() => {
    const loadPost = async () => {
      if (!resolvedPostId) {
        setLoading(false);
        return;
      }
      try {
        const postRef = doc(db, 'feedPosts', resolvedPostId);
        const snap = await getDoc(postRef);
        if (!snap.exists()) {
          setPost(null);
          return;
        }
        const data = snap.data() as any;
        const visRaw = String(data.visibility || 'public').toLowerCase();
        const postVisibility =
          visRaw === 'institution' || visRaw === 'followers' || visRaw === 'public' ? visRaw : 'public';

        if (postVisibility === 'followers') {
          if (!firebaseUser) {
            setPost(null);
            return;
          }
          const authorUid = String(data.authorUid || '').trim();
          if (authorUid && authorUid !== firebaseUser.uid) {
            const followRef = doc(db, 'follows', `${firebaseUser.uid}_${authorUid}`);
            const followSnap = await getDoc(followRef);
            if (!followSnap.exists()) {
              setPost(null);
              return;
            }
          }
        }

        const likedBy: string[] = data.likedBy || [];
        const savedBy: string[] = data.savedBy || [];
        let authorAvatarUrl = String(data.authorAvatarUrl || '').trim();
        if (data.authorUid) {
          try {
            const authorSnap = await getDoc(doc(db, 'users', data.authorUid));
            if (authorSnap.exists()) {
              const authorData = authorSnap.data() as any;
              const fromProfile = String(
                authorData?.profilePictureUrl ||
                  authorData?.profileImageUrl ||
                  authorData?.photoURL ||
                  authorData?.avatarUrl ||
                  ''
              ).trim();
              authorAvatarUrl = fromProfile || undefined;
            }
          } catch {
            // Keep denormalized post avatar if user lookup fails.
          }
        }
        setPost({
          id: snap.id,
          authorUid: data.authorUid || '',
          authorName: data.authorName || 'User',
          authorAvatarUrl,
          authorInstitution: data.authorInstitution || '',
          courseName: data.courseName || '',
          type: (data.type || 'Summary') as StudyPost['type'],
          title: data.title || '',
          content: data.content || '',
          tags: data.tags || [],
          attachments: Array.isArray(data.attachments) ? data.attachments : [],
          likesCount: likedBy.length,
          commentsCount: Number(data.commentsCount || 0),
          savesCount: savedBy.length,
          createdAt: data.createdAt?.toDate ? relativeTime(data.createdAt.toDate()) : 'Just now',
          isLiked: firebaseUser ? likedBy.includes(firebaseUser.uid) : false,
          isSaved: firebaseUser ? savedBy.includes(firebaseUser.uid) : false,
          visibility: postVisibility as 'public' | 'institution' | 'followers',
        });
      } catch (err) {
        console.log('post details load error', err);
      } finally {
        setLoading(false);
      }
    };
    loadPost();
  }, [firebaseUser, resolvedPostId]);

  useEffect(() => {
    if (!resolvedPostId) return;
    setLoadingComments(true);
    const commentsQuery = query(
      collection(db, 'feedPosts', resolvedPostId, 'comments'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(
      commentsQuery,
      (snap) => {
        const list: PostComment[] = snap.docs.map((d) => {
          const data = d.data() as any;
          const createdAtDate = data.createdAt?.toDate ? data.createdAt.toDate() : null;
          return {
            id: d.id,
            authorName: data.authorName || 'User',
            authorUid: data.authorUid || '',
            authorAvatarUrl: data.authorAvatarUrl || '',
            text: data.text || '',
            createdAtLabel: createdAtDate ? relativeTime(createdAtDate) : 'Just now',
            likesCount: Array.isArray(data.likedBy) ? data.likedBy.length : 0,
            isLiked: firebaseUser ? (data.likedBy || []).includes(firebaseUser.uid) : false,
          };
        });
        setComments(list);
        setLoadingComments(false);
      },
      () => setLoadingComments(false)
    );
    return unsub;
  }, [resolvedPostId, firebaseUser]);

  useEffect(() => {
    const uids = [...new Set(comments.map((c) => String(c.authorUid || '').trim()).filter(Boolean))];
    if (!uids.length) {
      setCommentAvatarByUid({});
      return;
    }
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      await Promise.all(
        uids.map(async (uid) => {
          try {
            const userSnap = await getDoc(doc(db, 'users', uid));
            if (userSnap.exists()) {
              const ud = userSnap.data() as any;
              next[uid] = String(
                ud?.profilePictureUrl ||
                  ud?.profileImageUrl ||
                  ud?.photoURL ||
                  ud?.avatarUrl ||
                  ''
              ).trim();
            }
          } catch {
            // skip uid
          }
        })
      );
      if (!cancelled) setCommentAvatarByUid(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [comments]);

  const handleLike = async () => {
    if (!firebaseUser || !post) return;
    const currentlyLiked = post.isLiked;
    setPost((prev) =>
      prev
        ? {
            ...prev,
            isLiked: !currentlyLiked,
            likesCount: currentlyLiked ? Math.max(0, prev.likesCount - 1) : prev.likesCount + 1,
          }
        : prev
    );
    try {
      await updateDoc(doc(db, 'feedPosts', post.id), {
        likedBy: currentlyLiked ? arrayRemove(firebaseUser.uid) : arrayUnion(firebaseUser.uid),
      });
      if (!currentlyLiked && post.authorUid) {
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
          postId: post.id,
        });
      }
    } catch (err) {
      console.log('like details error', err);
    }
  };

  const handleSave = async () => {
    if (!firebaseUser || !post) return;
    const currentlySaved = post.isSaved;
    setPost((prev) =>
      prev
        ? {
            ...prev,
            isSaved: !currentlySaved,
            savesCount: currentlySaved ? Math.max(0, prev.savesCount - 1) : prev.savesCount + 1,
          }
        : prev
    );
    try {
      await updateDoc(doc(db, 'feedPosts', post.id), {
        savedBy: currentlySaved ? arrayRemove(firebaseUser.uid) : arrayUnion(firebaseUser.uid),
      });
    } catch (err) {
      console.log('save details error', err);
    }
  };

  const handleReport = () => {
    if (!firebaseUser || !post) return;
    Alert.alert(t('feed.report'), 'Are you sure you want to report this post?', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('feed.report'),
        style: 'destructive',
        onPress: async () => {
          try {
            await addDoc(collection(db, 'feedReports'), {
              postId: post.id,
              reporterUid: firebaseUser.uid,
              createdAt: serverTimestamp(),
            });
            Alert.alert(t('common.success'), 'Post reported successfully.');
          } catch (err) {
            console.log('report details error', err);
          }
        },
      },
    ]);
  };

  const handleAddComment = async () => {
    if (!firebaseUser || !post) return;
    const text = commentText.trim();
    if (!text || sendingComment) return;
    setSendingComment(true);
    try {
      const currentUserSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
      const currentUserData = currentUserSnap.exists() ? (currentUserSnap.data() as any) : {};
      const authorName = currentUserData?.fullName || currentUserData?.username || 'User';
      const authorAvatarUrl = currentUserData?.profilePictureUrl || '';

      await addDoc(collection(db, 'feedPosts', post.id, 'comments'), {
        authorUid: firebaseUser.uid,
        authorName,
        authorAvatarUrl,
        text,
        likedBy: [],
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'feedPosts', post.id), {
        commentsCount: increment(1),
      });
      setPost((prev) => (prev ? { ...prev, commentsCount: prev.commentsCount + 1 } : prev));
      if (post.authorUid && post.id) {
        await createActivityNotification({
          recipientUid: post.authorUid,
          actorUid: firebaseUser.uid,
          actorName: authorName,
          actorAvatarUrl: authorAvatarUrl,
          type: 'post_comment',
          postId: post.id,
          text,
        });
      }

      setCommentText('');
    } catch (err) {
      console.log('add comment error', err);
      Alert.alert(t('common.error'), 'Failed to add comment.');
    } finally {
      setSendingComment(false);
    }
  };

  const handleToggleCommentLike = async (comment: PostComment) => {
    if (!firebaseUser || !post) return;
    const targetRef = doc(db, 'feedPosts', post.id, 'comments', comment.id);
    const currentlyLiked = comment.isLiked;

    setComments((prev) =>
      prev.map((c) =>
        c.id === comment.id
          ? {
              ...c,
              isLiked: !currentlyLiked,
              likesCount: currentlyLiked ? Math.max(0, c.likesCount - 1) : c.likesCount + 1,
            }
          : c
      )
    );

    try {
      await updateDoc(targetRef, {
        likedBy: currentlyLiked ? arrayRemove(firebaseUser.uid) : arrayUnion(firebaseUser.uid),
      });
      if (!currentlyLiked && comment.authorUid) {
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
          recipientUid: comment.authorUid,
          actorUid: firebaseUser.uid,
          actorName,
          actorAvatarUrl,
          type: 'comment_like',
          postId: post.id,
          commentId: comment.id,
        });
      }
    } catch (err) {
      console.log('toggle comment like error', err);
    }
  };

  const handleDeleteComment = (comment: PostComment) => {
    if (!firebaseUser || !post) return;
    if (comment.authorUid !== firebaseUser.uid) return;

    Alert.alert('Delete comment', 'Are you sure you want to delete this comment?', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'feedPosts', post.id, 'comments', comment.id));
            await updateDoc(doc(db, 'feedPosts', post.id), {
              commentsCount: increment(-1),
            });
            setPost((prev) =>
              prev ? { ...prev, commentsCount: Math.max(0, prev.commentsCount - 1) } : prev
            );
          } catch (err) {
            console.log('delete comment error', err);
            Alert.alert(t('common.error'), 'Failed to delete comment.');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <AppScreen>
        <AppHeader title={t('feed.postDetailsTitle')} onBack={() => router.back()} />
        <View style={[styles.topDecorWrap, { borderBottomColor: colors.border }]}>
          <View style={[styles.topDecorPrimary, { backgroundColor: colors.primary }]} />
          <View style={[styles.topDecorAccent, { backgroundColor: colors.accent }]} />
        </View>
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.stateText, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
            {t('common.loading')}
          </Text>
        </View>
      </AppScreen>
    );
  }

  if (!post) {
    return (
      <AppScreen>
        <AppHeader title={t('feed.postDetailsTitle')} onBack={() => router.back()} />
        <View style={[styles.topDecorWrap, { borderBottomColor: colors.border }]}>
          <View style={[styles.topDecorPrimary, { backgroundColor: colors.primary }]} />
          <View style={[styles.topDecorAccent, { backgroundColor: colors.accent }]} />
        </View>
        <View style={[styles.center, { flex: 1, paddingHorizontal: layout.screenPadding }]}>
          <AppCard style={{ borderColor: colors.border, paddingVertical: spacing.xl, paddingHorizontal: spacing.lg }}>
            <Text style={[styles.stateText, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
              {t('feed.noPosts')}
            </Text>
          </AppCard>
        </View>
      </AppScreen>
    );
  }

  const typeLabel = t(`feed.postType.${post.type.toLowerCase().replace(' ', '')}` as any);

  return (
    <AppScreen>
      <AppHeader
        title={t('feed.postDetailsTitle')}
        onBack={() => router.back()}
        rightSlot={
          <TouchableOpacity onPress={handleReport} accessibilityRole="button" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="flag-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        }
      />

      <View style={styles.keyboardAvoid}>
        <View style={[styles.topDecorWrap, { borderBottomColor: colors.border }]}>
          <View style={[styles.topDecorPrimary, { backgroundColor: colors.primary }]} />
          <View style={[styles.topDecorAccent, { backgroundColor: colors.accent }]} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 120 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        <AppCard style={[styles.postCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={[styles.postTopRow, isHebrewUi && styles.rtlRow]}>
            <TouchableOpacity
              style={[styles.authorBlock, isHebrewUi && styles.rtlRow]}
              onPress={() => {
                if (!post.authorUid) return;
                router.push(`/user-profile/${post.authorUid}` as any);
              }}
              activeOpacity={0.75}
            >
              <View style={[styles.avatar, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                {post.authorAvatarUrl ? (
                  <Image source={{ uri: post.authorAvatarUrl }} style={styles.avatarImage} />
                ) : (
                  <Ionicons name="person" size={22} color={colors.primary} />
                )}
              </View>
              <View style={[styles.authorTextStack, isHebrewUi && styles.rtlTextBlock]}>
                <Text style={[styles.authorName, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]} numberOfLines={1}>
                  {post.authorName}
                </Text>
                {!!post.authorInstitution ? (
                  <Text style={[styles.authorInstitution, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]} numberOfLines={1}>
                    {formatAuthorInstitutionLabel(post.authorInstitution)}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
            <View
              style={[
                styles.typeBadge,
                {
                  backgroundColor: colors.surfaceMuted,
                  borderColor: typeBadgeBorder(post.type),
                },
              ]}
            >
              <Text style={[styles.typeBadgeText, { color: colors.textPrimary }]} numberOfLines={1}>
                {typeLabel}
              </Text>
            </View>
          </View>

          {post.courseName ? (
            <View style={[styles.courseTag, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }, isHebrewUi && styles.rtlRow]}>
              <Ionicons name="book-outline" size={14} color={colors.primary} />
              <Text style={[styles.courseTagText, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]} numberOfLines={1}>
                {post.courseName}
              </Text>
            </View>
          ) : null}

          {post.visibility === 'institution' ? (
            <View
              style={[
                styles.courseTag,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.border, marginBottom: 8 },
                isHebrewUi && styles.rtlRow,
              ]}
            >
              <Ionicons name="school-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.courseTagText, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]} numberOfLines={1}>
                {t('feed.institutionOnlyBadge')}
              </Text>
            </View>
          ) : null}

          <Text style={[styles.title, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>{post.title}</Text>
          <Text style={[styles.contentText, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>{post.content}</Text>

          {post.tags.length > 0 ? (
            <View style={[styles.tagsContainer, isHebrewUi && styles.rtlRow]}>
              {post.tags.map((tag, idx) => (
                <View key={idx} style={[styles.tag, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                  <Text style={[styles.tagText, { color: colors.textSecondary }]}>#{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {post.attachments && post.attachments.length > 0 ? (
            <View style={styles.attachmentsBlock}>
              {post.attachments.map((file, idx) =>
                attachmentLooksLikeImage(file) ? (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.9}
                    onPress={() => {
                      if (!file?.url) return;
                      pushAttachmentViewer(router, {
                        url: file.url,
                        name: file.name,
                        mimeType: file.mimeType ?? undefined,
                      });
                    }}
                  >
                    <View style={[styles.attachmentImageWrap, { borderColor: colors.border }]}>
                      <Image source={{ uri: file.url }} style={styles.attachmentImage} resizeMode="cover" />
                    </View>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.attachmentItem,
                      { borderColor: colors.border, backgroundColor: colors.surfaceMuted },
                      isHebrewUi && styles.rtlRow,
                    ]}
                    onPress={() => {
                      if (!file?.url) return;
                      pushAttachmentViewer(router, {
                        url: file.url,
                        name: file.name,
                        mimeType: file.mimeType ?? undefined,
                      });
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="document-text-outline" size={20} color={colors.primary} />
                    <Text style={[styles.attachmentText, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]} numberOfLines={2}>
                      {file?.name || 'attachment'}
                    </Text>
                    <Ionicons name="open-outline" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                )
              )}
            </View>
          ) : null}

          <View style={[styles.postFooter, { borderTopColor: colors.border }, isHebrewUi && styles.rtlRow]}>
            <Text style={[styles.footerTime, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>{post.createdAt}</Text>
            <View style={styles.footerStatsRow}>
              <TouchableOpacity style={styles.statItem} onPress={handleLike} activeOpacity={0.75} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
                <Ionicons
                  name={post.isLiked ? 'heart' : 'heart-outline'}
                  size={18}
                  color={post.isLiked ? colors.danger : colors.textSecondary}
                />
                <Text style={[styles.statLine, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]} numberOfLines={1}>
                  {post.likesCount} {t('feed.likesLabel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.statItem}
                onPress={() => commentInputRef.current?.focus()}
                activeOpacity={0.75}
                hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              >
                <Ionicons name="chatbubble-outline" size={17} color={colors.textSecondary} />
                <Text style={[styles.statLine, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]} numberOfLines={1}>
                  {post.commentsCount} {t('feed.commentsLabel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.statItem} onPress={handleSave} activeOpacity={0.75} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
                <Ionicons
                  name={post.isSaved ? 'bookmark' : 'bookmark-outline'}
                  size={18}
                  color={post.isSaved ? colors.warning : colors.textSecondary}
                />
                <Text style={[styles.statLine, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]} numberOfLines={1}>
                  {post.savesCount} {t('feed.savesLabel')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </AppCard>

        <Text style={[styles.commentsSectionTitle, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
          {t('feed.commentsSection')}
        </Text>

        {loadingComments ? (
          <View style={styles.commentsLoading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.commentsStateText, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
              {t('feed.loadingComments')}
            </Text>
          </View>
        ) : comments.length ? (
          <View style={styles.commentsList}>
            {comments.map((comment) => (
              <TouchableOpacity
                key={comment.id}
                activeOpacity={0.92}
                onLongPress={() => handleDeleteComment(comment)}
                delayLongPress={300}
                style={styles.commentCardWrap}
              >
                <AppCard style={[styles.commentCard, { borderColor: colors.border }]}>
                  <View style={styles.commentRow}>
                    <View style={[styles.commentAvatar, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                      {(() => {
                        const uid = String(comment.authorUid || '').trim();
                        const inMap = uid && Object.prototype.hasOwnProperty.call(commentAvatarByUid, uid);
                        const uri = inMap ? commentAvatarByUid[uid] || undefined : comment.authorAvatarUrl;
                        return uri ? (
                          <Image source={{ uri }} style={styles.commentAvatarImage} />
                        ) : (
                          <Ionicons name="person" size={14} color={colors.primary} />
                        );
                      })()}
                    </View>
                    <View style={styles.commentMain}>
                      <View style={[styles.commentHeader, isHebrewUi && styles.rtlRow]}>
                        <Text style={[styles.commentAuthor, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]} numberOfLines={1}>
                          {comment.authorName}
                        </Text>
                        <Text style={[styles.commentTime, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
                          {comment.createdAtLabel}
                        </Text>
                      </View>
                      <Text style={[styles.commentText, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>{comment.text}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.commentLikeButton}
                      onPress={() => handleToggleCommentLike(comment)}
                      activeOpacity={0.75}
                      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                    >
                      <Ionicons
                        name={comment.isLiked ? 'heart' : 'heart-outline'}
                        size={16}
                        color={comment.isLiked ? colors.danger : colors.textSecondary}
                      />
                      <Text style={[styles.commentLikeText, { color: colors.textSecondary }, comment.isLiked && { color: colors.danger }]}>
                        {comment.likesCount}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </AppCard>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <AppCard style={[styles.emptyCommentsCard, { borderColor: colors.border }]}>
            <Ionicons name="chatbubble-ellipses-outline" size={28} color={colors.textSecondary} style={{ alignSelf: 'center' }} />
            <Text style={[styles.emptyCommentsTitle, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
              {t('feed.noCommentsYet')}
            </Text>
            <Text style={[styles.emptyCommentsSubtitle, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
              {t('feed.beFirstToComment')}
            </Text>
          </AppCard>
        )}
        </ScrollView>

        <View
          style={[
            styles.commentInputBar,
            {
              marginBottom: keyboardHeight,
              paddingBottom: Math.max(insets.bottom, spacing.sm),
              backgroundColor: colors.bg,
              borderTopColor: colors.border,
            },
          ]}
        >
            <AppCard style={[styles.composerCard, { borderColor: colors.border, marginBottom: 0 }]}>
              <View style={styles.commentInputRow}>
                <TextInput
                  ref={commentInputRef}
                  style={[
                    styles.commentInput,
                    { color: colors.textPrimary, backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                    isHebrewUi ? styles.commentInputRtl : styles.commentInputLtr,
                  ]}
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholder={t('feed.writeCommentPlaceholder')}
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  keyboardType="default"
                  keyboardAppearance={mode === 'dark' ? 'dark' : 'light'}
                  returnKeyType="default"
                  blurOnSubmit={false}
                  autoCorrect
                />
                <TouchableOpacity
                  style={[
                    styles.commentSendButton,
                    { backgroundColor: colors.primary },
                    (!commentText.trim() || sendingComment) && styles.commentSendButtonDisabled,
                  ]}
                  onPress={handleAddComment}
                  disabled={!commentText.trim() || sendingComment}
                  activeOpacity={0.85}
                >
                  {sendingComment ? (
                    <ActivityIndicator size="small" color={colors.textOnPrimary} />
                  ) : (
                    <Ionicons name="send" size={16} color={colors.textOnPrimary} />
                  )}
                </TouchableOpacity>
              </View>
            </AppCard>
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: layout.screenPadding,
    gap: spacing.sm,
  },
  stateText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  topDecorWrap: {
    position: 'relative',
    overflow: 'hidden',
    height: 26,
    marginHorizontal: layout.screenPadding,
    marginTop: -2,
    marginBottom: 2,
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
  keyboardAvoid: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  commentInputBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
    paddingHorizontal: layout.screenPadding,
  },
  postCard: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  postTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  authorBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    gap: 10,
  },
  authorTextStack: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  authorInstitution: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    maxWidth: '42%',
    flexShrink: 0,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  courseTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  courseTagText: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
    marginBottom: spacing.sm,
  },
  contentText: {
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '500',
    marginBottom: spacing.md,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.md,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  attachmentsBlock: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  attachmentImageWrap: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    maxHeight: 220,
  },
  attachmentImage: {
    width: '100%',
    height: 200,
    backgroundColor: 'transparent',
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    flexWrap: 'nowrap',
  },
  attachmentText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    minWidth: 0,
  },
  postFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  footerTime: {
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 0,
  },
  footerStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statLine: {
    fontSize: 11,
    fontWeight: '700',
  },
  commentsSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  composerCard: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  commentInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    fontWeight: '600',
  },
  commentInputLtr: {
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  commentInputRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  commentSendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentSendButtonDisabled: {
    opacity: 0.45,
  },
  commentsLoading: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  commentsStateText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  commentsList: {
    gap: spacing.sm,
  },
  commentCardWrap: {
    marginBottom: 0,
  },
  commentCard: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  commentMain: {
    flex: 1,
    minWidth: 0,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 4,
    gap: spacing.sm,
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
    minWidth: 0,
    marginEnd: spacing.xs,
  },
  commentTime: {
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 0,
  },
  commentText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  commentLikeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 28,
    gap: 2,
    paddingTop: 2,
  },
  commentLikeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyCommentsCard: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  emptyCommentsTitle: {
    marginTop: spacing.sm,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyCommentsSubtitle: {
    marginTop: spacing.xs,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  rtlRow: {
    flexDirection: 'row-reverse',
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  rtlTextBlock: {
    alignItems: 'flex-end',
  },
});

