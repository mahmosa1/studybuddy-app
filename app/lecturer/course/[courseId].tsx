// app/lecturer/course/[courseId].tsx
import { auth, db } from '@/lib/firebaseConfig';
import { supabase } from '@/lib/supabaseClient';
import { uploadCourseFileToSupabase } from '@/lib/upload';
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
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type CourseFile = {
  id: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
  url?: string | null;
};

export default function LecturerCourseDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    courseId?: string | string[];
    name?: string;
  }>();

  const courseId =
    typeof params.courseId === 'string' ? params.courseId : undefined;
  const name = params.name;

  const [files, setFiles] = useState<CourseFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!courseId) {
      setLoadingFiles(false);
      return;
    }

    const filesRef = collection(db, 'courseFiles');
    const q = query(
      filesRef,
      where('courseId', '==', courseId),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: CourseFile[] = [];
        snapshot.forEach((docSnap) => {
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
      (err) => {
        console.log('Error loading course files:', err);
        Alert.alert('Error', 'Failed to load course files.');
        setLoadingFiles(false);
      }
    );

    return unsub;
  }, [courseId]);

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

      setUploading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        setUploading(false);
        return;
      }

      const asset = result.assets?.[0];
      if (!asset || !asset.uri) {
        Alert.alert('Error', 'Could not read selected file.');
        setUploading(false);
        return;
      }

      const fileUrl = await uploadCourseFileToSupabase(
        asset.uri,
        courseId,
        asset.mimeType ?? undefined
      );

      if (!fileUrl) {
        Alert.alert('Upload failed', 'Could not upload file. Please try again.');
        setUploading(false);
        return;
      }

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
    } finally {
      setUploading(false);
    }
  };

  const handleOpenFile = (file: CourseFile) => {
    if (!file.url) {
      Alert.alert('Error', 'Missing file URL.');
      return;
    }

    Linking.openURL(file.url).catch((err) => {
      console.log('Failed to open file url:', err);
      Alert.alert('Error', 'Could not open file.');
    });
  };

  const getPathFromPublicUrl = (url: string): string | null => {
    try {
      const parts = url.split(
        '/storage/v1/object/public/studybuddy-files/'
      );
      if (parts.length !== 2) return null;
      return parts[1];
    } catch {
      return null;
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

  const handleDeleteFile = (file: CourseFile) => {
    Alert.alert('Delete file', 'Are you sure you want to delete this file?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
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

            await deleteDoc(doc(db, 'courseFiles', file.id));
          } catch (err) {
            console.log('Delete file error:', err);
            Alert.alert('Error', 'Failed to delete file. Please try again.');
          }
        },
      },
    ]);
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
          <TouchableOpacity
            style={styles.backButtonHeader}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Ionicons name="folder" size={32} color="#ffffff" />
          <Text style={styles.headerTitle}>{name ?? 'Course'}</Text>
          <Text style={styles.headerSubtitle}>
            Manage teaching materials and course files
          </Text>
        </View>

        {/* Joined Students Section */}
        <View style={styles.studentsCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="people" size={22} color={ACCENT_GREEN} />
            <Text style={styles.sectionTitle}>Joined Students</Text>
          </View>
          {/* Mock joined students */}
          <View style={styles.studentsList}>
            <View style={styles.studentItem}>
              <View style={styles.studentAvatar}>
                <Ionicons name="person" size={20} color={PRIMARY_GREEN} />
              </View>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>John Doe</Text>
                <Text style={styles.studentEmail}>john@example.com</Text>
              </View>
            </View>
            <View style={styles.studentItem}>
              <View style={styles.studentAvatar}>
                <Ionicons name="person" size={20} color={PRIMARY_GREEN} />
              </View>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>Jane Smith</Text>
                <Text style={styles.studentEmail}>jane@example.com</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Pending Join Requests Section */}
        <View style={styles.requestsCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="mail" size={22} color={ACCENT_GREEN} />
            <Text style={styles.sectionTitle}>Pending Join Requests</Text>
            <TouchableOpacity
              style={styles.viewAllButton}
              onPress={() => router.push('/lecturer/join-requests' as any)}
            >
              <Text style={styles.viewAllText}>View All</Text>
              <Ionicons name="chevron-forward" size={16} color={PRIMARY_GREEN} />
            </TouchableOpacity>
          </View>
          {/* Mock pending requests */}
          <View style={styles.requestsList}>
            <View style={styles.requestItem}>
              <View style={styles.requestInfo}>
                <Text style={styles.requestStudentName}>Bob Johnson</Text>
                <Text style={styles.requestDate}>Requested 2 days ago</Text>
              </View>
              <View style={styles.requestActions}>
                <TouchableOpacity style={styles.approveButton}>
                  <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.rejectButton}>
                  <Ionicons name="close-circle" size={20} color="#ffffff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Files Section */}
        <View style={styles.filesCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text" size={22} color={ACCENT_GREEN} />
            <Text style={styles.sectionTitle}>Teaching Materials</Text>
          </View>

          {loadingFiles ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={PRIMARY_GREEN} size="large" />
              <Text style={styles.loadingText}>Loading files...</Text>
            </View>
          ) : files.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="document-outline" size={64} color="#6b7280" />
              </View>
              <Text style={styles.emptyTitle}>No files yet</Text>
              <Text style={styles.emptyText}>
                Start by uploading your first teaching material to this course.
              </Text>
            </View>
          ) : (
            <FlatList
              data={files}
              keyExtractor={(item) => item.id}
              renderItem={renderFile}
              scrollEnabled={false}
              contentContainerStyle={styles.filesList}
            />
          )}

          <TouchableOpacity
            style={[
              styles.uploadButton,
              uploading && styles.uploadButtonDisabled,
            ]}
            onPress={handleUploadFile}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.uploadButtonText}>Upload File</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    paddingBottom: 30,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: -50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  backButtonHeader: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 10,
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#ffffff',
    opacity: 0.9,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  studentsCard: {
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
  studentsList: {
    gap: 12,
  },
  studentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  studentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  studentEmail: {
    fontSize: 13,
    color: '#6b7280',
  },
  requestsCard: {
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
  requestsList: {
    gap: 12,
  },
  requestItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  requestInfo: {
    flex: 1,
  },
  requestStudentName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  requestDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  approveButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ACCENT_GREEN,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rejectButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: PRIMARY_GREEN,
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
    marginBottom: 20,
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
  uploadButtonDisabled: {
    opacity: 0.7,
  },
  uploadButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16,
  },
});

