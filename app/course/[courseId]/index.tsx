// app/course/[courseId]/index.tsx
import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppHeader } from '@/frontend/components/ui/AppHeader';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { EmptyState } from '@/frontend/components/ui/EmptyState';
import { LoadingState } from '@/frontend/components/ui/LoadingState';
import { PrimaryButton } from '@/frontend/components/ui/PrimaryButton';
import { iconContainer, layout, radius, spacing, typography } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import { auth, db } from '@/lib/firebaseConfig';
import {
  getStudentSubmissionsForExerciseIds,
  listPublishedTutorExercisesForCourse,
  type TutorExerciseSubmissionDoc,
} from '@/lib/tutorExerciseService';
import { fetchTutorSupportRequestsForStudent } from '@/lib/tutorSupportRequestService';
import { useUser } from '@/lib/UserContext';
import type { TutorExerciseDoc } from '@/shared/types/tutorExercise';
import { askCourseAssistant } from '@/lib/aiService';
import { startCourseFileIntelligenceJob } from '@/lib/learningIntelligence/api';
import { supabase } from '@/lib/supabaseClient';
import { uploadCourseFileToSupabase } from '@/lib/upload';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type CourseFile = {
  id: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
  url?: string | null;
};

function formatTutorExerciseGradeForCard(grade: unknown): string | null {
  if (grade == null) return null;
  if (typeof grade === 'number' && !Number.isNaN(grade)) return String(grade);
  if (typeof grade === 'string' && grade.trim()) return grade.trim();
  return null;
}

export default function CourseDetailsScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const isHebrewUi = i18n.language === 'he';
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);
  const { role, loading: userRoleLoading } = useUser();
  const params = useLocalSearchParams<{
    courseId?: string | string[];
    name?: string;
  }>();

  const courseId =
    typeof params.courseId === 'string' ? params.courseId : undefined;
  const name = params.name;

  const [files, setFiles] = useState<CourseFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiResponse, setAiResponse] = useState<{
    answer: string;
    sourceFiles: string[];
    sourceChunksCount: number;
    question: string;
    qualityStatus?: 'grounded' | 'weak_grounding' | 'no_sources' | 'fallback' | 'error';
    traceId?: string;
  } | null>(null);
  const [aiRatingLoading, setAiRatingLoading] = useState(false);
  const [aiMarkedRating, setAiMarkedRating] = useState<'good' | 'bad' | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryPack, setSummaryPack] = useState<{
    summary: string;
    keyPoints: string[];
    flashcards: Array<{ question: string; answer: string }>;
  } | null>(null);
  
  // Practice statistics
  const [practiceStats, setPracticeStats] = useState<{
    totalPractices: number;
    averageScore: number;
    lastPracticeDate: Date | null;
    weakTopics: string[];
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  /** Participating / tutored courses: student is not `ownerUid` on the course doc (same rule as "Courses I participate in"). */
  const [studentNonOwnerCourse, setStudentNonOwnerCourse] = useState(false);
  const [courseOwnershipResolved, setCourseOwnershipResolved] = useState(false);

  const [tutorPublishedExercises, setTutorPublishedExercises] = useState<TutorExerciseDoc[]>([]);
  const [loadingTutorPublished, setLoadingTutorPublished] = useState(false);
  const [tutorSubmissionsByExerciseId, setTutorSubmissionsByExerciseId] = useState<
    Record<string, TutorExerciseSubmissionDoc | null>
  >({});

  /** Same rule as "Courses I participate in" tutor badge: accepted `tutorSupportRequests` for this course + student. */
  const [hasAcceptedTutorForThisCourse, setHasAcceptedTutorForThisCourse] = useState(false);
  const [tutorParticipationResolved, setTutorParticipationResolved] = useState(false);

  // --- טעינת קבצים לקורס הזה ---
  useEffect(() => {
    if (!courseId) {
      setLoadingFiles(false);
      return;
    }

    const filesRef = collection(db, 'courseFiles');
    const q = query(
      filesRef,
      where('courseId', '==', courseId),
      orderBy('createdAt', 'desc'),
    );

    const unsub = onSnapshot(
      q,
      snapshot => {
        const list: CourseFile[] = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data() as any;
          list.push({
            id: docSnap.id,
            name: data.name,
            mimeType: data.mimeType ?? null,
            size: data.size ?? null,
            url: data.url ?? null,
          });
        });
        setFiles(list);
        setLoadingFiles(false);
      },
      err => {
        console.log('Error loading course files:', err);
        Alert.alert('Error', 'Failed to load course files.');
        setLoadingFiles(false);
      },
    );

    return unsub;
  }, [courseId]);

  useEffect(() => {
    if (!courseId) {
      setStudentNonOwnerCourse(false);
      setCourseOwnershipResolved(false);
      return;
    }
    if (userRoleLoading) return;

    if (role !== 'student') {
      setStudentNonOwnerCourse(false);
      setCourseOwnershipResolved(true);
      return;
    }

    const uid = auth.currentUser?.uid;
    if (!uid) {
      setStudentNonOwnerCourse(false);
      setCourseOwnershipResolved(true);
      return;
    }

    let cancelled = false;
    setCourseOwnershipResolved(false);
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'courses', courseId));
        if (cancelled) return;
        if (!snap.exists()) {
          setStudentNonOwnerCourse(false);
          setCourseOwnershipResolved(true);
          return;
        }
        const ownerUid = (snap.data() as { ownerUid?: unknown }).ownerUid;
        setStudentNonOwnerCourse(typeof ownerUid === 'string' && ownerUid !== uid);
        setCourseOwnershipResolved(true);
      } catch {
        if (!cancelled) {
          setStudentNonOwnerCourse(false);
          setCourseOwnershipResolved(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [courseId, userRoleLoading, role]);

  useEffect(() => {
    if (!courseId) {
      setHasAcceptedTutorForThisCourse(false);
      setTutorParticipationResolved(false);
      return;
    }
    if (userRoleLoading) return;

    if (role !== 'student') {
      setHasAcceptedTutorForThisCourse(false);
      setTutorParticipationResolved(true);
      return;
    }

    const uid = auth.currentUser?.uid;
    if (!uid) {
      setHasAcceptedTutorForThisCourse(false);
      setTutorParticipationResolved(true);
      return;
    }

    let cancelled = false;
    setTutorParticipationResolved(false);
    (async () => {
      try {
        const requests = await fetchTutorSupportRequestsForStudent(uid);
        if (cancelled) return;
        setHasAcceptedTutorForThisCourse(
          requests.some((r) => r.courseId === courseId && r.status === 'accepted'),
        );
        setTutorParticipationResolved(true);
      } catch (e) {
        console.log('Error loading tutor participation for course:', e);
        if (!cancelled) {
          setHasAcceptedTutorForThisCourse(false);
          setTutorParticipationResolved(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [courseId, userRoleLoading, role]);

  const showStudyInsights =
    !userRoleLoading &&
    role !== null &&
    (role !== 'student' || (courseOwnershipResolved && !studentNonOwnerCourse));

  /** Participating / tutored students (not course owner) must not delete course files — UI + handler guard. */
  const canDeleteCourseFiles =
    !userRoleLoading &&
    role !== null &&
    (role !== 'student' || (courseOwnershipResolved && !studentNonOwnerCourse));

  // Load practice statistics - reload when screen comes into focus (after practice)
  const loadPracticeStats = useCallback(async () => {
    if (!courseId) {
      setLoadingStats(false);
      return;
    }
    if (userRoleLoading || role === null) return;
    if (role === 'student') {
      if (!courseOwnershipResolved) return;
      if (studentNonOwnerCourse) {
        setLoadingStats(false);
        setPracticeStats(null);
        return;
      }
    }

    try {
      setLoadingStats(true);
      const { getPracticeStats } = await import('@/lib/practiceService');
      const stats = await getPracticeStats(courseId);
      console.log('📊 Loaded practice stats:', stats);
      setPracticeStats(stats);
    } catch (error) {
      console.log('Error loading practice stats:', error);
      // Set default stats on error
      setPracticeStats({
        totalPractices: 0,
        averageScore: 0,
        lastPracticeDate: null,
        weakTopics: [],
      });
    } finally {
      setLoadingStats(false);
    }
  }, [courseId, userRoleLoading, role, courseOwnershipResolved, studentNonOwnerCourse]);

  // Load stats on mount and when screen comes into focus
  useEffect(() => {
    loadPracticeStats();
  }, [loadPracticeStats]);

  // Reload stats when screen comes into focus (after returning from practice)
  useFocusEffect(
    useCallback(() => {
      loadPracticeStats();
    }, [loadPracticeStats])
  );

  useEffect(() => {
    if (
      !courseId ||
      userRoleLoading ||
      role !== 'student' ||
      !tutorParticipationResolved ||
      !hasAcceptedTutorForThisCourse
    ) {
      setTutorPublishedExercises([]);
      setLoadingTutorPublished(false);
      return;
    }
    let cancelled = false;
    setLoadingTutorPublished(true);
    listPublishedTutorExercisesForCourse(courseId)
      .then((list) => {
        if (!cancelled) setTutorPublishedExercises(list);
      })
      .catch((e) => {
        console.log('Error loading tutor exercises for course:', e);
        if (!cancelled) setTutorPublishedExercises([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingTutorPublished(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, role, userRoleLoading, tutorParticipationResolved, hasAcceptedTutorForThisCourse]);

  const reloadTutorSubmissions = useCallback(async () => {
    if (
      role !== 'student' ||
      !tutorParticipationResolved ||
      !hasAcceptedTutorForThisCourse ||
      tutorPublishedExercises.length === 0
    ) {
      setTutorSubmissionsByExerciseId({});
      return;
    }
    const uid = auth.currentUser?.uid;
    if (!uid) {
      setTutorSubmissionsByExerciseId({});
      return;
    }
    try {
      const ids = tutorPublishedExercises.map((e) => e.id);
      const map = await getStudentSubmissionsForExerciseIds(ids, uid);
      setTutorSubmissionsByExerciseId(map);
    } catch (e) {
      console.log('Error loading tutor exercise submissions for course:', e);
      setTutorSubmissionsByExerciseId({});
    }
  }, [role, tutorParticipationResolved, hasAcceptedTutorForThisCourse, tutorPublishedExercises]);

  useEffect(() => {
    void reloadTutorSubmissions();
  }, [reloadTutorSubmissions]);

  useFocusEffect(
    useCallback(() => {
      void reloadTutorSubmissions();
    }, [reloadTutorSubmissions]),
  );

  // --- העלאת קובץ חדש ---
  const handleUploadFile = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Error', 'You must be logged in to upload files.');
        return;
      }
      if (!courseId) {
        Alert.alert('Error', 'Missing course id.');
        return;
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset || !asset.uri) {
        Alert.alert('Error', 'Could not read selected file.');
        return;
      }

      // 1. העלאה ל-Supabase
      const fileUrl = await uploadCourseFileToSupabase(
        asset.uri,
        courseId,
        asset.mimeType ?? undefined,
      );

      if (!fileUrl) {
        Alert.alert('Upload failed', 'Could not upload file. Please try again.');
        return;
      }

      // 2. שמירת מטא-דאטה ב-Firestore
      const createdRef = await addDoc(collection(db, 'courseFiles'), {
        courseId,
        ownerUid: user.uid,
        name: asset.name ?? 'Untitled file',
        size: asset.size ?? null,
        mimeType: asset.mimeType ?? null,
        url: fileUrl,
        createdAt: serverTimestamp(),
      });

      // Trigger unified file-intelligence indexing/insights pipeline in background.
      startCourseFileIntelligenceJob({
        userId: user.uid,
        courseId,
        courseName: name ?? 'Course',
        fileId: createdRef.id,
      }).catch((engineErr) => {
        console.log('File intelligence job trigger failed:', engineErr);
      });

      Alert.alert('Success', 'File uploaded successfully.');
    } catch (err) {
      console.log('Upload error:', err);
      Alert.alert('Error', 'Failed to upload file, please try again.');
    }
  };

  // --- פתיחת קובץ בלחיצה ---
  const handleOpenFile = (file: CourseFile) => {
    if (!file.url) {
      Alert.alert('Error', 'Missing file URL.');
      return;
    }

    Linking.openURL(file.url).catch(err => {
      console.log('Failed to open file url:', err);
      Alert.alert('Error', 'Could not open file.');
    });
  };

  // Format practice date
  const formatPracticeDate = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return t('courseDetails.today');
    if (diffDays === 1) return t('courseDetails.yesterday');
    if (diffDays < 7) return t('courseDetails.daysAgo', { count: diffDays });
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return t('courseDetails.weeksAgo', { count: weeks });
    }
    const months = Math.floor(diffDays / 30);
    return t('courseDetails.monthsAgo', { count: months });
  };

  const formatTutorExercisePublishedDate = (ex: TutorExerciseDoc): string => {
    const ts = ex.publishedAt ?? ex.updatedAt;
    const ms =
      ts && typeof (ts as { toMillis?: () => number }).toMillis === 'function'
        ? (ts as { toMillis: () => number }).toMillis()
        : 0;
    if (!ms) return '—';
    const locale = isHebrewUi ? 'he-IL' : 'en-US';
    return new Date(ms).toLocaleDateString(locale, { dateStyle: 'medium' });
  };

  // helper קטן לשליפת ה-path מתוך ה־public URL
  const getPathFromPublicUrl = (url: string): string | null => {
    try {
      const parts = url.split(
        '/storage/v1/object/public/studybuddy-files/',
      );
      if (parts.length !== 2) return null;
      return parts[1]; // למשל: "course-files/abc/123.pdf"
    } catch {
      return null;
    }
  };

  const handleAskAI = async () => {
    if (!aiQuestion.trim() || aiLoading) return;

    setAiLoading(true);
    setAiResponse(null);
    setAiMarkedRating(null);
    try {
      const askedQuestion = aiQuestion.trim();
      const language = /[\u0590-\u05FF]/.test(aiQuestion) ? 'hebrew' : 'english';
      const response = await askCourseAssistant(
        courseId || '',
        name ?? 'Course',
        askedQuestion,
        language
      );
      setAiResponse({
        answer: response.answer,
        sourceFiles: Array.isArray(response.sourceFiles) ? response.sourceFiles : [],
        sourceChunksCount: Array.isArray(response.sourceChunks) ? response.sourceChunks.length : 0,
        question: askedQuestion,
        qualityStatus: response.qualityStatus,
        traceId: response.traceId,
      });
    } catch (error) {
      console.log('Course assistant failed:', error);
      Alert.alert('Error', 'AI assistant is temporarily unavailable. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleQuickAIAction = (question: string) => {
    setAiQuestion(question);
    setAiResponse(null);
    setShowAIModal(true);
  };

  const handleMarkAIResponse = async (rating: 'good' | 'bad') => {
    if (!aiResponse || aiRatingLoading || aiMarkedRating !== null || role !== 'admin' || !__DEV__) return;
    const user = auth.currentUser;
    if (!user || !courseId) return;
    try {
      setAiRatingLoading(true);
      await addDoc(collection(db, 'aiEvaluations'), {
        userId: user.uid,
        courseId,
        question: aiResponse.question,
        answer: aiResponse.answer,
        qualityStatus: aiResponse.qualityStatus || 'unknown',
        rating,
        traceId: aiResponse.traceId || null,
        createdAt: serverTimestamp(),
      });
      setAiMarkedRating(rating);
    } catch (err) {
      console.log('Failed to save AI evaluation:', err);
      Alert.alert('Error', 'Failed to save AI evaluation mark.');
    } finally {
      setAiRatingLoading(false);
    }
  };

  const handleGenerateSummaryPack = async () => {
    if (!courseId || summaryLoading) return;
    try {
      setSummaryLoading(true);
      const { generateSummaryAndFlashcards } = await import('@/lib/aiService');
      const pack = await generateSummaryAndFlashcards(courseId, name ?? 'Course');
      setSummaryPack(pack);
    } catch (error) {
      console.log('Summary generation failed:', error);
      Alert.alert('Error', 'Failed to generate AI summary pack');
    } finally {
      setSummaryLoading(false);
    }
  };

  // Get file icon based on mime type
  const getFileIcon = (mimeType: string | null | undefined) => {
    if (!mimeType) return 'document-outline';
    if (mimeType.includes('pdf')) return 'document-text-outline';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'document-outline';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'grid-outline';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'easel-outline';
    if (mimeType.includes('image')) return 'image-outline';
    if (mimeType.includes('video')) return 'videocam-outline';
    if (mimeType.includes('audio')) return 'musical-notes-outline';
    if (mimeType.includes('zip') || mimeType.includes('archive')) return 'archive-outline';
    return 'document-outline';
  };

  // --- מחיקת קובץ ---
  const handleDeleteFile = (file: CourseFile) => {
    if (!canDeleteCourseFiles) {
      console.log('Course file delete blocked: user cannot delete files on this course.');
      return;
    }
    Alert.alert(
      'Delete file',
      'Are you sure you want to delete this file?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // 1. מחיקה מ-Supabase (אם יש url)
              if (file.url) {
                const path = getPathFromPublicUrl(file.url);
                if (path) {
                  const { error } = await supabase.storage
                    .from('studybuddy-files')
                    .remove([path]);
                  if (error) {
                    console.log('Supabase delete error:', error);
                  }
                }
              }

              // 2. מחיקה מ-Firestore
              await deleteDoc(doc(db, 'courseFiles', file.id));
            } catch (err) {
              console.log('Delete file error:', err);
              Alert.alert(
                'Error',
                'Failed to delete file. Please try again.',
              );
            }
          },
        },
      ],
    );
  };

  const renderFile = ({ item }: { item: CourseFile }) => {
    const sizeMb =
      item.size != null ? (item.size / (1024 * 1024)).toFixed(2) : null;
    const fileIcon = getFileIcon(item.mimeType);

    return (
      <View style={styles.fileCard}>
        <TouchableOpacity
          style={styles.fileContent}
          onPress={() => handleOpenFile(item)}
          activeOpacity={0.7}
        >
          <View style={styles.fileIconContainer}>
            <Ionicons name={fileIcon} size={24} color={colors.accent} />
          </View>
          <View style={styles.fileInfo}>
            <Text style={styles.fileName} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.fileMetaRow}>
              {item.mimeType && (
                <View style={styles.metaTag}>
                  <Ionicons name="document-outline" size={10} color={colors.textSecondary} />
                  <Text style={styles.metaTagText}>
                    {item.mimeType.split('/')[1]?.toUpperCase() || 'FILE'}
                  </Text>
                </View>
              )}
              {sizeMb && (
                <View style={styles.metaTag}>
                  <Ionicons name="hardware-chip-outline" size={10} color={colors.textSecondary} />
                  <Text style={styles.metaTagText}>{sizeMb} MB</Text>
                </View>
              )}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        {canDeleteCourseFiles && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteFile(item)}
          >
            <Ionicons name="trash-outline" size={18} color={colors.textOnPrimary} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const shouldShowTutorExercises =
    role === 'student' && tutorParticipationResolved && hasAcceptedTutorForThisCourse;

  return (
    <AppScreen>
      <AppHeader title={String(name ?? 'Course')} onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroWrap}>
          <View style={styles.heroGlowPrimary} />
          <View style={styles.heroGlowAccent} />
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
            {t('courseDetails.manageMaterials')}
          </Text>
        </View>

        {/* Study Insights — hidden for participating / tutored courses (student is not course owner). */}
        {showStudyInsights && (
          <AppCard style={styles.insightsCard}>
            <View style={styles.cardAccentBar} />
            <View style={styles.sectionHeader}>
              <View style={styles.sectionIconBadge}>
                <Ionicons name="analytics" size={18} color={colors.accent} />
              </View>
              <Text style={styles.sectionTitle}>{t('courseDetails.studyInsights')}</Text>
            </View>

            {/* Real practice statistics */}
            {loadingStats ? (
              <View style={styles.insightsContent}>
                <LoadingState />
              </View>
            ) : practiceStats ? (
              <View style={styles.insightsContent}>
                <View style={styles.insightRow}>
                  <View style={styles.insightItem}>
                    <Ionicons name="alert-circle" size={20} color="#f59e0b" />
                    <Text style={styles.insightLabel}>{t('courseDetails.weakTopics')}</Text>
                    <Text style={styles.insightValue}>{practiceStats.weakTopics.length}</Text>
                  </View>
                  <View style={styles.insightItem}>
                    <Ionicons name="flask" size={20} color={colors.accent} />
                    <Text style={styles.insightLabel}>{t('courseDetails.practices')}</Text>
                    <Text style={styles.insightValue}>{practiceStats.totalPractices}</Text>
                  </View>
                  <View style={styles.insightItem}>
                    <Ionicons name="calendar" size={20} color={colors.primary} />
                    <Text style={styles.insightLabel}>{t('courseDetails.lastPractice')}</Text>
                    <Text style={styles.insightValue}>
                      {practiceStats.lastPracticeDate
                        ? formatPracticeDate(practiceStats.lastPracticeDate)
                        : t('courseDetails.noPractice')}
                    </Text>
                  </View>
                  {shouldShowTutorExercises && (
                    <View style={styles.insightItem}>
                      <Ionicons name="reader-outline" size={20} color={colors.primary} />
                      <Text style={[styles.insightLabel, isHebrewUi && styles.rtlText]} numberOfLines={2}>
                        {t('courseDetails.tutorExercisesStatLabel')}
                      </Text>
                      <Text style={styles.insightValue}>
                        {loadingTutorPublished ? '—' : tutorPublishedExercises.length}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Top Weak Topics */}
                {practiceStats.weakTopics.length > 0 && (
                  <View style={styles.weakTopicsSection}>
                    <Text style={styles.weakTopicsTitle}>{t('courseDetails.topWeakTopics')}</Text>
                    <View style={styles.weakTopicsList}>
                      {practiceStats.weakTopics.slice(0, 3).map((topic, index) => (
                        <View key={index} style={styles.weakTopicItem}>
                          <Ionicons name="bookmark-outline" size={16} color="#f59e0b" />
                          <Text style={styles.weakTopicText}>{topic}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.insightsContent}>
                <Text style={styles.noDataText}>{t('courseDetails.noPracticeData')}</Text>
              </View>
            )}
          </AppCard>
        )}

        {shouldShowTutorExercises && (
          <AppCard style={styles.tutorExercisesCard}>
            <View style={styles.cardAccentBar} />
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <View style={styles.sectionIconBadge}>
                  <Ionicons name="create-outline" size={18} color={colors.textPrimary} />
                </View>
                <Text style={[styles.sectionTitle, isHebrewUi && styles.rtlText]}>
                  {t('courseDetails.tutorExercisesTitle')}
                </Text>
              </View>
            </View>
            {loadingTutorPublished ? (
              <View style={styles.loadingContainer}>
                <LoadingState />
              </View>
            ) : tutorPublishedExercises.length === 0 ? (
              <EmptyState title={t('courseDetails.tutorExercisesEmpty')} subtitle="" />
            ) : (
              <View style={styles.tutorExercisesList}>
                {tutorPublishedExercises.map((ex) => (
                  <TouchableOpacity
                    key={ex.id}
                    activeOpacity={0.88}
                    accessibilityRole="button"
                    onPress={() =>
                      courseId &&
                      router.push(`/course/${courseId}/tutor-exercises/${ex.id}` as any)
                    }
                    style={[
                      styles.tutorExItem,
                      { borderColor: colors.border, backgroundColor: colors.surfaceMuted },
                    ]}
                  >
                    <View style={styles.tutorExItemHeader}>
                      <Text
                        style={[styles.tutorExTitle, { color: colors.textPrimary }, isHebrewUi && styles.rtlText]}
                        numberOfLines={2}
                      >
                        {ex.title || '—'}
                      </Text>
                      <View
                        style={[
                          styles.tutorExPublishedPill,
                          { borderColor: colors.primary, backgroundColor: `${colors.primary}14` },
                        ]}
                      >
                        <Text style={[styles.tutorExPublishedPillText, { color: colors.primary }]}>
                          {t('courseDetails.tutorExercisesPublished')}
                        </Text>
                      </View>
                    </View>
                    {!!ex.tutorName && (
                      <Text
                        style={[styles.tutorExTutor, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}
                        numberOfLines={1}
                      >
                        {ex.tutorName}
                      </Text>
                    )}
                    <Text style={[styles.tutorExMeta, { color: colors.textSecondary }, isHebrewUi && styles.rtlText]}>
                      {t('tutor.exercises.questionCount', { count: ex.questions.length })}
                      {' · '}
                      {t('courseDetails.tutorExercisesPublishedOn', {
                        date: formatTutorExercisePublishedDate(ex),
                      })}
                    </Text>
                    {(() => {
                      const submission = tutorSubmissionsByExerciseId[ex.id];
                      const graded = submission?.status === 'graded';
                      const submitted = submission?.status === 'submitted';
                      const ctaLabel = graded
                        ? t('courseDetails.tutorExerciseCardViewGrade')
                        : submitted
                          ? t('courseDetails.tutorExerciseCardWaitingReview')
                          : t('courseDetails.tutorExerciseCardTapToSolve');
                      const ctaColor = graded
                        ? colors.success
                        : submitted
                          ? colors.textSecondary
                          : colors.primary;
                      const gradeStr = graded ? formatTutorExerciseGradeForCard(submission.grade) : null;
                      return (
                        <View style={[styles.tutorExOpenRow, { borderTopColor: colors.border }]}>
                          <View style={styles.tutorExOpenCol}>
                            <Text
                              style={[styles.tutorExOpenText, { color: ctaColor }, isHebrewUi && styles.rtlText]}
                            >
                              {ctaLabel}
                            </Text>
                            {gradeStr != null && (
                              <Text
                                style={[
                                  styles.tutorExGradeLine,
                                  { color: colors.textSecondary },
                                  isHebrewUi && styles.rtlText,
                                ]}
                              >
                                {t('courseDetails.tutorExerciseCardGrade', { score: gradeStr })}
                              </Text>
                            )}
                          </View>
                          <Ionicons
                            name={isHebrewUi ? 'chevron-back' : 'chevron-forward'}
                            size={18}
                            color={ctaColor}
                          />
                        </View>
                      );
                    })()}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </AppCard>
        )}

        {/* Files Section */}
        <AppCard style={styles.filesCard}>
          <View style={styles.cardAccentBar} />
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <View style={styles.sectionIconBadge}>
                <Ionicons name="document-text" size={18} color={colors.textPrimary} />
              </View>
              <Text style={styles.sectionTitle}>{t('courseDetails.courseFiles')}</Text>
            </View>
            <TouchableOpacity
              style={styles.aiButtonInline}
              onPress={() => setShowAIModal(true)}
            >
              <Ionicons name="sparkles" size={18} color={colors.accent} />
              <Text style={styles.aiButtonInlineText}>{t('courseDetails.askAI')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.aiQuickActionsRow}>
            <TouchableOpacity
              style={styles.aiQuickAction}
              onPress={() => handleQuickAIAction(t('courseDetails.quickAiSummaryQuestion', { courseName: name ?? t('courseDetails.thisCourse') }))}
            >
              <Ionicons name="document-text-outline" size={14} color={colors.accent} />
              <Text style={styles.aiQuickActionText}>{t('courseDetails.quickAiSummary')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.aiQuickAction}
              onPress={() => handleQuickAIAction(t('courseDetails.quickAiExamQuestion', { courseName: name ?? t('courseDetails.thisCourse') }))}
            >
              <Ionicons name="school-outline" size={14} color={colors.accent} />
              <Text style={styles.aiQuickActionText}>{t('courseDetails.quickAiExamPrep')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.aiQuickAction}
              onPress={() => handleQuickAIAction(t('courseDetails.quickAiWeakQuestion', { courseName: name ?? t('courseDetails.thisCourse') }))}
            >
              <Ionicons name="analytics-outline" size={14} color={colors.accent} />
              <Text style={styles.aiQuickActionText}>{t('courseDetails.quickAiWeakTopics')}</Text>
            </TouchableOpacity>
          </View>

          {loadingFiles ? (
            <View style={styles.loadingContainer}>
              <LoadingState label={t('courseDetails.loadingFiles')} />
            </View>
          ) : files.length === 0 ? (
            <EmptyState title={t('courseDetails.noFiles')} subtitle={t('courseDetails.noFilesMessage')} />
          ) : (
            <FlatList
              data={files}
              keyExtractor={item => item.id}
              renderItem={renderFile}
              scrollEnabled={false}
              contentContainerStyle={styles.filesList}
            />
          )}

          <PrimaryButton
            label={t('courseDetails.uploadFile')}
            onPress={handleUploadFile}
            style={styles.uploadButton}
          />

          <PrimaryButton
            label={summaryLoading ? `${t('common.loading')}...` : 'AI Summary + Flashcards'}
            onPress={handleGenerateSummaryPack}
            loading={summaryLoading}
            style={styles.summaryButton}
          />

          {summaryPack && (
            <View style={styles.summaryPackBox}>
              <Text style={styles.summaryPackTitle}>AI Summary</Text>
              <Text style={styles.summaryPackText}>{summaryPack.summary}</Text>
              {summaryPack.keyPoints.length > 0 && (
                <>
                  <Text style={styles.summaryPackSubtitle}>Key Points</Text>
                  {summaryPack.keyPoints.map((point, idx) => (
                    <Text key={`${point}-${idx}`} style={styles.summaryBullet}>• {point}</Text>
                  ))}
                </>
              )}
              {summaryPack.flashcards.length > 0 && (
                <>
                  <Text style={styles.summaryPackSubtitle}>Flashcards</Text>
                  {summaryPack.flashcards.slice(0, 4).map((card, idx) => (
                    <View key={`${card.question}-${idx}`} style={styles.flashcardItem}>
                      <Text style={styles.flashcardQ}>Q: {card.question}</Text>
                      <Text style={styles.flashcardA}>A: {card.answer}</Text>
                    </View>
                  ))}
                </>
              )}
            </View>
          )}
        </AppCard>
      </ScrollView>

      {/* AI Question Modal */}
      <Modal
        visible={showAIModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowAIModal(false);
          setAiQuestion('');
          setAiResponse(null);
        }}
      >
        <KeyboardAvoidingView
          style={styles.aiModalKeyboardWrapper}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <View style={styles.aiModalBackdrop}>
            <View style={styles.aiModalContent}>
              <View style={styles.aiModalHeader}>
                <View style={styles.aiModalHeaderLeft}>
                  <View style={styles.aiIconContainer}>
                    <Ionicons name="sparkles" size={24} color={PRIMARY_GREEN} />
                  </View>
                  <View>
                    <Text style={styles.aiModalTitle}>{t('courseDetails.aiAssistant')}</Text>
                    <Text style={styles.aiModalSubtitle}>
                      {t('courseDetails.askQuestionsAbout', { courseName: name ?? t('courseDetails.thisCourse') })}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setShowAIModal(false);
                    setAiQuestion('');
                    setAiResponse(null);
                  }}
                >
                  <Ionicons name="close" size={24} color="#111827" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.aiModalBody}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.aiModalBodyContent}
              >
                {aiResponse ? (
                  <View style={styles.aiResponseContainer}>
                    <View style={styles.aiResponseHeader}>
                      <Ionicons name="sparkles" size={20} color={PRIMARY_GREEN} />
                      <Text style={styles.aiResponseTitle}>{t('courseDetails.aiResponse')}</Text>
                    </View>
                    <Text style={styles.aiResponseText}>{aiResponse.answer}</Text>
                    <View style={styles.sourcesCard}>
                      <View style={styles.sourcesHeader}>
                        <Text style={styles.sourcesTitle}>{t('courseDetails.sourcesUsedTitle')}</Text>
                        <View
                          style={[
                            styles.sourceConfidenceBadge,
                            aiResponse.sourceFiles.length > 0
                              ? styles.sourceConfidenceBadgeStrong
                              : styles.sourceConfidenceBadgeWeak,
                          ]}
                        >
                          <Text
                            style={[
                              styles.sourceConfidenceText,
                              aiResponse.sourceFiles.length > 0
                                ? styles.sourceConfidenceTextStrong
                                : styles.sourceConfidenceTextWeak,
                            ]}
                          >
                            {aiResponse.sourceFiles.length > 0
                              ? t('courseDetails.sourceIndicatorGrounded')
                              : t('courseDetails.sourceIndicatorNoGrounding')}
                          </Text>
                        </View>
                      </View>
                      {aiResponse.sourceFiles.length > 0 ? (
                        <View style={styles.sourcesList}>
                          {aiResponse.sourceFiles.map((fileName, index) => (
                            <View key={`${fileName}-${index}`} style={styles.sourceFileRow}>
                              <Ionicons name="document-text-outline" size={14} color="#065f46" />
                              <Text style={styles.sourceFileName} numberOfLines={1}>
                                {fileName}
                              </Text>
                            </View>
                          ))}
                          <Text style={styles.sourcesHelperText}>
                            {t('courseDetails.sourceChunksUsed', {
                              count: aiResponse.sourceChunksCount || aiResponse.sourceFiles.length,
                            })}
                          </Text>
                        </View>
                      ) : (
                        <Text style={styles.noSourcesText}>
                          {t('courseDetails.noCourseSourcesFound')}
                        </Text>
                      )}
                    </View>
                    {role === 'admin' && __DEV__ ? (
                      <View style={styles.evaluationRow}>
                        <Text style={styles.evaluationLabel}>Mark response (QA)</Text>
                        <View style={styles.evaluationButtons}>
                          <TouchableOpacity
                            style={[
                              styles.markButton,
                              styles.markGoodButton,
                              aiMarkedRating === 'good' && styles.markButtonActive,
                            ]}
                            onPress={() => handleMarkAIResponse('good')}
                            disabled={aiRatingLoading || aiMarkedRating !== null}
                          >
                            <Text style={styles.markButtonText}>👍 good</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.markButton,
                              styles.markBadButton,
                              aiMarkedRating === 'bad' && styles.markButtonActive,
                            ]}
                            onPress={() => handleMarkAIResponse('bad')}
                            disabled={aiRatingLoading || aiMarkedRating !== null}
                          >
                            <Text style={styles.markButtonText}>👎 bad</Text>
                          </TouchableOpacity>
                        </View>
                        {aiMarkedRating ? (
                          <Text style={styles.evaluationConfirmationText}>
                            {aiMarkedRating === 'good' ? 'Marked as good' : 'Marked as bad'}
                          </Text>
                        ) : null}
                      </View>
                    ) : null}
                    <TouchableOpacity
                      style={styles.askAnotherButton}
                      onPress={() => {
                        setAiQuestion('');
                        setAiResponse(null);
                        setAiMarkedRating(null);
                      }}
                    >
                      <Ionicons name="add-circle-outline" size={18} color={PRIMARY_GREEN} />
                      <Text style={styles.askAnotherText}>{t('courseDetails.askAnother')}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.aiQuestionContainer}>
                    <View style={styles.aiInfoCard}>
                      <Ionicons name="information-circle" size={24} color={PRIMARY_GREEN} />
                      <Text style={styles.aiInfoText}>
                        {files.length === 1 
                          ? t('courseDetails.aiInfoSingle', { count: files.length })
                          : t('courseDetails.aiInfoPlural', { count: files.length })}
                      </Text>
                    </View>
                    <Text style={styles.inputLabel}>{t('courseDetails.yourQuestion')}</Text>
                    <TextInput
                      style={styles.aiInput}
                      placeholder={t('courseDetails.questionPlaceholder')}
                      placeholderTextColor="#9ca3af"
                      value={aiQuestion}
                      onChangeText={setAiQuestion}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />
                    <TouchableOpacity
                      style={[styles.submitQuestionButton, !aiQuestion.trim() && styles.submitQuestionButtonDisabled]}
                      onPress={handleAskAI}
                      disabled={!aiQuestion.trim() || aiLoading}
                    >
                      {aiLoading ? (
                        <ActivityIndicator color="#ffffff" size="small" />
                      ) : (
                        <>
                          <Ionicons name="send" size={18} color="#ffffff" />
                          <Text style={styles.submitQuestionText}>{t('courseDetails.askQuestion')}</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </AppScreen>
  );
}

const PRIMARY_GREEN = '#635BFF';
const ACCENT_GREEN = '#0891B2';

const makeStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: 40,
  },
  heroWrap: {
    position: 'relative',
    overflow: 'hidden',
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  heroGlowPrimary: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    top: -100,
    right: -50,
    backgroundColor: colors.primary,
    opacity: 0.08,
  },
  heroGlowAccent: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    bottom: -65,
    left: -30,
    backgroundColor: colors.accent,
    opacity: 0.08,
  },
  heroSubtitle: {
    ...typography.body,
  },
  cardAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.primary,
    opacity: 0.35,
  },
  aiButtonInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  aiButtonInlineText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
  },
  aiQuickActionsRow: {
    marginTop: 12,
    marginBottom: 4,
    flexDirection: 'row',
    gap: 8,
  },
  aiQuickAction: {
    flex: 1,
    minHeight: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 8,
  },
  aiQuickActionText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  insightsCard: {
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    position: 'relative',
    overflow: 'hidden',
  },
  insightsContent: {
    marginTop: 16,
  },
  insightRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginBottom: 20,
    gap: spacing.sm,
  },
  insightItem: {
    alignItems: 'center',
    gap: 6,
  },
  insightLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  insightValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  weakTopicsSection: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  weakTopicsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  weakTopicsList: {
    gap: 8,
  },
  weakTopicItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noDataText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    padding: 20,
  },
  weakTopicText: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  rtlText: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  tutorExercisesCard: {
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    position: 'relative',
    overflow: 'hidden',
  },
  tutorExercisesList: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  tutorExItem: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  tutorExItemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  tutorExTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  tutorExPublishedPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  tutorExPublishedPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  tutorExTutor: {
    fontSize: 13,
    marginTop: spacing.xs,
  },
  tutorExMeta: {
    fontSize: 12,
    marginTop: spacing.sm,
  },
  tutorExOpenRow: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  tutorExOpenCol: {
    flex: 1,
    minWidth: 0,
  },
  tutorExOpenText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tutorExGradeLine: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  filesCard: {
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    position: 'relative',
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginLeft: 10,
  },
  sectionIconBadge: {
    width: iconContainer.size,
    height: iconContainer.size,
    borderRadius: iconContainer.radius,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#6b7280',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  filesList: {
    paddingBottom: 10,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fileContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  fileMetaRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metaTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  metaTagText: {
    fontSize: 10,
    color: colors.textSecondary,
    marginLeft: 4,
    fontWeight: '500',
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  uploadButton: {
    marginTop: spacing.md,
  },
  summaryButton: {
    marginTop: 20,
  },
  uploadButtonText: {
    color: colors.textOnPrimary,
    fontWeight: '600',
    fontSize: 16,
  },
  // AI Modal Styles
  aiModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  aiModalKeyboardWrapper: {
    flex: 1,
  },
  aiModalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingTop: 20,
  },
  aiModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  aiModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  aiIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  aiModalSubtitle: {
    fontSize: 13,
    color: '#6b7280',
  },
  aiModalBody: {
    padding: 20,
    maxHeight: 600,
  },
  aiModalBodyContent: {
    paddingBottom: 24,
  },
  aiQuestionContainer: {
    gap: 16,
  },
  aiInfoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#f0fdf4',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: PRIMARY_GREEN,
  },
  aiInfoText: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  aiInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitQuestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: PRIMARY_GREEN,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  submitQuestionButtonDisabled: {
    opacity: 0.5,
  },
  submitQuestionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  aiResponseContainer: {
    gap: 16,
  },
  aiResponseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  aiResponseTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  aiResponseText: {
    fontSize: 15,
    color: '#4b5563',
    lineHeight: 24,
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sourcesCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 8,
  },
  sourcesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sourcesTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  sourceConfidenceBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
  },
  sourceConfidenceBadgeStrong: {
    backgroundColor: '#ecfdf5',
    borderColor: '#86efac',
  },
  sourceConfidenceBadgeWeak: {
    backgroundColor: '#fffbeb',
    borderColor: '#fcd34d',
  },
  sourceConfidenceText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sourceConfidenceTextStrong: {
    color: '#166534',
  },
  sourceConfidenceTextWeak: {
    color: '#92400e',
  },
  sourcesList: {
    gap: 6,
  },
  sourceFileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  sourceFileName: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
  },
  sourcesHelperText: {
    marginTop: 2,
    fontSize: 12,
    color: '#64748b',
  },
  noSourcesText: {
    fontSize: 13,
    color: '#92400e',
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  evaluationRow: {
    marginTop: 2,
    gap: 8,
  },
  evaluationLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  evaluationButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  markButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markGoodButton: {
    borderColor: '#86efac',
    backgroundColor: '#ecfdf5',
  },
  markBadButton: {
    borderColor: '#fca5a5',
    backgroundColor: '#fef2f2',
  },
  markButtonActive: {
    opacity: 0.65,
  },
  markButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1f2937',
  },
  evaluationConfirmationText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
  },
  askAnotherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 8,
  },
  askAnotherText: {
    fontSize: 14,
    fontWeight: '600',
    color: PRIMARY_GREEN,
  },
  summaryPackBox: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#99f6e4',
    backgroundColor: '#f0fdfa',
    padding: 12,
    gap: 6,
  },
  summaryPackTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#134e4a',
  },
  summaryPackSubtitle: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#115e59',
  },
  summaryPackText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#0f172a',
  },
  summaryBullet: {
    fontSize: 13,
    color: '#0f172a',
  },
  flashcardItem: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ccfbf1',
    backgroundColor: '#ffffff',
    padding: 8,
    marginTop: 6,
  },
  flashcardQ: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  flashcardA: {
    fontSize: 12,
    color: '#334155',
    marginTop: 2,
  },
});
