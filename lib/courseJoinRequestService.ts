import { auth, db } from '@/lib/firebaseConfig';
import {
  Timestamp,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';

export type CourseJoinRequestStatus = 'pending' | 'approved' | 'rejected';

export type CourseJoinRequest = {
  id: string;
  courseId: string;
  courseName: string;
  lecturerUid: string;
  studentUid: string;
  studentName: string;
  studentEmail: string;
  studentPhotoURL: string | null;
  status: CourseJoinRequestStatus;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
  approvedAt?: Timestamp | null;
  rejectedAt?: Timestamp | null;
  reviewedByUid?: string | null;
};

export type CourseJoinRequestResultReason =
  | 'not_authenticated'
  | 'invalid_input'
  | 'owner_blocked'
  | 'course_not_found'
  | 'already_participating'
  | 'pending_exists'
  | 'request_not_found'
  | 'not_authorized'
  | 'already_handled';

export type GetExistingJoinRequestInput = {
  courseId: string;
  studentUid: string;
};

export type RequestToJoinCourseInput = {
  courseId: string;
  courseName: string;
  lecturerUid: string;
};

export type RequestToJoinCourseResult =
  | { ok: true; requestId: string }
  | { ok: false; reason: CourseJoinRequestResultReason };

export type ReviewJoinRequestInput = {
  requestId: string;
};

export type ReviewJoinRequestResult =
  | { ok: true }
  | { ok: false; reason: CourseJoinRequestResultReason };

const COURSE_JOIN_REQUESTS = 'courseJoinRequests';

function toCourseJoinRequest(id: string, data: any): CourseJoinRequest {
  return {
    id,
    courseId: String(data?.courseId || ''),
    courseName: String(data?.courseName || ''),
    lecturerUid: String(data?.lecturerUid || ''),
    studentUid: String(data?.studentUid || ''),
    studentName: String(data?.studentName || ''),
    studentEmail: String(data?.studentEmail || ''),
    studentPhotoURL: data?.studentPhotoURL ? String(data.studentPhotoURL) : null,
    status: (data?.status || 'pending') as CourseJoinRequestStatus,
    createdAt: (data?.createdAt as Timestamp) ?? null,
    updatedAt: (data?.updatedAt as Timestamp) ?? null,
    approvedAt: (data?.approvedAt as Timestamp) ?? null,
    rejectedAt: (data?.rejectedAt as Timestamp) ?? null,
    reviewedByUid: data?.reviewedByUid ? String(data.reviewedByUid) : null,
  };
}

export async function getExistingJoinRequest(
  input: GetExistingJoinRequestInput,
): Promise<CourseJoinRequest | null> {
  const courseId = input.courseId?.trim();
  const studentUid = input.studentUid?.trim();
  if (!courseId || !studentUid) return null;

  const q = query(
    collection(db, COURSE_JOIN_REQUESTS),
    where('courseId', '==', courseId),
    where('studentUid', '==', studentUid),
    orderBy('createdAt', 'desc'),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const first = snap.docs[0];
  return toCourseJoinRequest(first.id, first.data());
}

export async function requestToJoinCourse(
  input: RequestToJoinCourseInput,
): Promise<RequestToJoinCourseResult> {
  const user = auth.currentUser;
  if (!user?.uid) return { ok: false, reason: 'not_authenticated' };

  const courseId = input.courseId?.trim();
  const courseName = input.courseName?.trim();
  const lecturerUid = input.lecturerUid?.trim();

  if (!courseId || !courseName || !lecturerUid) {
    return { ok: false, reason: 'invalid_input' };
  }
  if (user.uid === lecturerUid) {
    return { ok: false, reason: 'owner_blocked' };
  }

  const courseRef = doc(db, 'courses', courseId);
  const userRef = doc(db, 'users', user.uid);

  const [courseSnap, userSnap] = await Promise.all([getDoc(courseRef), getDoc(userRef)]);

  if (!courseSnap.exists()) {
    return { ok: false, reason: 'course_not_found' };
  }

  const courseData = courseSnap.data() as any;
  const sharedWithUids = Array.isArray(courseData?.sharedWithUids)
    ? courseData.sharedWithUids.map((v: any) => String(v))
    : [];
  if (sharedWithUids.includes(user.uid)) {
    return { ok: false, reason: 'already_participating' };
  }

  const latest = await getExistingJoinRequest({ courseId, studentUid: user.uid });
  if (latest?.status === 'pending') {
    return { ok: false, reason: 'pending_exists' };
  }
  if (latest?.status === 'approved') {
    return { ok: false, reason: 'already_participating' };
  }

  const userData = userSnap.data() as any;
  const studentName = String(userData?.fullName || userData?.username || user.displayName || 'Student');
  const studentEmail = String(userData?.email || user.email || '');
  const studentPhotoURL = userData?.profilePictureUrl
    ? String(userData.profilePictureUrl)
    : user.photoURL || null;

  const created = await runTransaction(db, async (tx) => {
    const requestRef = doc(collection(db, COURSE_JOIN_REQUESTS));
    tx.set(requestRef, {
      courseId,
      courseName,
      lecturerUid,
      studentUid: user.uid,
      studentName,
      studentEmail,
      studentPhotoURL,
      status: 'pending' as CourseJoinRequestStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      approvedAt: null,
      rejectedAt: null,
      reviewedByUid: null,
    });
    return requestRef.id;
  });

  return { ok: true, requestId: created };
}

export function subscribeLecturerPendingRequests(
  input: { lecturerUid: string },
  onChange: (requests: CourseJoinRequest[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const lecturerUid = input.lecturerUid?.trim();
  if (!lecturerUid) {
    onChange([]);
    return () => {};
  }

  const q = query(
    collection(db, COURSE_JOIN_REQUESTS),
    where('lecturerUid', '==', lecturerUid),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc'),
  );

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => toCourseJoinRequest(d.id, d.data()));
      onChange(list);
    },
    (err) => onError?.(err as Error),
  );
}

export function subscribeCoursePendingRequests(
  input: { courseId: string },
  onChange: (requests: CourseJoinRequest[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const courseId = input.courseId?.trim();
  if (!courseId) {
    onChange([]);
    return () => {};
  }

  const q = query(
    collection(db, COURSE_JOIN_REQUESTS),
    where('courseId', '==', courseId),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc'),
  );

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => toCourseJoinRequest(d.id, d.data()));
      onChange(list);
    },
    (err) => onError?.(err as Error),
  );
}

export function subscribeCourseApprovedParticipants(
  input: { courseId: string },
  onChange: (participants: CourseJoinRequest[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const courseId = input.courseId?.trim();
  if (!courseId) {
    onChange([]);
    return () => {};
  }

  const q = query(
    collection(db, COURSE_JOIN_REQUESTS),
    where('courseId', '==', courseId),
    where('status', '==', 'approved'),
    orderBy('approvedAt', 'desc'),
  );

  return onSnapshot(
    q,
    (snap) => {
      const byStudentUid = new Map<string, CourseJoinRequest>();
      snap.docs.forEach((d) => {
        const item = toCourseJoinRequest(d.id, d.data());
        const existing = byStudentUid.get(item.studentUid);
        const itemTs = item.approvedAt?.toMillis?.() ?? 0;
        const existingTs = existing?.approvedAt?.toMillis?.() ?? 0;
        if (!existing || itemTs >= existingTs) {
          byStudentUid.set(item.studentUid, item);
        }
      });
      onChange(Array.from(byStudentUid.values()));
    },
    (err) => onError?.(err as Error),
  );
}

export async function approveJoinRequest(
  input: ReviewJoinRequestInput,
): Promise<ReviewJoinRequestResult> {
  const reviewer = auth.currentUser;
  if (!reviewer?.uid) return { ok: false, reason: 'not_authenticated' };
  const requestId = input.requestId?.trim();
  if (!requestId) return { ok: false, reason: 'invalid_input' };

  return runTransaction(db, async (tx) => {
    const requestRef = doc(db, COURSE_JOIN_REQUESTS, requestId);
    const requestSnap = await tx.get(requestRef);

    if (!requestSnap.exists()) return { ok: false, reason: 'request_not_found' } as ReviewJoinRequestResult;

    const requestData = requestSnap.data() as any;
    const status = String(requestData?.status || 'pending') as CourseJoinRequestStatus;
    if (status !== 'pending') return { ok: false, reason: 'already_handled' } as ReviewJoinRequestResult;

    const lecturerUid = String(requestData?.lecturerUid || '');
    if (!lecturerUid || lecturerUid !== reviewer.uid) {
      return { ok: false, reason: 'not_authorized' } as ReviewJoinRequestResult;
    }

    const courseId = String(requestData?.courseId || '');
    const studentUid = String(requestData?.studentUid || '');
    if (!courseId || !studentUid) return { ok: false, reason: 'invalid_input' } as ReviewJoinRequestResult;

    const courseRef = doc(db, 'courses', courseId);
    const courseSnap = await tx.get(courseRef);
    if (!courseSnap.exists()) return { ok: false, reason: 'course_not_found' } as ReviewJoinRequestResult;

    const courseData = courseSnap.data() as any;
    const ownerUid = courseData?.ownerUid ? String(courseData.ownerUid) : '';
    const lecturerOwnerUid = courseData?.lecturerUid ? String(courseData.lecturerUid) : '';
    if ((ownerUid && ownerUid !== reviewer.uid) || (lecturerOwnerUid && lecturerOwnerUid !== reviewer.uid)) {
      return { ok: false, reason: 'not_authorized' } as ReviewJoinRequestResult;
    }

    tx.update(requestRef, {
      status: 'approved' as CourseJoinRequestStatus,
      updatedAt: serverTimestamp(),
      approvedAt: serverTimestamp(),
      rejectedAt: null,
      reviewedByUid: reviewer.uid,
    });

    tx.update(courseRef, {
      sharedWithUids: arrayUnion(studentUid),
    });

    return { ok: true } as ReviewJoinRequestResult;
  });
}

export async function rejectJoinRequest(
  input: ReviewJoinRequestInput,
): Promise<ReviewJoinRequestResult> {
  const reviewer = auth.currentUser;
  if (!reviewer?.uid) return { ok: false, reason: 'not_authenticated' };
  const requestId = input.requestId?.trim();
  if (!requestId) return { ok: false, reason: 'invalid_input' };

  return runTransaction(db, async (tx) => {
    const requestRef = doc(db, COURSE_JOIN_REQUESTS, requestId);
    const requestSnap = await tx.get(requestRef);

    if (!requestSnap.exists()) return { ok: false, reason: 'request_not_found' } as ReviewJoinRequestResult;

    const requestData = requestSnap.data() as any;
    const status = String(requestData?.status || 'pending') as CourseJoinRequestStatus;
    if (status !== 'pending') return { ok: false, reason: 'already_handled' } as ReviewJoinRequestResult;

    const lecturerUid = String(requestData?.lecturerUid || '');
    if (!lecturerUid || lecturerUid !== reviewer.uid) {
      return { ok: false, reason: 'not_authorized' } as ReviewJoinRequestResult;
    }

    tx.update(requestRef, {
      status: 'rejected' as CourseJoinRequestStatus,
      updatedAt: serverTimestamp(),
      rejectedAt: serverTimestamp(),
      approvedAt: null,
      reviewedByUid: reviewer.uid,
    });

    return { ok: true } as ReviewJoinRequestResult;
  });
}

/** Student-visible join outcomes for System Updates: approved/rejected only (filtered client-side; single-field studentUid query avoids extra composite indexes). */
export async function fetchStudentCourseJoinOutcomes(studentUid: string): Promise<CourseJoinRequest[]> {
  const uid = studentUid.trim();
  if (!uid) return [];

  const q = query(collection(db, COURSE_JOIN_REQUESTS), where('studentUid', '==', uid));
  const snap = await getDocs(q);
  const list: CourseJoinRequest[] = [];
  snap.forEach((d) => {
    const item = toCourseJoinRequest(d.id, d.data());
    if (item.status === 'approved' || item.status === 'rejected') {
      list.push(item);
    }
  });
  return list;
}
