import { auth, db } from '@/lib/firebaseConfig';
import * as Linking from 'expo-linking';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';

export function buildVoiceRoomJoinLink(roomId: string, password: string): string {
  return Linking.createURL(`/voice-room/${roomId.trim().toUpperCase()}`, {
    queryParams: { password },
  });
}

export async function sendVoiceRoomInviteToChat(
  threadId: string,
  invite: { roomId: string; password: string; roomTitle: string },
): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('NOT_AUTHENTICATED');

  const threadRef = doc(db, 'chatThreads', threadId);
  const threadSnap = await getDoc(threadRef);
  if (!threadSnap.exists()) throw new Error('THREAD_NOT_FOUND');

  const thread = threadSnap.data() as { members?: string[] };
  const members = thread.members || [];
  if (!members.includes(user.uid)) throw new Error('NOT_MEMBER');

  const link = buildVoiceRoomJoinLink(invite.roomId, invite.password);
  const previewText = `🎧 ${invite.roomTitle}`;

  await addDoc(collection(db, 'chatThreads', threadId, 'messages'), {
    senderUid: user.uid,
    text: previewText,
    type: 'voice_room_invite',
    roomId: invite.roomId.trim().toUpperCase(),
    roomPassword: invite.password,
    roomTitle: invite.roomTitle,
    roomLink: link,
    createdAt: serverTimestamp(),
  });

  const unreadUpdates: Record<string, unknown> = {};
  members
    .filter((uid) => uid !== user.uid)
    .forEach((uid) => {
      unreadUpdates[`unreadCountBy.${uid}`] = increment(1);
    });

  await updateDoc(threadRef, {
    lastMessage: previewText,
    lastMessageSenderUid: user.uid,
    updatedAt: serverTimestamp(),
    lastMessageAt: serverTimestamp(),
    ...unreadUpdates,
  });
}
