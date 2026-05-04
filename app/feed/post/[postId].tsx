// app/feed/post/[postId].tsx
import { useUser } from '@/lib/UserContext';
import { db } from '@/lib/firebaseConfig';
import { createActivityNotification } from '@/lib/notificationService';
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
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const PRIMARY_GREEN = '#047857';

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

const TYPE_COLORS: Record<StudyPost['type'], string> = {
  Summary: '#3b82f6',
  Tip: '#f59e0b',
  Question: '#8b5cf6',
  'Exam Info': '#ef4444',
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
  const { t } = useTranslation();
  const { firebaseUser } = useUser();
  const { postId } = useLocalSearchParams<{ postId: string | string[] }>();
  const [post, setPost] = useState<StudyPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const commentInputRef = useRef<TextInput | null>(null);

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
        const likedBy: string[] = data.likedBy || [];
        const savedBy: string[] = data.savedBy || [];
        let authorAvatarUrl = data.authorAvatarUrl || '';
        if (!authorAvatarUrl && data.authorUid) {
          try {
            const authorSnap = await getDoc(doc(db, 'users', data.authorUid));
            if (authorSnap.exists()) {
              const authorData = authorSnap.data() as any;
              authorAvatarUrl = authorData?.profilePictureUrl || '';
            }
          } catch {
            // Keep icon fallback if user lookup fails.
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
          actorName,
          actorAvatarUrl,
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
      <View style={[styles.container, styles.center]}>
        <Text style={styles.stateText}>{t('common.loading')}</Text>
      </View>
    );
  }

  if (!post) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.stateText}>{t('feed.noPosts')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post Details</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleReport}>
            <Ionicons name="flag-outline" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Author Info */}
        <View style={styles.authorSection}>
          <TouchableOpacity
            style={styles.authorPressable}
            onPress={() => {
              if (!post.authorUid) return;
              router.push(`/user-profile/${post.authorUid}` as any);
            }}
            activeOpacity={0.75}
          >
            <View style={styles.avatar}>
              {post.authorAvatarUrl ? (
                <Image source={{ uri: post.authorAvatarUrl }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={24} color={PRIMARY_GREEN} />
              )}
            </View>
            <View style={styles.authorInfo}>
              <Text style={styles.authorName}>{post.authorName}</Text>
              <Text style={styles.authorInstitution}>{post.authorInstitution}</Text>
            </View>
          </TouchableOpacity>
          <View style={[styles.typeBadge, { backgroundColor: TYPE_COLORS[post.type] }]}>
            <Text style={styles.typeBadgeText}>{post.type}</Text>
          </View>
        </View>

        {/* Course Name */}
        {post.courseName && (
          <View style={styles.courseTag}>
            <Ionicons name="book" size={16} color={PRIMARY_GREEN} />
            <Text style={styles.courseTagText}>{post.courseName}</Text>
          </View>
        )}

        {/* Title */}
        <Text style={styles.title}>{post.title}</Text>

        {/* Full Content */}
        <Text style={styles.contentText}>{post.content}</Text>

        {/* Tags */}
        {post.tags.length > 0 && (
          <View style={styles.tagsSection}>
            <Text style={styles.sectionTitle}>Tags</Text>
            <View style={styles.tagsContainer}>
              {post.tags.map((tag, idx) => (
                <View key={idx} style={styles.tag}>
                  <Text style={styles.tagText}>#{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Attachments */}
        {post.attachments && post.attachments.length > 0 && (
          <View style={styles.attachmentsSection}>
            <Text style={styles.sectionTitle}>Attachments</Text>
            {post.attachments.map((file, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.attachmentItem}
                onPress={() => {
                  if (!file?.url) return;
                  Linking.openURL(file.url).catch(() => {
                    Alert.alert(t('common.error'), 'Could not open attachment.');
                  });
                }}
              >
                <Ionicons name="document" size={20} color={PRIMARY_GREEN} />
                <Text style={styles.attachmentText}>{file?.name || 'attachment'}</Text>
                <Ionicons name="download-outline" size={20} color="#6b7280" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsSection}>
          <TouchableOpacity style={styles.statItem} onPress={handleLike} activeOpacity={0.75}>
            <Ionicons
              name={post.isLiked ? 'heart' : 'heart-outline'}
              size={20}
              color={post.isLiked ? '#ef4444' : '#6b7280'}
            />
            <Text style={styles.statText}>{post.likesCount} likes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.statItem}
            onPress={() => commentInputRef.current?.focus()}
            activeOpacity={0.75}
          >
            <Ionicons
              name="chatbubble-outline"
              size={20}
              color="#6b7280"
            />
            <Text style={styles.statText}>{post.commentsCount} comments</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statItem} onPress={handleSave} activeOpacity={0.75}>
            <Ionicons
              name={post.isSaved ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={post.isSaved ? PRIMARY_GREEN : '#6b7280'}
            />
            <Text style={styles.statText}>{post.savesCount} saves</Text>
          </TouchableOpacity>
          <Text style={styles.timeText}>{post.createdAt}</Text>
        </View>

        <View style={styles.commentsSection}>
          <Text style={styles.sectionTitle}>Comments</Text>
          <View style={styles.commentInputRow}>
            <TextInput
              ref={commentInputRef}
              style={styles.commentInput}
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Write a comment..."
              placeholderTextColor="#9ca3af"
              multiline
            />
            <TouchableOpacity
              style={[styles.commentSendButton, (!commentText.trim() || sendingComment) && styles.commentSendButtonDisabled]}
              onPress={handleAddComment}
              disabled={!commentText.trim() || sendingComment}
            >
              <Ionicons name="send" size={16} color="#ffffff" />
            </TouchableOpacity>
          </View>

          {loadingComments ? (
            <Text style={styles.commentsStateText}>Loading comments...</Text>
          ) : comments.length ? (
            <View style={styles.commentsList}>
              {comments.map((comment) => (
                <TouchableOpacity
                  key={comment.id}
                  style={styles.commentItem}
                  activeOpacity={0.92}
                  onLongPress={() => handleDeleteComment(comment)}
                  delayLongPress={300}
                >
                  <View style={styles.commentAvatar}>
                    {comment.authorAvatarUrl ? (
                      <Image source={{ uri: comment.authorAvatarUrl }} style={styles.commentAvatarImage} />
                    ) : (
                      <Ionicons name="person" size={14} color={PRIMARY_GREEN} />
                    )}
                  </View>
                  <View style={styles.commentBody}>
                    <View style={styles.commentHeader}>
                      <Text style={styles.commentAuthor}>{comment.authorName}</Text>
                      <Text style={styles.commentTime}>{comment.createdAtLabel}</Text>
                    </View>
                    <Text style={styles.commentText}>{comment.text}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.commentLikeButton}
                    onPress={() => handleToggleCommentLike(comment)}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name={comment.isLiked ? 'heart' : 'heart-outline'}
                      size={16}
                      color={comment.isLiked ? '#ef4444' : '#6b7280'}
                    />
                    <Text style={[styles.commentLikeText, comment.isLiked && styles.commentLikeTextActive]}>
                      {comment.likesCount}
                    </Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.commentsStateText}>No comments yet.</Text>
          )}
        </View>
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  stateText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  authorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#ffffff',
    marginBottom: 12,
  },
  authorPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  authorInstitution: {
    fontSize: 13,
    color: '#6b7280',
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  courseTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  courseTagText: {
    fontSize: 13,
    fontWeight: '500',
    color: PRIMARY_GREEN,
    marginLeft: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginHorizontal: 20,
    marginBottom: 16,
  },
  contentText: {
    fontSize: 15,
    color: '#4b5563',
    lineHeight: 24,
    marginHorizontal: 20,
    marginBottom: 24,
  },
  tagsSection: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 13,
    color: '#6b7280',
  },
  attachmentsSection: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  attachmentText: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    marginLeft: 12,
  },
  statsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 20,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  timeText: {
    fontSize: 13,
    color: '#9ca3af',
    marginLeft: 'auto',
  },
  commentsSection: {
    marginHorizontal: 20,
    marginBottom: 28,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    marginBottom: 14,
  },
  commentInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 96,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
    fontSize: 14,
  },
  commentSendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PRIMARY_GREEN,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentSendButtonDisabled: {
    opacity: 0.45,
  },
  commentsStateText: {
    color: '#6b7280',
    fontSize: 13,
  },
  commentsList: {
    gap: 10,
  },
  commentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 10,
  },
  commentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  commentBody: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 4,
    gap: 6,
  },
  commentAuthor: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '700',
  },
  commentTime: {
    color: '#9ca3af',
    fontSize: 11,
  },
  commentText: {
    color: '#374151',
    fontSize: 13,
    lineHeight: 18,
  },
  commentLikeButton: {
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 22,
    gap: 2,
  },
  commentLikeText: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '600',
  },
  commentLikeTextActive: {
    color: '#ef4444',
  },
});

