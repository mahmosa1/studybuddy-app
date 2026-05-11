import { db } from '@/lib/firebaseConfig';
import { fetchTutorSupportRequestsForStudent } from '@/lib/tutorSupportRequestService';
import { ParticipatingCourse } from '@/shared/types/participation';
import { collection, getDocs } from 'firebase/firestore';

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
  const lecturerCourses: ParticipatingCourse[] = coursesSnap.docs
    .map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        name: data?.name || 'Course',
        lecturer: data?.lecturer || data?.ownerName || unknownLecturerLabel,
        ownerUid: data?.ownerUid || '',
        isParticipatingViaLecturer: isUserSharedInCourse(data, userUid),
      };
    })
    .filter((c: any) => !!c.ownerUid && c.ownerUid !== userUid && c.isParticipatingViaLecturer)
    .map((c: any) => ({
      id: c.id,
      name: c.name,
      lecturer: c.lecturer,
      sources: ['lecturer'] as const,
    }));

  const byCourseId = new Map<string, ParticipatingCourse>();
  lecturerCourses.forEach((course) => byCourseId.set(course.id, course));

  const tutorRequests = await fetchTutorSupportRequestsForStudent(userUid);
  tutorRequests
    .filter((r) => r.status === 'accepted')
    .forEach((req) => {
      const existing = byCourseId.get(req.courseId);
      if (existing) {
        if (!existing.sources.includes('tutor')) {
          existing.sources = [...existing.sources, 'tutor'];
        }
        if (!existing.tutorName && req.tutorName) existing.tutorName = req.tutorName;
      } else {
        byCourseId.set(req.courseId, {
          id: req.courseId,
          name: req.courseName || 'Course',
          lecturer: unknownLecturerLabel,
          tutorName: req.tutorName || '',
          sources: ['tutor'],
        });
      }
    });

  return Array.from(byCourseId.values());
}
