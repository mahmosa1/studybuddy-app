import { useUser } from '@/lib/UserContext';
import { db } from '@/lib/firebaseConfig';
import { uploadFeedAttachmentToSupabase } from '@/lib/upload';
import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { layout, radius, spacing } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { Ionicons } from '@expo/vector-icons';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FAST_RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: false,
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 32000,
    numberOfChannels: 1,
    bitRate: 64000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.MEDIUM,
    sampleRate: 32000,
    numberOfChannels: 1,
    bitRate: 64000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/mp4',
    bitsPerSecond: 64000,
  },
};

type ChatMessage = {
  id: string;
  senderUid: string;
  text: string;
  type?: 'text' | 'image' | 'audio';
  mediaUrl?: string;
  fileName?: string;
  createdAtMs: number;
};

type ChatUserMeta = {
  name: string;
  avatarUrl?: string;
};

export default function ChatRoomScreen() {
  const router = useRouter();
  const isScreenFocused = useIsFocused();
  const { firebaseUser } = useUser();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { chatId, friendId, friendName, friendAvatar } = useLocalSearchParams<{
    chatId: string;
    conversationId?: string;
    friendId?: string;
    friendName?: string;
    friendAvatar?: string;
  }>();
  const resolvedFriendId = useMemo(
    () => (Array.isArray(friendId) ? friendId[0] : friendId || ''),
    [friendId]
  );
  const resolvedFriendName = useMemo(
    () => (Array.isArray(friendName) ? friendName[0] : friendName || ''),
    [friendName]
  );
  const resolvedFriendAvatar = useMemo(
    () => (Array.isArray(friendAvatar) ? friendAvatar[0] : friendAvatar || ''),
    [friendAvatar]
  );
  const [title, setTitle] = useState('Chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [chatMembersMeta, setChatMembersMeta] = useState<Record<string, ChatUserMeta>>({});
  const [headerAvatarUrl, setHeaderAvatarUrl] = useState('');
  const [sendingMedia, setSendingMedia] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [threadMembers, setThreadMembers] = useState<string[]>([]);
  const [threadType, setThreadType] = useState<'direct' | 'course' | 'group'>('direct');
  const [showGroupDetailsModal, setShowGroupDetailsModal] = useState(false);
  const [groupDetailsStep, setGroupDetailsStep] = useState<'info' | 'addMembers'>('info');
  const [threadCreatorUid, setThreadCreatorUid] = useState('');
  const [editingGroupName, setEditingGroupName] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState('');
  const [addMemberSearch, setAddMemberSearch] = useState('');
  const [followedAddMemberUsers, setFollowedAddMemberUsers] = useState<Array<{ uid: string; name: string; avatarUrl?: string }>>([]);
  const [allUsersDirectoryForAdd, setAllUsersDirectoryForAdd] = useState<Array<{ uid: string; name: string; avatarUrl?: string }>>([]);
  const [allUsersDirectoryLoadedForAdd, setAllUsersDirectoryLoadedForAdd] = useState(false);
  const [loadingAddMembersUsers, setLoadingAddMembersUsers] = useState(false);
  const [selectedAddMemberIds, setSelectedAddMemberIds] = useState<string[]>([]);
  const [activeAudioMessageId, setActiveAudioMessageId] = useState<string | null>(null);
  const [loadingAudioMessageId, setLoadingAudioMessageId] = useState<string | null>(null);
  const [soundRef, setSoundRef] = useState<Audio.Sound | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isThreadContextReady, setIsThreadContextReady] = useState(false);
  const [isHeaderReady, setIsHeaderReady] = useState(false);
  const [initialUnreadMessageId, setInitialUnreadMessageId] = useState('');
  const lastMarkedReadMessageMsRef = useRef<number>(0);
  const initialLastReadAtRef = useRef<number | null>(null);
  const initialUnreadCountRef = useRef(0);
  const hasComputedInitialUnreadBoundaryRef = useRef(false);
  const hasMarkedReadForOpenRef = useRef(false);
  const messagesListRef = useRef<FlatList<ChatMessage> | null>(null);
  const audioBufferingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const isNearBottomRef = useRef(true);
  const previousMessagesLengthRef = useRef(0);
  const threadLoadSeqRef = useRef(0);
  const audioCacheUriByMessageRef = useRef<Map<string, string>>(new Map());
  const resolvedChatId = useMemo(() => (Array.isArray(chatId) ? chatId[0] : chatId), [chatId]);
  const displayMessages = useMemo(() => [...messages].reverse(), [messages]);
  const groupMembers = useMemo(
    () =>
      threadMembers.map((uid) => ({
        uid,
        name: chatMembersMeta[uid]?.name || 'User',
        avatarUrl: chatMembersMeta[uid]?.avatarUrl || '',
      })),
    [threadMembers, chatMembersMeta]
  );
  const isGroupCreator = !!firebaseUser && threadCreatorUid === firebaseUser.uid;
  const addableUsers = useMemo(() => {
    const q = addMemberSearch.trim().toLowerCase();
    const base = q ? [...followedAddMemberUsers, ...allUsersDirectoryForAdd] : followedAddMemberUsers;
    const seen = new Set<string>();
    return base
      .filter((u) => {
        if (seen.has(u.uid)) return false;
        seen.add(u.uid);
        if (threadMembers.includes(u.uid)) return false;
        if (q && !u.name.toLowerCase().includes(q)) return false;
        return true;
      })
      .slice(0, 150);
  }, [followedAddMemberUsers, allUsersDirectoryForAdd, threadMembers, addMemberSearch]);

  useEffect(() => {
    isNearBottomRef.current = true;
    previousMessagesLengthRef.current = 0;
    initialLastReadAtRef.current = null;
    initialUnreadCountRef.current = 0;
    hasComputedInitialUnreadBoundaryRef.current = false;
    hasMarkedReadForOpenRef.current = false;
    setInitialUnreadMessageId('');
    setTitle(resolvedFriendName || '');
    setHeaderAvatarUrl(resolvedFriendAvatar || '');
    setThreadMembers([]);
    setThreadType('direct');
    setShowGroupDetailsModal(false);
    setGroupDetailsStep('info');
    setThreadCreatorUid('');
    setEditingGroupName(false);
    setGroupNameDraft('');
    setAddMemberSearch('');
    setFollowedAddMemberUsers([]);
    setAllUsersDirectoryForAdd([]);
    setAllUsersDirectoryLoadedForAdd(false);
    setLoadingAddMembersUsers(false);
    setSelectedAddMemberIds([]);
    setChatMembersMeta(
      resolvedFriendId
        ? {
            [resolvedFriendId]: {
              name: resolvedFriendName || 'User',
              avatarUrl: resolvedFriendAvatar || '',
            },
          }
        : {}
    );
    setMessages([]);
    setIsHeaderReady(!!resolvedFriendName);
    setIsThreadContextReady(false);
  }, [resolvedChatId, resolvedFriendAvatar, resolvedFriendId, resolvedFriendName]);

  useEffect(() => {
    if (!isScreenFocused) return;
    isNearBottomRef.current = true;
    previousMessagesLengthRef.current = 0;
    initialLastReadAtRef.current = null;
    initialUnreadCountRef.current = 0;
    hasComputedInitialUnreadBoundaryRef.current = false;
    hasMarkedReadForOpenRef.current = false;
    setInitialUnreadMessageId('');
    setTitle(resolvedFriendName || '');
    setHeaderAvatarUrl(resolvedFriendAvatar || '');
    setThreadMembers([]);
    setThreadType('direct');
    setShowGroupDetailsModal(false);
    setGroupDetailsStep('info');
    setThreadCreatorUid('');
    setEditingGroupName(false);
    setGroupNameDraft('');
    setAddMemberSearch('');
    setFollowedAddMemberUsers([]);
    setAllUsersDirectoryForAdd([]);
    setAllUsersDirectoryLoadedForAdd(false);
    setLoadingAddMembersUsers(false);
    setSelectedAddMemberIds([]);
    setChatMembersMeta(
      resolvedFriendId
        ? {
            [resolvedFriendId]: {
              name: resolvedFriendName || 'User',
              avatarUrl: resolvedFriendAvatar || '',
            },
          }
        : {}
    );
    setMessages([]);
    setIsHeaderReady(!!resolvedFriendName);
    setIsThreadContextReady(false);
  }, [isScreenFocused, resolvedFriendAvatar, resolvedFriendId, resolvedFriendName]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setIsKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const scrollToBottom = (animated = true) => {
    requestAnimationFrame(() => {
      messagesListRef.current?.scrollToOffset({ offset: 0, animated });
      setTimeout(() => {
        messagesListRef.current?.scrollToOffset({ offset: 0, animated });
      }, 80);
    });
  };

  useEffect(() => {
    if (!isScreenFocused) return;
    if (!messages.length) return;

    const prevLength = previousMessagesLengthRef.current;
    previousMessagesLengthRef.current = messages.length;
    if (messages.length <= prevLength) return;

    const latest = messages[messages.length - 1];
    const latestIsMine = latest?.senderUid === firebaseUser?.uid;
    if (isNearBottomRef.current || latestIsMine) {
      scrollToBottom(true);
    }
  }, [firebaseUser, isScreenFocused, messages]);

  useEffect(() => {
    if (!isKeyboardVisible) return;
    const timer = setTimeout(() => {
      scrollToBottom(true);
    }, 80);
    return () => clearTimeout(timer);
  }, [isKeyboardVisible]);

  useEffect(() => {
    if (!showGroupDetailsModal || groupDetailsStep !== 'addMembers') return;
    if (followedAddMemberUsers.length) return;
    loadFollowedUsersForAddMembers().catch(() => {});
  }, [showGroupDetailsModal, groupDetailsStep, followedAddMemberUsers.length]);

  useEffect(() => {
    if (!showGroupDetailsModal || groupDetailsStep !== 'addMembers') return;
    if (!addMemberSearch.trim()) return;
    if (allUsersDirectoryLoadedForAdd || loadingAddMembersUsers) return;
    loadAllUsersForAddMembersSearch().catch(() => {});
  }, [showGroupDetailsModal, groupDetailsStep, addMemberSearch, allUsersDirectoryLoadedForAdd, loadingAddMembersUsers]);

  useEffect(() => {
    if (!isScreenFocused) return;
    if (!resolvedChatId) return;
    let active = true;
    const loadSeq = ++threadLoadSeqRef.current;
    (async () => {
      const snap = await getDoc(doc(db, 'chatThreads', resolvedChatId));
      if (!active || loadSeq !== threadLoadSeqRef.current || !snap.exists()) return;
      const data = snap.data() as any;
      const members: string[] = data.members || [];
      setThreadMembers(members);
      setThreadType((data.type || 'direct') as 'direct' | 'course' | 'group');
      setThreadCreatorUid(data.createdBy || '');
      if (firebaseUser) {
        const previousLastReadAt =
          data?.lastReadAtBy?.[firebaseUser.uid]?.toDate?.().getTime?.() ?? null;
        const previousUnreadCount = Number(data?.unreadCountBy?.[firebaseUser.uid] || 0);
        initialLastReadAtRef.current = previousLastReadAt;
        initialUnreadCountRef.current = previousUnreadCount;
        lastMarkedReadMessageMsRef.current = previousLastReadAt || 0;
      }

      const userDocs = await Promise.all(members.map((uid) => getDoc(doc(db, 'users', uid))));
      if (!active || loadSeq !== threadLoadSeqRef.current) return;
      const next: Record<string, ChatUserMeta> = {};
      userDocs.forEach((u) => {
        if (!u.exists()) return;
        const ud = u.data() as any;
        next[u.id] = {
          name: ud.fullName || ud.username || 'User',
          avatarUrl: ud.profilePictureUrl || '',
        };
      });
      setChatMembersMeta(next);

      if (firebaseUser && data.type === 'direct') {
        const otherUid = resolvedFriendId || members.find((uid) => uid !== firebaseUser.uid);
        if (otherUid) {
          const otherMeta = next[otherUid];
          setHeaderAvatarUrl(otherMeta?.avatarUrl || resolvedFriendAvatar || '');
          setTitle(otherMeta?.name || resolvedFriendName || '');
        } else {
          setHeaderAvatarUrl(resolvedFriendAvatar || '');
          setTitle(resolvedFriendName || '');
        }
      } else {
        setHeaderAvatarUrl('');
        setTitle(data.title || '');
      }
      setGroupNameDraft(data.title || '');
      setIsHeaderReady(true);
      setIsThreadContextReady(true);
    })();

    return () => {
      active = false;
    };
  }, [firebaseUser, resolvedChatId, isScreenFocused, resolvedFriendAvatar, resolvedFriendId, resolvedFriendName]);

  useEffect(() => {
    if (!isScreenFocused) return;
    if (!resolvedChatId) return;
    const q = query(
      collection(db, 'chatThreads', resolvedChatId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: ChatMessage[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        list.push({
          id: d.id,
          senderUid: data.senderUid || '',
          text: data.text || '',
          type: (data.type || 'text') as 'text' | 'image' | 'audio',
          mediaUrl: data.mediaUrl || '',
          fileName: data.fileName || '',
          createdAtMs: data.createdAt?.toDate ? data.createdAt.toDate().getTime() : 0,
        });
      });
      setMessages(list);
      const latestMessageMs = list.length ? list[list.length - 1].createdAtMs : 0;
      if (!firebaseUser) return;

      // Delay mark-read until initial unread boundary has been frozen for this open.
      if (!hasMarkedReadForOpenRef.current) {
        return;
      }

      // While chat is open: keep unread cleared only when a truly newer message arrives.
      if (latestMessageMs > 0 && latestMessageMs > lastMarkedReadMessageMsRef.current) {
        lastMarkedReadMessageMsRef.current = latestMessageMs;
        updateDoc(doc(db, 'chatThreads', resolvedChatId), {
          [`unreadCountBy.${firebaseUser.uid}`]: 0,
          [`lastReadAtBy.${firebaseUser.uid}`]: serverTimestamp(),
        }).catch(() => {});
      }
    });
    return unsub;
  }, [firebaseUser, resolvedChatId, isScreenFocused]);

  useEffect(() => {
    if (!isScreenFocused) return;
    if (!isThreadContextReady) return;
    if (!firebaseUser) return;
    if (hasComputedInitialUnreadBoundaryRef.current) return;

    let boundaryId = '';
    const initialLastReadAt = initialLastReadAtRef.current;
    const initialUnreadCount = initialUnreadCountRef.current;

    if (messages.length > 0) {
      if (initialLastReadAt !== null) {
        boundaryId =
          messages.find((m) => m.senderUid !== firebaseUser.uid && m.createdAtMs > initialLastReadAt)?.id || '';
      } else if (initialUnreadCount > 0) {
        const incomingMessages = messages.filter((m) => m.senderUid !== firebaseUser.uid);
        const firstUnreadIncomingIndex = Math.max(0, incomingMessages.length - initialUnreadCount);
        boundaryId = incomingMessages[firstUnreadIncomingIndex]?.id || '';
      }
    }

    setInitialUnreadMessageId(boundaryId);
    hasComputedInitialUnreadBoundaryRef.current = true;

    const latestMessageMs = messages.length ? messages[messages.length - 1].createdAtMs : 0;
    if (latestMessageMs > 0) {
      lastMarkedReadMessageMsRef.current = latestMessageMs;
    }
    updateDoc(doc(db, 'chatThreads', resolvedChatId), {
      [`unreadCountBy.${firebaseUser.uid}`]: 0,
      [`lastReadAtBy.${firebaseUser.uid}`]: serverTimestamp(),
    }).catch(() => {});
    hasMarkedReadForOpenRef.current = true;
  }, [firebaseUser, isScreenFocused, isThreadContextReady, messages, resolvedChatId]);

  const handleMessagesScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const distanceFromBottom = event.nativeEvent.contentOffset.y;
    isNearBottomRef.current = distanceFromBottom <= 60;
  };

  useEffect(() => {
    return () => {
      if (soundRef) {
        soundRef.unloadAsync().catch(() => {});
      }
      audioBufferingTimeoutsRef.current.forEach((timer) => clearTimeout(timer));
      audioBufferingTimeoutsRef.current.clear();
    };
  }, [soundRef]);

  const sendMessage = async () => {
    if (!firebaseUser || !resolvedChatId || !draft.trim()) return;
    const text = draft.trim();
    setDraft('');
    await addDoc(collection(db, 'chatThreads', resolvedChatId, 'messages'), {
      senderUid: firebaseUser.uid,
      text,
      type: 'text',
      createdAt: serverTimestamp(),
    });
    const unreadUpdates: Record<string, any> = {};
    threadMembers
      .filter((uid) => uid !== firebaseUser.uid)
      .forEach((uid) => {
        unreadUpdates[`unreadCountBy.${uid}`] = increment(1);
      });
    await updateDoc(doc(db, 'chatThreads', resolvedChatId), {
      lastMessage: text,
      lastMessageSenderUid: firebaseUser.uid,
      updatedAt: serverTimestamp(),
      lastMessageAt: serverTimestamp(),
      ...unreadUpdates,
    });
    scrollToBottom(true);
  };

  const sendMediaMessage = async (media: {
    type: 'image' | 'audio';
    mediaUrl: string;
    fileName?: string;
  }) => {
    if (!firebaseUser || !resolvedChatId) return;
    await addDoc(collection(db, 'chatThreads', resolvedChatId, 'messages'), {
      senderUid: firebaseUser.uid,
      text: media.type === 'image' ? 'Image' : 'Voice message',
      type: media.type,
      mediaUrl: media.mediaUrl,
      fileName: media.fileName || '',
      createdAt: serverTimestamp(),
    });
    const unreadUpdates: Record<string, any> = {};
    threadMembers
      .filter((uid) => uid !== firebaseUser.uid)
      .forEach((uid) => {
        unreadUpdates[`unreadCountBy.${uid}`] = increment(1);
      });
    await updateDoc(doc(db, 'chatThreads', resolvedChatId), {
      lastMessage: media.type === 'image' ? '📷 Image' : '🎤 Voice message',
      lastMessageSenderUid: firebaseUser.uid,
      updatedAt: serverTimestamp(),
      lastMessageAt: serverTimestamp(),
      ...unreadUpdates,
    });
    scrollToBottom(true);
  };

  const handlePickFromGallery = async () => {
    if (!firebaseUser) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
    });
    if (res.canceled) return;
    const asset = res.assets?.[0];
    if (!asset?.uri) return;
    try {
      setSendingMedia(true);
      const url = await uploadFeedAttachmentToSupabase(asset.uri, firebaseUser.uid, asset.mimeType || 'image/jpeg');
      if (!url) return;
      await sendMediaMessage({
        type: 'image',
        mediaUrl: url,
        fileName: asset.fileName || 'image',
      });
    } finally {
      setSendingMedia(false);
    }
  };

  const handleTakePhoto = async () => {
    if (!firebaseUser) return;
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Camera permission is required.');
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.6,
      });
      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (!asset?.uri) return;
      setSendingMedia(true);
      const url = await uploadFeedAttachmentToSupabase(asset.uri, firebaseUser.uid, asset.mimeType || 'image/jpeg');
      if (!url) return;
      await sendMediaMessage({
        type: 'image',
        mediaUrl: url,
        fileName: asset.fileName || 'camera-photo',
      });
    } catch (err: any) {
      const message = String(err?.message || '');
      if (message.toLowerCase().includes('camera not available')) {
        Alert.alert('Camera unavailable', 'Camera is not available on simulator. Please use a real device.');
      } else {
        Alert.alert('Camera error', 'Could not open camera.');
      }
    } finally {
      setSendingMedia(false);
    }
  };

  const startVoiceRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Microphone permission is required.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(FAST_RECORDING_OPTIONS);
      await rec.startAsync();
      setRecording(rec);
      setIsRecording(true);
    } catch {
      Alert.alert('Recording error', 'Could not start voice recording.');
    }
  };

  const stopVoiceRecording = async () => {
    if (!recording || !firebaseUser) return;
    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const localRecordingStatus = await recording.getStatusAsync();
      if ('durationMillis' in localRecordingStatus) {
        console.log('[chat-audio] local recording durationMillis:', localRecordingStatus.durationMillis);
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      const uri = recording.getURI();
      setRecording(null);
      if (!uri) return;
      setSendingMedia(true);
      const url = await uploadFeedAttachmentToSupabase(uri, firebaseUser.uid, 'audio/mp4');
      if (!url) return;
      await sendMediaMessage({
        type: 'audio',
        mediaUrl: url,
        fileName: 'voice-message.m4a',
      });
    } catch {
      Alert.alert('Recording error', 'Could not save voice recording.');
    } finally {
      setSendingMedia(false);
    }
  };

  const handlePlayAudioMessage = async (messageId: string, mediaUrl: string) => {
    const audioUri = String(mediaUrl || '').trim();
    if (!audioUri) {
      console.log('[chat-audio] invalid audio uri:', mediaUrl);
      setActiveAudioMessageId(null);
      setLoadingAudioMessageId(null);
      Alert.alert('Playback error', 'Audio file is missing.');
      return;
    }
    console.log('[chat-audio] play request uri:', audioUri);
    const isLocalUri = audioUri.startsWith('file://') || audioUri.startsWith('content://');
    const isRemoteUri = /^https?:\/\//i.test(audioUri);
    if (!isLocalUri && !isRemoteUri) {
      console.log('[chat-audio] unsupported uri scheme:', audioUri);
      Alert.alert('Playback error', 'Audio URL is invalid.');
      return;
    }

    const clearBufferingTimeout = () => {
      const existingTimer = audioBufferingTimeoutsRef.current.get(messageId);
      if (existingTimer) {
        clearTimeout(existingTimer);
        audioBufferingTimeoutsRef.current.delete(messageId);
      }
    };

    const resolvePlayableUri = async () => {
      if (!isRemoteUri) return audioUri;
      const cached = audioCacheUriByMessageRef.current.get(messageId);
      if (cached) return cached;
      const cacheBase = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      if (!cacheBase) return audioUri;
      const targetUri = `${cacheBase}${messageId}.m4a`;
      try {
        const downloaded = await FileSystem.downloadAsync(audioUri, targetUri);
        console.log('[chat-audio] downloaded to cache:', downloaded.uri);
        audioCacheUriByMessageRef.current.set(messageId, downloaded.uri);
        return downloaded.uri;
      } catch (downloadErr) {
        console.log('[chat-audio] cache download failed, fallback remote:', downloadErr);
        return audioUri;
      }
    };

    const startBufferingTimeout = () => {
      clearBufferingTimeout();
      const timer = setTimeout(() => {
        console.log('[chat-audio] buffering timeout after 8s:', { messageId, audioUri });
        setLoadingAudioMessageId((current) => (current === messageId ? null : current));
        setActiveAudioMessageId((current) => (current === messageId ? null : current));
        Alert.alert('Playback timeout', 'Audio is taking too long to start.');
      }, 8000);
      audioBufferingTimeoutsRef.current.set(messageId, timer);
    };

    try {
      setLoadingAudioMessageId(messageId);
      setActiveAudioMessageId(null);
      await Audio.setIsEnabledAsync(true);
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });

      // Always play from a local cached file to avoid remote streaming quirks.
      const playbackUri = await resolvePlayableUri();
      console.log('[chat-audio] using playback uri:', playbackUri);

      if (soundRef) {
        const currentStatus = await soundRef.getStatusAsync().catch(() => null as any);
        if (
          activeAudioMessageId === messageId &&
          currentStatus &&
          currentStatus.isLoaded &&
          currentStatus.isPlaying
        ) {
          clearBufferingTimeout();
          await soundRef.pauseAsync().catch(() => {});
          setActiveAudioMessageId(null);
          setLoadingAudioMessageId(null);
          return;
        }
        await soundRef.unloadAsync().catch(() => {});
      }
      setActiveAudioMessageId(null);

      startBufferingTimeout();
      const { sound } = await Audio.Sound.createAsync(
        { uri: playbackUri },
        { shouldPlay: false, volume: 1.0, isMuted: false, progressUpdateIntervalMillis: 200 },
        (status) => {
          if (!status.isLoaded) {
            if (status.error) {
              console.log('[chat-audio] playback status error:', status.error);
            }
            clearBufferingTimeout();
            setActiveAudioMessageId((current) => (current === messageId ? null : current));
            setLoadingAudioMessageId((current) => (current === messageId ? null : current));
            return;
          }
          if (status.isBuffering && !status.isPlaying) {
            setLoadingAudioMessageId(messageId);
            return;
          }
          if (status.isPlaying) {
            clearBufferingTimeout();
            setActiveAudioMessageId(messageId);
            setLoadingAudioMessageId((current) => (current === messageId ? null : current));
          }
          if (status.didJustFinish) {
            clearBufferingTimeout();
            setActiveAudioMessageId((current) => (current === messageId ? null : current));
            setLoadingAudioMessageId((current) => (current === messageId ? null : current));
          }
        }
      );

      setSoundRef(sound);

      await sound.setVolumeAsync(1.0);
      await sound.setIsMutedAsync(false);
      await sound.setPositionAsync(0);
      await sound.playFromPositionAsync(0);

      setTimeout(async () => {
        const after300ms = await sound.getStatusAsync();
        console.log('[chat-audio] status after 300ms:', after300ms);
        if (after300ms.isLoaded && after300ms.isPlaying) {
          clearBufferingTimeout();
          setActiveAudioMessageId(messageId);
          setLoadingAudioMessageId((current) => (current === messageId ? null : current));
        }
      }, 300);
    } catch (error) {
      console.log('[chat-audio] voice playback failed:', error);
      clearBufferingTimeout();
      setActiveAudioMessageId(null);
      setLoadingAudioMessageId(null);
      Alert.alert('Playback error', 'Could not play this voice message.');
    }
  };

  const formatMessageTime = (ms: number) => {
    if (!ms) return '';
    const d = new Date(ms);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  };

  const handleDeleteOwnMessage = async (message: ChatMessage) => {
    if (!firebaseUser || !resolvedChatId) return;
    const maxDeleteWindowMs = 20 * 60 * 1000;
    const sentAtMs = message.createdAtMs || 0;
    const isWithinDeleteWindow = sentAtMs > 0 && Date.now() - sentAtMs <= maxDeleteWindowMs;
    if (!isWithinDeleteWindow) {
      Alert.alert('Cannot delete', 'You can delete a message only within 20 minutes.');
      return;
    }

    Alert.alert('Delete message', 'Delete this message from the chat?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteDoc(doc(db, 'chatThreads', resolvedChatId, 'messages', message.id));

          // Keep thread preview in sync after deletion.
          const latestSnap = await getDocs(
            query(
              collection(db, 'chatThreads', resolvedChatId, 'messages'),
              orderBy('createdAt', 'desc'),
              limit(1)
            )
          );
          if (latestSnap.empty) {
            await updateDoc(doc(db, 'chatThreads', resolvedChatId), {
              lastMessage: '',
              lastMessageSenderUid: '',
              updatedAt: serverTimestamp(),
              lastMessageAt: serverTimestamp(),
            });
          } else {
            const latest = latestSnap.docs[0].data() as any;
            const nextPreview =
              latest.type === 'audio'
                ? '🎤 Voice message'
                : latest.type === 'image'
                ? '📷 Image'
                : latest.text || '';
            await updateDoc(doc(db, 'chatThreads', resolvedChatId), {
              lastMessage: nextPreview,
              lastMessageSenderUid: latest.senderUid || '',
              updatedAt: serverTimestamp(),
              lastMessageAt: serverTimestamp(),
            });
          }
        },
      },
    ]);
  };

  const handleSaveGroupName = async () => {
    if (!resolvedChatId || !isGroupCreator) return;
    const nextName = groupNameDraft.trim();
    if (!nextName) {
      Alert.alert('Name required', 'Please enter a group name.');
      return;
    }
    await updateDoc(doc(db, 'chatThreads', resolvedChatId), {
      title: nextName,
      updatedAt: serverTimestamp(),
    });
    setTitle(nextName);
    setEditingGroupName(false);
  };

  const loadFollowedUsersForAddMembers = async () => {
    if (!firebaseUser) return;
    setLoadingAddMembersUsers(true);
    try {
      const followsSnap = await getDocs(
        query(collection(db, 'follows'), where('followerId', '==', firebaseUser.uid))
      );
      const followedIds: string[] = [];
      followsSnap.forEach((f) => {
        const data = f.data() as any;
        if (data?.followingId) followedIds.push(data.followingId);
      });
      const userDocs = await Promise.all(followedIds.map((uid) => getDoc(doc(db, 'users', uid))));
      const users: Array<{ uid: string; name: string; avatarUrl?: string }> = [];
      userDocs.forEach((d) => {
        if (!d.exists() || d.id === firebaseUser.uid) return;
        const data = d.data() as any;
        users.push({
          uid: d.id,
          name: data.fullName || data.username || 'User',
          avatarUrl: data.profilePictureUrl || '',
        });
      });
      setFollowedAddMemberUsers(users);
    } finally {
      setLoadingAddMembersUsers(false);
    }
  };

  const loadAllUsersForAddMembersSearch = async () => {
    if (!firebaseUser || allUsersDirectoryLoadedForAdd) return;
    setLoadingAddMembersUsers(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const users: Array<{ uid: string; name: string; avatarUrl?: string }> = [];
      snap.forEach((d) => {
        if (d.id === firebaseUser.uid) return;
        const data = d.data() as any;
        users.push({
          uid: d.id,
          name: data.fullName || data.username || 'User',
          avatarUrl: data.profilePictureUrl || '',
        });
      });
      setAllUsersDirectoryForAdd(users);
      setAllUsersDirectoryLoadedForAdd(true);
    } finally {
      setLoadingAddMembersUsers(false);
    }
  };

  const toggleAddMemberSelection = (uid: string) => {
    setSelectedAddMemberIds((prev) => (prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]));
  };

  const handleAddSelectedMembers = async () => {
    if (!resolvedChatId || !isGroupCreator) return;
    if (!selectedAddMemberIds.length) return;
    await updateDoc(doc(db, 'chatThreads', resolvedChatId), {
      members: arrayUnion(...selectedAddMemberIds),
      updatedAt: serverTimestamp(),
    });
    setThreadMembers((prev) => Array.from(new Set([...prev, ...selectedAddMemberIds])));
    setSelectedAddMemberIds([]);
    setGroupDetailsStep('info');
  };

  const handleRemoveMember = async (uid: string) => {
    if (!resolvedChatId || !isGroupCreator) return;
    if (uid === threadCreatorUid) return;
    await updateDoc(doc(db, 'chatThreads', resolvedChatId), {
      members: arrayRemove(uid),
      updatedAt: serverTimestamp(),
    });
    setThreadMembers((prev) => prev.filter((id) => id !== uid));
  };

  const handleLeaveGroup = async () => {
    if (!resolvedChatId || !firebaseUser) return;
    Alert.alert('Leave group?', 'Are you sure you want to leave this group?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          await updateDoc(doc(db, 'chatThreads', resolvedChatId), {
            members: arrayRemove(firebaseUser.uid),
            updatedAt: serverTimestamp(),
            [`unreadCountBy.${firebaseUser.uid}`]: 0,
          });
          router.back();
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <AppScreen>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerSideBtn} accessibilityRole="button">
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerCenter}
            activeOpacity={threadType === 'group' ? 0.8 : 1}
            disabled={threadType !== 'group'}
            onPress={() => {
              setGroupDetailsStep('info');
              setShowGroupDetailsModal(true);
            }}
          >
            {headerAvatarUrl ? (
              <Image source={{ uri: headerAvatarUrl }} style={[styles.headerAvatar, { borderColor: colors.border }]} />
            ) : (
              <View style={[styles.headerAvatarFallback, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                <Ionicons name={threadType === 'group' ? 'people' : 'person'} size={15} color={colors.primary} />
              </View>
            )}
            <View style={styles.headerTitleWrap}>
              {isHeaderReady ? (
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {title || 'Chat'}
                </Text>
              ) : (
                <ActivityIndicator size="small" color={colors.textSecondary} />
              )}
              {threadType === 'group' ? (
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                  {threadMembers.length ? `${threadMembers.length} members` : 'Group'}
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>

          <View style={styles.headerSideBtn} />
        </View>

        <FlatList
          ref={messagesListRef}
          data={displayMessages}
          inverted
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.messagesContent,
            { paddingBottom: 6 },
          ]}
          onScroll={handleMessagesScroll}
          scrollEventThrottle={16}
          renderItem={({ item }) => {
            const mine = firebaseUser?.uid === item.senderUid;
            const isLastMessage = item.id === messages[messages.length - 1]?.id;
            return (
              <View>
                {initialUnreadMessageId === item.id && (
                  <View style={styles.newMessagesDividerRow}>
                    <View style={[styles.newMessagesDividerLine, { backgroundColor: colors.border }]} />
                    <View style={[styles.newMessagesDividerPill, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                      <Text style={[styles.newMessagesDividerText, { color: colors.textSecondary }]}>New messages</Text>
                    </View>
                    <View style={[styles.newMessagesDividerLine, { backgroundColor: colors.border }]} />
                  </View>
                )}

                <View
                  style={[
                    styles.messageRow,
                    mine ? styles.messageRowMine : styles.messageRowOther,
                    isLastMessage && styles.messageRowLast,
                  ]}
                >
                  {!mine ? (
                    <View style={[styles.messageAvatarWrap, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                      {chatMembersMeta[item.senderUid]?.avatarUrl ? (
                        <Image source={{ uri: chatMembersMeta[item.senderUid].avatarUrl }} style={styles.messageAvatar} />
                      ) : (
                        <Ionicons name="person" size={14} color={colors.primary} />
                      )}
                    </View>
                  ) : null}

                  <View
                    style={[
                      styles.bubble,
                      mine
                        ? { backgroundColor: colors.primary }
                        : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
                    ]}
                  >
                    {item.type === 'image' && item.mediaUrl ? (
                      <TouchableOpacity
                        onPress={() => setPreviewImageUrl(item.mediaUrl || null)}
                        onLongPress={() => {
                          if (mine) handleDeleteOwnMessage(item);
                        }}
                        delayLongPress={260}
                      >
                        <Image source={{ uri: item.mediaUrl }} style={styles.messageImage} />
                      </TouchableOpacity>
                    ) : item.type === 'audio' && item.mediaUrl ? (
                      <TouchableOpacity
                        style={styles.audioRow}
                        onPress={() => handlePlayAudioMessage(item.id, item.mediaUrl || '')}
                        onLongPress={() => {
                          if (mine) handleDeleteOwnMessage(item);
                        }}
                        delayLongPress={260}
                        activeOpacity={0.85}
                      >
                        <View
                          style={[
                            styles.audioIcon,
                            mine ? { backgroundColor: `${colors.textOnPrimary}22` } : { backgroundColor: colors.surfaceMuted },
                          ]}
                        >
                          {loadingAudioMessageId === item.id ? (
                            <ActivityIndicator size="small" color={mine ? colors.textOnPrimary : colors.textPrimary} />
                          ) : (
                            <Ionicons
                              name={activeAudioMessageId === item.id ? 'pause' : 'play'}
                              size={14}
                              color={mine ? colors.textOnPrimary : colors.textPrimary}
                            />
                          )}
                        </View>
                        <View style={styles.audioTextWrap}>
                          <Text style={[styles.bubbleText, { color: mine ? colors.textOnPrimary : colors.textPrimary }]}>
                            Voice message
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        activeOpacity={1}
                        onLongPress={() => {
                          if (mine) handleDeleteOwnMessage(item);
                        }}
                        delayLongPress={260}
                      >
                        <Text style={[styles.bubbleText, { color: mine ? colors.textOnPrimary : colors.textPrimary }]}>{item.text}</Text>
                      </TouchableOpacity>
                    )}
                    <Text
                      style={[
                        styles.messageTime,
                        { color: mine ? 'rgba(255,255,255,0.82)' : colors.textSecondary },
                        mine ? styles.messageTimeMine : styles.messageTimeOther,
                      ]}
                    >
                      {formatMessageTime(item.createdAtMs)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          }}
        />

      <Modal
        visible={!!previewImageUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImageUrl(null)}
      >
        <View style={styles.imagePreviewBackdrop}>
          <TouchableOpacity style={styles.imagePreviewClose} onPress={() => setPreviewImageUrl(null)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {previewImageUrl ? (
            <Image source={{ uri: previewImageUrl }} style={styles.imagePreviewFull} resizeMode="contain" />
          ) : null}
        </View>
      </Modal>

      <Modal
        visible={showGroupDetailsModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (groupDetailsStep === 'addMembers') {
            setGroupDetailsStep('info');
            return;
          }
          setShowGroupDetailsModal(false);
        }}
      >
        <View style={[styles.groupDetailsBackdrop, { backgroundColor: 'rgba(15, 23, 42, 0.45)' }]}>
          <AppCard style={[styles.groupDetailsCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <View style={[styles.groupDetailsHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.groupDetailsTitle, { color: colors.textPrimary }]}>
                {groupDetailsStep === 'addMembers' ? 'Add members' : 'Group info'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (groupDetailsStep === 'addMembers') {
                    setGroupDetailsStep('info');
                    return;
                  }
                  setShowGroupDetailsModal(false);
                }}
                accessibilityRole="button"
              >
                <Ionicons name={groupDetailsStep === 'addMembers' ? 'arrow-back' : 'close'} size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            {groupDetailsStep === 'info' && editingGroupName ? (
              <View style={styles.groupNameEditRow}>
                <TextInput
                  value={groupNameDraft}
                  onChangeText={setGroupNameDraft}
                  placeholder="Group name"
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.groupNameInput, { color: colors.textPrimary }]}
                />
                <TouchableOpacity onPress={handleSaveGroupName}>
                  <Ionicons name="checkmark" size={20} color={colors.primary} />
                </TouchableOpacity>
              </View>
            ) : groupDetailsStep === 'info' ? (
              <Text style={[styles.groupDetailsName, { color: colors.textPrimary }]}>{title || 'Group Chat'}</Text>
            ) : null}
            {groupDetailsStep === 'info' ? (
              <Text style={[styles.groupDetailsMembersCount, { color: colors.textSecondary }]}>
                {groupMembers.length} {groupMembers.length === 1 ? 'member' : 'members'}
              </Text>
            ) : null}
            {groupDetailsStep === 'info' && isGroupCreator && !editingGroupName ? (
              <View style={styles.groupActionsRow}>
                <TouchableOpacity style={[styles.groupActionBtn, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]} onPress={() => setEditingGroupName(true)}>
                  <Ionicons name="create-outline" size={15} color={colors.textPrimary} />
                  <Text style={[styles.groupActionBtnText, { color: colors.textPrimary }]}>Rename</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.groupActionBtn, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
                  onPress={() => {
                    setAddMemberSearch('');
                    setSelectedAddMemberIds([]);
                    setGroupDetailsStep('addMembers');
                  }}
                >
                  <Ionicons name="person-add-outline" size={15} color={colors.textPrimary} />
                  <Text style={[styles.groupActionBtnText, { color: colors.textPrimary }]}>Add members</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {groupDetailsStep === 'info' ? (
              <>
                <FlatList
                  data={groupMembers}
                  keyExtractor={(item) => item.uid}
                  style={styles.groupMembersList}
                  renderItem={({ item }) => (
                    <View style={styles.groupMemberRow}>
                      <View style={[styles.groupMemberAvatarWrap, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                        {item.avatarUrl ? (
                          <Image source={{ uri: item.avatarUrl }} style={styles.groupMemberAvatar} />
                        ) : (
                          <Ionicons name="person" size={14} color={colors.primary} />
                        )}
                      </View>
                      <Text style={[styles.groupMemberName, { color: colors.textPrimary }]}>{item.name}</Text>
                      {item.uid === threadCreatorUid ? (
                        <Text style={[styles.groupCreatorBadge, { color: colors.primary }]}>Creator</Text>
                      ) : null}
                      {isGroupCreator && item.uid !== threadCreatorUid ? (
                        <TouchableOpacity onPress={() => handleRemoveMember(item.uid)} style={styles.groupMemberRemoveBtn}>
                          <Ionicons name="remove-circle-outline" size={17} color={colors.danger} />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  )}
                />
                <TouchableOpacity style={styles.leaveGroupBtn} onPress={handleLeaveGroup}>
                  <Text style={[styles.leaveGroupBtnText, { color: colors.danger }]}>Leave group</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.groupNameEditRow}>
                  <TextInput
                    value={addMemberSearch}
                    onChangeText={setAddMemberSearch}
                    placeholder="Search users..."
                    placeholderTextColor={colors.textSecondary}
                    style={[styles.groupNameInput, { color: colors.textPrimary }]}
                  />
                </View>
                {loadingAddMembersUsers ? (
                  <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
                ) : (
                  <FlatList
                    data={addableUsers}
                    keyExtractor={(item) => item.uid}
                    style={styles.groupMembersList}
                    ListEmptyComponent={<Text style={[styles.groupDetailsMembersCount, { color: colors.textSecondary }]}>No users to add</Text>}
                    renderItem={({ item }) => (
                      <TouchableOpacity style={styles.groupMemberRow} onPress={() => toggleAddMemberSelection(item.uid)}>
                        <View style={[styles.groupMemberAvatarWrap, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                          {item.avatarUrl ? (
                            <Image source={{ uri: item.avatarUrl }} style={styles.groupMemberAvatar} />
                          ) : (
                            <Ionicons name="person" size={14} color={colors.primary} />
                          )}
                        </View>
                        <Text style={[styles.groupMemberName, { color: colors.textPrimary }]}>{item.name}</Text>
                        <View
                          style={[
                            styles.groupMemberSelectCircle,
                            {
                              borderColor: selectedAddMemberIds.includes(item.uid) ? colors.primary : colors.border,
                              backgroundColor: selectedAddMemberIds.includes(item.uid) ? colors.primary : 'transparent',
                            },
                          ]}
                        >
                          {selectedAddMemberIds.includes(item.uid) ? (
                            <Ionicons name="checkmark" size={12} color={colors.textOnPrimary} />
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    )}
                  />
                )}
                <TouchableOpacity
                  style={[
                    styles.addMembersConfirmBtn,
                    { backgroundColor: colors.primary, borderColor: colors.primary },
                    (!selectedAddMemberIds.length || loadingAddMembersUsers) && styles.addMembersConfirmBtnDisabled,
                  ]}
                  disabled={!selectedAddMemberIds.length || loadingAddMembersUsers}
                  onPress={handleAddSelectedMembers}
                >
                  <Text style={styles.addMembersConfirmBtnText}>Add selected</Text>
                </TouchableOpacity>
              </>
            )}
          </AppCard>
        </View>
      </Modal>

      <View
        style={[
          styles.inputBar,
          { paddingBottom: isKeyboardVisible ? 10 : Math.max(insets.bottom, 10) },
          { borderTopColor: colors.border, backgroundColor: colors.bg },
        ]}
      >
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]} onPress={handleTakePhoto}>
          <Ionicons name="camera-outline" size={18} color={colors.primary} />
        </TouchableOpacity>
        <TextInput
          style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surfaceMuted, color: colors.textPrimary }]}
          value={draft}
          onChangeText={setDraft}
          placeholder="Type a message..."
          placeholderTextColor={colors.textSecondary}
        />
        <TouchableOpacity
          style={[
            styles.iconBtn,
            { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
            isRecording && styles.iconBtnRecording,
          ]}
          onLongPress={startVoiceRecording}
          onPressOut={() => {
            if (isRecording) stopVoiceRecording();
          }}
          delayLongPress={220}
        >
          <Ionicons
            name={isRecording ? 'stop' : 'mic-outline'}
            size={18}
            color={isRecording ? colors.textOnPrimary : colors.textSecondary}
          />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]} onPress={handlePickFromGallery}>
          <Ionicons name="image-outline" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.sendBtn, { backgroundColor: colors.primary }]} onPress={sendMessage}>
          {sendingMedia ? (
            <Ionicons name="hourglass-outline" size={16} color={colors.textOnPrimary} />
          ) : (
            <Ionicons name="send" size={16} color={colors.textOnPrimary} />
          )}
        </TouchableOpacity>
      </View>
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: layout.headerTopPadding,
    paddingBottom: layout.headerBottomPadding,
    paddingHorizontal: layout.screenPadding,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSideBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 10,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#111827', maxWidth: '75%' },
  headerTitleWrap: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  headerSubtitle: {
    marginTop: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
  },
  headerAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  messagesContent: { paddingHorizontal: layout.screenPadding, paddingTop: spacing.md, paddingBottom: spacing.xl },
  messagesLoadingPlaceholder: {
    flex: 1,
  },
  messageRow: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  messageRowLast: {
    marginBottom: 2,
  },
  messageRowMine: {
    justifyContent: 'flex-end',
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },
  messageAvatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
  },
  messageAvatar: {
    width: '100%',
    height: '100%',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 0,
  },
  bubbleMine: { alignSelf: 'flex-end' },
  bubbleOther: { alignSelf: 'flex-start' },
  senderName: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
    fontWeight: '600',
  },
  bubbleText: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  bubbleTextMine: {},
  messageImage: {
    width: 210,
    height: 160,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
  },
  messageTime: {
    marginTop: 6,
    fontSize: 10,
    fontWeight: '600',
  },
  messageTimeMine: {
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'right',
  },
  messageTimeOther: {
    color: '#9ca3af',
    textAlign: 'left',
  },
  newMessagesDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    gap: 8,
    paddingHorizontal: 10,
  },
  newMessagesDividerLine: {
    flex: 1,
    height: 1,
  },
  newMessagesDividerText: {
    fontSize: 12,
    fontWeight: '700',
  },
  newMessagesDividerPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  imagePreviewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  imagePreviewClose: {
    position: 'absolute',
    top: 56,
    right: 18,
    zIndex: 2,
  },
  imagePreviewFull: {
    width: '100%',
    height: '82%',
  },
  groupDetailsBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  groupDetailsCard: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    maxHeight: '72%',
  },
  groupDetailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
    marginBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  groupDetailsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  groupDetailsName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  groupDetailsMembersCount: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 10,
  },
  groupNameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  groupNameInput: {
    flex: 1,
    fontSize: 17,
    color: '#111827',
    paddingVertical: 0,
  },
  groupActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  groupActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  groupActionBtnText: {
    fontSize: 12,
    color: '#111827',
    fontWeight: '600',
  },
  groupMembersList: {
    marginTop: 4,
  },
  groupMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  groupMemberAvatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
  },
  groupMemberAvatar: {
    width: '100%',
    height: '100%',
  },
  groupMemberName: {
    fontSize: 17,
    color: '#111827',
    fontWeight: '600',
  },
  groupCreatorBadge: {
    marginLeft: 8,
    fontSize: 11,
    fontWeight: '700',
  },
  groupMemberRemoveBtn: {
    marginLeft: 'auto',
    padding: 4,
  },
  groupMemberSelectCircle: {
    marginLeft: 'auto',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMembersConfirmBtn: {
    marginTop: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    paddingVertical: 12,
    borderWidth: 1,
  },
  addMembersConfirmBtnDisabled: {
    opacity: 0.5,
  },
  addMembersConfirmBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  leaveGroupBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  leaveGroupBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  audioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 160,
  },
  audioIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  inputBar: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  iconBtnRecording: {
    backgroundColor: '#ef4444',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
