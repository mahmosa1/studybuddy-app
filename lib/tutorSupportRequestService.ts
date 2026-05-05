import { auth, db } from '@/lib/firebaseConfig';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

export type TutorSupportRequestStatus = 'pending' | 'accepted' | 'rejected';

export type TutorSupportRequestDoc = {
  id: string;
  tutorUid: string;
  tutorName?: string;
  studentUid: string;
  studentName?: string;
  studentAvatarUrl?: string;
  courseId: string;
  courseName: string;
  status: TutorSupportRequestStatus;
  createdAt?: unknown;
  reviewedAt?: unknown;
  reviewedByUid?: string;
};

export async function hasPendingTutorSupportRequest(input: {
  tutorUid: string;
  studentUid: string;
  courseId: string;
}): Promise<boolean> {
  const q = query(
    collection(db, 'tutorSupportRequests'),
    where('tutorUid', '==', input.tutorUid),
    where('studentUid', '==', input.studentUid),
    where('courseId', '==', input.courseId),
    where('status', '==', 'pending'),
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

export async function submitTutorSupportRequest(input: {
  tutorUid: string;
  tutorName?: string;
  courseId: string;
  courseName: string;
}): Promise<{ ok: true } | { ok: false; reason: 'pending_exists' | 'accepted_exists' | 'invalid_user' }> {
  const student = auth.currentUser;
  if (!student?.uid) return { ok: false, reason: 'invalid_user' };

  if (student.uid === input.tutorUid) return { ok: false, reason: 'invalid_user' };

  const samePairQ = query(
    collection(db, 'tutorSupportRequests'),
    where('tutorUid', '==', input.tutorUid),
    where('studentUid', '==', student.uid),
    where('courseId', '==', input.courseId),
  );
  const samePairSnap = await getDocs(samePairQ);
  const statuses = samePairSnap.docs.map((d) => String((d.data() as any)?.status || 'pending'));
  if (statuses.includes('accepted')) {
    return { ok: false, reason: 'accepted_exists' };
  }
  if (statuses.includes('pending')) {
    return { ok: false, reason: 'pending_exists' };
  }

  const studentSnap = await getDoc(doc(db, 'users', student.uid));
  const studentData = studentSnap.data() as any;
  const studentName = String(studentData?.fullName || studentData?.username || student.displayName || 'Student');
  const studentAvatarUrl = String(studentData?.profilePictureUrl || '');

  await addDoc(collection(db, 'tutorSupportRequests'), {
    tutorUid: input.tutorUid,
    tutorName: input.tutorName ?? '',
    studentUid: student.uid,
    studentName,
    studentAvatarUrl,
    courseId: input.courseId,
    courseName: input.courseName,
    status: 'pending' as TutorSupportRequestStatus,
    createdAt: serverTimestamp(),
  });

  return { ok: true };
}

export async function fetchTutorSupportRequestsForTutor(
  tutorUid: string,
): Promise<TutorSupportRequestDoc[]> {
  const q = query(
    collection(db, 'tutorSupportRequests'),
    where('tutorUid', '==', tutorUid),
  );
  const snap = await getDocs(q);
  const list: TutorSupportRequestDoc[] = [];
  snap.forEach((d) => {
    const data = d.data() as any;
    list.push({
      id: d.id,
      tutorUid: String(data.tutorUid || ''),
      tutorName: String(data.tutorName || ''),
      studentUid: String(data.studentUid || ''),
      studentName: String(data.studentName || ''),
      studentAvatarUrl: String(data.studentAvatarUrl || ''),
      courseId: String(data.courseId || ''),
      courseName: String(data.courseName || ''),
      status: (data.status || 'pending') as TutorSupportRequestStatus,
      createdAt: data.createdAt,
      reviewedAt: data.reviewedAt,
      reviewedByUid: data.reviewedByUid,
    });
  });
  list.sort((a, b) => {
    const ta = (a.createdAt as any)?.toMillis?.() ?? 0;
    const tb = (b.createdAt as any)?.toMillis?.() ?? 0;
    return tb - ta;
  });
  return list;
}

export async function fetchTutorSupportRequestsForStudent(
  studentUid: string,
): Promise<TutorSupportRequestDoc[]> {
  const q = query(
    collection(db, 'tutorSupportRequests'),
    where('studentUid', '==', studentUid),
  );
  const snap = await getDocs(q);
  const list: TutorSupportRequestDoc[] = [];
  snap.forEach((d) => {
    const data = d.data() as any;
    list.push({
      id: d.id,
      tutorUid: String(data.tutorUid || ''),
      tutorName: String(data.tutorName || ''),
      studentUid: String(data.studentUid || ''),
      studentName: String(data.studentName || ''),
      studentAvatarUrl: String(data.studentAvatarUrl || ''),
      courseId: String(data.courseId || ''),
      courseName: String(data.courseName || ''),
      status: (data.status || 'pending') as TutorSupportRequestStatus,
      createdAt: data.createdAt,
      reviewedAt: data.reviewedAt,
      reviewedByUid: data.reviewedByUid,
    });
  });
  list.sort((a, b) => {
    const ta = (a.reviewedAt as any)?.toMillis?.() ?? (a.createdAt as any)?.toMillis?.() ?? 0;
    const tb = (b.reviewedAt as any)?.toMillis?.() ?? (b.createdAt as any)?.toMillis?.() ?? 0;
    return tb - ta;
  });
  return list;
}

export async function reviewTutorSupportRequest(
  requestId: string,
  decision: 'accepted' | 'rejected',
): Promise<void> {
  const reviewer = auth.currentUser;
  if (!reviewer?.uid) throw new Error('Not signed in');
  await updateDoc(doc(db, 'tutorSupportRequests', requestId), {
    status: decision,
    reviewedAt: serverTimestamp(),
    reviewedByUid: reviewer.uid,
  });
}
