// app/feed/saved.tsx
import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppHeader } from '@/frontend/components/ui/AppHeader';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { layout, spacing } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { auth, db } from '@/lib/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { arrayRemove, collection, doc, getDoc, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  I18nManager,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from 'react-native';

type StudyPost = {
  id: string;
  authorUid?: string;
  authorName: string;
  authorInstitution: string;
  authorAvatarUrl?: string;
  courseName?: string;
  type: 'Summary' | 'Tip' | 'Question' | 'Exam Info';
  title: string;
  content: string;
  tags: string[];
  likesCount: number;
  savesCount: number;
  createdAt: string;
  isLiked?: boolean;
  isSaved?: boolean;
};

const TYPE_COLORS: Record<StudyPost['type'], string> = {
  Summary: '#3b82f6',
  Tip: '#f59e0b',
  Question: '#8b5cf6',
  'Exam Info': '#ef4444',
};

export default function SavedPostsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const isRtl = I18nManager.isRTL;
  const [savedPosts, setSavedPosts] = useState<StudyPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorAvatarMap, setAuthorAvatarMap] = useState<Record<string, string>>({});

  const relativeTime = (date: Date): string => {
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, 'feedPosts'),
      where('savedBy', 'array-contains', currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      async (snap) => {
        const list: StudyPost[] = [];
        const authorUids = new Set<string>();
        snap.forEach((d) => {
          const data = d.data() as any;
          const likedBy: string[] = data.likedBy || [];
          const savedBy: string[] = data.savedBy || [];
          const authorUid = String(data.authorUid || data.userId || '').trim();
          if (authorUid) authorUids.add(authorUid);
          const directAvatar = String(
            data.authorAvatarUrl ||
              data.avatarUrl ||
              data.photoURL ||
              data.profileImage ||
              data.userAvatarUrl ||
              ''
          );
          list.push({
            id: d.id,
            authorUid: authorUid || undefined,
            authorName: data.authorName || 'User',
            authorInstitution: data.authorInstitution || '',
            authorAvatarUrl: directAvatar || undefined,
            courseName: data.courseName || '',
            type: (data.type || 'Summary') as StudyPost['type'],
            title: data.title || '',
            content: data.content || '',
            tags: data.tags || [],
            likesCount: likedBy.length,
            savesCount: savedBy.length,
            createdAt: data.createdAt?.toDate ? relativeTime(data.createdAt.toDate()) : 'Just now',
            isLiked: likedBy.includes(currentUser.uid),
            isSaved: savedBy.includes(currentUser.uid),
          });
        });
        if (authorUids.size > 0) {
          const fetchedEntries = await Promise.all(
            Array.from(authorUids).map(async (uid) => {
              try {
                const userSnap = await getDoc(doc(db, 'users', uid));
                if (!userSnap.exists()) return [uid, ''] as const;
                const userData = userSnap.data() as any;
                const avatar = String(
                  userData.profilePictureUrl ||
                    userData.profileImageUrl ||
                    userData.photoURL ||
                    userData.avatarUrl ||
                    userData.authorAvatarUrl ||
                    userData.profileImage ||
                    userData.userAvatarUrl ||
                    ''
                ).trim();
                return [uid, avatar] as const;
              } catch {
                return [uid, ''] as const;
              }
            })
          );
          const updates: Record<string, string> = {};
          fetchedEntries.forEach(([uid, avatar]) => {
            updates[uid] = avatar;
          });
          setAuthorAvatarMap((prev) => {
            const next = { ...prev };
            Object.entries(updates).forEach(([uid, avatar]) => {
              next[uid] = avatar;
            });
            return next;
          });
        } else {
          setAuthorAvatarMap({});
        }
        setSavedPosts(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, []);

  const handleUnsave = (postId: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    updateDoc(doc(db, 'feedPosts', postId), {
      savedBy: arrayRemove(currentUser.uid),
    }).catch((err) => console.log('unsave error', err));
  };

  const renderPost = ({ item }: { item: StudyPost }) => (
    <TouchableOpacity
      style={[
        styles.postCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
      onPress={() => router.push(`/feed/post/${item.id}` as any)}
      activeOpacity={0.7}
    >
      <View style={styles.postHeader}>
      <View style={styles.authorInfo}>
        <View style={[styles.avatar, { backgroundColor: colors.surfaceElevated }]}>
          {(() => {
            const uid = item.authorUid;
            const inMap = uid && Object.prototype.hasOwnProperty.call(authorAvatarMap, uid);
            const displayUri = inMap ? authorAvatarMap[uid!] : item.authorAvatarUrl || '';
            return displayUri ? (
              <Image source={{ uri: displayUri }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={20} color={colors.primary} />
            );
          })()}
        </View>
          <View style={styles.authorDetails}>
            <Text style={[styles.authorName, { color: colors.textPrimary }]}>{item.authorName}</Text>
            <Text style={[styles.authorInstitution, { color: colors.textSecondary }]}>{item.authorInstitution}</Text>
          </View>
        </View>
        <View style={[styles.typeBadge, { backgroundColor: TYPE_COLORS[item.type] }]}>
          <Text style={styles.typeBadgeText}>{item.type}</Text>
        </View>
      </View>

      {item.courseName && (
        <View style={[styles.courseTag, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Ionicons name="book" size={14} color={colors.primary} />
          <Text style={[styles.courseTagText, { color: colors.primary }]}>{item.courseName}</Text>
        </View>
      )}

      <Text style={[styles.postTitle, { color: colors.textPrimary }]}>{item.title}</Text>
      <Text style={[styles.postContent, { color: colors.textSecondary }]} numberOfLines={3}>
        {item.content}
      </Text>

      {item.tags.length > 0 && (
        <View style={styles.tagsContainer}>
          {item.tags.slice(0, 3).map((tag, idx) => (
            <View key={idx} style={[styles.tag, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <Text style={[styles.tagText, { color: colors.textSecondary }]}>#{tag}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={[styles.postFooter, { borderTopColor: colors.border }]}>
        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Ionicons
              name={item.isLiked ? 'heart' : 'heart-outline'}
              size={18}
              color={item.isLiked ? '#ef4444' : '#6b7280'}
            />
            <Text style={[styles.statText, { color: colors.textSecondary }]}>{item.likesCount}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="bookmark" size={18} color={colors.primary} />
            <Text style={[styles.statText, { color: colors.textSecondary }]}>{item.savesCount}</Text>
          </View>
          <Text style={[styles.timeText, { color: colors.textSecondary }]}>{item.createdAt}</Text>
        </View>
        <TouchableOpacity
          style={[styles.unsaveButton, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
          onPress={(e) => {
            e.stopPropagation();
            handleUnsave(item.id);
          }}
        >
          <Ionicons name="bookmark" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <AppScreen>
      <AppHeader title={t('feed.savedPosts')} onBack={() => router.back()} />
      <View style={[styles.topDecorWrap, { borderBottomColor: colors.border }]}>
        <View style={[styles.topDecorPrimary, { backgroundColor: colors.primary }]} />
        <View style={[styles.topDecorAccent, { backgroundColor: colors.accent }]} />
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyStateTitle, { color: colors.textPrimary }]}>{t('common.loading')}</Text>
        </View>
      ) : savedPosts.length === 0 ? (
        <View style={styles.emptyState}>
          <AppCard style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="bookmark-outline" size={56} color={colors.textSecondary} />
            <Text style={[styles.emptyStateTitle, { color: colors.textPrimary }]}>{t('search.noResults')}</Text>
            <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>{t('feed.savedPosts')}</Text>
          </AppCard>
        </View>
      ) : (
        <FlatList
          data={savedPosts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.feedContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  feedContent: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.xs,
    paddingBottom: 100,
    gap: spacing.sm,
  },
  postCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
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
    gap: 10,
    marginBottom: 10,
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
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  authorDetails: {
    flex: 1,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  authorInstitution: {
    fontSize: 12,
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
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 12,
  },
  courseTagText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  postTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
  },
  postContent: {
    fontSize: 14,
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
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
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
    fontWeight: '500',
  },
  timeText: {
    fontSize: 12,
  },
  unsaveButton: {
    padding: 6,
    borderWidth: 1,
    borderRadius: 10,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: layout.screenPadding,
  },
  emptyCard: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
  },
});

