// app/(tabs)/profile.tsx
import { auth, db } from '@/lib/firebaseConfig';
import { useRouter } from 'expo-router';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type UserProfile = {
  username?: string;
  fullName?: string;
  email: string;
  institution?: string;
  fieldOfStudy?: string;
  phone?: string;
  role?: string;
  profilePictureUrl?: string | null;
};

type CourseHighlight = {
  id: string;
  name: string;
};

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [courses, setCourses] = useState<CourseHighlight[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace('/(auth)/login');
        return;
      }

      try {
        setLoading(true);

        // --- User profile ---
        const snap = await getDoc(doc(db, 'users', user.uid));

        if (snap.exists()) {
          const data = snap.data() as any;
          setProfile({
            username: data.username,
            fullName: data.fullName,
            email: data.email,
            institution: data.institution,
            fieldOfStudy: data.fieldOfStudy,
            phone: data.phone,
            role: data.role,
            profilePictureUrl: data.profilePictureUrl,
          });
        } else {
          setProfile({
            email: user.email ?? '',
          });
        }

        // --- Courses for highlights ---
        const q = query(
          collection(db, 'courses'),
          where('ownerUid', '==', user.uid),
        );
        const coursesSnap = await getDocs(q);
        const list: CourseHighlight[] = [];
        coursesSnap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          list.push({
            id: docSnap.id,
            name: data.name ?? 'Course',
          });
        });
        setCourses(list);
      } catch (err) {
        console.log('Load profile error:', err);
      } finally {
        setLoading(false);
      }
    });

    return unsub;
  }, [router]);

  const getInitials = () => {
    if (!profile) return '?';
    if (profile.fullName) {
      const parts = profile.fullName.split(' ').filter(Boolean);
      if (parts.length === 1) return parts[0][0]?.toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    if (profile.username) return profile.username[0]?.toUpperCase();
    if (profile.email) return profile.email[0]?.toUpperCase();
    return '?';
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/(auth)/login');
    } catch (err) {
      console.log('Logout error:', err);
    }
  };

  const handleEditProfile = () => {
    // Later: navigate to edit profile screen
    console.log('Edit profile pressed');
  };

  const renderCourseHighlight = ({ item }: { item: CourseHighlight }) => {
    const initial = item.name ? item.name[0]?.toUpperCase() : '?';

    return (
      <View style={styles.highlightItem}>
        <View style={styles.highlightCircle}>
          <Text style={styles.highlightInitial}>{initial}</Text>
        </View>
        <Text style={styles.highlightLabel} numberOfLines={1}>
          {item.name}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color="#f97316" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorText}>Failed to load profile.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header – username in center */}
      <View style={styles.headerRow}>
        <Text style={styles.headerUsername}>
          {profile.username ?? 'Profile'}
        </Text>
      </View>

      {/* Top section: avatar + stats */}
      <View style={styles.topRow}>
        {/* Avatar */}
        <View style={styles.avatarColumn}>
          {profile.profilePictureUrl ? (
            <Image
              source={{ uri: profile.profilePictureUrl }}
              style={styles.avatarImage}
            />
          ) : (
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{getInitials()}</Text>
            </View>
          )}
        </View>

        {/* Stats (placeholders for now) */}
        <View style={styles.statsRow}>
          <View style={styles.statBlock}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
        </View>
      </View>

      {/* Name + "bio" */}
      <View style={styles.bioSection}>
        <Text style={styles.nameText}>
          {profile.fullName ?? profile.username ?? 'Student'}
        </Text>
        {profile.fieldOfStudy && (
          <Text style={styles.bioText}>{profile.fieldOfStudy}</Text>
        )}
        {profile.institution && (
          <Text style={styles.bioText}>{profile.institution}</Text>
        )}
        {profile.role && (
          <Text style={styles.bioText}>{profile.role.toUpperCase()}</Text>
        )}
      </View>

      {/* Buttons row */}
      <View style={styles.buttonsRow}>
        <TouchableOpacity
          style={[styles.mainButton, styles.editButton]}
          onPress={handleEditProfile}
        >
          <Text style={styles.mainButtonText}>Edit Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mainButton, styles.logoutButton]}
          onPress={handleLogout}
        >
          <Text style={styles.mainButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Highlights = courses */}
      <View style={styles.highlightsSection}>
        {courses.length > 0 ? (
          <>
            <FlatList
              data={courses}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              renderItem={renderCourseHighlight}
              contentContainerStyle={{ paddingHorizontal: 4 }}
            />
          </>
        ) : (
          <Text style={styles.highlightsEmptyText}>
            No courses yet – your courses will appear here.
          </Text>
        )}
      </View>

      {/* Posts tabs (single tab for now) */}
      <View style={styles.postsTabsRow}>
        <Text style={styles.postsTabActive}>Posts</Text>
      </View>

      {/* Empty posts grid placeholder */}
      <View style={styles.emptyPostsBox}>
        <Text style={styles.emptyPostsTitle}>No posts yet</Text>
        <Text style={styles.emptyPostsText}>
          In the final phase, you&apos;ll be able to share study notes and
          updates here.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // GENERAL
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 50,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // HEADER
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
  },
  headerUsername: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },

  // TOP SECTION
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarColumn: {
    marginRight: 20,
  },
  avatarCircle: {
    width: 86,
    height: 86,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: '#f97316', // כתום כמו בלוגו
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
  },
  avatarImage: {
    width: 86,
    height: 86,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: '#f97316',
  },
  avatarText: {
    color: '#111827',
    fontSize: 30,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    flex: 1,
    justifyContent: 'space-around',
  },
  statBlock: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },

  // BIO
  bioSection: {
    marginBottom: 12,
  },
  nameText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  bioText: {
    fontSize: 13,
    color: '#4b5563',
  },

  // BUTTONS
  buttonsRow: {
    flexDirection: 'row',
    columnGap: 8,
    marginBottom: 16,
  },
  mainButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    backgroundColor: '#e5e7eb',
  },
  logoutButton: {
    backgroundColor: '#f97316',
  },
  mainButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },

  // HIGHLIGHTS (COURSES)
  highlightsSection: {
    paddingVertical: 10,
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: '#e5e7eb',
    marginBottom: 8,
  },
  highlightItem: {
    alignItems: 'center',
    marginRight: 14,
  },
  highlightCircle: {
    width: 62,
    height: 62,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    marginBottom: 4,
  },
  highlightInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: '#92400e',
  },
  highlightLabel: {
    fontSize: 11,
    color: '#111827',
    maxWidth: 70,
    textAlign: 'center',
  },
  highlightsEmptyText: {
    fontSize: 12,
    color: '#9ca3af',
  },

  // POSTS
  postsTabsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderColor: '#e5e7eb',
  },
  postsTabActive: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  emptyPostsBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyPostsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  emptyPostsText: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  errorText: {
    color: '#f97316',
    fontSize: 14,
  },
});
