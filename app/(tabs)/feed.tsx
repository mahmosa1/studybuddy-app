// app/(tabs)/feed.tsx
import { useUser } from '@/lib/UserContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
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
  authorName: string;
  authorInstitution: string;
  courseName?: string;
  type: 'Summary' | 'Tip' | 'Question' | 'Exam Info';
  title: string;
  content: string;
  tags: string[];
  attachments?: string[];
  likesCount: number;
  savesCount: number;
  createdAt: string;
  isLiked?: boolean;
  isSaved?: boolean;
};

// Mocked data
const MOCK_POSTS: StudyPost[] = [
  {
    id: '1',
    authorName: 'Sarah Johnson',
    authorInstitution: 'MIT',
    courseName: 'Data Structures',
    type: 'Summary',
    title: 'Quick Review: Binary Trees',
    content: 'Binary trees are hierarchical data structures where each node has at most two children. Key operations include insertion, deletion, and traversal (in-order, pre-order, post-order).',
    tags: ['datastructures', 'trees', 'algorithms'],
    likesCount: 24,
    savesCount: 12,
    createdAt: '2 hours ago',
    isLiked: false,
    isSaved: false,
  },
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
    id: '3',
    authorName: 'Emma Williams',
    authorInstitution: 'Harvard',
    courseName: 'Linear Algebra',
    type: 'Question',
    title: 'Eigenvalues vs Eigenvectors',
    content: 'Can someone explain the difference between eigenvalues and eigenvectors? I understand eigenvalues are scalars, but how do eigenvectors relate to them?',
    tags: ['linearalgebra', 'eigenvalues'],
    likesCount: 18,
    savesCount: 9,
    createdAt: '1 day ago',
    isLiked: false,
    isSaved: false,
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
  {
    id: '5',
    authorName: 'Lisa Anderson',
    authorInstitution: 'Yale',
    courseName: 'Organic Chemistry',
    type: 'Summary',
    title: 'Reaction Mechanisms Overview',
    content: 'SN1 vs SN2: SN1 is unimolecular (first order), forms carbocation intermediate, racemization occurs. SN2 is bimolecular (second order), single step, inversion of configuration.',
    tags: ['chemistry', 'organic', 'mechanisms'],
    likesCount: 29,
    savesCount: 15,
    createdAt: '3 days ago',
    isLiked: true,
    isSaved: false,
  },
];

const TYPE_COLORS: Record<StudyPost['type'], string> = {
  Summary: '#3b82f6',
  Tip: '#f59e0b',
  Question: '#8b5cf6',
  'Exam Info': '#ef4444',
};

export default function StudentFeedScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { role } = useUser();
  const [posts, setPosts] = useState<StudyPost[]>(MOCK_POSTS);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Redirect if not student
  if (role !== 'student') {
    return null;
  }

  const handleLike = (postId: string) => {
    setPosts((prev) =>
      prev.map((post) => {
        if (post.id === postId) {
          return {
            ...post,
            isLiked: !post.isLiked,
            likesCount: post.isLiked ? post.likesCount - 1 : post.likesCount + 1,
          };
        }
        return post;
      })
    );
  };

  const handleSave = (postId: string) => {
    setPosts((prev) =>
      prev.map((post) => {
        if (post.id === postId) {
          return {
            ...post,
            isSaved: !post.isSaved,
            savesCount: post.isSaved ? post.savesCount - 1 : post.savesCount + 1,
          };
        }
        return post;
      })
    );
  };

  const handleReport = (postId: string) => {
    // Mock: just show alert
    console.log('Report post:', postId);
  };

  const renderPost = ({ item }: { item: StudyPost }) => (
    <TouchableOpacity
      style={styles.postCard}
      onPress={() => router.push(`/feed/post/${item.id}` as any)}
      activeOpacity={0.7}
    >
      {/* Header */}
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
          <View style={styles.statItem}>
            <Ionicons
              name={item.isLiked ? 'heart' : 'heart-outline'}
              size={18}
              color={item.isLiked ? '#ef4444' : '#6b7280'}
            />
            <Text style={styles.statText}>{item.likesCount}</Text>
          </View>
          <View style={styles.statItem}>
            <Ionicons
              name={item.isSaved ? 'bookmark' : 'bookmark-outline'}
              size={18}
              color={item.isSaved ? PRIMARY_GREEN : '#6b7280'}
            />
            <Text style={styles.statText}>{item.savesCount}</Text>
          </View>
          <Text style={styles.timeText}>{item.createdAt}</Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              handleLike(item.id);
            }}
          >
            <Ionicons
              name={item.isLiked ? 'heart' : 'heart-outline'}
              size={20}
              color={item.isLiked ? '#ef4444' : '#6b7280'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              handleSave(item.id);
            }}
          >
            <Ionicons
              name={item.isSaved ? 'bookmark' : 'bookmark-outline'}
              size={20}
              color={item.isSaved ? PRIMARY_GREEN : '#6b7280'}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              handleReport(item.id);
            }}
          >
            <Ionicons name="flag-outline" size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('feed.title')}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push('/feed/saved' as any)}
          >
            <Ionicons name="bookmark" size={24} color={PRIMARY_GREEN} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Ionicons name="add-circle" size={24} color={PRIMARY_GREEN} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Feed */}
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.feedContent}
        showsVerticalScrollIndicator={false}
      />

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
              <TouchableOpacity style={styles.input}>
                <Text style={styles.inputPlaceholder}>{t('feed.selectCourse')}</Text>
                <Ionicons name="chevron-down" size={20} color="#6b7280" />
              </TouchableOpacity>

              <Text style={styles.label}>{t('feed.titleLabel')} *</Text>
              <TextInput style={styles.textInput} placeholder={t('feed.titlePlaceholder')} />

              <Text style={styles.label}>{t('feed.contentLabel')} *</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                placeholder={t('feed.contentPlaceholder')}
                multiline
                numberOfLines={6}
              />

              <Text style={styles.label}>{t('feed.postTypeLabel')} *</Text>
              <View style={styles.typeOptions}>
                {(['Summary', 'Tip', 'Question', 'Exam Info'] as StudyPost['type'][]).map((type) => (
                  <TouchableOpacity key={type} style={styles.typeOption}>
                    <Text style={styles.typeOptionText}>{t(`feed.postType.${type.toLowerCase().replace(' ', '')}`)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>{t('feed.tags')} ({t('common.optional')})</Text>
              <TextInput style={styles.textInput} placeholder={t('feed.tagsPlaceholder')} />

              <Text style={styles.label}>{t('feed.visibility')}</Text>
              <View style={styles.visibilityOptions}>
                <TouchableOpacity style={[styles.visibilityOption, styles.visibilityOptionActive]}>
                  <Ionicons name="globe" size={20} color={PRIMARY_GREEN} />
                  <Text style={styles.visibilityOptionText}>{t('feed.public')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.visibilityOption}>
                  <Ionicons name="school" size={20} color="#6b7280" />
                  <Text style={[styles.visibilityOptionText, styles.visibilityOptionTextInactive]}>
                    {t('feed.institutionOnly')}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.publishButton}
                onPress={() => {
                  setShowCreateModal(false);
                  // Mock: show success message
                }}
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
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    padding: 4,
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
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    padding: 4,
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
  typeOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
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
  publishButton: {
    backgroundColor: PRIMARY_GREEN,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  publishButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
});

