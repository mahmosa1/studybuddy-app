import { PrimaryButton } from '@/frontend/components/ui/PrimaryButton';
import { layout, radius, spacing } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { useUser } from '@/lib/UserContext';
import { sendVoiceRoomInviteToChat } from '@/lib/voiceRoomShareService';
import { db } from '@/lib/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type ChatThreadOption = {
  id: string;
  title: string;
  type: 'direct' | 'course' | 'group';
  avatarUrl?: string;
};

type ShareVoiceRoomModalProps = {
  visible: boolean;
  roomId: string;
  password: string;
  roomTitle: string;
  onClose: () => void;
};

export function ShareVoiceRoomModal({
  visible,
  roomId,
  password,
  roomTitle,
  onClose,
}: ShareVoiceRoomModalProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const { firebaseUser } = useUser();
  const isRtl = i18n.language === 'he';
  const [threads, setThreads] = useState<ChatThreadOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!visible || !firebaseUser) return;
    setLoading(true);
    setSelectedIds([]);
    setSearch('');
    const q = query(
      collection(db, 'chatThreads'),
      where('members', 'array-contains', firebaseUser.uid),
    );
    const unsub = onSnapshot(q, async (snap) => {
      const list = await Promise.all(
        snap.docs.map(async (d) => {
          const data = d.data() as {
            title?: string;
            type?: ChatThreadOption['type'];
            members?: string[];
          };
          let title = data.title || t('chat.title');
          let avatarUrl = '';
          if (data.type === 'direct') {
            const otherUid = (data.members || []).find((uid) => uid !== firebaseUser.uid);
            if (otherUid) {
              const otherSnap = await getDoc(doc(db, 'users', otherUid));
              if (otherSnap.exists()) {
                const otherData = otherSnap.data() as { fullName?: string; username?: string; profilePictureUrl?: string };
                title = otherData.fullName || otherData.username || title;
                avatarUrl = otherData.profilePictureUrl || '';
              }
            }
          }
          return {
            id: d.id,
            title,
            type: (data.type || 'direct') as ChatThreadOption['type'],
            avatarUrl,
          };
        }),
      );
      list.sort((a, b) => a.title.localeCompare(b.title));
      setThreads(list);
      setLoading(false);
    });
    return unsub;
  }, [firebaseUser, t, visible]);

  const filteredThreads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((thread) => thread.title.toLowerCase().includes(q));
  }, [search, threads]);

  const toggleThread = (threadId: string) => {
    setSelectedIds((prev) =>
      prev.includes(threadId) ? prev.filter((id) => id !== threadId) : [...prev, threadId],
    );
  };

  const handleSend = async () => {
    if (!selectedIds.length) return;
    setSending(true);
    try {
      await Promise.all(
        selectedIds.map((threadId) =>
          sendVoiceRoomInviteToChat(threadId, { roomId, password, roomTitle }),
        ),
      );
      onClose();
      Alert.alert(t('voiceRoom.shareToChatSent'));
    } catch {
      Alert.alert(t('common.error'), t('voiceRoom.shareToChatFailed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.sheetHeader, isRtl && styles.rtlRow]}>
            <Text style={[styles.sheetTitle, { color: colors.textPrimary }, isRtl && styles.rtlText]}>
              {t('voiceRoom.shareToChatTitle')}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.sheetHint, { color: colors.textSecondary }, isRtl && styles.rtlText]}>
            {t('voiceRoom.shareToChatHint')}
          </Text>

          <View style={[styles.searchRow, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }, isRtl && styles.rtlRow]}>
            <Ionicons name="search" size={16} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary }, isRtl && styles.rtlText]}
              value={search}
              onChangeText={setSearch}
              placeholder={t('chat.searchUsers')}
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
          ) : (
            <FlatList
              data={filteredThreads}
              keyExtractor={(item) => item.id}
              style={styles.list}
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: colors.textSecondary }, isRtl && styles.rtlText]}>
                  {t('chat.empty.subtitle')}
                </Text>
              }
              renderItem={({ item }) => {
                const selected = selectedIds.includes(item.id);
                return (
                  <TouchableOpacity
                    style={[
                      styles.threadRow,
                      { borderColor: colors.border, backgroundColor: selected ? `${colors.primary}12` : colors.surfaceElevated },
                      isRtl && styles.rtlRow,
                    ]}
                    onPress={() => toggleThread(item.id)}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.avatarWrap, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                      {item.type === 'group' ? (
                        <Ionicons name="people-outline" size={18} color={colors.primary} />
                      ) : item.avatarUrl ? (
                        <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
                      ) : (
                        <Ionicons name="person-outline" size={18} color={colors.primary} />
                      )}
                    </View>
                    <Text style={[styles.threadTitle, { color: colors.textPrimary }, isRtl && styles.rtlText]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Ionicons
                      name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={selected ? colors.primary : colors.textSecondary}
                    />
                  </TouchableOpacity>
                );
              }}
            />
          )}

          <PrimaryButton
            label={t('voiceRoom.shareToChatSend', { count: selectedIds.length })}
            onPress={() => void handleSend()}
            loading={sending}
            disabled={!selectedIds.length || sending}
            style={{ marginTop: spacing.sm }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    maxHeight: '78%',
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', flex: 1 },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  sheetHint: { fontSize: 13, lineHeight: 18, marginBottom: spacing.sm },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    marginBottom: spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  list: { maxHeight: 320 },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    marginBottom: spacing.xs,
  },
  avatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: { width: 36, height: 36 },
  threadTitle: { flex: 1, fontSize: 15, fontWeight: '600' },
  emptyText: { textAlign: 'center', paddingVertical: spacing.lg, fontSize: 14 },
  rtlRow: { flexDirection: 'row-reverse' },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
});
