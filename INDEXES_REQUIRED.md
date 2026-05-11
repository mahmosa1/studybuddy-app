# Firestore composite indexes required for join requests

The `courseJoinRequests` collection uses queries that combine **equality filters** on two fields with **`orderBy` on a timestamp**. Firestore requires a **composite index** for each distinct query shape.

Create these manually in the [Firebase Console](https://console.firebase.google.com/) → Firestore → **Indexes** → **Composite**, or deploy equivalent definitions via `firestore.indexes.json` if you use the Firebase CLI.

**Collection ID:** `courseJoinRequests`  
**Query scope:** Collection (default)

## Required composite indexes

| Purpose | Fields (order matters) |
|--------|-------------------------|
| Lecturer inbox: pending requests for one lecturer (`subscribeLecturerPendingRequests`) | `lecturerUid` **Ascending**, `status` **Ascending**, `createdAt` **Descending** |
| Lecturer course detail + course-scoped pending list (`subscribeCoursePendingRequests`) | `courseId` **Ascending**, `status` **Ascending**, `createdAt` **Descending** |
| Approved participants for a course (`subscribeCourseApprovedParticipants`) | `courseId` **Ascending**, `status` **Ascending**, `approvedAt` **Descending** |
| Latest request for a student + course (`getExistingJoinRequest`) | `courseId` **Ascending**, `studentUid` **Ascending**, `createdAt` **Descending** |

Until all indexes exist and finish building (**Enabled** in the console), affected listeners will fail with `The query requires an index` and the error log will include a one-click link to create the matching index.

## Implementation reference

Queries are defined in `lib/courseJoinRequestService.ts` (`subscribeLecturerPendingRequests`, `subscribeCoursePendingRequests`, `subscribeCourseApprovedParticipants`, `getExistingJoinRequest`).
