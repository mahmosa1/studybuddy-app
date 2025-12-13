// app/course/[courseId].tsx
import { auth, db } from '@/lib/firebaseConfig';
import { supabase } from '@/lib/supabaseClient';
import { uploadCourseFileToSupabase } from '@/lib/upload';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
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

export default function CourseDetailsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
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
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

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
      await addDoc(collection(db, 'courseFiles'), {
        courseId,
        ownerUid: user.uid,
        name: asset.name ?? 'Untitled file',
        size: asset.size ?? null,
        mimeType: asset.mimeType ?? null,
        url: fileUrl,
        createdAt: serverTimestamp(),
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

    // Mock AI response - in real implementation, this would call an AI service
    // that analyzes the course files and generates a response
    setTimeout(() => {
      const question = aiQuestion.toLowerCase();
      let response = '';
      
      if (question.includes('topic') || question.includes('cover') || question.includes('about')) {
        response = `Based on the course materials in "${name ?? 'this course'}", the main topics covered include algorithms, data structures, and computational complexity. The course focuses on understanding fundamental computer science concepts and their practical applications. The ${files.length} file${files.length !== 1 ? 's' : ''} uploaded contain detailed information about these topics.`;
      } else if (question.includes('exam') || question.includes('test') || question.includes('quiz')) {
        response = `Based on the course files, I recommend focusing on the key concepts from the uploaded materials. Review the main algorithms and data structures covered in the ${files.length} file${files.length !== 1 ? 's' : ''}, and practice solving problems similar to those in the course materials.`;
      } else if (question.includes('difficult') || question.includes('hard') || question.includes('challeng')) {
        response = `Based on the course files, some challenging areas include advanced algorithm analysis and complex data structure implementations. I recommend reviewing the uploaded materials and practicing with similar problems. The course materials contain ${files.length} file${files.length !== 1 ? 's' : ''} that can help you understand these concepts better.`;
      } else if (question.includes('help') || question.includes('understand')) {
        response = `I can help you understand concepts from this course based on the ${files.length} file${files.length !== 1 ? 's' : ''} uploaded. The course materials cover various topics related to "${name ?? 'this course'}". Feel free to ask more specific questions about any topic you'd like to explore further.`;
      } else {
        response = `Based on the ${files.length} file${files.length !== 1 ? 's' : ''} in "${name ?? 'this course'}", ${aiQuestion.includes('?') ? aiQuestion.slice(0, -1) : aiQuestion} relates to the content covered in the course materials. The files contain relevant information that addresses this topic. For more specific details, I recommend reviewing the uploaded course files directly.`;
      }
      
      setAiResponse(response);
      setAiLoading(false);
    }, 2000);
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
            <Ionicons name={fileIcon} size={24} color={ACCENT_GREEN} />
          </View>
          <View style={styles.fileInfo}>
            <Text style={styles.fileName} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.fileMetaRow}>
              {item.mimeType && (
                <View style={styles.metaTag}>
                  <Ionicons name="document-outline" size={10} color="#6b7280" />
                  <Text style={styles.metaTagText}>
                    {item.mimeType.split('/')[1]?.toUpperCase() || 'FILE'}
                  </Text>
                </View>
              )}
              {sizeMb && (
                <View style={styles.metaTag}>
                  <Ionicons name="hardware-chip-outline" size={10} color="#6b7280" />
                  <Text style={styles.metaTagText}>{sizeMb} MB</Text>
                </View>
              )}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#6b7280" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteFile(item)}
        >
          <Ionicons name="trash-outline" size={18} color="#ffffff" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              style={styles.backButtonHeader}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>
          <View style={styles.headerContent}>
            <Ionicons name="folder" size={32} color="#ffffff" />
            <Text style={styles.headerTitle}>{name ?? 'Course'}</Text>
            <Text style={styles.headerSubtitle}>
              {t('courseDetails.manageMaterials')}
            </Text>
          </View>
        </View>

        {/* Study Insights Section - Only for students */}
        <View style={styles.insightsCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="analytics" size={22} color={ACCENT_GREEN} />
            <Text style={styles.sectionTitle}>{t('courseDetails.studyInsights')}</Text>
          </View>

          {/* Mock data for insights */}
          <View style={styles.insightsContent}>
            <View style={styles.insightRow}>
              <View style={styles.insightItem}>
                <Ionicons name="alert-circle" size={20} color="#f59e0b" />
                <Text style={styles.insightLabel}>{t('courseDetails.weakTopics')}</Text>
                <Text style={styles.insightValue}>3</Text>
              </View>
              <View style={styles.insightItem}>
                <Ionicons name="flask" size={20} color={ACCENT_GREEN} />
                <Text style={styles.insightLabel}>{t('courseDetails.practices')}</Text>
                <Text style={styles.insightValue}>12</Text>
              </View>
              <View style={styles.insightItem}>
                <Ionicons name="calendar" size={20} color={PRIMARY_GREEN} />
                <Text style={styles.insightLabel}>{t('courseDetails.lastPractice')}</Text>
                <Text style={styles.insightValue}>2 days ago</Text>
              </View>
            </View>

            {/* Top Weak Topics */}
            <View style={styles.weakTopicsSection}>
              <Text style={styles.weakTopicsTitle}>{t('courseDetails.topWeakTopics')}</Text>
              <View style={styles.weakTopicsList}>
                <View style={styles.weakTopicItem}>
                  <Ionicons name="bookmark-outline" size={16} color="#f59e0b" />
                  <Text style={styles.weakTopicText}>Integration by Parts</Text>
                </View>
                <View style={styles.weakTopicItem}>
                  <Ionicons name="bookmark-outline" size={16} color="#f59e0b" />
                  <Text style={styles.weakTopicText}>Eigenvalues</Text>
                </View>
                <View style={styles.weakTopicItem}>
                  <Ionicons name="bookmark-outline" size={16} color="#f59e0b" />
                  <Text style={styles.weakTopicText}>Time Complexity</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Files Section */}
        <View style={styles.filesCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Ionicons name="document-text" size={22} color={ACCENT_GREEN} />
              <Text style={styles.sectionTitle}>{t('courseDetails.courseFiles')}</Text>
            </View>
            <TouchableOpacity
              style={styles.aiButtonInline}
              onPress={() => setShowAIModal(true)}
            >
              <Ionicons name="sparkles" size={18} color={PRIMARY_GREEN} />
              <Text style={styles.aiButtonInlineText}>{t('courseDetails.askAI')}</Text>
            </TouchableOpacity>
          </View>

          {loadingFiles ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={PRIMARY_GREEN} size="large" />
              <Text style={styles.loadingText}>{t('courseDetails.loadingFiles')}</Text>
            </View>
          ) : files.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="document-outline" size={64} color="#6b7280" />
              </View>
              <Text style={styles.emptyTitle}>{t('courseDetails.noFiles')}</Text>
              <Text style={styles.emptyText}>
                {t('courseDetails.noFilesMessage')}
              </Text>
            </View>
          ) : (
            <FlatList
              data={files}
              keyExtractor={item => item.id}
              renderItem={renderFile}
              scrollEnabled={false}
              contentContainerStyle={styles.filesList}
            />
          )}

          <TouchableOpacity
            style={styles.uploadButton}
            onPress={handleUploadFile}
          >
            <Ionicons name="cloud-upload-outline" size={20} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.uploadButtonText}>{t('courseDetails.uploadFile')}</Text>
          </TouchableOpacity>
        </View>
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

            <ScrollView style={styles.aiModalBody} showsVerticalScrollIndicator={false}>
              {aiResponse ? (
                <View style={styles.aiResponseContainer}>
                  <View style={styles.aiResponseHeader}>
                    <Ionicons name="sparkles" size={20} color={PRIMARY_GREEN} />
                    <Text style={styles.aiResponseTitle}>{t('courseDetails.aiResponse')}</Text>
                  </View>
                  <Text style={styles.aiResponseText}>{aiResponse}</Text>
                  <TouchableOpacity
                    style={styles.askAnotherButton}
                    onPress={() => {
                      setAiQuestion('');
                      setAiResponse(null);
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
      </Modal>
    </View>
  );
}

const PRIMARY_GREEN = '#047857';
const ACCENT_GREEN = '#047857';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    backgroundColor: PRIMARY_GREEN,
    paddingTop: 60,
    paddingBottom: 24,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: -10,
    shadowColor: PRIMARY_GREEN,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  headerTop: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  backButtonHeader: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 10,
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#ffffff',
    opacity: 0.9,
    marginBottom: 8,
    textAlign: 'center',
  },
  aiButtonInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: PRIMARY_GREEN,
  },
  aiButtonInlineText: {
    fontSize: 13,
    fontWeight: '600',
    color: PRIMARY_GREEN,
  },
  insightsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  insightsContent: {
    marginTop: 16,
  },
  insightRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  insightItem: {
    alignItems: 'center',
    gap: 6,
  },
  insightLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  insightValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  weakTopicsSection: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  weakTopicsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
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
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  weakTopicText: {
    flex: 1,
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
  },
  filesCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 10,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
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
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
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
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#374151',
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
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    color: '#111827',
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
    backgroundColor: '#ffffff',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  metaTagText: {
    fontSize: 10,
    color: '#6b7280',
    marginLeft: 4,
    fontWeight: '500',
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  uploadButton: {
    flexDirection: 'row',
    backgroundColor: PRIMARY_GREEN,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    shadowColor: PRIMARY_GREEN,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  uploadButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
  // AI Modal Styles
  aiModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  aiModalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
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
});
