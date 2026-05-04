import { useUser } from '@/lib/UserContext';
import { db } from '@/lib/firebaseConfig';
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
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const PRIMARY_GREEN = '#047857';

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

export default function ChatScreen() {
  const router = useRouter();
  const { t } = useTranslation();
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
      <View style={styles.emptyState}>
        <Ionicons name="chatbubbles-outline" size={48} color="#9ca3af" />
        <Text style={styles.emptyStateTitle}>{t('chat.empty.title')}</Text>
        <Text style={styles.emptyStateSubtitle}>{t('chat.empty.subtitle')}</Text>
      </View>
    ),
    [t]
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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('chat.title')}</Text>
        <TouchableOpacity onPress={openNewChatModal}>
          <Ionicons name="add-circle" size={24} color={PRIMARY_GREEN} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={PRIMARY_GREEN} />
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={emptyState}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.threadItem}
              onPress={() => openThread(item)}
              onLongPress={() => handleThreadLongPress(item)}
              delayLongPress={260}
            >
              <View style={styles.threadIconWrap}>
                {item.type === 'group' ? (
                  <Ionicons
                    name="people-outline"
                    size={18}
                    color={PRIMARY_GREEN}
                  />
                ) : item.avatarUrl ? (
                  <Image source={{ uri: item.avatarUrl }} style={styles.threadAvatar} />
                ) : (
                  <Ionicons
                    name={item.type === 'course' ? 'people-outline' : 'person-outline'}
                    size={18}
                    color={PRIMARY_GREEN}
                  />
                )}
              </View>
              <View style={styles.threadMain}>
                <View style={styles.threadTitleRow}>
                  <Text style={styles.threadTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {item.isPinned && <Ionicons name="pin" size={12} color="#f59e0b" />}
                  {item.isMuted && <Ionicons name="volume-mute" size={12} color="#9ca3af" />}
                </View>
                {item.unreadCount && item.unreadCount > 0 ? (
                  item.unreadCount === 1 ? (
                    <Text style={styles.threadLastUnreadSingle} numberOfLines={1}>
                      {item.lastMessage || t('chat.newMessage')}
                    </Text>
                  ) : (
                    <Text style={styles.unreadText} numberOfLines={1}>
                      {item.unreadCount > 4 ? t('chat.unread.many') : t('chat.unread.count', { count: item.unreadCount })}
                    </Text>
                  )
                ) : (
                  <Text style={styles.threadLast} numberOfLines={1}>
                    {item.lastMessage || t('chat.noMessagesYet')}
                  </Text>
                )}
              </View>
              {!!item.unreadCount && item.unreadCount > 0 ? (
                <View style={styles.unreadDot} />
              ) : (
                <Text style={styles.threadTime}>{item.updatedLabel}</Text>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={showNewChatModal} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setShowNewChatModal(false)}>
        <KeyboardAvoidingView
          style={styles.newMessageScreen}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <View style={styles.newMessageHeader}>
            <TouchableOpacity
              onPress={() => {
                if (newChatStep === 'group') {
                  setNewChatStep('main');
                  return;
                }
                setShowNewChatModal(false);
              }}
            >
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.newMessageHeaderTitle}>
              {newChatStep === 'main' ? t('chat.newMessage') : t('chat.newGroup')}
            </Text>
            <View style={{ width: 24 }} />
          </View>

          {creating && <ActivityIndicator color={PRIMARY_GREEN} style={{ marginTop: 10 }} />}

          {newChatStep === 'main' ? (
            <>
              <View style={styles.toSearchRow}>
                <Text style={styles.toSearchLabel}>{t('chat.to')}:</Text>
                <TextInput
                  style={styles.toSearchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder={t('chat.searchUsers')}
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <TouchableOpacity style={styles.newMessageGroupRow} onPress={() => setNewChatStep('group')}>
                <View style={styles.createGroupIcon}>
                  <Ionicons name="people" size={16} color={PRIMARY_GREEN} />
                </View>
                <Text style={styles.createGroupText}>{t('chat.groupChat')}</Text>
                <Ionicons name="chevron-forward" size={18} color="#6b7280" style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>

              <Text style={styles.newMessageSectionTitle}>
                {searchQuery.trim() ? t('chat.results') : t('chat.suggested')}
              </Text>
              {searchingUsers && searchQuery.trim() ? (
                <ActivityIndicator color={PRIMARY_GREEN} style={{ marginBottom: 8 }} />
              ) : null}
              <FlatList
                data={searchableUsers}
                keyExtractor={(item) => item.uid}
                style={styles.newMessageList}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                ListEmptyComponent={<Text style={styles.emptyOptionText}>{t('search.noResults')}</Text>}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.newMessageUserRow} onPress={() => createDirectChat(item)}>
                    <View style={styles.optionAvatarWrap}>
                      {item.avatarUrl ? (
                        <Image source={{ uri: item.avatarUrl }} style={styles.optionAvatar} />
                      ) : (
                        <Ionicons name="person" size={14} color={PRIMARY_GREEN} />
                      )}
                    </View>
                    <Text style={styles.optionText}>{item.name}</Text>
                  </TouchableOpacity>
                )}
              />
            </>
          ) : (
            <>
              <View style={styles.toSearchRow}>
                <Text style={styles.toSearchLabel}>{t('chat.to')}:</Text>
                <TextInput
                  style={styles.toSearchInput}
                  value={groupSearchQuery}
                  onChangeText={setGroupSearchQuery}
                  placeholder={t('chat.searchUsers')}
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.groupNameRow}>
                <Text style={styles.groupNameLabel}>{t('chat.groupName')}:</Text>
                <TextInput
                  style={styles.groupNameInput}
                  value={groupName}
                  onChangeText={setGroupName}
                  placeholder={t('chat.groupNamePlaceholder')}
                  placeholderTextColor="#9ca3af"
                  maxLength={60}
                />
              </View>

              {!!selectedGroupUsers.length && (
                <View style={styles.chipsWrap}>
                  {selectedGroupUsers.map((user) => (
                    <View key={user.uid} style={styles.userChip}>
                      <Text style={styles.userChipText} numberOfLines={1}>
                        {user.name}
                      </Text>
                      <TouchableOpacity onPress={() => toggleSelectGroupUser(user.uid)}>
                        <Ionicons name="close" size={14} color="#374151" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <Text style={styles.newMessageSectionTitle}>{t('chat.suggested')}</Text>
              {searchingUsers && groupSearchQuery.trim() ? (
                <ActivityIndicator color={PRIMARY_GREEN} style={{ marginBottom: 8 }} />
              ) : null}
              <FlatList
                data={filteredGroupUsers}
                keyExtractor={(item) => item.uid}
                style={styles.newMessageList}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                ListEmptyComponent={<Text style={styles.emptyOptionText}>{t('search.noResults')}</Text>}
                renderItem={({ item }) => {
                  const selected = selectedGroupUserIds.includes(item.uid);
                  return (
                    <TouchableOpacity style={styles.newMessageUserRow} onPress={() => toggleSelectGroupUser(item.uid)}>
                      <View style={styles.optionAvatarWrap}>
                        {item.avatarUrl ? (
                          <Image source={{ uri: item.avatarUrl }} style={styles.optionAvatar} />
                        ) : (
                          <Ionicons name="person" size={14} color={PRIMARY_GREEN} />
                        )}
                      </View>
                      <Text style={styles.optionText}>{item.name}</Text>
                      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                        {selected && <Ionicons name="checkmark" size={12} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />

              <TouchableOpacity
                style={[
                  styles.createGroupBtn,
                  (selectedGroupUserIds.length < 2 || creating) && styles.createGroupBtnDisabled,
                ]}
                disabled={selectedGroupUserIds.length < 2 || creating}
                onPress={createGroupChat}
              >
                <Text style={styles.createGroupBtnText}>{t('chat.createGroup')}</Text>
              </TouchableOpacity>
            </>
          )}
        </KeyboardAvoidingView>
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
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 14,
    paddingBottom: 30,
  },
  threadItem: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  threadIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  threadAvatar: {
    width: '100%',
    height: '100%',
  },
  threadMain: { flex: 1 },
  threadTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  threadTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  threadLast: { marginTop: 3, fontSize: 14, color: '#6b7280' },
  threadLastUnreadSingle: {
    marginTop: 3,
    fontSize: 15,
    color: '#111827',
    fontWeight: '700',
  },
  unreadText: {
    marginTop: 5,
    fontSize: 13,
    color: '#111827',
    fontWeight: '700',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444',
    marginLeft: 8,
  },
  threadTime: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyState: {
    marginTop: 80,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyStateTitle: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  emptyStateSubtitle: {
    marginTop: 4,
    color: '#6b7280',
    fontSize: 13,
  },
  newMessageScreen: {
    flex: 1,
    backgroundColor: '#fff',
  },
  newMessageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  newMessageHeaderTitle: {
    fontSize: 30,
    fontWeight: '700',
    color: '#111827',
  },
  modalKeyboardWrap: { flex: 1 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalHeader: { flexDirection: 'row' },
  modalSection: { marginTop: 8 },
  optionList: { maxHeight: 300 },
  emptyOptionText: {
    paddingVertical: 8,
    fontSize: 12,
    color: '#6b7280',
  },
  searchWrap: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#111827',
    paddingVertical: 0,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  optionAvatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  optionAvatar: {
    width: '100%',
    height: '100%',
  },
  optionText: { color: '#111827', fontSize: 17, fontWeight: '500' },
  createGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  createGroupIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createGroupText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '700',
  },
  toSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  toSearchLabel: {
    fontSize: 20,
    color: '#6b7280',
    fontWeight: '500',
  },
  toSearchInput: {
    flex: 1,
    fontSize: 17,
    color: '#111827',
    paddingVertical: 0,
  },
  groupNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  groupNameLabel: {
    fontSize: 17,
    color: '#6b7280',
    fontWeight: '500',
  },
  groupNameInput: {
    flex: 1,
    fontSize: 17,
    color: '#111827',
    paddingVertical: 0,
  },
  newMessageGroupRow: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  newMessageSectionTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
    marginBottom: 6,
    paddingHorizontal: 16,
  },
  newMessageList: {
    flex: 1,
    paddingHorizontal: 8,
  },
  newMessageUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 2,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  userChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  userChipText: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '600',
  },
  checkbox: {
    marginLeft: 'auto',
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#9ca3af',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: PRIMARY_GREEN,
    borderColor: PRIMARY_GREEN,
  },
  createGroupBtn: {
    marginTop: 10,
    marginHorizontal: 14,
    marginBottom: 16,
    backgroundColor: PRIMARY_GREEN,
    borderRadius: 14,
    minHeight: 54,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createGroupBtnDisabled: {
    backgroundColor: '#6b7280',
  },
  createGroupBtnText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
});
