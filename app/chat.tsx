import { useUser } from '@/lib/UserContext';
import { db } from '@/lib/firebaseConfig';
import { createVoiceRoom, joinVoiceRoom } from '@/lib/voiceRoomService';
import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppHeader } from '@/frontend/components/ui/AppHeader';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { PrimaryButton } from '@/frontend/components/ui/PrimaryButton';
import { layout, radius, spacing } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

type ChatThread = {
  id: string;
  title: string;
  type: 'direct' | 'course' | 'group';
  members: string[];
  updatedAtMs: number;
  lastMessage?: string;
  avatarUrl?: string;
  isPinned?: boolean;
  isMuted?: boolean;
  unreadCount?: number;
  updatedLabel?: string;
};

type UserOption = {
  uid: string;
  name: string;
  role?: string;
  avatarUrl?: string;
};

function NewChatModalShell({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const topInset =
    insets.top > 0 ? insets.top : Platform.OS === 'ios' ? 47 : StatusBar.currentHeight ?? 0;

  return (
    <View style={[styles.newChatModalRoot, { backgroundColor: colors.bg, paddingTop: topInset }]}>
      {children}
    </View>
  );
}

export default function ChatScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const isHebrewUi = i18n.language === 'he';
  const { firebaseUser } = useUser();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [followedUsers, setFollowedUsers] = useState<UserOption[]>([]);
  const [allUsersDirectory, setAllUsersDirectory] = useState<UserOption[]>([]);
  const [allUsersLoaded, setAllUsersLoaded] = useState(false);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [groupName, setGroupName] = useState('');
  const [newChatStep, setNewChatStep] = useState<'main' | 'group'>('main');
  const [selectedGroupUserIds, setSelectedGroupUserIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [showRoomMenuModal, setShowRoomMenuModal] = useState(false);
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [showJoinRoomModal, setShowJoinRoomModal] = useState(false);
  const [roomTitleInput, setRoomTitleInput] = useState('');
  const [roomPasswordInput, setRoomPasswordInput] = useState('');
  const [joinRoomIdInput, setJoinRoomIdInput] = useState('');
  const [joinRoomPasswordInput, setJoinRoomPasswordInput] = useState('');
  const [roomActionLoading, setRoomActionLoading] = useState(false);

  const formatTimeAgo = (ms: number) => {
    if (!ms) return '';
    const diffMin = Math.floor((Date.now() - ms) / 60000);
    if (diffMin < 1) return 'now';
    if (diffMin < 60) return `${diffMin}m`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h`;
    const diffD = Math.floor(diffH / 24);
    return `${diffD}d`;
  };

  useEffect(() => {
    if (!firebaseUser) return;
    const q = query(
      collection(db, 'chatThreads'),
      where('members', 'array-contains', firebaseUser.uid)
    );
    const unsub = onSnapshot(
      q,
      async (snap) => {
        const list = await Promise.all(
          snap.docs.map(async (d) => {
          const data = d.data() as any;
          let resolvedTitle = data.title || t('chat.title');
          let avatarUrl = '';
          if (data.type === 'direct' && firebaseUser) {
            const otherUid = (data.members || []).find((uid: string) => uid !== firebaseUser.uid);
            if (otherUid) {
              const otherSnap = await getDoc(doc(db, 'users', otherUid));
              if (otherSnap.exists()) {
                const otherData = otherSnap.data() as any;
                resolvedTitle = otherData.fullName || otherData.username || resolvedTitle;
                avatarUrl = otherData.profilePictureUrl || '';
              }
            }
          }
          return {
            id: d.id,
            title: resolvedTitle,
            type: (data.type || 'direct') as 'direct' | 'course' | 'group',
            members: data.members || [],
            updatedAtMs: data.updatedAt?.toDate ? data.updatedAt.toDate().getTime() : 0,
            lastMessage: data.lastMessage || '',
            avatarUrl,
            isPinned: firebaseUser ? (data.pinnedBy || []).includes(firebaseUser.uid) : false,
            isMuted: firebaseUser ? (data.mutedBy || []).includes(firebaseUser.uid) : false,
            unreadCount: firebaseUser ? Number(data.unreadCountBy?.[firebaseUser.uid] || 0) : 0,
            updatedLabel: formatTimeAgo(data.updatedAt?.toDate ? data.updatedAt.toDate().getTime() : 0),
          } as ChatThread;
        })
        );
        list.sort((a, b) => {
          const pinDiff = Number(!!b.isPinned) - Number(!!a.isPinned);
          if (pinDiff !== 0) return pinDiff;
          return b.updatedAtMs - a.updatedAtMs;
        });
        setThreads(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [firebaseUser]);

  const loadOptionsForNewChat = async () => {
    if (!firebaseUser) return;
    const followsSnap = await getDocs(query(collection(db, 'follows'), where('followerId', '==', firebaseUser.uid)));
    const followedIds: string[] = [];
    followsSnap.forEach((f) => {
      const data = f.data() as any;
      if (data?.followingId) followedIds.push(data.followingId);
    });
    const followedDocs = await Promise.all(
      followedIds.map((uid) => getDoc(doc(db, 'users', uid)))
    );
    const followedList: UserOption[] = [];
    followedDocs.forEach((u) => {
      if (!u.exists()) return;
      const data = u.data() as any;
      followedList.push({
        uid: u.id,
        name: data.fullName || data.username || 'User',
        role: data.role,
        avatarUrl: data.profilePictureUrl || '',
      });
    });
    setFollowedUsers(followedList.slice(0, 200));
  };

  const loadAllUsersDirectory = async () => {
    if (!firebaseUser || allUsersLoaded) return;
    try {
      setSearchingUsers(true);
      const usersSnap = await getDocs(collection(db, 'users'));
      const users: UserOption[] = [];
      usersSnap.forEach((u) => {
        if (u.id === firebaseUser.uid) return;
        const data = u.data() as any;
        users.push({
          uid: u.id,
          name: data.fullName || data.username || 'User',
          role: data.role,
          avatarUrl: data.profilePictureUrl || '',
        });
      });
      setAllUsersDirectory(users.slice(0, 1500));
      setAllUsersLoaded(true);
    } finally {
      setSearchingUsers(false);
    }
  };

  const openNewChatModal = async () => {
    setShowNewChatModal(true);
    setNewChatStep('main');
    setSearchQuery('');
    setGroupSearchQuery('');
    setGroupName('');
    setSelectedGroupUserIds([]);
    if (!followedUsers.length) {
      await loadOptionsForNewChat();
    }
  };

  useEffect(() => {
    if (!showNewChatModal) return;
    if (!searchQuery.trim() && !groupSearchQuery.trim()) return;
    if (allUsersLoaded || searchingUsers) return;
    loadAllUsersDirectory().catch(() => {});
  }, [showNewChatModal, searchQuery, groupSearchQuery, allUsersLoaded, searchingUsers]);

  const createDirectChat = async (target: UserOption) => {
    if (!firebaseUser) return;
    try {
      setCreating(true);
      const sorted = [firebaseUser.uid, target.uid].sort();
      const chatId = `direct_${sorted[0]}_${sorted[1]}`;
      const threadRef = doc(db, 'chatThreads', chatId);
      const existing = await getDoc(threadRef);
      if (!existing.exists()) {
        await setDoc(threadRef, {
          type: 'direct',
          title: target.name,
          members: sorted,
          createdBy: firebaseUser.uid,
          updatedAt: serverTimestamp(),
          lastMessage: '',
        });
      }
      setShowNewChatModal(false);
      router.push({
        pathname: '/chat/[chatId]',
        params: {
          chatId,
          conversationId: chatId,
          friendId: target.uid,
          friendName: target.name,
          friendAvatar: '',
        },
      } as any);
    } finally {
      setCreating(false);
    }
  };

  const createGroupChat = async () => {
    if (!firebaseUser) return;
    if (selectedGroupUserIds.length < 2) return;
    try {
      setCreating(true);
      const members = Array.from(new Set([firebaseUser.uid, ...selectedGroupUserIds])).sort();
      const titleNames = followedUsers
        .filter((u) => selectedGroupUserIds.includes(u.uid))
        .slice(0, 3)
        .map((u) => u.name);
      const title = groupName.trim() || (titleNames.length ? titleNames.join(', ') : t('chat.groupChat'));
      const threadRef = doc(collection(db, 'chatThreads'));
      await setDoc(threadRef, {
        type: 'group',
        title,
        members,
        createdBy: firebaseUser.uid,
        updatedAt: serverTimestamp(),
        lastMessage: '',
      });
      setShowNewChatModal(false);
      router.push({
        pathname: '/chat/[chatId]',
        params: {
          chatId: threadRef.id,
          conversationId: threadRef.id,
        },
      } as any);
    } finally {
      setCreating(false);
    }
  };

  const handleThreadLongPress = (thread: ChatThread) => {
    if (!firebaseUser) return;
    Alert.alert(t('chat.options.title'), thread.title, [
      {
        text: thread.isPinned ? t('chat.options.unpin') : t('chat.options.pin'),
        onPress: async () => {
          await updateDoc(doc(db, 'chatThreads', thread.id), {
            pinnedBy: thread.isPinned ? arrayRemove(firebaseUser.uid) : arrayUnion(firebaseUser.uid),
          });
        },
      },
      {
        text: thread.isMuted ? t('chat.options.unmute') : t('chat.options.mute'),
        onPress: async () => {
          await updateDoc(doc(db, 'chatThreads', thread.id), {
            mutedBy: thread.isMuted ? arrayRemove(firebaseUser.uid) : arrayUnion(firebaseUser.uid),
          });
        },
      },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          await updateDoc(doc(db, 'chatThreads', thread.id), {
            members: arrayRemove(firebaseUser.uid),
            pinnedBy: arrayRemove(firebaseUser.uid),
            mutedBy: arrayRemove(firebaseUser.uid),
          });
        },
      },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const emptyState = useMemo(
    () => (
      <AppCard style={[styles.emptyCard, { borderColor: colors.border }]}>
        <Ionicons name="chatbubbles-outline" size={42} color={colors.textSecondary} style={{ alignSelf: 'center' }} />
        <Text style={[styles.emptyTitle, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
          {t('chat.empty.title')}
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
          {t('chat.empty.subtitle')}
        </Text>
      </AppCard>
    ),
    [colors.border, colors.textPrimary, colors.textSecondary, isHebrewUi, t]
  );

  const filteredFollowedUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return followedUsers;
    return followedUsers.filter((u) => u.name.toLowerCase().includes(q));
  }, [followedUsers, searchQuery]);

  const searchableUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return filteredFollowedUsers;
    const merged = [...followedUsers, ...allUsersDirectory];
    const seen = new Set<string>();
    return merged
      .filter((u) => {
        if (seen.has(u.uid)) return false;
        seen.add(u.uid);
        return u.name.toLowerCase().includes(q);
      })
      .slice(0, 200);
  }, [searchQuery, followedUsers, allUsersDirectory, filteredFollowedUsers]);

  const filteredGroupUsers = useMemo(() => {
    const q = groupSearchQuery.trim().toLowerCase();
    if (!q) return followedUsers;
    const merged = [...followedUsers, ...allUsersDirectory];
    const seen = new Set<string>();
    return merged
      .filter((u) => {
        if (seen.has(u.uid)) return false;
        seen.add(u.uid);
        return u.name.toLowerCase().includes(q);
      })
      .slice(0, 200);
  }, [followedUsers, allUsersDirectory, groupSearchQuery]);

  const selectedGroupUsers = useMemo(
    () => followedUsers.filter((u) => selectedGroupUserIds.includes(u.uid)),
    [followedUsers, selectedGroupUserIds]
  );

  const toggleSelectGroupUser = (uid: string) => {
    setSelectedGroupUserIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleCreateVoiceRoom = async () => {
    if (roomPasswordInput.trim().length < 4) {
      Alert.alert(t('common.error'), t('voiceRoom.passwordTooShort'));
      return;
    }
    setRoomActionLoading(true);
    try {
      const password = roomPasswordInput.trim();
      const { roomId } = await createVoiceRoom(password, roomTitleInput);
      setShowCreateRoomModal(false);
      setRoomTitleInput('');
      setRoomPasswordInput('');
      router.push({
        pathname: '/voice-room/[roomId]',
        params: { roomId, password },
      } as any);
    } catch {
      Alert.alert(t('common.error'), t('voiceRoom.createFailed'));
    } finally {
      setRoomActionLoading(false);
    }
  };

  const handleJoinVoiceRoom = async () => {
    if (!joinRoomIdInput.trim() || joinRoomPasswordInput.trim().length < 4) {
      Alert.alert(t('common.error'), t('voiceRoom.joinInvalid'));
      return;
    }
    setRoomActionLoading(true);
    try {
      await joinVoiceRoom(joinRoomIdInput, joinRoomPasswordInput);
      setShowJoinRoomModal(false);
      const password = joinRoomPasswordInput;
      const roomId = joinRoomIdInput.trim().toUpperCase();
      setJoinRoomIdInput('');
      setJoinRoomPasswordInput('');
      router.push({
        pathname: '/voice-room/[roomId]',
        params: { roomId, password },
      } as any);
    } catch (error: any) {
      const code = error?.message;
      if (code === 'ROOM_NOT_FOUND') {
        Alert.alert(t('common.error'), t('voiceRoom.roomNotFound'));
      } else if (code === 'WRONG_PASSWORD') {
        Alert.alert(t('common.error'), t('voiceRoom.wrongPassword'));
      } else if (code === 'ROOM_INACTIVE') {
        Alert.alert(t('common.error'), t('voiceRoom.roomInactive'));
      } else {
        Alert.alert(t('common.error'), t('voiceRoom.joinFailed'));
      }
    } finally {
      setRoomActionLoading(false);
    }
  };

  const openThread = (thread: ChatThread) => {
    if (!firebaseUser) return;
    const otherUid = thread.type === 'direct' ? thread.members.find((uid) => uid !== firebaseUser.uid) || '' : '';
    router.push({
      pathname: '/chat/[chatId]',
      params: {
        chatId: thread.id,
        conversationId: thread.id,
        friendId: otherUid,
        friendName: thread.type === 'direct' ? thread.title : '',
        friendAvatar: thread.type === 'direct' ? thread.avatarUrl || '' : '',
      },
    } as any);
  };

  return (
    <AppScreen>
      <AppHeader
        title={t('chat.title')}
        onBack={() => router.back()}
        rightSlot={
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => setShowRoomMenuModal(true)}
              accessibilityRole="button"
              style={[
                styles.headerRoomBtn,
                { backgroundColor: `${colors.primary}12`, borderColor: colors.primary },
              ]}
              activeOpacity={0.85}
            >
              <Ionicons name="headset-outline" size={16} color={colors.primary} />
              <Text style={[styles.headerRoomBtnText, { color: colors.primary }]}>
                {t('voiceRoom.menuButton')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={openNewChatModal}
              accessibilityRole="button"
              style={[
                styles.headerActionBtn,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              ]}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        }
      />

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={emptyState}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.threadItemWrap}
              onPress={() => openThread(item)}
              onLongPress={() => handleThreadLongPress(item)}
              delayLongPress={260}
              activeOpacity={0.88}
            >
              <AppCard
                style={[
                  styles.threadCard,
                  { borderColor: colors.border, backgroundColor: colors.surface },
                ]}
              >
                <View style={[styles.threadRow, isHebrewUi && styles.rtlRow]}>
                  <View style={[styles.threadIconWrap, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                    {item.type === 'group' ? (
                      <Ionicons name="people-outline" size={18} color={colors.primary} />
                    ) : item.avatarUrl ? (
                      <Image source={{ uri: item.avatarUrl }} style={styles.threadAvatar} />
                    ) : (
                      <Ionicons name={item.type === 'course' ? 'school-outline' : 'person-outline'} size={18} color={colors.primary} />
                    )}
                  </View>

                  <View style={styles.threadMain}>
                    <View style={[styles.threadTitleRow, isHebrewUi && styles.rtlRow]}>
                      <Text
                        style={[styles.threadTitle, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      {item.isPinned ? <Ionicons name="pin" size={12} color={colors.warning} /> : null}
                      {item.isMuted ? <Ionicons name="volume-mute" size={12} color={colors.textSecondary} /> : null}
                    </View>

                    {item.unreadCount && item.unreadCount > 0 ? (
                      item.unreadCount === 1 ? (
                        <Text
                          style={[styles.threadLastUnreadSingle, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}
                          numberOfLines={1}
                        >
                          {item.lastMessage || t('chat.newMessage')}
                        </Text>
                      ) : (
                        <Text style={[styles.unreadText, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]} numberOfLines={1}>
                          {item.unreadCount > 4
                            ? t('chat.unread.many')
                            : t('chat.unread.count', { count: item.unreadCount })}
                        </Text>
                      )
                    ) : (
                      <Text style={[styles.threadLast, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]} numberOfLines={1}>
                        {item.lastMessage || t('chat.noMessagesYet')}
                      </Text>
                    )}
                  </View>

                  <View style={styles.threadMeta}>
                    {!!item.unreadCount && item.unreadCount > 0 ? (
                      <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                        <Text style={[styles.unreadBadgeText, { color: colors.textOnPrimary }]}>
                          {item.unreadCount > 99 ? '99+' : String(item.unreadCount)}
                        </Text>
                      </View>
                    ) : (
                      <Text style={[styles.threadTime, { color: colors.textSecondary }]}>{item.updatedLabel}</Text>
                    )}
                  </View>
                </View>
              </AppCard>
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={showNewChatModal} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setShowNewChatModal(false)}>
        <SafeAreaProvider style={styles.newMessageScreen}>
          <KeyboardAvoidingView
            style={styles.newMessageScreen}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}
          >
            <NewChatModalShell>
              <AppHeader
                title={newChatStep === 'main' ? t('chat.newMessage') : t('chat.newGroup')}
                onBack={() => {
                  if (newChatStep === 'group') {
                    setNewChatStep('main');
                    return;
                  }
                  setShowNewChatModal(false);
                }}
              />

            {creating ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.sm }} /> : null}

            {newChatStep === 'main' ? (
              <>
                <AppCard style={[styles.searchCard, { borderColor: colors.border }]}>
                  <View style={[styles.searchRow, isHebrewUi && styles.rtlRow]}>
                    <Ionicons name="search" size={16} color={colors.textSecondary} />
                    <TextInput
                      style={[styles.searchInput, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      placeholder={t('chat.searchUsers')}
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                </AppCard>

                <TouchableOpacity activeOpacity={0.9} onPress={() => setNewChatStep('group')}>
                  <AppCard style={[styles.actionCard, { borderColor: colors.border }]}>
                    <View style={[styles.actionRow, isHebrewUi && styles.rtlRow]}>
                      <View style={[styles.actionIcon, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                        <Ionicons name="people-outline" size={18} color={colors.primary} />
                      </View>
                      <View style={styles.actionTextWrap}>
                        <Text style={[styles.actionTitle, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
                          {t('chat.groupChat')}
                        </Text>
                        <Text style={[styles.actionSubtitle, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
                          {t('chat.newGroup')}
                        </Text>
                      </View>
                      <Ionicons
                        name={isHebrewUi ? 'chevron-back' : 'chevron-forward'}
                        size={18}
                        color={colors.textSecondary}
                        style={styles.actionChevron}
                      />
                    </View>
                  </AppCard>
                </TouchableOpacity>

                <Text style={[styles.sectionTitle, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
                  {searchQuery.trim() ? t('chat.results') : t('chat.suggested')}
                </Text>
                {searchingUsers && searchQuery.trim() ? (
                  <ActivityIndicator color={colors.primary} style={{ marginBottom: spacing.sm }} />
                ) : null}
                <FlatList
                  data={searchableUsers}
                  keyExtractor={(item) => item.uid}
                  style={styles.newMessageList}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="interactive"
                  ListEmptyComponent={
                    <Text style={[styles.emptyOptionText, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
                      {t('search.noResults')}
                    </Text>
                  }
                  renderItem={({ item }) => (
                    <TouchableOpacity activeOpacity={0.9} onPress={() => createDirectChat(item)} style={styles.userRowWrap}>
                      <AppCard style={[styles.userRowCard, { borderColor: colors.border }]}>
                        <View style={[styles.userRow, isHebrewUi && styles.rtlRow]}>
                          <View style={[styles.optionAvatarWrap, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                            {item.avatarUrl ? (
                              <Image source={{ uri: item.avatarUrl }} style={styles.optionAvatar} />
                            ) : (
                              <Ionicons name="person" size={14} color={colors.primary} />
                            )}
                          </View>
                          <Text style={[styles.optionText, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]} numberOfLines={1}>
                            {item.name}
                          </Text>
                        </View>
                      </AppCard>
                    </TouchableOpacity>
                  )}
                />
              </>
            ) : (
              <>
                <AppCard style={[styles.searchCard, { borderColor: colors.border }]}>
                  <View style={[styles.searchRow, isHebrewUi && styles.rtlRow]}>
                    <Ionicons name="search" size={16} color={colors.textSecondary} />
                    <TextInput
                      style={[styles.searchInput, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}
                      value={groupSearchQuery}
                      onChangeText={setGroupSearchQuery}
                      placeholder={t('chat.searchUsers')}
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                </AppCard>

                <AppCard style={[styles.searchCard, { borderColor: colors.border }]}>
                  <View style={[styles.searchRow, isHebrewUi && styles.rtlRow]}>
                    <Ionicons name="create-outline" size={16} color={colors.textSecondary} />
                    <TextInput
                      style={[styles.searchInput, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}
                      value={groupName}
                      onChangeText={setGroupName}
                      placeholder={t('chat.groupNamePlaceholder')}
                      placeholderTextColor={colors.textSecondary}
                      maxLength={60}
                    />
                  </View>
                </AppCard>

                {!!selectedGroupUsers.length ? (
                  <View style={styles.chipsWrap}>
                    {selectedGroupUsers.map((user) => (
                      <View key={user.uid} style={[styles.userChip, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                        <Text style={[styles.userChipText, { color: colors.textPrimary }]} numberOfLines={1}>
                          {user.name}
                        </Text>
                        <TouchableOpacity onPress={() => toggleSelectGroupUser(user.uid)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="close" size={14} color={colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : null}

                <Text style={[styles.sectionTitle, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>{t('chat.suggested')}</Text>
                {searchingUsers && groupSearchQuery.trim() ? (
                  <ActivityIndicator color={colors.primary} style={{ marginBottom: spacing.sm }} />
                ) : null}
                <FlatList
                  data={filteredGroupUsers}
                  keyExtractor={(item) => item.uid}
                  style={styles.newMessageList}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="interactive"
                  ListEmptyComponent={
                    <Text style={[styles.emptyOptionText, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
                      {t('search.noResults')}
                    </Text>
                  }
                  renderItem={({ item }) => {
                    const selected = selectedGroupUserIds.includes(item.uid);
                    return (
                      <TouchableOpacity activeOpacity={0.9} onPress={() => toggleSelectGroupUser(item.uid)} style={styles.userRowWrap}>
                        <AppCard style={[styles.userRowCard, { borderColor: colors.border }]}>
                          <View style={[styles.userRow, isHebrewUi && styles.rtlRow]}>
                            <View style={[styles.optionAvatarWrap, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                              {item.avatarUrl ? (
                                <Image source={{ uri: item.avatarUrl }} style={styles.optionAvatar} />
                              ) : (
                                <Ionicons name="person" size={14} color={colors.primary} />
                              )}
                            </View>
                            <Text style={[styles.optionText, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]} numberOfLines={1}>
                              {item.name}
                            </Text>
                            <View
                              style={[
                                styles.checkbox,
                                { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : 'transparent' },
                                isHebrewUi && { marginLeft: 0, marginRight: 'auto' },
                              ]}
                            >
                              {selected ? <Ionicons name="checkmark" size={12} color={colors.textOnPrimary} /> : null}
                            </View>
                          </View>
                        </AppCard>
                      </TouchableOpacity>
                    );
                  }}
                />

                <View style={styles.footerCta}>
                  <PrimaryButton
                    label={t('chat.createGroup')}
                    onPress={createGroupChat}
                    disabled={selectedGroupUserIds.length < 2 || creating}
                    loading={creating}
                  />
                </View>
              </>
            )}
            </NewChatModalShell>
          </KeyboardAvoidingView>
        </SafeAreaProvider>
      </Modal>

      <Modal visible={showRoomMenuModal} transparent animationType="fade" onRequestClose={() => setShowRoomMenuModal(false)}>
        <Pressable style={styles.voiceRoomOverlay} onPress={() => setShowRoomMenuModal(false)}>
          <Pressable
            style={[styles.voiceRoomSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.voiceRoomTitle, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
              {t('voiceRoom.menuTitle')}
            </Text>
            <PrimaryButton
              label={t('voiceRoom.createAction')}
              onPress={() => {
                setShowRoomMenuModal(false);
                setShowCreateRoomModal(true);
              }}
              style={{ marginBottom: spacing.sm }}
            />
            <PrimaryButton
              label={t('voiceRoom.joinAction')}
              variant="secondary"
              onPress={() => {
                setShowRoomMenuModal(false);
                setShowJoinRoomModal(true);
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showCreateRoomModal} transparent animationType="fade" onRequestClose={() => setShowCreateRoomModal(false)}>
        <Pressable style={styles.voiceRoomOverlay} onPress={() => setShowCreateRoomModal(false)}>
          <Pressable
            style={[styles.voiceRoomSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.voiceRoomTitle, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
              {t('voiceRoom.createTitle')}
            </Text>
            <Text style={[styles.voiceRoomHint, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
              {t('voiceRoom.createHint')}
            </Text>
            <TextInput
              style={[styles.voiceRoomInput, { color: colors.textPrimary, borderColor: colors.border }, isHebrewUi && styles.rtlText]}
              value={roomTitleInput}
              onChangeText={setRoomTitleInput}
              placeholder={t('voiceRoom.roomTitlePlaceholder')}
              placeholderTextColor={colors.textSecondary}
            />
            <TextInput
              style={[styles.voiceRoomInput, { color: colors.textPrimary, borderColor: colors.border }, isHebrewUi && styles.rtlText]}
              value={roomPasswordInput}
              onChangeText={setRoomPasswordInput}
              placeholder={t('voiceRoom.passwordPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
            />
            <PrimaryButton
              label={t('voiceRoom.createAction')}
              onPress={() => void handleCreateVoiceRoom()}
              loading={roomActionLoading}
              style={{ marginTop: spacing.sm }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showJoinRoomModal} transparent animationType="fade" onRequestClose={() => setShowJoinRoomModal(false)}>
        <Pressable style={styles.voiceRoomOverlay} onPress={() => setShowJoinRoomModal(false)}>
          <Pressable
            style={[styles.voiceRoomSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.voiceRoomTitle, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}>
              {t('voiceRoom.joinTitle')}
            </Text>
            <TextInput
              style={[styles.voiceRoomInput, { color: colors.textPrimary, borderColor: colors.border }, isHebrewUi && styles.rtlText]}
              value={joinRoomIdInput}
              onChangeText={setJoinRoomIdInput}
              placeholder={t('voiceRoom.roomIdPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="characters"
            />
            <TextInput
              style={[styles.voiceRoomInput, { color: colors.textPrimary, borderColor: colors.border }, isHebrewUi && styles.rtlText]}
              value={joinRoomPasswordInput}
              onChangeText={setJoinRoomPasswordInput}
              placeholder={t('voiceRoom.passwordPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
            />
            <PrimaryButton
              label={t('voiceRoom.joinAction')}
              onPress={() => void handleJoinVoiceRoom()}
              loading={roomActionLoading}
              style={{ marginTop: spacing.sm }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerRoomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 7,
    maxWidth: 108,
  },
  headerRoomBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  headerActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceRoomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: layout.screenPadding,
  },
  voiceRoomSheet: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  voiceRoomTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  voiceRoomHint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  voiceRoomInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: spacing.sm,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  threadItemWrap: {
    marginBottom: spacing.sm,
  },
  threadCard: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  threadIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
  },
  threadAvatar: {
    width: '100%',
    height: '100%',
  },
  threadMain: { flex: 1, minWidth: 0 },
  threadTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  threadTitle: { fontSize: 16, fontWeight: '800', flexShrink: 1 },
  threadLast: { marginTop: 3, fontSize: 13, fontWeight: '600' },
  threadLastUnreadSingle: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: '800',
  },
  unreadText: {
    marginTop: 5,
    fontSize: 13,
    fontWeight: '800',
  },
  threadMeta: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 52,
  },
  threadTime: {
    fontSize: 12,
    fontWeight: '600',
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  emptyCard: {
    marginTop: spacing.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  emptyTitle: {
    marginTop: spacing.sm,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptySubtitle: {
    marginTop: spacing.xs,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  newMessageScreen: {
    flex: 1,
  },
  newChatModalRoot: {
    flex: 1,
  },
  emptyOptionText: {
    paddingVertical: 8,
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: layout.screenPadding,
  },
  searchCard: {
    marginHorizontal: layout.screenPadding,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 0,
    minHeight: 22,
  },
  actionCard: {
    marginHorizontal: layout.screenPadding,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  actionSubtitle: {
    marginTop: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  actionChevron: {
    marginLeft: 'auto',
  },
  optionAvatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
  },
  optionAvatar: {
    width: '100%',
    height: '100%',
  },
  optionText: { fontSize: 14, fontWeight: '700', flex: 1, minWidth: 0 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    paddingHorizontal: layout.screenPadding,
  },
  newMessageList: {
    flex: 1,
    paddingHorizontal: layout.screenPadding,
  },
  userRowWrap: {
    marginBottom: spacing.xs,
  },
  userRowCard: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: layout.screenPadding,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  userChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  userChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  checkbox: {
    marginLeft: 'auto',
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerCta: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  rtlRow: {
    flexDirection: 'row-reverse',
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
