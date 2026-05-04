# STUDYBUDDY Full Project Audit

Last updated: 2026-05-01

## 1) Executive Summary

StudyBuddy is a feature-rich Expo React Native learning platform with multi-role support (`student`, `lecturer`, `admin`), social learning tools, and an upgraded AI layer now centered around a unified Learning Intelligence Engine.

Current strengths:
- Strong product breadth: auth lifecycle, courses, AI practice, feed, chat/group chat, profiles/follows, admin moderation.
- Modernized AI architecture with centralized engine modules, retrieval, tracing, and quality labeling.
- Good progress on product polish and real-world QA tooling (AI diagnostics + response marking).

Current risks:
- Firestore security posture still needs hardening review against strict RBAC assumptions.
- A few large route files remain complex and expensive to maintain.
- UX consistency is improved but still uneven in some keyboard/modal-heavy areas and edge states.

Overall status:
- **Working MVP+ with advanced AI direction in place**.
- Recommended next phase: **stabilization + QA hardening + security tightening** before major new features.

---

## 2) Tech Stack and Architecture

### Core stack
- Expo `~54`
- React Native `0.81`
- TypeScript `~5.9`
- Expo Router (file-based routing)
- Firebase Auth + Firestore
- Supabase Storage
- OpenAI APIs (chat + embeddings + retrieval workflows)
- i18n (`react-i18next`, `en/he`)

### Key architectural layers
- `app/`: route-level UI and user flows.
- `lib/`: services, AI orchestration, storage helpers, domain logic.
- `lib/learningIntelligence/`: centralized AI engine modules:
  - `engine.ts`
  - `retrieval.ts`
  - `contextBuilder.ts`
  - `cache.ts`
  - `tracing.ts`
  - `types.ts`
  - `api.ts`

---

## 3) Product Surface Audit

## Authentication and User Lifecycle

Implemented:
- Login, role registration flows, pending/rejected approval flow, forgot password.
- Role/status-aware redirects in root and tabs layouts.

Status: **Good (core stable)**.

## Roles and Access

Implemented roles:
- Student
- Lecturer
- Admin

Observed behavior:
- Admin tab is hidden for non-admin.
- Feed tab is student-oriented.
- Admin-specific routes exist under `app/admin/*`.

Status: **Good at UI-routing level**.  
Note: backend permission verification should be continuously validated against rules.

## Courses and Learning

Implemented:
- Courses Hub and sub-screens (`my`, `participating`, `statistics`).
- Course details with file upload/open/delete.
- Lecturer course management paths.

Status: **Good**, with minor UX refinements still ongoing.

## AI Learning Features

Implemented:
- AI Practice setup/test/results flow.
- Adaptive and weakness-aware behavior paths.
- Summary + flashcards generation.
- Ask AI in course context with sources display.
- Unified Learning Intelligence Engine with retrieval and caching.
- Quality status labeling (`grounded`, `weak_grounding`, `no_sources`, `fallback`, `error`) in traces.

Status: **Strong direction, actively maturing**.

## Feed and Social

Implemented:
- Post creation/details, likes, saves, comments, reports.
- Profile image integration and profile navigation.
- Follow/following flows and user profile-based context.
- Notification-style updates surface.

Status: **Strong feature coverage**.

## Chat and Group Chat

Implemented:
- Chat list, one-to-one chat, group chat creation and management.
- Unread indicators/divider logic improvements.
- Voice message upload/playback debugging and stabilization work.
- Group info controls and member management capabilities.

Status: **Advanced and usable**, with QA needed on device-specific audio/keyboard behavior.

## Admin

Implemented:
- Pending approvals
- User management
- Course moderation
- Appeals management
- AI diagnostics screen (admin-only, read-only)

Status: **Good and improving**.

---

## 4) AI System Audit (Current)

## 4.1 Unified Engine Foundation

The project now has a centralized AI engine with:
- Retrieval context assembly
- Semantic chunking/embedding retrieval
- Cache layer
- Trace logging to `ragTraces`

This is a major improvement over scattered AI logic.

## 4.2 AI Observability and Diagnostics

Implemented:
- `ragTraces` logging for AI actions.
- Admin-only diagnostics screen with filters:
  - feature
  - courseId
  - fallback used
  - cache status
  - quality status
- Per-trace quality badges with unknown fallback handling.

Status: **Very good for manual QA workflows**.

## 4.3 Trust and QA Controls

Implemented:
- Ask AI UI now shows "Sources used".
- Clear no-sources state in student UI.
- Admin/dev-only response marking (`good`/`bad`) persisted to `aiEvaluations`.
- Trace linkage in evaluation when available (`traceId`).
- Duplicate mark prevention for the same displayed answer.

Status: **Excellent incremental QA instrumentation**.

## 4.4 Remaining AI Risks

- Quality heuristics are lightweight (by design) and can produce false positives/negatives in edge language/content cases.
- Retrieval success depends heavily on extraction quality and chunk coverage.
- Real-world multilingual QA (Hebrew/English mixed content) should continue before broad rollout.

---

## 5) Data and Storage Audit

Main systems:
- Firestore: users, courses, files, practice/session data, social/chat/admin/AI traces/evaluations.
- Supabase Storage: uploaded media and files.

Positive:
- Data model has expanded to support AI quality evaluation and diagnostics.
- Additive approach preserved existing flows.

Risk:
- Firestore rules should be re-audited for least-privilege access, especially with growing admin/dev telemetry collections.

---

## 6) UI/UX Audit

Progress observed:
- Better visual hierarchy across key screens.
- More compact and consistent card/spacing patterns.
- Improved trust UX in AI surfaces.

Current friction points:
- Keyboard + modal interactions are recurrently sensitive and require device QA.
- Some screens remain large and mixed in concern (UI + orchestration + state-heavy logic).

Recommendation:
- Continue incremental UX fixes, then extract reusable modal/form primitives for keyboard-safe patterns.

---

## 7) Engineering Quality and Maintainability

Strengths:
- Clear momentum on incremental safe changes.
- Good feature flag/fallback behavior in AI transitions.
- Additive upgrades with low regression risk.

Weaknesses:
- Large files in `app/` are still difficult to reason about.
- Domain contracts between UI and AI payloads need continued normalization.
- Some localized strings and UX states can still drift across languages.

Recommended technical debt priorities:
1. Refactor largest screens into smaller presentational + hook/service slices.
2. Standardize payload types returned by AI entry points.
3. Strengthen lint/type strictness around optional AI metadata fields.

---

## 8) Manual QA Readiness

The project is now set up well for real manual AI QA:
- Diagnostics visibility per trace
- Quality status labeling
- Admin/dev response marking
- Trace-linked evaluations

Suggested immediate QA sequence (already aligned with current work):
1. Short file + direct question
2. Long file + summary
3. In-file question
4. Out-of-file question
5. Quiz generation from file
6. Vague question
7. Hebrew query
8. English query

Track per test:
- Sources shown
- `qualityStatus`
- `fallbackUsed`
- Latency
- Rating (`good`/`bad`)

---

## 9) Priority Recommendations (Next Phase)

Without adding major new features yet:

1. **Security and Permissions Audit**
- Re-validate Firestore rules collection-by-collection for least privilege.

2. **AI QA Review Loop**
- Run 5-10 real file scenarios and analyze `aiEvaluations` vs `ragTraces`.
- Identify top failure patterns before model/prompt expansions.

3. **Stability Pass**
- Keyboard/modal stress test on iOS and Android (especially bottom-sheet and modal forms).

4. **Maintainability Pass**
- Split the heaviest route files (`home`, `chat`, `course details`) into smaller modules.

---

## 10) Final Verdict

StudyBuddy is no longer a basic prototype. It is a broad, functional product with a strong AI evolution path already in place:
- Real user roles and moderation workflows
- Deep social and chat capabilities
- Context-aware AI infrastructure with diagnostics and QA hooks

The correct next move is **quality consolidation**, not feature sprawl:
- finalize manual QA findings,
- harden security and reliability,
- then scale new AI features with confidence.

# STUDYBUDDY Full Project Audit

## 1. Project Overview

StudyBuddy is an Expo React Native mobile app for learning workflows with three implemented roles: `student`, `lecturer`, `admin`.

Based on current code, the app currently provides:
- Auth + registration + approval lifecycle (`pending/active/rejected/blocked` paths).
- Student and lecturer account onboarding with document/image upload.
- Tab-based app shell with role-gated tabs (student feed, admin tab).
- Courses hub + my courses + participating courses + statistics pages.
- Course details with file upload/open/delete, AI summary/flashcards, and “Ask AI” UI.
- AI practice generation flow (setup -> test -> results), including adaptive mode and open-answer scoring.
- Social feed (posts, likes, saves, comments, comment likes, reports) and notifications.
- User profiles + follow system + follower/following lists.
- Chat list + direct/group chat + media/audio support + group info actions.
- Admin tools for approvals, appeals, users, and course moderation.

Not all intended product ideas are fully real yet:
- Some flows are mock/placeholder.
- Some AI paths fallback to templated generation.
- Database permission model is not strictly role-hardened.

---

## 2. Tech Stack

| Area | Technology |
|---|---|
| Framework | Expo + React Native |
| Language | TypeScript |
| Routing | Expo Router (file-based) |
| Navigation | React Navigation underneath (`@react-navigation/*`) |
| State Management | Local React state/hooks + `UserContext` |
| Auth | Firebase Auth |
| Database | Firestore |
| File Storage | Supabase Storage (`studybuddy-files`) |
| Realtime | Firestore `onSnapshot` |
| AI | OpenAI APIs (`chat/completions`, `responses`, `files`) + local fallback logic |
| i18n | `i18next`, `react-i18next` (`en/he`) |
| Media/File libs | `expo-image-picker`, `expo-document-picker`, `expo-av` |
| Icons | `@expo/vector-icons` (Ionicons) |
| Styling | Per-screen `StyleSheet.create` (mostly inline constants) |

Relevant dependency evidence: `package.json`.

---

## 3. Full Folder Structure

```text
studybuddy/
  app/
    (auth)/
    (tabs)/
    admin/
    chat/
    course/
    courses/
    feed/
    lecturer/
    user-profile/
    ... (other route files)
  lib/
    aiService.ts
    practiceService.ts
    studyJournalService.ts
    upload.ts
    fileContentExtractor.ts
    notificationService.ts
    firebaseConfig.ts
    supabaseClient.ts
    UserContext.tsx
    i18n.ts
    locales/
  components/
  constants/
  hooks/
  firestore.rules
  package.json
```

### Responsibilities
- `app/`: screens/routes and UI flows.
- `lib/`: business logic, backend integrations, AI, and services.
- `components/`: reusable UI helpers (limited use in core product screens).
- `constants/`: theme constants (not fully enforced app-wide).
- `hooks/`: utility hooks.

---

## 4. App Navigation / Sitemap

### Root/Auth/Tabs
- `/` -> `app/index.tsx` (bootstrap redirect by auth+status)
- `app/_layout.tsx` (root stack)
- `/(auth)/_layout` (auth stack)
- `/(tabs)/_layout` (tab shell)

### Auth Routes
- `/(auth)/login` -> `app/(auth)/login.tsx`
- `/(auth)/forgot-password` -> `app/(auth)/forgot-password.tsx`
- `/(auth)/register-role` -> `app/(auth)/register-role.tsx`
- `/(auth)/register-student` -> `app/(auth)/register-student.tsx`
- `/(auth)/register-lecturer` -> `app/(auth)/register-lecturer.tsx`
- `/(auth)/pending-approval` -> `app/(auth)/pending-approval.tsx`

### Tabs
- `/(tabs)/index` -> `app/(tabs)/index.tsx`
- `/(tabs)/search` -> `app/(tabs)/search.tsx`
- `/(tabs)/feed` -> `app/(tabs)/feed.tsx`
- `/(tabs)/courses` -> `app/(tabs)/courses.tsx`
- `/(tabs)/profile` -> `app/(tabs)/profile.tsx`
- `/(tabs)/admin` -> `app/(tabs)/admin.tsx`
- `/(tabs)/practice` -> `app/(tabs)/practice.tsx` (hidden)

### Learning/Courses
- `/course/[courseId]` -> `app/course/[courseId].tsx`
- `/lecturer/course/[courseId]` -> `app/lecturer/course/[courseId].tsx`
- `/lecturer-course/[courseId]` -> `app/lecturer-course/[courseId].tsx`
- `/courses/my` -> `app/courses/my.tsx`
- `/courses/participating` -> `app/courses/participating.tsx`
- `/courses/statistics` -> `app/courses/statistics.tsx`

### AI Practice
- `/ai-practice-setup` -> `app/ai-practice-setup.tsx`
- `/ai-practice-test` -> `app/ai-practice-test.tsx`
- `/practice-results` -> `app/practice-results.tsx`

### Social/Profile/Chat/Admin
- `/feed/post/[postId]` -> `app/feed/post/[postId].tsx`
- `/feed/saved` -> `app/feed/saved.tsx`
- `/user-profile/[userId]` -> `app/user-profile/[userId].tsx`
- `/edit-profile` -> `app/edit-profile.tsx`
- `/chat` -> `app/chat.tsx`
- `/chat/[chatId]` -> `app/chat/[chatId].tsx`
- `/admin/users` -> `app/admin/users.tsx`
- `/admin/courses` -> `app/admin/courses.tsx`
- `/admin/appeals` -> `app/admin/appeals.tsx`
- `/join-requests` -> `app/join-requests.tsx`
- `/lecturer/join-requests` -> `app/lecturer/join-requests.tsx`
- `/lecturer/add-course` -> `app/lecturer/add-course.tsx`
- `/modal` -> `app/modal.tsx`
- `/image-viewer` -> `app/image-viewer.tsx`

---

## 5. Tabs and Navigation Layout

Source: `app/(tabs)/_layout.tsx`

| Tab | Route | Icon | Role Visibility |
|---|---|---|---|
| Home | `/(tabs)/index` | home | all active users |
| Search | `/(tabs)/search` | search | all active users |
| Feed | `/(tabs)/feed` | newspaper | student only |
| Courses | `/(tabs)/courses` | book | all active users |
| Profile | `/(tabs)/profile` | person | all active users |
| Admin | `/(tabs)/admin` | shield | admin only |
| Practice | `/(tabs)/practice` | hidden | hidden (`href: null`) |

---

## 6. User Roles and Permissions

### Roles found
- `student`
- `lecturer`
- `admin`
- Tutor role: **Not implemented** as runtime role.

### Status logic
- `pending`, `active`, `rejected`, `blocked` (blocked used in several route guards)

### Storage
- Role/status stored in Firestore `users/{uid}`.

### Access behavior
- Routing changes by role/status in `app/index.tsx` and `app/(tabs)/_layout.tsx`.
- Home content switches by role in `app/(tabs)/index.tsx`.
- Feed tab hidden for non-student.
- Admin tab hidden for non-admin.

### Important permission caveat
- `firestore.rules` ends with:
  - `match /{document=**} { allow read, write: if isAuthenticated(); }`
- This means many effective restrictions are app-level, not strict backend RBAC.

---

## 7. Authentication Flow

1. App startup (`app/index.tsx`) listens to Firebase auth state.
2. If no user -> login.
3. If user exists, reads Firestore `users` doc:
   - `pending/rejected` -> pending screen.
   - `blocked` -> login.
   - `active` -> tabs.
4. Login (`app/(auth)/login.tsx`) repeats status checks post-login.
5. Registration:
   - Student and lecturer forms create Firebase Auth user.
   - Firestore user doc created with `status: pending`.
6. Pending screen allows logout and rejected-appeal submission.

Protected routing is mostly implemented through route-level redirect guards.

---

## 8. Student Features

| Feature | Status | Notes |
|---|---|---|
| Home dashboard/journal | Partially done | rich but heavy file and mixed concerns |
| Courses hub | Done | clear entry cards |
| My/participating/statistics | Partially done | mostly working; semantics overlap |
| Course details/files | Partially done | core operations exist |
| AI practice setup/test/results | Partially done | real path + fallback path |
| Weakness/progress metrics | Partially done | usable, still heuristic in places |
| Feed + post detail | Done (core) | likes/saves/comments/report implemented |
| Notifications | Partially done | implemented in feed/profile context |
| Search + study buddy filtering | Partially done | works but preferences backend unclear |
| Profile + follow system | Done (core) | follow graph + lists |
| Chat + group chat | Done (core) | direct/group/media/audio |
| Join requests | Mock only | student join route appears placeholder |

---

## 9. Lecturer Features

| Feature | Status | Notes |
|---|---|---|
| Lecturer registration/approval | Done |
| Lecturer home path | Partially done |
| Add course | Done |
| Lecturer course details | Partially done |
| Student management in course | Partially done / mock mixed |
| Join requests | Mock only (`app/lecturer/join-requests.tsx`) |
| File sharing | Done (basic Supabase-backed) |
| Public/private controls | Could not verify from code |

---

## 10. Tutor Mode

Tutor mode is **Not implemented**.

No runtime tutor role, no tutor application workflow, no tutor-specific routes/services.
Only a future-facing comment exists in profile UI about potential tutor verification badge.

---

## 11. Admin Features

| Admin Feature | Status | File(s) |
|---|---|---|
| Pending account approvals | Done | `app/(tabs)/admin.tsx` |
| Approve/reject users | Done | `app/(tabs)/admin.tsx` |
| Appeals management | Done (core) | `app/admin/appeals.tsx` |
| User management (block/unblock/delete) | Done (core) | `app/admin/users.tsx` |
| Course management (delete) | Done (basic) | `app/admin/courses.tsx` |
| Hardened backend RBAC | Needs improvement | `firestore.rules` |

---

## 12. AI Features

### Real implementations
- `lib/aiService.ts`
  - `generatePracticeQuestions()` (OpenAI + fallback)
  - `generateSummaryAndFlashcards()` (OpenAI + fallback)
  - `evaluateOpenAnswer()` (OpenAI + heuristic fallback)

### Fallback/mock areas
- `generatePracticeQuestionsFast()` is explicitly fallback-oriented.
- `app/course/[courseId].tsx` `handleAskAI()` is mock text generation (timeout-based), not true OpenAI call.

### Behavior notes
- AI quality currently depends on:
  - file extraction quality,
  - OpenAI call success,
  - fallback usage.
- There is no robust retrieval citation layer yet for strict source-traceable QA.

---

## 13. Database / Backend / Storage

### Main collections observed
- `users`, `courses`, `courseFiles`
- `practiceSessions`, `practiceResults`, `userTopicPerformance`
- `studyTasks`, `studySessions`, `dailyStatistics`
- `feedPosts` (+ comments subcollection), `feedReports`
- `follows`, `activityNotifications`
- `chatThreads` (+ messages subcollection)
- `appeals`

### Storage
- Supabase bucket: `studybuddy-files`
- Common folders: student cards, profile images, course files, feed files, lecturer docs/images.

### Schema quality
- Typed mostly as local TypeScript types per feature/service.
- No single central schema definition module.

### Security
- Firestore rules exist but wildcard authenticated allow weakens strict control.
- Some rule/data field mismatches exist (e.g., `uploadedBy` in rules vs `ownerUid` seen in some writes).

---

## 14. UI / UX Analysis (Current)

### What works well
- Consistent brand color direction (green-first).
- Many flows have polished card-based mobile layouts.
- Complex features (feed/chat/practice) are reachable and functional.

### What feels weak
- Visual consistency is uneven between screens.
- Repeated styles/tokens create drift.
- Some screens are overloaded with logic + UI in one file.
- Some user flows still feel partially mocked.
- Some text density and hierarchy can be improved in analytics/results pages.

### Responsiveness/mobile
- Phone-focused layouts generally okay.
- Some keyboard-heavy screens are complex and can regress.

---

## 15. Design System Extract

### De facto tokens from code
- Primary: `#047857`
- Background: `#f9fafb`
- Surface: `#ffffff`
- Text primary: `#111827`
- Text secondary: `#6b7280`
- Border: `#e5e7eb`
- Danger: `#ef4444`
- Warning: `#f59e0b`
- Success variants: `#10b981`, `#22c55e`

### Component style patterns
- Rounded cards, pill buttons, icon + label rows.
- Header blocks with icon/title/subtitle.
- Inputs with leading icon and label.

### Gaps
- No strongly enforced global design token usage in major screens.
- Theme scaffolding exists but not consistently applied across product screens.

---

## 16. Product Weaknesses

- Some critical flows are still mock/placeholder.
- AI behavior is inconsistent across features (real vs fallback vs mock).
- DB security model is permissive for authenticated users due to catch-all rule.
- Route/file architecture has several very large monolithic screens.
- Role boundaries are partially UI-enforced rather than backend-enforced.
- Tutor mode is requested in vision but absent in implementation.

---

## 17. Recommended Improvements (No Code Changes Here)

### Product
- Define one canonical role-feature matrix and one canonical participation/join lifecycle.

### UX
- Add clear source/quality indicators for AI outputs.
- Standardize loading/empty/error patterns in all major modules.

### UI/Design
- Create centralized token system + reusable primitives (header/card/button/input/badge).
- Refactor oversized screens into module-level components/hooks.

### AI
- Unify AI stack to one grounded retrieval path with citations.
- Add post-generation quality validation (topic diversity, source grounding checks).

### Backend/Security
- Remove broad wildcard rules and enforce role/ownership per collection.
- Align rules and write schema fields.

### MVP priorities
1. Security hardening
2. AI consistency and source-grounded generation
3. Real join-request participation flow
4. Design-system and architecture cleanup

---

## 18. Current MVP Status

| Feature | Current Status | File Path | Notes | Priority |
|---|---|---|---|---|
| Auth + approval lifecycle | Done | `app/(auth)/*`, `app/index.tsx` | core works | High |
| Role-aware tab shell | Done | `app/(tabs)/_layout.tsx` | student/admin gating | High |
| Student home/journal | Partially done | `app/(tabs)/index.tsx` | rich but heavy | Medium |
| Courses hub + subpages | Done/Partial | `app/(tabs)/courses.tsx`, `app/courses/*` | mostly working | High |
| Course file management | Partially done | `app/course/[courseId].tsx` | core done; polish needed | High |
| AI practice flow | Partially done | `app/ai-practice-*`, `lib/aiService.ts` | quality variance by path | High |
| Feed/social | Done (core) | `app/(tabs)/feed.tsx`, `app/feed/post/[postId].tsx` | strong | High |
| Chat/group chat | Done (core) | `app/chat.tsx`, `app/chat/[chatId].tsx` | strong | High |
| Lecturer join requests | Mock only | `app/lecturer/join-requests.tsx` | placeholder | High |
| Student join requests | Mock only | `app/join-requests.tsx` | placeholder | High |
| Admin moderation suite | Done (core) | `app/(tabs)/admin.tsx`, `app/admin/*` | usable | High |
| Tutor mode | Missing | N/A | not implemented | Medium |
| Firestore strict RBAC | Needs improvement | `firestore.rules` | permissive wildcard | Critical |

---

## 19. Files That Need Review (for next AI planning)

1. `app/(tabs)/_layout.tsx`  
   - role/tab visibility and navigation foundation.
2. `app/index.tsx` and `app/(auth)/login.tsx`  
   - auth + status redirect logic.
3. `app/(tabs)/index.tsx`  
   - role-based home experience and journal complexity.
4. `app/(tabs)/feed.tsx` and `app/feed/post/[postId].tsx`  
   - social architecture and interaction model.
5. `app/chat.tsx` and `app/chat/[chatId].tsx`  
   - messaging UX/data complexity and performance-critical logic.
6. `app/course/[courseId].tsx`  
   - course details + AI entry points + file operations.
7. `app/ai-practice-setup.tsx`, `app/ai-practice-test.tsx`, `app/practice-results.tsx`  
   - core AI learning flow and weakness UX.
8. `lib/aiService.ts`  
   - most important AI quality and grounding logic.
9. `lib/practiceService.ts`  
   - practice persistence, scoring outputs, weak-topic derivation.
10. `lib/upload.ts`, `lib/fileContentExtractor.ts`  
    - quality of source material ingestion.
11. `lib/UserContext.tsx`  
    - role/status app-wide behavior.
12. `firestore.rules`  
    - critical for real permission/security correctness.
13. `lib/locales/en.json`, `lib/locales/he.json`  
    - text consistency and translation quality.

---

## 20. Final Summary

StudyBuddy today is a feature-rich, working mobile app with real auth, social, chat, course, and AI-assisted study flows.  
Its strongest areas are:
- breadth of implemented product surface,
- role/status-aware routing,
- strong feed/chat functionality,
- active AI-assisted learning flow with real backend integration.

Its weakest areas are:
- uneven AI grounding quality across paths,
- mock/partial flows in participation/join requests,
- security/rules permissiveness,
- lack of centralized design system and oversized route files.

What to improve first:
1. Harden backend permissions (Firestore rules + role enforcement).  
2. Unify AI pipeline to one source-grounded reliable experience.  
3. Replace placeholder join-request flows with real backend lifecycle.  
4. Standardize design system + refactor large screens into maintainable modules.

