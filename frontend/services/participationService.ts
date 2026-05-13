import { db } from '@/lib/firebaseConfig';
import { fetchTutorSupportRequestsForStudent } from '@/lib/tutorSupportRequestService';
import { ParticipatingCourse } from '@/shared/types/participation';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';

type InternalParticipatingCourse = ParticipatingCourse & { ownerUid: string };

function displayNameFromUserData(data: Record<string, unknown> | undefined): string {
  if (!data) return '';
  const fullName = String(data.fullName ?? '').trim();
  if (fullName) return fullName;
  const username = String(data.username ?? '').trim();
  if (username) return username;
  const email = String(data.email ?? '').trim();
  if (email) return email;
  return '';
}

async function resolveLecturerLabels(
  courses: InternalParticipatingCourse[],
  unknownLecturerLabel: string,
): Promise<ParticipatingCourse[]> {
  const uids = new Set<string>();
  for (const c of courses) {
    if (!(c.lecturer || '').trim() && c.ownerUid) uids.add(c.ownerUid);
  }
  const byUid: Record<string, string> = {};
  await Promise.all(
    [...uids].map(async (uid) => {
      try {
        const snap = await getDoc(doc(db, 'users', uid));
        if (snap.exists()) {
          const name = displayNameFromUserData(snap.data() as Record<string, unknown>);
          if (name) byUid[uid] = name;
        }
      } catch {
        /* ignore */
      }
    }),
  );

  return courses.map((c) => {
    let lecturer = (c.lecturer || '').trim();
    if (!lecturer && c.ownerUid) {
      lecturer = byUid[c.ownerUid] || '';
    }
    if (!lecturer) lecturer = unknownLecturerLabel;
    return {
      id: c.id,
      name: c.name,
      lecturer,
      tutorName: c.tutorName,
      sources: c.sources,
    };
  });
}

function isUserSharedInCourse(data: any, uid: string): boolean {
  const sharedWithUids = Array.isArray(data?.sharedWithUids)
    ? data.sharedWithUids.map((x: any) => String(x))
    : [];
  const sharedWith = Array.isArray(data?.sharedWith)
    ? data.sharedWith
        .map((x: any) => {
          if (typeof x === 'string' || typeof x === 'number') return String(x);
          if (x && typeof x === 'object') return String(x.uid || x.userId || x.id || '');
          return '';
        })
        .filter(Boolean)
    : [];
  return sharedWithUids.includes(uid) || sharedWith.includes(uid);
}

export async function getParticipatingCourses(input: {
  userUid: string;
  unknownLecturerLabel: string;
}): Promise<ParticipatingCourse[]> {
  const { userUid, unknownLecturerLabel } = input;
  const coursesSnap = await getDocs(collection(db, 'courses'));
  const lecturerCourses: InternalParticipatingCourse[] = coursesSnap.docs
    .map((d) => {
      const data = d.data() as any;
      const lecturerFromDoc = String(data?.lecturer || data?.ownerName || '').trim();
      return {
        id: d.id,
        name: data?.name || 'Course',
        lecturer: lecturerFromDoc,
        ownerUid: String(data?.ownerUid || ''),
        isParticipatingViaLecturer: isUserSharedInCourse(data, userUid),
      };
    })
    .filter((c: any) => !!c.ownerUid && c.ownerUid !== userUid && c.isParticipatingViaLecturer)
    .map((c: any) => ({
      id: c.id,
      name: c.name,
      lecturer: c.lecturer,
      ownerUid: c.ownerUid,
      sources: ['lecturer'] as const,
    }));

  const byCourseId = new Map<string, InternalParticipatingCourse>();
  lecturerCourses.forEach((course) => byCourseId.set(course.id, course));

  const tutorRequests = await fetchTutorSupportRequestsForStudent(userUid);
  for (const req of tutorRequests.filter((r) => r.status === 'accepted')) {
    const existing = byCourseId.get(req.courseId);
    if (existing) {
      if (!existing.sources.includes('tutor')) {
        existing.sources = [...existing.sources, 'tutor'];
      }
      if (!existing.tutorName && req.tutorName) existing.tutorName = req.tutorName;
    } else {
      let lecturer = '';
      let name = req.courseName || 'Course';
      let ownerUid = '';
      try {
        const courseSnap = await getDoc(doc(db, 'courses', req.courseId));
        if (courseSnap.exists()) {
          const data = courseSnap.data() as any;
          lecturer = String(data?.lecturer || data?.ownerName || '').trim();
          ownerUid = String(data?.ownerUid || '');
          if (data?.name) name = String(data.name);
        }
      } catch {
        /* keep defaults */
      }
      byCourseId.set(req.courseId, {
        id: req.courseId,
        name,
        lecturer,
        ownerUid,
        tutorName: req.tutorName || '',
        sources: ['tutor'],
      });
    }
  }

  return resolveLecturerLabels(Array.from(byCourseId.values()), unknownLecturerLabel);
}
