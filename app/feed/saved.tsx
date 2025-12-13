// app/feed/saved.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
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

// Mock saved posts
const MOCK_SAVED_POSTS: StudyPost[] = [
  {
    id: '2',
    authorName: 'Michael Chen',
    authorInstitution: 'Stanford',
    courseName: 'Calculus II',
    type: 'Tip',
    title: 'Integration by Parts Trick',
    content: 'Remember LIATE: Logarithmic, Inverse trigonometric, Algebraic, Trigonometric, Exponential. Choose u in this order for easier integration by parts.',
    tags: ['calculus', 'integration', 'tips'],
    likesCount: 45,
    savesCount: 28,
    createdAt: '5 hours ago',
    isLiked: true,
    isSaved: true,
  },
  {
    id: '4',
    authorName: 'David Lee',
    authorInstitution: 'UC Berkeley',
    courseName: 'Computer Networks',
    type: 'Exam Info',
    title: 'Midterm Exam Schedule',
    content: 'The midterm exam will cover chapters 1-5. Focus on OSI model, TCP/IP protocol stack, and routing algorithms. Practice problems will be similar to homework assignments.',
    tags: ['networks', 'exam', 'midterm'],
    likesCount: 32,
    savesCount: 41,
    createdAt: '2 days ago',
    isLiked: false,
    isSaved: true,
  },
];

const TYPE_COLORS: Record<StudyPost['type'], string> = {
  Summary: '#3b82f6',
  Tip: '#f59e0b',
  Question: '#8b5cf6',
  'Exam Info': '#ef4444',
};

export default function SavedPostsScreen() {
  const router = useRouter();
  const [savedPosts] = useState<StudyPost[]>(MOCK_SAVED_POSTS);

  const handleUnsave = (postId: string) => {
    // Mock: remove from saved
    console.log('Unsave post:', postId);
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

      {savedPosts.length === 0 ? (
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

