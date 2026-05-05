import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { TracePayload } from './types';

export async function traceLearningEvent(payload: TracePayload): Promise<string | null> {
  try {
    const sanitizedPayload = Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined)
    );

    const docRef = await addDoc(collection(db, 'ragTraces'), {
      ...sanitizedPayload,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.log('traceLearningEvent error:', error);
    return null;
  }
}

