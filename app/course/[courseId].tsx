// app/course/[courseId].tsx
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
  StyleSheet,
  Text,
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
  const params = useLocalSearchParams<{
    courseId?: string | string[];
    name?: string;
  }>();

  const courseId =
    typeof params.courseId === 'string' ? params.courseId : undefined;
  const name = params.name;

  const [files, setFiles] = useState<CourseFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(true);

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

    return (
      <TouchableOpacity
        style={styles.fileCard}
        onPress={() => handleOpenFile(item)}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.fileName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.fileMeta}>
            {item.mimeType ?? 'Unknown type'}
            {sizeMb ? ` • ${sizeMb} MB` : ''}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.deleteBadge}
          onPress={() => handleDeleteFile(item)}
        >
          <Text style={styles.deleteBadgeText}>Delete</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{name ?? 'Course'}</Text>
      <Text style={styles.subtitle}>
        Manage your study materials for this course.
      </Text>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Files for this course</Text>

        {loadingFiles ? (
          <ActivityIndicator
            style={{ marginTop: 12 }}
            color="#f97316"
            size="small"
          />
        ) : files.length === 0 ? (
          <Text style={styles.sectionText}>
            No files uploaded yet. Start by uploading your first file.
          </Text>
        ) : (
          <FlatList
            data={files}
            keyExtractor={item => item.id}
            renderItem={renderFile}
            style={{ marginTop: 8 }}
            contentContainerStyle={{ paddingBottom: 4 }}
          />
        )}

        <TouchableOpacity
          style={[styles.uploadButton, { marginTop: 12 }]}
          onPress={handleUploadFile}
        >
          <Text style={styles.uploadButtonText}>Upload File</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>

      <Text style={styles.debugText}>Course ID: {courseId}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // רקע לבן כמו במסך Login/Home
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 24,
    paddingTop: 60,
  },

  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#4b5563',
    marginBottom: 20,
  },

  // כרטיס ראשי לקבצים
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  sectionText: {
    color: '#6b7280',
    fontSize: 13,
  },

  // כפתור העלאה כתום
  uploadButton: {
    backgroundColor: '#f97316', // כתום כמו ב-Login/Home
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
  },
  uploadButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },

  // כפתור Back כ-outline עדין
  backButton: {
    marginTop: 20,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  backButtonText: {
    color: '#4b5563',
    fontWeight: '500',
  },

  debugText: {
    marginTop: 16,
    fontSize: 11,
    color: '#9ca3af',
  },

  // כרטיס של קובץ
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  fileName: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
  },
  fileMeta: {
    color: '#6b7280',
    fontSize: 11,
    marginTop: 2,
  },

  // תגית מחיקה אדומה
  deleteBadge: {
    marginLeft: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#ef4444',
  },
  deleteBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
});
