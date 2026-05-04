import { auth, db } from '@/lib/firebaseConfig';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';

export type TutorApplicationStatus = 'pending' | 'approved' | 'rejected';

export type TutorApplicationDoc = {
  id: string;
  applicantUid: string;
  applicantEmail?: string;
  applicantFullName?: string;
  courseId: string;
  courseName: string;
  gradeSheetUrl: string;
  declarationAccepted: boolean;
  declarationTextSnapshot: string;
  status: TutorApplicationStatus;
  createdAt?: unknown;
  reviewedAt?: unknown;
  reviewedByUid?: string;
  rejectionReason?: string;
};

export async function hasPendingTutorApplicationForCourse(
  applicantUid: string,
  courseId: string,
): Promise<boolean> {
  const q = query(
    collection(db, 'tutorApplications'),
    where('applicantUid', '==', applicantUid),
    where('courseId', '==', courseId),
    where('status', '==', 'pending'),
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

export async function canSubmitTutorApplication(
  applicantUid: string,
  courseId: string,
): Promise<{ ok: boolean; reason?: 'pending' | 'already_tutor' }> {
  const userSnap = await getDoc(doc(db, 'users', applicantUid));
  const approved = (userSnap.data()?.tutorApprovedCourses || []) as Array<{ courseId?: string }>;
  if (approved.some((e) => e.courseId === courseId)) {
    return { ok: false, reason: 'already_tutor' };
  }
  if (await hasPendingTutorApplicationForCourse(applicantUid, courseId)) {
    return { ok: false, reason: 'pending' };
  }
  return { ok: true };
}

/** Courses to hide from the tutor-application picker (already approved or pending application). */
export async function getTutorApplyExcludedCourseIds(applicantUid: string): Promise<Set<string>> {
  const excluded = new Set<string>();
  const userSnap = await getDoc(doc(db, 'users', applicantUid));
  const approved = (userSnap.data()?.tutorApprovedCourses || []) as Array<{ courseId?: string }>;
  for (const e of approved) {
    if (e.courseId) excluded.add(String(e.courseId));
  }
  const pendingQ = query(
    collection(db, 'tutorApplications'),
    where('applicantUid', '==', applicantUid),
    where('status', '==', 'pending'),
  );
  const pendingSnap = await getDocs(pendingQ);
  pendingSnap.forEach((d) => {
    const cid = (d.data() as any).courseId;
    if (cid) excluded.add(String(cid));
  });
  return excluded;
}

export async function submitTutorApplication(input: {
  applicantUid: string;
  applicantEmail?: string;
  applicantFullName?: string;
  courseId: string;
  courseName: string;
  gradeSheetUrl: string;
  declarationAccepted: boolean;
  declarationTextSnapshot: string;
}): Promise<void> {
  if (!input.declarationAccepted) {
    throw new Error('Declaration must be accepted');
  }
  const gate = await canSubmitTutorApplication(input.applicantUid, input.courseId);
  if (!gate.ok) {
    if (gate.reason === 'already_tutor') {
      throw new Error('You are already approved as a tutor for this course.');
    }
    throw new Error('You already have a pending tutor application for this course.');
  }
  await addDoc(collection(db, 'tutorApplications'), {
    applicantUid: input.applicantUid,
    applicantEmail: input.applicantEmail ?? null,
    applicantFullName: input.applicantFullName ?? null,
    courseId: input.courseId,
    courseName: input.courseName,
    gradeSheetUrl: input.gradeSheetUrl,
    declarationAccepted: true,
    declarationTextSnapshot: input.declarationTextSnapshot.trim(),
    status: 'pending' as TutorApplicationStatus,
    createdAt: serverTimestamp(),
  });
}

export async function fetchPendingTutorApplications(): Promise<TutorApplicationDoc[]> {
  const q = query(collection(db, 'tutorApplications'), where('status', '==', 'pending'));
  const snap = await getDocs(q);
  const list: TutorApplicationDoc[] = [];
  snap.forEach((d) => {
    const data = d.data() as any;
    list.push({
      id: d.id,
      applicantUid: data.applicantUid,
      applicantEmail: data.applicantEmail,
      applicantFullName: data.applicantFullName,
      courseId: data.courseId,
      courseName: data.courseName,
      gradeSheetUrl: data.gradeSheetUrl,
      declarationAccepted: !!data.declarationAccepted,
      declarationTextSnapshot: data.declarationTextSnapshot || '',
      status: data.status,
      createdAt: data.createdAt,
      reviewedAt: data.reviewedAt,
      reviewedByUid: data.reviewedByUid,
      rejectionReason: data.rejectionReason,
    });
  });
  list.sort((a, b) => {
    const ta = (a.createdAt as any)?.toMillis?.() ?? 0;
    const tb = (b.createdAt as any)?.toMillis?.() ?? 0;
    return tb - ta;
  });
  return list;
}

export async function approveTutorApplication(applicationId: string): Promise<void> {
  const admin = auth.currentUser;
  if (!admin?.uid) throw new Error('Not signed in');

  const appRef = doc(db, 'tutorApplications', applicationId);

  await runTransaction(db, async (transaction) => {
    const appSnap = await transaction.get(appRef);
    if (!appSnap.exists()) throw new Error('Application not found');
    const app = appSnap.data() as any;
    if (app.status !== 'pending') throw new Error('Application is not pending');

    const applicantUid = app.applicantUid as string;
    const courseId = app.courseId as string;
    const courseName = String(app.courseName || '');
    const userRef = doc(db, 'users', applicantUid);
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) throw new Error('Applicant user not found');

    const existing: Array<{ courseId: string; courseName: string; approvedAt: string; applicationId: string }> =
      Array.isArray(userSnap.data()?.tutorApprovedCourses) ? userSnap.data()!.tutorApprovedCourses : [];

    const filtered = existing.filter((e) => e.courseId !== courseId);
    const next = [
      ...filtered,
      {
        courseId,
        courseName,
        approvedAt: new Date().toISOString(),
        applicationId,
      },
    ];

    transaction.update(userRef, { tutorApprovedCourses: next });
    transaction.update(appRef, {
      status: 'approved',
      reviewedAt: serverTimestamp(),
      reviewedByUid: admin.uid,
      rejectionReason: null,
    });
  });
}

export async function rejectTutorApplication(
  applicationId: string,
  rejectionReason: string,
): Promise<void> {
  const admin = auth.currentUser;
  if (!admin?.uid) throw new Error('Not signed in');
  await runTransaction(db, async (transaction) => {
    const appRef = doc(db, 'tutorApplications', applicationId);
    const appSnap = await transaction.get(appRef);
    if (!appSnap.exists()) throw new Error('Application not found');
    const app = appSnap.data() as any;
    if (app.status !== 'pending') throw new Error('Application is not pending');

    transaction.update(appRef, {
      status: 'rejected',
      reviewedAt: serverTimestamp(),
      reviewedByUid: admin.uid,
      rejectionReason: rejectionReason.trim() || 'Rejected',
    });
  });
}
