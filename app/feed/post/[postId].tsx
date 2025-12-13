// app/feed/post/[postId].tsx
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const PRIMARY_GREEN = '#047857';

// Mock data - in real app, fetch by postId
const MOCK_POST = {
  id: '1',
  authorName: 'Sarah Johnson',
  authorInstitution: 'MIT',
  courseName: 'Data Structures',
  type: 'Summary',
  title: 'Quick Review: Binary Trees',
  content: `Binary trees are hierarchical data structures where each node has at most two children. Key operations include insertion, deletion, and traversal (in-order, pre-order, post-order).

**Key Concepts:**
- Root: The topmost node
- Leaf: A node with no children
- Height: The longest path from root to leaf
- Depth: The distance from root to a node

**Traversal Methods:**
1. In-order: Left, Root, Right
2. Pre-order: Root, Left, Right
3. Post-order: Left, Right, Root

**Common Operations:**
- Insert: O(log n) average, O(n) worst case
- Search: O(log n) average, O(n) worst case
- Delete: O(log n) average, O(n) worst case

Binary trees are fundamental to many advanced data structures like AVL trees, Red-Black trees, and B-trees.`,
  tags: ['datastructures', 'trees', 'algorithms', 'programming'],
  attachments: ['binary-tree-diagram.pdf', 'practice-problems.pdf'],
  likesCount: 24,
  savesCount: 12,
  createdAt: '2 hours ago',
  isLiked: false,
  isSaved: false,
};

const TYPE_COLORS: Record<string, string> = {
  Summary: '#3b82f6',
  Tip: '#f59e0b',
  Question: '#8b5cf6',
  'Exam Info': '#ef4444',
};

export default function StudyPostDetailsScreen() {
  const router = useRouter();
  const { postId } = useLocalSearchParams();
  const [post, setPost] = useState(MOCK_POST);

  const handleLike = () => {
    setPost((prev) => ({
      ...prev,
      isLiked: !prev.isLiked,
      likesCount: prev.isLiked ? prev.likesCount - 1 : prev.likesCount + 1,
    }));
  };

  const handleSave = () => {
    setPost((prev) => ({
      ...prev,
      isSaved: !prev.isSaved,
      savesCount: prev.isSaved ? prev.savesCount - 1 : prev.savesCount + 1,
    }));
  };

  const handleReport = () => {
    Alert.alert('Report Post', 'Are you sure you want to report this post?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Report', style: 'destructive', onPress: () => console.log('Reported') },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post Details</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleSave}>
            <Ionicons
              name={post.isSaved ? 'bookmark' : 'bookmark-outline'}
              size={24}
              color={post.isSaved ? PRIMARY_GREEN : '#6b7280'}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleReport} style={{ marginLeft: 16 }}>
            <Ionicons name="flag-outline" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Author Info */}
        <View style={styles.authorSection}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={24} color={PRIMARY_GREEN} />
          </View>
          <View style={styles.authorInfo}>
            <Text style={styles.authorName}>{post.authorName}</Text>
            <Text style={styles.authorInstitution}>{post.authorInstitution}</Text>
          </View>
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
              <TouchableOpacity key={idx} style={styles.attachmentItem}>
                <Ionicons name="document" size={20} color={PRIMARY_GREEN} />
                <Text style={styles.attachmentText}>{file}</Text>
                <Ionicons name="download-outline" size={20} color="#6b7280" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsSection}>
          <View style={styles.statItem}>
            <Ionicons
              name={post.isLiked ? 'heart' : 'heart-outline'}
              size={20}
              color={post.isLiked ? '#ef4444' : '#6b7280'}
            />
            <Text style={styles.statText}>{post.likesCount} likes</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons
              name={post.isSaved ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={post.isSaved ? PRIMARY_GREEN : '#6b7280'}
            />
            <Text style={styles.statText}>{post.savesCount} saves</Text>
          </View>
          <Text style={styles.timeText}>{post.createdAt}</Text>
        </View>
      </ScrollView>

      {/* Action Bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
          <Ionicons
            name={post.isLiked ? 'heart' : 'heart-outline'}
            size={24}
            color={post.isLiked ? '#ef4444' : '#6b7280'}
          />
          <Text style={[styles.actionButtonText, post.isLiked && styles.actionButtonTextActive]}>
            Like
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handleSave}>
          <Ionicons
            name={post.isSaved ? 'bookmark' : 'bookmark-outline'}
            size={24}
            color={post.isSaved ? PRIMARY_GREEN : '#6b7280'}
          />
          <Text style={[styles.actionButtonText, post.isSaved && styles.actionButtonTextActive]}>
            Save
          </Text>
        </TouchableOpacity>
      </View>
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
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
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
  actionBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  actionButtonTextActive: {
    color: PRIMARY_GREEN,
  },
});

