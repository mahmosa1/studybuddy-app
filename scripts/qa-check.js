/**
 * StudyBuddy QA verification (structure + documentation quality).
 * Node built-ins only: fs, path. Root = process.cwd().
 */

const fs = require('fs');
const path = require('path');

const root = process.cwd();

let total = 0;
let passed = 0;
let failed = 0;
let warnings = 0;

function recordPass(label) {
  total += 1;
  passed += 1;
  console.log(`✅ PASS: ${label}`);
}

function recordFail(label) {
  total += 1;
  failed += 1;
  console.log(`❌ FAIL: ${label}`);
}

function recordWarn(label) {
  total += 1;
  warnings += 1;
  console.log(`⚠️ WARN: ${label}`);
}

function fileExists(rel) {
  try {
    return fs.existsSync(path.join(root, rel));
  } catch {
    return false;
  }
}

function readText(rel) {
  try {
    return fs.readFileSync(path.join(root, rel), 'utf8');
  } catch {
    return null;
  }
}

function readJson(rel) {
  const raw = readText(rel);
  if (raw == null) return { ok: false, data: null, error: 'missing or unreadable' };
  try {
    return { ok: true, data: JSON.parse(raw), error: null };
  } catch (e) {
    return { ok: false, data: null, error: e.message || 'invalid JSON' };
  }
}

function countMatches(text, re) {
  if (!text) return 0;
  const m = text.match(re);
  return m ? m.length : 0;
}

function getByPath(obj, dotted) {
  const parts = dotted.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object' || !(p in cur)) return undefined;
    cur = cur[p];
  }
  return cur;
}

// --- A. Required files ---
const REQUIRED_FILES = [
  'QA_TEST_PLAN.md',
  'app/(auth)/login.tsx',
  'app/(auth)/register-student.tsx',
  'app/(auth)/register-lecturer.tsx',
  'app/(tabs)/feed.tsx',
  'app/course/[courseId]/index.tsx',
  'app/course/[courseId]/tutor-exercises/[exerciseId].tsx',
  'app/tutor/exercises/index.tsx',
  'app/tutor/exercises/new.tsx',
  'app/tutor/exercises/[exerciseId]/index.tsx',
  'app/tutor/exercises/[exerciseId]/submissions/[submissionId].tsx',
  'app/user-profile/[userId].tsx',
  'lib/tutorExerciseService.ts',
  'shared/types/tutorExercise.ts',
  'lib/locales/he.json',
  'lib/locales/en.json',
  'firestore.rules',
];

console.log('\nStudyBuddy — QA check\n');

// Smoke: repo root markers
if (fileExists('package.json')) recordPass('Smoke: package.json exists');
else recordFail('Smoke: package.json exists');

if (fileExists('app/_layout.tsx')) recordPass('Smoke: app/_layout.tsx exists');
else recordWarn('Smoke: app/_layout.tsx missing (optional smoke)');

if (fileExists('tsconfig.json')) recordPass('Smoke: tsconfig.json exists');
else recordWarn('Smoke: tsconfig.json missing (optional smoke)');

for (const rel of REQUIRED_FILES) {
  if (fileExists(rel)) recordPass(`Required file: ${rel}`);
  else recordFail(`Required file: ${rel}`);
}

// Tutor submissions route: Expo Router may use submissions/index.tsx instead of submissions.tsx
const submissionsTsx = 'app/tutor/exercises/[exerciseId]/submissions.tsx';
const submissionsIndex = 'app/tutor/exercises/[exerciseId]/submissions/index.tsx';
if (fileExists(submissionsTsx)) {
  recordPass(`Required file: ${submissionsTsx}`);
} else if (fileExists(submissionsIndex)) {
  recordPass(`Required file: ${submissionsIndex} (submissions screen)`);
} else {
  recordFail(`Required file: tutor submissions screen (${submissionsTsx} or ${submissionsIndex})`);
}

// --- B. Feature strings ---
const tutorSvc = readText('lib/tutorExerciseService.ts');
const tutorStrings = [
  'tutorExercises',
  'tutorExerciseSubmissions',
  'submitTutorExerciseSolution',
  'listSubmissionsForExercise',
  'gradeTutorExerciseSubmission',
  'getPublishedExerciseWithSolutionsIfGraded',
];
if (tutorSvc) {
  for (const s of tutorStrings) {
    if (tutorSvc.includes(s)) recordPass(`tutorExerciseService.ts contains "${s}"`);
    else recordFail(`tutorExerciseService.ts missing "${s}"`);
  }
} else {
  for (const s of tutorStrings) {
    recordFail(`tutorExerciseService.ts missing "${s}" (file unreadable)`);
  }
}

const feed = readText('app/(tabs)/feed.tsx');
const feedStrings = ['followers', 'visibility', 'KeyboardAvoidingView', 'useSafeAreaInsets'];
if (feed) {
  for (const s of feedStrings) {
    if (feed.includes(s)) recordPass(`feed.tsx contains "${s}"`);
    else recordFail(`feed.tsx missing "${s}"`);
  }
} else {
  for (const s of feedStrings) {
    recordFail(`feed.tsx missing "${s}" (file unreadable)`);
  }
}

const rules = readText('firestore.rules');
const ruleStrings = ['tutorExercises', 'tutorExerciseSubmissions'];
if (rules) {
  for (const s of ruleStrings) {
    if (rules.includes(s)) recordPass(`firestore.rules contains "${s}"`);
    else recordFail(`firestore.rules missing "${s}"`);
  }
} else {
  for (const s of ruleStrings) {
    recordFail(`firestore.rules missing "${s}" (file unreadable)`);
  }
}

// --- C & D. QA_TEST_PLAN.md ---
const qaPath = 'QA_TEST_PLAN.md';
const qaText = readText(qaPath);

if (qaText) {
  const sectionChecks = [
    {
      name: 'Unit Tests',
      en: 'Unit Tests',
      he: 'בדיקות יחידה',
    },
    {
      name: 'Integration Tests',
      en: 'Integration Tests',
      he: 'בדיקות אינטגרציה',
    },
    {
      name: 'Test Cases',
      en: 'Test Cases',
      he: 'תרחישי בדיקה',
    },
    {
      name: 'GUI Tests',
      en: 'GUI Tests',
      he: 'בדיקות GUI',
    },
  ];

  for (const sc of sectionChecks) {
    const ok = qaText.includes(sc.en) || qaText.includes(sc.he);
    if (ok) recordPass(`QA_TEST_PLAN.md section: ${sc.name} (EN or HE heading)`);
    else recordFail(`QA_TEST_PLAN.md section missing: ${sc.name} (expected "${sc.en}" or "${sc.he}")`);
  }

  const idThresholds = [
    { prefix: 'UT-', re: /\bUT-\d+\b/g, min: 10 },
    { prefix: 'IT-', re: /\bIT-\d+\b/g, min: 10 },
    { prefix: 'TC-', re: /\bTC-\d+\b/g, min: 20 },
    { prefix: 'GUI-', re: /\bGUI-\d+\b/g, min: 15 },
  ];

  for (const { prefix, re, min } of idThresholds) {
    const n = countMatches(qaText, re);
    if (n >= min) recordPass(`QA_TEST_PLAN.md: ${prefix}* count ${n} (min ${min})`);
    else recordFail(`QA_TEST_PLAN.md: ${prefix}* count ${n} (min ${min})`);
  }
} else {
  recordFail('QA_TEST_PLAN.md unreadable or missing (sections + IDs)');
}

// --- E. Locale JSON ---
const localeFiles = ['lib/locales/he.json', 'lib/locales/en.json'];
const topKeys = ['auth', 'feed', 'profile', 'tutor'];
const nestedPaths = ['tutor.exercises', 'tutor.studentSolve', 'tutor.submissionsList', 'feed.followersOnly'];

for (const lf of localeFiles) {
  const { ok, data, error } = readJson(lf);
  if (!ok) {
    recordFail(`${lf}: parse failed (${error})`);
    continue;
  }
  for (const k of topKeys) {
    if (data && typeof data === 'object' && k in data) recordPass(`${lf}: top-level "${k}"`);
    else recordFail(`${lf}: missing top-level "${k}"`);
  }
  for (const np of nestedPaths) {
    const v = getByPath(data, np);
    if (v !== undefined) recordPass(`${lf}: nested "${np}"`);
    else recordFail(`${lf}: missing nested "${np}"`);
  }
}

// --- Summary ---
console.log('\n--- Summary ---');
console.log(`Total checks: ${total}`);
console.log(`Passed:       ${passed}`);
console.log(`Failed:       ${failed}`);
console.log(`Warnings:     ${warnings}\n`);

if (failed > 0) {
  process.exit(1);
}
process.exit(0);
