// app/feed/saved.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { auth, db } from '@/lib/firebaseConfig';
import { arrayRemove, collection, doc, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const PRIMARY_GREEN = '#047857';

type StudyPost = {
  id: string;
  authorName: string;
  authorInstitution: string;
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
  const [savedPosts, setSavedPosts] = useState<StudyPost[]>([]);
  const [loading, setLoading] = useState(true);

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
      (snap) => {
        const list: StudyPost[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          const likedBy: string[] = data.likedBy || [];
          const savedBy: string[] = data.savedBy || [];
          list.push({
            id: d.id,
            authorName: data.authorName || 'User',
            authorInstitution: data.authorInstitution || '',
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
      style={styles.postCard}
      onPress={() => router.push(`/feed/post/${item.id}` as any)}
      activeOpacity={0.7}
    >
      <View style={styles.postHeader}>
        <View style={styles.authorInfo}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={20} color={PRIMARY_GREEN} />
          </View>
          <View style={styles.authorDetails}>
            <Text style={styles.authorName}>{item.authorName}</Text>
            <Text style={styles.authorInstitution}>{item.authorInstitution}</Text>
          </View>
        </View>
        <View style={[styles.typeBadge, { backgroundColor: TYPE_COLORS[item.type] }]}>
          <Text style={styles.typeBadgeText}>{item.type}</Text>
        </View>
      </View>

      {item.courseName && (
        <View style={styles.courseTag}>
          <Ionicons name="book" size={14} color={PRIMARY_GREEN} />
          <Text style={styles.courseTagText}>{item.courseName}</Text>
        </View>
      )}

      <Text style={styles.postTitle}>{item.title}</Text>
      <Text style={styles.postContent} numberOfLines={3}>
        {item.content}
      </Text>

      {item.tags.length > 0 && (
        <View style={styles.tagsContainer}>
          {item.tags.slice(0, 3).map((tag, idx) => (
            <View key={idx} style={styles.tag}>
              <Text style={styles.tagText}>#{tag}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.postFooter}>
        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Ionicons
              name={item.isLiked ? 'heart' : 'heart-outline'}
              size={18}
              color={item.isLiked ? '#ef4444' : '#6b7280'}
            />
            <Text style={styles.statText}>{item.likesCount}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons name="bookmark" size={18} color={PRIMARY_GREEN} />
            <Text style={styles.statText}>{item.savesCount}</Text>
          </View>
          <Text style={styles.timeText}>{item.createdAt}</Text>
        </View>
        <TouchableOpacity
          style={styles.unsaveButton}
          onPress={(e) => {
            e.stopPropagation();
            handleUnsave(item.id);
          }}
        >
          <Ionicons name="bookmark" size={20} color={PRIMARY_GREEN} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saved Posts</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateTitle}>Loading...</Text>
        </View>
      ) : savedPosts.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="bookmark-outline" size={64} color="#9ca3af" />
          <Text style={styles.emptyStateTitle}>No Saved Posts</Text>
          <Text style={styles.emptyStateText}>
            Posts you save will appear here
          </Text>
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
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
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
  unsaveButton: {
    padding: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});

