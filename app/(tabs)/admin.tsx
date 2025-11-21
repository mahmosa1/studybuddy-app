// app/(tabs)/admin.tsx
import { db } from '@/lib/firebaseConfig';
import {
    collection,
    doc,
    getDocs,
    query,
    updateDoc,
    where,
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Linking,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

type UserItem = {
  uid: string;
  email: string;
  fullName?: string;
  username?: string;
  role: string;
  status: string;
  studentCardUrl?: string | null;
  profilePictureUrl?: string | null;
};

export default function AdminScreen() {
  const [pendingUsers, setPendingUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);

  // לתצוגת תמונה במודאל
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const loadPendingUsers = async () => {
    try {
      setLoading(true);
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('status', '==', 'pending'));
      const snapshot = await getDocs(q);

      const list: UserItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as any;
        list.push({
          uid: data.uid ?? docSnap.id,
          email: data.email,
          fullName: data.fullName,
          username: data.username,
          role: data.role,
          status: data.status,
          studentCardUrl: data.studentCardUrl,
          profilePictureUrl: data.profilePictureUrl,
        });
      });

      setPendingUsers(list);
    } catch (err) {
      console.log('Error loading pending users:', err);
      Alert.alert('Error', 'Failed to load pending users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingUsers();
  }, []);

  const handleApprove = async (uid: string) => {
    try {
      setUpdatingUid(uid);
      await updateDoc(doc(db, 'users', uid), {
        status: 'active',
      });
      setPendingUsers((prev) => prev.filter((u) => u.uid !== uid));
    } catch (err) {
      console.log('Approve error:', err);
      Alert.alert('Error', 'Failed to approve user');
    } finally {
      setUpdatingUid(null);
    }
  };

  const handleReject = async (uid: string) => {
    try {
      setUpdatingUid(uid);
      await updateDoc(doc(db, 'users', uid), {
        status: 'rejected',
      });
      setPendingUsers((prev) => prev.filter((u) => u.uid !== uid));
    } catch (err) {
      console.log('Reject error:', err);
      Alert.alert('Error', 'Failed to reject user');
    } finally {
      setUpdatingUid(null);
    }
  };

  // אם בעתיד יהיו גם PDF/קבצים אחרים – נוכל לפתוח אותם בדפדפן
  const openInBrowser = (url?: string | null) => {
    if (!url) return;
    Linking.openURL(url).catch((err) =>
      console.log('Failed to open link:', err)
    );
  };

  const openPreview = (url: string) => {
    setPreviewUrl(url);
  };

  const closePreview = () => {
    setPreviewUrl(null);
  };

  const renderItem = ({ item }: { item: UserItem }) => (
    <View style={styles.card}>
      <Text style={styles.email}>{item.email}</Text>
      <Text style={styles.smallText}>
        {item.fullName ?? 'No name'} · {item.username ?? 'No username'}
      </Text>
      <Text style={styles.smallText}>Role: {item.role}</Text>

      <Text style={styles.smallText}>
        Student card: {item.studentCardUrl ? 'Uploaded' : 'Not uploaded'}
      </Text>
      <Text style={styles.smallText}>
        Profile picture: {item.profilePictureUrl ? 'Uploaded' : 'Not uploaded'}
      </Text>

      {/* אפשר גם להראות Thumbnails קטנים */}
      <View style={styles.thumbnailsRow}>
        {item.studentCardUrl && (
          <TouchableOpacity onPress={() => openPreview(item.studentCardUrl!)}>
            <Image
              source={{ uri: item.studentCardUrl! }}
              style={styles.thumbnail}
            />
          </TouchableOpacity>
        )}
        {item.profilePictureUrl && (
          <TouchableOpacity onPress={() => openPreview(item.profilePictureUrl!)}>
            <Image
              source={{ uri: item.profilePictureUrl! }}
              style={styles.thumbnail}
            />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.linksRow}>
        {item.studentCardUrl && (
          <TouchableOpacity
            onPress={() => openPreview(item.studentCardUrl!)}
            style={styles.linkButton}
          >
            <Text style={styles.linkButtonText}>View Student Card</Text>
          </TouchableOpacity>
        )}
        {item.profilePictureUrl && (
          <TouchableOpacity
            onPress={() => openPreview(item.profilePictureUrl!)}
            style={styles.linkButton}
          >
            <Text style={styles.linkButtonText}>View Profile Picture</Text>
          </TouchableOpacity>
        )}
        {/* אם תרצה גם כפתור לפתיחה חיצונית (למשל אם זה PDF): */}
        {/* 
        {item.studentCardUrl && (
          <TouchableOpacity
            onPress={() => openInBrowser(item.studentCardUrl!)}
            style={styles.linkButton}
          >
            <Text style={styles.linkButtonText}>Open in Browser</Text>
          </TouchableOpacity>
        )}
        */}
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionButton, styles.approveButton]}
          onPress={() => handleApprove(item.uid)}
          disabled={updatingUid === item.uid}
        >
          {updatingUid === item.uid ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.actionText}>Approve</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => handleReject(item.uid)}
          disabled={updatingUid === item.uid}
        >
          {updatingUid === item.uid ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.actionText}>Reject</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Admin Panel</Text>
      <Text style={styles.subtitle}>
        Pending users (students / lecturers) waiting for approval.
      </Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} color="#a855f7" />
      ) : pendingUsers.length === 0 ? (
        <Text style={styles.emptyText}>No pending users 🎉</Text>
      ) : (
        <FlatList
          data={pendingUsers}
          keyExtractor={(item) => item.uid}
          renderItem={renderItem}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 24 }}
        />
      )}

      {/* Modal לתצוגת תמונה מלאה */}
      <Modal
        visible={!!previewUrl}
        transparent
        animationType="fade"
        onRequestClose={closePreview}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closePreview} />
          <View style={styles.modalContent}>
            {previewUrl && (
              <Image
                source={{ uri: previewUrl }}
                style={styles.modalImage}
                resizeMode="contain"
              />
            )}
            <TouchableOpacity style={styles.modalCloseButton} onPress={closePreview}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050816',
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: 'white',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 16,
  },
  emptyText: {
    marginTop: 24,
    color: '#9ca3af',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  email: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  smallText: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 2,
  },
  thumbnailsRow: {
    flexDirection: 'row',
    columnGap: 8,
    marginTop: 8,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  linksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    columnGap: 8,
    rowGap: 4,
  },
  linkButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  linkButtonText: {
    color: '#a855f7',
    fontSize: 12,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: 10,
    columnGap: 10,
  },
  actionButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: '#22c55e',
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  actionText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 16,
    backgroundColor: '#020617',
    padding: 12,
    alignItems: 'center',
  },
  modalImage: {
    width: '100%',
    height: 350,
    borderRadius: 12,
    backgroundColor: '#000',
  },
  modalCloseButton: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#a855f7',
  },
  modalCloseText: {
    color: '#fff',
    fontWeight: '600',
  },
});
