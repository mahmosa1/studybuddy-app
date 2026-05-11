# Backend Boundary

This project currently runs as an Expo frontend with Firebase/Supabase managed services.

To keep architecture clear:

- `frontend/` contains UI, presentation logic, and client-side orchestration.
- `backend/` is reserved for future server code (Cloud Functions, APIs, workers).
- `shared/` contains reusable types/constants used by both sides.

When backend code is added, place it here and avoid importing React Native modules into this directory.
