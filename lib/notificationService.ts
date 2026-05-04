import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';

export type ActivityNotificationType =
  | 'follow'
  | 'post_like'
  | 'post_comment'
  | 'comment_like';

type NotifyArgs = {
  recipientUid: string;
  actorUid: string;
  actorName?: string;
  actorAvatarUrl?: string;
  type: ActivityNotificationType;
  postId?: string;
  commentId?: string;
  text?: string;
};

export async function createActivityNotification(args: NotifyArgs) {
  const {
    recipientUid,
    actorUid,
    actorName = 'User',
    actorAvatarUrl = '',
    type,
    postId = '',
    commentId = '',
    text = '',
  } = args;

  if (!recipientUid || !actorUid || recipientUid === actorUid) return;

  try {
    await addDoc(collection(db, 'activityNotifications'), {
      recipientUid,
      actorUid,
      actorName,
      actorAvatarUrl,
      type,
      postId,
      commentId,
      text,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.log('createActivityNotification error:', err);
  }
}

