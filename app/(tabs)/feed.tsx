// app/(tabs)/feed.tsx
import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { PrimaryButton } from '@/frontend/components/ui/PrimaryButton';
import { layout, radius, spacing } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { useUser } from '@/lib/UserContext';
import { db } from '@/lib/firebaseConfig';
import { attachmentLooksLikeImage } from '@/lib/feedAttachmentUtils';
import { createActivityNotification } from '@/lib/notificationService';
import { pushAttachmentViewer } from '@/lib/openAttachmentViewer';
import { uploadFeedAttachmentToSupabase } from '@/lib/upload';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter, useFocusEffect } from 'expo-router';
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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

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
  visibility?: 'public' | 'institution' | 'followers';
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
  actorUid?: string;
  actorName: string;
  actorAvatarUrl?: string;
  type: 'follow' | 'post_like' | 'post_comment' | 'comment_like';
  text?: string;
  postId?: string;
  createdAtLabel: string;
  createdAtMs: number;
  read: boolean;
};

type FeedNotificationsModalBodyProps = {
  onClose: () => void;
  notificationsFilter: 'all' | 'follows' | 'comments' | 'likes';
  setNotificationsFilter: (f: 'all' | 'follows' | 'comments' | 'likes') => void;
  groupedNotifications: { title: string; data: ActivityNotificationItem[] }[];
  notificationText: (item: ActivityNotificationItem) => string;
  notificationRowTypeIcon: (n: ActivityNotificationItem) => keyof typeof Ionicons.glyphMap;
};

type CreatePostModalBodyProps = {
  onClose: () => void;
  courses: CourseOption[];
  selectedCourse: CourseOption | null;
  setSelectedCourse: React.Dispatch<React.SetStateAction<CourseOption | null>>;
  showCoursePicker: boolean;
  setShowCoursePicker: React.Dispatch<React.SetStateAction<boolean>>;
  selectedType: StudyPost['type'];
  setSelectedType: React.Dispatch<React.SetStateAction<StudyPost['type']>>;
  visibility: 'public' | 'institution' | 'followers';
  setVisibility: React.Dispatch<React.SetStateAction<'public' | 'institution' | 'followers'>>;
  attachments: FeedAttachment[];
  setAttachments: React.Dispatch<React.SetStateAction<FeedAttachment[]>>;
  uploadingAttachment: boolean;
  newTitle: string;
  setNewTitle: React.Dispatch<React.SetStateAction<string>>;
  newContent: string;
  setNewContent: React.Dispatch<React.SetStateAction<string>>;
  newTags: string;
  setNewTags: React.Dispatch<React.SetStateAction<string>>;
  publishing: boolean;
  onPublish: () => void;
  onPickAttachment: () => void;
  coursesLoading: boolean;
};

/**
 * Create Post form: call useSafeAreaInsets() only as a descendant of Modal → SafeAreaProvider (see parent).
 */
function CreatePostModalBody({
  onClose,
  courses,
  selectedCourse,
  setSelectedCourse,
  showCoursePicker,
  setShowCoursePicker,
  selectedType,
  setSelectedType,
  visibility,
  setVisibility,
  attachments,
  setAttachments,
  uploadingAttachment,
  newTitle,
  setNewTitle,
  newContent,
  setNewContent,
  newTags,
  setNewTags,
  publishing,
  onPublish,
  onPickAttachment,
  coursesLoading,
}: CreatePostModalBodyProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { t, i18n } = useTranslation();
  const isHebrewUi = i18n.language === 'he';

  const topInset =
    insets.top > 0 ? insets.top : Platform.OS === 'ios' ? 47 : StatusBar.currentHeight ?? 0;

  return (
    <View style={[styles.createModalRoot, { backgroundColor: colors.surface }]}>
      <KeyboardAvoidingView
        style={styles.createModalKeyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View
          style={[
            styles.createPostModalHeaderShell,
            {
              paddingTop: topInset + 8,
              minHeight: topInset + 8 + 56,
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <View style={[styles.createPostModalHeaderRow, isHebrewUi && styles.rtlRow]}>
            <TouchableOpacity
              style={styles.createPostModalCloseWrap}
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text
              style={[styles.createPostModalHeaderTitle, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}
              numberOfLines={1}
            >
              {t('feed.createPost')}
            </Text>
            <View style={styles.createPostModalHeaderSideSlot} />
          </View>
        </View>

        <ScrollView
          style={styles.createModalScroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          contentContainerStyle={[
            styles.createModalScrollContent,
            { paddingBottom: insets.bottom + spacing.xxl + 32 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.label, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
            {t('feed.course')} ({t('common.optional')})
          </Text>
          <TouchableOpacity
            style={[
              styles.input,
              { backgroundColor: colors.surfaceMuted, borderColor: colors.border, opacity: coursesLoading ? 0.65 : 1 },
            ]}
            onPress={() => !coursesLoading && setShowCoursePicker((prev) => !prev)}
            activeOpacity={0.8}
            disabled={coursesLoading}
          >
            <Text
              style={
                selectedCourse
                  ? [styles.inputValue, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]
                  : [styles.inputPlaceholder, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]
              }
            >
              {coursesLoading ? t('feed.loadingCourses') : selectedCourse?.name || t('feed.selectCourse')}
            </Text>
            {coursesLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
            )}
          </TouchableOpacity>
          {showCoursePicker ? (
            <View style={[styles.pickerList, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <TouchableOpacity
                style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setSelectedCourse(null);
                  setShowCoursePicker(false);
                }}
              >
                <Text style={[styles.pickerItemText, { color: colors.textPrimary }]}>{t('feed.selectCourse')}</Text>
              </TouchableOpacity>
              {courses.map((course) => (
                <TouchableOpacity
                  key={course.id}
                  style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setSelectedCourse(course);
                    setShowCoursePicker(false);
                  }}
                >
                  <Text style={[styles.pickerItemText, { color: colors.textPrimary }]}>{course.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          <Text style={[styles.label, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
            {t('feed.titleLabel')} *
          </Text>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.border,
                color: colors.textPrimary,
              },
            ]}
            placeholder={t('feed.titlePlaceholder')}
            placeholderTextColor={colors.textSecondary}
            selectionColor={colors.primary}
            cursorColor={colors.primary}
            value={newTitle}
            onChangeText={setNewTitle}
            textAlign={isHebrewUi ? 'right' : 'left'}
          />

          <Text style={[styles.label, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
            {t('feed.contentLabel')} *
          </Text>
          <TextInput
            style={[
              styles.textInput,
              styles.textArea,
              {
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.border,
                color: colors.textPrimary,
              },
            ]}
            placeholder={t('feed.contentPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            selectionColor={colors.primary}
            cursorColor={colors.primary}
            multiline
            numberOfLines={6}
            value={newContent}
            onChangeText={setNewContent}
            textAlign={isHebrewUi ? 'right' : 'left'}
          />

          <Text style={[styles.label, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
            {t('feed.postTypeLabel')} *
          </Text>
          <View style={styles.typeOptions}>
            {(['Summary', 'Tip', 'Question', 'Exam Info'] as StudyPost['type'][]).map((type) => {
              const active = selectedType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeOption,
                    {
                      backgroundColor: active ? colors.surfaceElevated : colors.surfaceMuted,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedType(type)}
                >
                  <Text
                    style={[
                      styles.typeOptionText,
                      { color: active ? colors.primary : colors.textSecondary, fontWeight: active ? '700' : '500' },
                      isHebrewUi && styles.rtlText,
                    ]}
                  >
                    {t(`feed.postType.${type.toLowerCase().replace(' ', '')}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.label, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
            {t('feed.tags')} ({t('common.optional')})
          </Text>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.border,
                color: colors.textPrimary,
              },
            ]}
            placeholder={t('feed.tagsPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            selectionColor={colors.primary}
            cursorColor={colors.primary}
            value={newTags}
            onChangeText={setNewTags}
          />

          <Text style={[styles.label, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
            {t('feed.visibility')}
          </Text>
          <View style={styles.visibilityOptions}>
            <TouchableOpacity
              style={[
                styles.visibilityOption,
                {
                  backgroundColor: visibility === 'public' ? colors.surfaceElevated : colors.surfaceMuted,
                  borderColor: visibility === 'public' ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setVisibility('public')}
            >
              <Ionicons
                name="globe"
                size={20}
                color={visibility === 'public' ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.visibilityOptionText,
                  { color: visibility === 'public' ? colors.primary : colors.textSecondary },
                  isHebrewUi && styles.rtlText,
                ]}
                numberOfLines={2}
              >
                {t('feed.public')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.visibilityOption,
                {
                  backgroundColor: visibility === 'institution' ? colors.surfaceElevated : colors.surfaceMuted,
                  borderColor: visibility === 'institution' ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setVisibility('institution')}
            >
              <Ionicons
                name="school"
                size={20}
                color={visibility === 'institution' ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.visibilityOptionText,
                  { color: visibility === 'institution' ? colors.primary : colors.textSecondary },
                  isHebrewUi && styles.rtlText,
                ]}
                numberOfLines={2}
              >
                {t('feed.institutionOnly')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.visibilityOption,
                {
                  backgroundColor: visibility === 'followers' ? colors.surfaceElevated : colors.surfaceMuted,
                  borderColor: visibility === 'followers' ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setVisibility('followers')}
            >
              <Ionicons
                name="people-outline"
                size={20}
                color={visibility === 'followers' ? colors.primary : colors.textSecondary}
              />
              <Text
                style={[
                  styles.visibilityOptionText,
                  { color: visibility === 'followers' ? colors.primary : colors.textSecondary },
                  isHebrewUi && styles.rtlText,
                ]}
                numberOfLines={2}
              >
                {t('feed.followersOnly')}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
            Attachments ({t('common.optional')})
          </Text>
          <TouchableOpacity
            style={[
              styles.attachButton,
              {
                borderColor: colors.primary,
                backgroundColor: colors.surfaceElevated,
              },
            ]}
            onPress={onPickAttachment}
            disabled={uploadingAttachment}
          >
            {uploadingAttachment ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="attach" size={18} color={colors.accent} />
            )}
            <Text style={[styles.attachButtonText, { color: colors.primary }]}>
              {uploadingAttachment ? t('common.uploading') : t('profile.addAttachment')}
            </Text>
          </TouchableOpacity>
          {attachments.length > 0 ? (
            <View style={styles.attachmentsList}>
              {attachments.map((file, idx) => (
                <View
                  key={`${file.url}-${idx}`}
                  style={[styles.attachmentChip, { borderColor: colors.border, backgroundColor: colors.surface }]}
                >
                  <Text style={[styles.attachmentChipText, { color: colors.textPrimary }]} numberOfLines={1}>
                    {file.name}
                  </Text>
                  <TouchableOpacity onPress={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}>
                    <Ionicons name="close-circle" size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : null}

          <PrimaryButton
            label={t('feed.publishPost')}
            onPress={onPublish}
            disabled={publishing}
            loading={publishing}
            style={styles.publishButtonPrimary}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * Renders inside Modal + nested SafeAreaProvider so useSafeAreaInsets() measures correctly on first open.
 */
function FeedNotificationsModalBody({
  onClose,
  notificationsFilter,
  setNotificationsFilter,
  groupedNotifications,
  notificationText,
  notificationRowTypeIcon,
}: FeedNotificationsModalBodyProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const isHebrewUi = i18n.language === 'he';

  const topInset =
    insets.top > 0 ? insets.top : Platform.OS === 'ios' ? 47 : StatusBar.currentHeight ?? 0;

  return (
    <View style={[styles.notificationsModalRoot, { backgroundColor: colors.bg }]}>
      <View
        style={[
          styles.notificationsLocalHeader,
          {
            paddingTop: topInset + 8,
            minHeight: topInset + 8 + 56,
            backgroundColor: colors.bg,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.notificationsLocalHeaderRow}>
          <TouchableOpacity
            style={styles.notificationsHeaderBackBtn}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <View style={styles.notificationsHeaderTitleWrap} pointerEvents="none">
            <Text
              style={[styles.notificationsHeaderTitle, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}
              numberOfLines={1}
            >
              {isHebrewUi ? 'עדכונים' : 'Updates'}
            </Text>
          </View>
          <View style={styles.notificationsHeaderSpacer} />
        </View>
      </View>

      <View style={[styles.notificationsModalTopDecor, { borderBottomColor: colors.border }]}>
        <View style={[styles.topDecorPrimary, { backgroundColor: colors.primary }]} />
        <View style={[styles.topDecorAccent, { backgroundColor: colors.accent }]} />
      </View>

      <AppCard
        style={[
          styles.notificationsFilterShell,
          { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
        ]}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.notificationsTabsRow}>
          {(['all', 'follows', 'comments', 'likes'] as const).map((filter) => {
            const active = notificationsFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.notificationTab,
                  active
                    ? { backgroundColor: colors.primary, borderColor: colors.primary }
                    : { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                onPress={() => setNotificationsFilter(filter)}
              >
                <Text
                  style={[
                    styles.notificationTabText,
                    { color: active ? colors.textOnPrimary : colors.textSecondary },
                  ]}
                >
                  {t(`feed.notifications.filters.${filter}`)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </AppCard>

      <ScrollView
        style={styles.notificationsModalScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.notificationsBody,
          { paddingBottom: spacing.xxl + insets.bottom },
        ]}
      >
        {groupedNotifications.length ? (
          groupedNotifications.map((section) => (
            <View key={section.title}>
              <Text style={[styles.notificationsSectionTitle, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
                {section.title}
              </Text>
              {section.data.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.78}
                  style={styles.notificationCardWrap}
                  onPress={() => {
                    onClose();
                    if (item.type === 'follow') {
                      const uid = item.actorUid?.trim();
                      if (uid) router.push(`/user-profile/${uid}` as any);
                      return;
                    }
                    if (item.postId) router.push(`/feed/post/${item.postId}` as any);
                  }}
                >
                  <AppCard style={[styles.notificationCard, { borderColor: colors.border }]}>
                    <View style={[styles.notificationRowInner, isHebrewUi && styles.rtlRow]}>
                      <View style={[styles.notificationTypeIconWrap, { backgroundColor: colors.surfaceMuted }]}>
                        <Ionicons name={notificationRowTypeIcon(item)} size={15} color={colors.primary} />
                      </View>
                      <View style={[styles.notificationAvatarWrap, { borderColor: colors.border }]}>
                        {item.actorAvatarUrl ? (
                          <Image source={{ uri: item.actorAvatarUrl }} style={styles.notificationAvatar} />
                        ) : (
                          <Ionicons name="person" size={14} color={colors.primary} />
                        )}
                      </View>
                      <View style={[styles.notificationTextWrap, isHebrewUi && styles.rtlTextBlock]}>
                        <Text style={[styles.notificationText, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]} numberOfLines={2}>
                          {notificationText(item)}
                        </Text>
                        {!!item.text && item.type === 'post_comment' ? (
                          <Text style={[styles.notificationSubText, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]} numberOfLines={1}>
                            &quot;{item.text}&quot;
                          </Text>
                        ) : null}
                      </View>
                      <View style={[styles.notificationMeta, isHebrewUi && styles.rtlRow]}>
                        <Text style={[styles.notificationTime, { color: colors.textSecondary }]}>{item.createdAtLabel}</Text>
                        {!item.read ? <View style={[styles.notificationUnreadDot, { backgroundColor: colors.danger }]} /> : null}
                      </View>
                    </View>
                  </AppCard>
                </TouchableOpacity>
              ))}
            </View>
          ))
        ) : (
          <AppCard style={[styles.notificationsEmptyCard, { borderColor: colors.border }]}>
            <Ionicons name="notifications-off-outline" size={36} color={colors.textSecondary} style={{ alignSelf: 'center' }} />
            <Text style={[styles.notificationsEmptyTitle, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
              {t('feed.notifications.empty')}
            </Text>
          </AppCard>
        )}
      </ScrollView>
    </View>
  );
}

export default function StudentFeedScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const isHebrewUi = i18n.language === 'he';
  const { role, firebaseUser } = useUser();
  const [posts, setPosts] = useState<StudyPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [showCoursePicker, setShowCoursePicker] = useState(false);
  const [userInstitution, setUserInstitution] = useState('');
  const [selectedType, setSelectedType] = useState<StudyPost['type']>('Summary');
  const [selectedCourse, setSelectedCourse] = useState<CourseOption | null>(null);
  const [visibility, setVisibility] = useState<'public' | 'institution' | 'followers'>('public');
  const [followingAuthorIds, setFollowingAuthorIds] = useState<string[]>([]);
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

  const followingIdsKey = useMemo(
    () => [...followingAuthorIds].sort().join(','),
    [followingAuthorIds]
  );

  useEffect(() => {
    if (!firebaseUser) {
      setFollowingAuthorIds([]);
      return;
    }
    const q = query(collection(db, 'follows'), where('followerId', '==', firebaseUser.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const ids: string[] = [];
        snap.forEach((d) => {
          const data = d.data() as any;
          if (data?.followingId) ids.push(String(data.followingId));
        });
        setFollowingAuthorIds(ids);
      },
      () => setFollowingAuthorIds([])
    );
    return unsub;
  }, [firebaseUser]);

  const refreshCourses = useCallback(async () => {
    if (!firebaseUser) {
      setCourses([]);
      setSelectedCourse(null);
      setCoursesLoading(false);
      return;
    }
    setCoursesLoading(true);
    try {
      const [userDoc, coursesSnap] = await Promise.all([
        getDoc(doc(db, 'users', firebaseUser.uid)),
        getDocs(query(collection(db, 'courses'), where('ownerUid', '==', firebaseUser.uid))),
      ]);
      if (userDoc.exists()) {
        const udata = userDoc.data() as any;
        setUserInstitution(udata?.institution || '');
      }
      const byId = new Map<string, CourseOption>();
      coursesSnap.forEach((courseDoc) => {
        const data = courseDoc.data() as any;
        if (data?.name) {
          byId.set(courseDoc.id, { id: courseDoc.id, name: String(data.name) });
        }
      });
      const nextList = Array.from(byId.values()).sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      );
      setCourses(nextList);
      setSelectedCourse((prev) => (prev && nextList.some((c) => c.id === prev.id) ? prev : null));
    } catch (err) {
      console.log('feed courses refresh error:', err);
    } finally {
      setCoursesLoading(false);
    }
  }, [firebaseUser]);

  useEffect(() => {
    void refreshCourses();
  }, [refreshCourses]);

  useFocusEffect(
    useCallback(() => {
      void refreshCourses();
    }, [refreshCourses])
  );

  useEffect(() => {
    if (showCreateModal) {
      void refreshCourses();
    }
  }, [showCreateModal, refreshCourses]);

  useEffect(() => {
    const postsRef = collection(db, 'feedPosts');
    const q = query(postsRef, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      async (snap) => {
        type PostVis = 'public' | 'institution' | 'followers';
        type Row = { id: string; data: any; likedBy: string[]; savedBy: string[]; postVisibility: PostVis };
        const followingSet = new Set(followingAuthorIds);
        const rows: Row[] = [];
        for (const d of snap.docs) {
          const data = d.data() as any;
          const likedBy: string[] = data.likedBy || [];
          const savedBy: string[] = data.savedBy || [];
          const rawVis = String(data.visibility || 'public').toLowerCase();
          const postVisibility = (
            rawVis === 'institution' || rawVis === 'followers' ? rawVis : 'public'
          ) as PostVis;
          const postInstitution = data.authorInstitution || '';
          const authorUid = String(data.authorUid || '').trim();
          const isAuthor = !!firebaseUser && !!authorUid && authorUid === firebaseUser.uid;
          const followsAuthor = !!authorUid && followingSet.has(authorUid);

          let canSeePost = false;
          if (postVisibility === 'followers') {
            canSeePost = !!firebaseUser && (isAuthor || followsAuthor);
          } else {
            canSeePost =
              postVisibility === 'public' ||
              !postInstitution ||
              (!!userInstitution && postInstitution === userInstitution);
          }
          if (!canSeePost) continue;
          rows.push({ id: d.id, data, likedBy, savedBy, postVisibility });
        }

        const authorUids = [...new Set(rows.map((r) => String(r.data.authorUid || '').trim()).filter(Boolean))];
        const avatarFromProfileByUid: Record<string, string> = {};
        await Promise.all(
          authorUids.map(async (uid) => {
            try {
              const authorSnap = await getDoc(doc(db, 'users', uid));
              if (authorSnap.exists()) {
                const authorData = authorSnap.data() as any;
                const url = String(
                  authorData?.profilePictureUrl ||
                    authorData?.profileImageUrl ||
                    authorData?.photoURL ||
                    authorData?.avatarUrl ||
                    ''
                ).trim();
                avatarFromProfileByUid[uid] = url;
              }
            } catch {
              // leave missing; fallback to post denormalized field below
            }
          })
        );

        const list: (StudyPost | null)[] = rows.map((r) => {
          const { data, id, likedBy, savedBy, postVisibility } = r;
          const uid = String(data.authorUid || '').trim();
          const fromPost = String(data.authorAvatarUrl || '').trim();
          const hasProfileFetch = uid && Object.prototype.hasOwnProperty.call(avatarFromProfileByUid, uid);
          const authorAvatarUrl = hasProfileFetch
            ? avatarFromProfileByUid[uid] || undefined
            : fromPost || undefined;

          return {
            id,
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
        });

        setPosts(list.filter(Boolean) as StudyPost[]);
        setLoadingPosts(false);
      },
      (err) => {
        console.log('feed load error:', err);
        setLoadingPosts(false);
      }
    );
    return unsub;
  }, [firebaseUser, userInstitution, followingIdsKey]);

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
            actorUid: String(
              data?.actorUid || data?.fromUid || data?.userId || data?.senderUid || ''
            ).trim(),
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

  if (role !== 'student' && role !== 'lecturer' && role !== 'admin') {
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

  const getPostFirstImageAttachment = (post: StudyPost) =>
    post.attachments?.find((a) =>
      attachmentLooksLikeImage({
        name: a.name || '',
        url: a.url || '',
        mimeType: a.mimeType ?? null,
      })
    );

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

  const notificationRowTypeIcon = (n: ActivityNotificationItem): keyof typeof Ionicons.glyphMap => {
    switch (n.type) {
      case 'follow':
        return 'person-add-outline';
      case 'post_like':
        return 'heart-outline';
      case 'post_comment':
        return 'chatbubble-ellipses-outline';
      case 'comment_like':
        return 'heart-outline';
      default:
        return 'notifications-outline';
    }
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

  const renderPost = ({ item }: { item: StudyPost }) => {
    const firstImageAttachment = getPostFirstImageAttachment(item);
    const imageUrl = firstImageAttachment?.url;
    const cardShadow =
      Platform.OS === 'ios'
        ? {
            shadowColor: '#0F172A',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.07,
            shadowRadius: 10,
          }
        : { elevation: 2 };

    return (
      <Pressable
        onPress={() => router.push(`/feed/post/${item.id}` as any)}
        style={({ pressed }) => [styles.postCardOuter, pressed && styles.postCardOuterPressed]}
        android_ripple={{ color: `${colors.primary}18` }}
      >
        <AppCard
          style={[
            styles.postCardInner,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              ...cardShadow,
            },
          ]}
        >
          <View style={[styles.postTopRow, isHebrewUi && styles.rtlRow]}>
            <Pressable
              style={({ pressed }) => [
                styles.authorBlock,
                isHebrewUi && styles.rtlRow,
                pressed && styles.authorBlockPressed,
              ]}
              onPress={(e) => {
                e.stopPropagation();
                if (!item.authorUid) return;
                router.push(`/user-profile/${item.authorUid}` as any);
              }}
              android_ripple={{ color: `${colors.primary}14`, borderless: false }}
            >
              <View style={[styles.avatar, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                {item.authorAvatarUrl ? (
                  <Image source={{ uri: item.authorAvatarUrl }} style={styles.avatarImage} />
                ) : (
                  <Ionicons name="person" size={18} color={colors.primary} />
                )}
              </View>
              <View style={[styles.authorTextStack, isHebrewUi && styles.rtlTextBlock]}>
                <Text style={[styles.authorName, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]} numberOfLines={1}>
                  {item.authorName}
                </Text>
                {!!item.authorInstitution ? (
                  <Text style={[styles.authorInstitution, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]} numberOfLines={1}>
                    {item.authorInstitution}
                  </Text>
                ) : null}
              </View>
            </Pressable>
            <View
              style={[
                styles.typeBadge,
                {
                  backgroundColor: colors.surfaceMuted,
                  borderColor: typeBadgeBorder(item.type),
                },
              ]}
            >
              <Text style={[styles.typeBadgeText, { color: colors.textPrimary }]} numberOfLines={1}>
                {t(`feed.postType.${item.type.toLowerCase().replace(' ', '')}`)}
              </Text>
            </View>
          </View>

          {item.courseName ? (
            <View style={[styles.courseTag, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }, isHebrewUi && styles.rtlRow]}>
              <Ionicons name="book-outline" size={13} color={colors.primary} />
              <Text style={[styles.courseTagText, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]} numberOfLines={1}>
                {item.courseName}
              </Text>
            </View>
          ) : null}

          {item.visibility === 'institution' ? (
            <View
              style={[
                styles.postVisibilityPill,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                isHebrewUi && styles.rtlRow,
              ]}
            >
              <Ionicons name="school-outline" size={12} color={colors.textSecondary} />
              <Text style={[styles.postVisibilityPillText, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]} numberOfLines={1}>
                {t('feed.institutionOnlyBadge')}
              </Text>
            </View>
          ) : null}

          <Text style={[styles.postTitle, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]} numberOfLines={2}>
            {item.title}
          </Text>

          <Text style={[styles.postContent, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]} numberOfLines={3}>
            {item.content}
          </Text>

          {imageUrl && firstImageAttachment ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                pushAttachmentViewer(router, {
                  url: firstImageAttachment.url,
                  name: firstImageAttachment.name,
                  mimeType: firstImageAttachment.mimeType ?? undefined,
                });
              }}
              style={[styles.postImageWrap, { borderColor: colors.border }]}
            >
              <Image source={{ uri: imageUrl }} style={styles.postImage} resizeMode="cover" />
            </Pressable>
          ) : null}

          {item.tags.length > 0 ? (
            <View style={[styles.tagsContainer, isHebrewUi && styles.rtlRow]}>
              {item.tags.slice(0, 4).map((tag, idx) => (
                <View key={idx} style={[styles.tag, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                  <Text style={[styles.tagText, { color: colors.textSecondary }]}>#{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={[styles.postFooter, { borderTopColor: colors.border }, isHebrewUi && styles.rtlRow]}>
            <Text style={[styles.footerTime, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>{item.createdAt}</Text>
            <View style={styles.footerStatsRow}>
              <TouchableOpacity
                style={styles.statItem}
                onPress={(e) => {
                  e.stopPropagation();
                  handleLike(item.id);
                }}
                activeOpacity={0.75}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              >
                <Ionicons
                  name={item.isLiked ? 'heart' : 'heart-outline'}
                  size={17}
                  color={item.isLiked ? colors.danger : colors.textSecondary}
                />
                <Text style={[styles.statText, { color: colors.textSecondary }]}>{item.likesCount}</Text>
              </TouchableOpacity>
              <View style={styles.statItem}>
                <Ionicons name="chatbubble-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.statText, { color: colors.textSecondary }]}>{item.commentsCount}</Text>
              </View>
              <TouchableOpacity
                style={styles.statItem}
                onPress={(e) => {
                  e.stopPropagation();
                  handleSave(item.id);
                }}
                activeOpacity={0.75}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              >
                <Ionicons
                  name={item.isSaved ? 'bookmark' : 'bookmark-outline'}
                  size={17}
                  color={item.isSaved ? colors.warning : colors.textSecondary}
                />
                <Text style={[styles.statText, { color: colors.textSecondary }]}>{item.savesCount}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </AppCard>
      </Pressable>
    );
  };

  return (
    <AppScreen>
      <View style={[styles.feedHeader, { borderBottomColor: colors.border }]}>
        <View style={styles.headerSide}>
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
            onPress={() => setShowCreateModal(true)}
            accessibilityRole="button"
          >
            <Ionicons name="add" size={22} color={colors.primary} />
          </TouchableOpacity>
          {/* invisible placeholder to visually balance the second button on the right */}
          <View style={styles.headerIconPlaceholder} />
        </View>
        <View style={styles.headerTitleWrap}>
          <Text
            style={[
              styles.headerTitle,
              { color: colors.textPrimary },
              isHebrewUi && styles.rtlText,
            ]}
            numberOfLines={1}
          >
            StudyFeed
          </Text>
        </View>
        <View style={[styles.headerSide, styles.headerActions]}>
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
            onPress={handleOpenNotifications}
            accessibilityRole="button"
          >
            <Ionicons name="notifications-outline" size={22} color={colors.primary} />
            {notificationsUnreadCount > 0 ? <View style={styles.headerNotificationDot} /> : null}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
            onPress={() => router.push('/chat' as any)}
            accessibilityRole="button"
          >
            <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.primary} />
            {chatUnreadCount > 0 ? (
              <View style={styles.chatUnreadBadge}>
                <Text style={styles.chatUnreadBadgeText}>
                  {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.topDecorWrap, { borderBottomColor: colors.border }]}>
        <View style={[styles.topDecorPrimary, { backgroundColor: colors.primary }]} />
        <View style={[styles.topDecorAccent, { backgroundColor: colors.accent }]} />
      </View>

      {loadingPosts ? (
        <View style={styles.feedBody}>
          <AppCard style={[styles.emptyCard, { borderColor: colors.border }]}>
            <ActivityIndicator color={colors.primary} style={{ marginBottom: spacing.sm }} />
            <Text style={[styles.emptyStateTitle, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
              {t('common.loading')}
            </Text>
            <Text style={[styles.emptyStateSubtitle, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
              {t('feed.title')}
            </Text>
          </AppCard>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={posts}
          renderItem={renderPost}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.feedContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <AppCard style={[styles.emptyCard, { borderColor: colors.border }]}>
              <Ionicons name="newspaper-outline" size={40} color={colors.textSecondary} style={{ alignSelf: 'center' }} />
              <Text style={[styles.emptyStateTitle, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
                {t('feed.noPosts')}
              </Text>
              <Text style={[styles.emptyStateSubtitle, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
                {t('feed.createPost')}
              </Text>
            </AppCard>
          }
        />
      )}

      <Modal
        visible={showNotificationsModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowNotificationsModal(false)}
      >
        <SafeAreaProvider style={[styles.notificationsModalRoot, { backgroundColor: colors.bg }]}>
          <FeedNotificationsModalBody
            onClose={() => setShowNotificationsModal(false)}
            notificationsFilter={notificationsFilter}
            setNotificationsFilter={setNotificationsFilter}
            groupedNotifications={groupedNotifications}
            notificationText={notificationText}
            notificationRowTypeIcon={notificationRowTypeIcon}
          />
        </SafeAreaProvider>
      </Modal>

      {/* Create Post Modal — nested SafeAreaProvider + local header for correct first-open insets */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <SafeAreaProvider style={{ flex: 1, backgroundColor: colors.surface }}>
          <CreatePostModalBody
            onClose={() => setShowCreateModal(false)}
            courses={courses}
            selectedCourse={selectedCourse}
            setSelectedCourse={setSelectedCourse}
            showCoursePicker={showCoursePicker}
            setShowCoursePicker={setShowCoursePicker}
            selectedType={selectedType}
            setSelectedType={setSelectedType}
            visibility={visibility}
            setVisibility={setVisibility}
            attachments={attachments}
            setAttachments={setAttachments}
            uploadingAttachment={uploadingAttachment}
            newTitle={newTitle}
            setNewTitle={setNewTitle}
            newContent={newContent}
            setNewContent={setNewContent}
            newTags={newTags}
            setNewTags={setNewTags}
            publishing={publishing}
            onPublish={handlePublishPost}
            onPickAttachment={handlePickAttachment}
            coursesLoading={coursesLoading}
          />
        </SafeAreaProvider>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  headerTitleWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: 100,
  },
  headerActions: {
    gap: 10,
  },
  headerIconPlaceholder: {
    width: 44,
    height: 44,
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
  notificationsModalRoot: {
    flex: 1,
  },
  notificationsLocalHeader: {
    width: '100%',
    zIndex: 20,
    elevation: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  notificationsLocalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    minHeight: 56,
  },
  notificationsHeaderBackBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationsHeaderTitleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  notificationsHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  notificationsHeaderSpacer: {
    width: 44,
    height: 44,
  },
  notificationsModalTopDecor: {
    position: 'relative',
    overflow: 'hidden',
    height: 26,
    marginHorizontal: layout.screenPadding,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    borderBottomWidth: 1,
  },
  notificationsModalScroll: {
    flex: 1,
  },
  feedBody: {
    flex: 1,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
  },
  headerNotificationDot: {
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
  chatUnreadBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
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
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: 100,
  },
  postCardOuter: {
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  postCardOuterPressed: {
    opacity: 0.94,
  },
  postCardInner: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  postTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  authorBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    gap: 8,
    paddingVertical: 2,
    paddingHorizontal: 2,
    borderRadius: radius.md,
  },
  authorBlockPressed: {
    opacity: 0.88,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  authorTextStack: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  authorName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 1,
  },
  authorInstitution: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.md,
    borderWidth: 1,
    maxWidth: '40%',
    flexShrink: 0,
    alignSelf: 'center',
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  courseTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: 6,
  },
  courseTagText: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  postVisibilityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: 6,
  },
  postVisibilityPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  postTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
    lineHeight: 22,
  },
  postContent: {
    fontSize: 14,
    lineHeight: 19,
    marginBottom: 6,
  },
  postImageWrap: {
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: 6,
    maxHeight: 200,
  },
  postImage: {
    width: '100%',
    height: 180,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 6,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  postFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    marginTop: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
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
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  notificationsFilterShell: {
    marginHorizontal: layout.screenPadding,
    marginTop: spacing.xs,
    padding: 4,
  },
  notificationsTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  notificationTab: {
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  notificationTabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  notificationsBody: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  notificationsSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  notificationCardWrap: {
    marginBottom: spacing.sm,
  },
  notificationCard: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  notificationRowInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  notificationTypeIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  notificationAvatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  notificationTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  notificationText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  notificationSubText: {
    marginTop: 3,
    fontSize: 12,
    fontStyle: 'italic',
  },
  notificationMeta: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    minWidth: 44,
    gap: 4,
  },
  notificationTime: {
    fontSize: 11,
    fontWeight: '500',
  },
  notificationUnreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  notificationsEmptyCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginTop: spacing.md,
  },
  notificationsEmptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  createModalRoot: {
    flex: 1,
  },
  createModalKeyboard: {
    flex: 1,
  },
  createPostModalHeaderShell: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 20,
    elevation: 8,
  },
  createPostModalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: layout.screenPadding,
  },
  createPostModalCloseWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createPostModalHeaderTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  createPostModalHeaderSideSlot: {
    width: 44,
    height: 44,
  },
  createModalScroll: {
    flex: 1,
    paddingHorizontal: layout.screenPadding,
  },
  createModalScrollContent: {
    flexGrow: 1,
    paddingTop: spacing.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: spacing.md,
  },
  input: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  inputPlaceholder: {
    fontSize: 14,
    flex: 1,
  },
  inputValue: {
    fontSize: 14,
    flex: 1,
    fontWeight: '600',
  },
  pickerList: {
    marginTop: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pickerItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerItemText: {
    fontSize: 14,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 14,
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
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  typeOptionText: {
    fontSize: 12,
  },
  visibilityOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  visibilityOption: {
    flexGrow: 1,
    minWidth: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  visibilityOptionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  attachButton: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 12,
  },
  attachButtonText: {
    fontSize: 14,
    fontWeight: '700',
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
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  attachmentChipText: {
    flex: 1,
    fontSize: 13,
  },
  publishButtonPrimary: {
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
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

