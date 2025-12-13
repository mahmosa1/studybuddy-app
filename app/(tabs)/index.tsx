// app/(tabs)/index.tsx
import { db } from '@/lib/firebaseConfig';
import { useUser } from '@/lib/UserContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

type RecentCourse = {
  id: string;
  name: string;
};

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { role, firebaseUser } = useUser();
  const [username, setUsername] = useState<string>('');
  const [recentCourses, setRecentCourses] = useState<RecentCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserData = async () => {
      if (!firebaseUser) {
        setLoading(false);
        return;
      }

      try {
        // Load username from Firestore
        const userDocSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          setUsername(userData.username || userData.fullName || 'User');
        }

        // Load recent courses (mock: just load user's courses)
        const coursesQuery = query(
          collection(db, 'courses'),
          where('ownerUid', '==', firebaseUser.uid)
        );
        const coursesSnap = await getDocs(coursesQuery);
        const courses: RecentCourse[] = [];
        coursesSnap.forEach((doc) => {
          courses.push({
            id: doc.id,
            name: doc.data().name || 'Course',
          });
        });
        setRecentCourses(courses.slice(0, 3)); // Show max 3 recent
      } catch (err) {
        console.log('Error loading home data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, [firebaseUser]);

  // Show different content based on role
  if (role === 'lecturer') {
    return <LecturerHomeScreen />;
  }

  if (role === 'admin') {
    return <AdminHomeScreen />;
  }

  // Default: Student Home
  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* App name in center */}
        <View style={styles.logoContainer}>
          <Text style={styles.appTitle}>{t('home.title')}</Text>
          <Text style={styles.appTagline}>{t('home.tagline')}</Text>
        </View>

        {/* Welcome message with username */}
        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeEmoji}>👋</Text>
          <Text style={styles.title}>
            {t('home.welcome', { name: loading ? '...' : username || 'Student' })}
          </Text>
          <Text style={styles.subtitle}>
            {t('home.readyToAce')}
          </Text>
        </View>

        <View style={styles.cardsWrapper}>
          {/* Quick action: Start Practice */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('home.startPractice')}</Text>
            <Text style={styles.cardText}>
              {t('home.startPracticeDescription')}
            </Text>
            <TouchableOpacity
              style={[styles.buttonBase, styles.buttonPrimary]}
              onPress={() => router.push('/ai-practice-setup' as any)}
            >
              <Text style={styles.buttonPrimaryText}>{t('home.startPractice')}</Text>
            </TouchableOpacity>
          </View>

          {/* Recently practiced courses */}
          {recentCourses.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('home.recentlyPracticed')}</Text>
              <FlatList
                data={recentCourses}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.courseItem}
                    onPress={() => router.push(`/course/${item.id}`)}
                  >
                    <Text style={styles.courseItemText}>{item.name}</Text>
                  </TouchableOpacity>
                )}
                scrollEnabled={false}
              />
            </View>
          )}

          {/* Quick action: My Courses */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('home.myCourses')}</Text>
            <Text style={styles.cardText}>
              {t('home.myCoursesDescription')}
            </Text>
            <TouchableOpacity
              style={[styles.buttonBase, styles.buttonPrimary]}
              onPress={() => router.push('/(tabs)/courses')}
            >
              <Text style={styles.buttonPrimaryText}>{t('home.goToMyCourses')}</Text>
            </TouchableOpacity>
          </View>

          {/* Quick tips section */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('home.quickTips')}</Text>
            <Text style={styles.tipText}>• {t('home.tip1')}</Text>
            <Text style={styles.tipText}>• {t('home.tip2')}</Text>
            <Text style={styles.tipText}>• {t('home.tip3')}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// Lecturer Home Screen Component
function LecturerHomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { firebaseUser } = useUser();
  const [lecturerName, setLecturerName] = useState<string>('');
  const [recentCourses, setRecentCourses] = useState<RecentCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLecturerData = async () => {
      if (!firebaseUser) {
        setLoading(false);
        return;
      }

      try {
        const userDocSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          setLecturerName(userData.fullName || userData.username || 'Lecturer');
        }

        const coursesQuery = query(
          collection(db, 'courses'),
          where('ownerUid', '==', firebaseUser.uid)
        );
        const coursesSnap = await getDocs(coursesQuery);
        const courses: RecentCourse[] = [];
        coursesSnap.forEach((doc) => {
          courses.push({
            id: doc.id,
            name: doc.data().name || 'Course',
          });
        });
        setRecentCourses(courses.slice(0, 3));
      } catch (err) {
        console.log('Error loading lecturer data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadLecturerData();
  }, [firebaseUser]);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.appTitle}>{t('home.title')}</Text>
        <Text style={styles.title}>
          {t('home.welcome', { name: loading ? '...' : lecturerName || t('auth.lecturer') })}
        </Text>
        <Text style={styles.subtitle}>
          {t('home.lecturerSubtitle')}
        </Text>

        <View style={styles.cardsWrapper}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('home.createNewCourse')}</Text>
            <Text style={styles.cardText}>
              {t('home.createNewCourseDescription')}
            </Text>
            <TouchableOpacity
              style={[styles.buttonBase, styles.buttonPrimary]}
              onPress={() => router.push('/lecturer/add-course' as any)}
            >
              <Text style={styles.buttonPrimaryText}>{t('home.createCourse')}</Text>
            </TouchableOpacity>
          </View>

          {recentCourses.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('home.recentCourses')}</Text>
              <FlatList
                data={recentCourses}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.courseItem}
                    onPress={() => router.push(`/lecturer/course/${item.id}` as any)}
                  >
                    <Text style={styles.courseItemText}>{item.name}</Text>
                  </TouchableOpacity>
                )}
                scrollEnabled={false}
              />
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('home.myCourses')}</Text>
            <Text style={styles.cardText}>
              {t('home.lecturerCoursesDescription')}
            </Text>
            <TouchableOpacity
              style={[styles.buttonBase, styles.buttonPrimary]}
              onPress={() => router.push('/(tabs)/courses')}
            >
              <Text style={styles.buttonPrimaryText}>{t('home.viewAllCourses')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// Admin Home Screen Component
function AdminHomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [stats, setStats] = useState({
    students: 0,
    lecturers: 0,
    pendingUsers: 0,
    pendingAppeals: 0,
    courses: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const coursesSnap = await getDocs(collection(db, 'courses'));
        const appealsSnap = await getDocs(
          query(collection(db, 'appeals'), where('status', '==', 'pending'))
        );

        let students = 0;
        let lecturers = 0;
        let pending = 0;

        usersSnap.forEach((doc) => {
          const data = doc.data();
          if (data.role === 'student') students++;
          if (data.role === 'lecturer') lecturers++;
          if (data.status === 'pending') pending++;
        });

        setStats({
          students,
          lecturers,
          pendingUsers: pending,
          pendingAppeals: appealsSnap.size,
          courses: coursesSnap.size,
        });
      } catch (err) {
        console.log('Error loading admin stats:', err);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="shield-checkmark" size={36} color="#ffffff" />
          <Text style={styles.headerTitle}>{t('admin.dashboard')}</Text>
          <Text style={styles.headerSubtitle}>
            {t('admin.dashboardSubtitle')}
          </Text>
        </View>

        {/* Statistics Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: '#dbeafe' }]}>
              <Ionicons name="school" size={28} color="#3b82f6" />
            </View>
            <Text style={styles.statNumber}>{loading ? '...' : stats.students}</Text>
            <Text style={styles.statLabel}>{t('admin.students')}</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: '#ffffff' }]}>
              <Ionicons name="person" size={28} color={ACCENT_GREEN} />
            </View>
            <Text style={styles.statNumber}>{loading ? '...' : stats.lecturers}</Text>
            <Text style={styles.statLabel}>{t('admin.lecturers')}</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: '#fee2e2' }]}>
              <Ionicons name="time" size={28} color="#ef4444" />
            </View>
            <Text style={styles.statNumber}>{loading ? '...' : stats.pendingUsers}</Text>
            <Text style={styles.statLabel}>{t('admin.pending')}</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: '#d1fae5' }]}>
              <Ionicons name="book" size={28} color="#047857" />
            </View>
            <Text style={styles.statNumber}>{loading ? '...' : stats.courses}</Text>
            <Text style={styles.statLabel}>{t('admin.courses')}</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.sectionTitle}>{t('admin.quickActions')}</Text>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/admin')}
          >
            <View style={styles.actionCardLeft}>
              <View style={[styles.actionIconContainer, { backgroundColor: '#ffffff' }]}>
                <Ionicons name="checkmark-circle" size={24} color={ACCENT_GREEN} />
              </View>
              <View style={styles.actionCardContent}>
                <Text style={styles.actionCardTitle}>{t('admin.pendingApprovals')}</Text>
                <Text style={styles.actionCardText}>
                  {stats.pendingUsers === 1
                    ? t('admin.reviewPendingUser', { count: stats.pendingUsers })
                    : t('admin.reviewPendingUsers', { count: stats.pendingUsers })}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#6b7280" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/admin/appeals' as any)}
          >
            <View style={styles.actionCardLeft}>
              <View style={[styles.actionIconContainer, { backgroundColor: '#ffffff' }]}>
                <Ionicons name="chatbubble-ellipses" size={24} color={ACCENT_GREEN} />
              </View>
              <View style={styles.actionCardContent}>
                <Text style={styles.actionCardTitle}>{t('admin.appeals')}</Text>
                <Text style={styles.actionCardText}>
                  {stats.pendingAppeals > 0
                    ? stats.pendingAppeals === 1
                      ? t('home.pendingAppeal', { count: stats.pendingAppeals })
                      : t('home.pendingAppeals', { count: stats.pendingAppeals })
                    : t('home.noPendingAppeals')}
                </Text>
              </View>
            </View>
            {stats.pendingAppeals > 0 && (
              <View style={styles.badgeContainer}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{stats.pendingAppeals}</Text>
                </View>
              </View>
            )}
            <Ionicons name="chevron-forward" size={24} color="#6b7280" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/admin/users' as any)}
          >
            <View style={styles.actionCardLeft}>
              <View style={[styles.actionIconContainer, { backgroundColor: '#eff6ff' }]}>
                <Ionicons name="people" size={24} color="#3b82f6" />
              </View>
              <View style={styles.actionCardContent}>
                <Text style={styles.actionCardTitle}>{t('admin.userManagement')}</Text>
                <Text style={styles.actionCardText}>
                  {t('admin.userManagementDescription')}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#6b7280" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/admin/courses' as any)}
          >
            <View style={styles.actionCardLeft}>
              <View style={[styles.actionIconContainer, { backgroundColor: '#f0fdf4' }]}>
                <Ionicons name="library" size={24} color="#047857" />
              </View>
              <View style={styles.actionCardContent}>
                <Text style={styles.actionCardTitle}>{t('admin.courseManagement')}</Text>
                <Text style={styles.actionCardText}>
                  {t('admin.courseManagementDescription')}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {/* System Info */}
        <View style={styles.systemInfoCard}>
          <View style={styles.systemInfoHeader}>
            <Ionicons name="information-circle" size={20} color={ACCENT_GREEN} />
            <Text style={styles.systemInfoTitle}>{t('admin.systemOverview')}</Text>
          </View>
          <View style={styles.systemInfoRow}>
            <Text style={styles.systemInfoLabel}>{t('admin.totalUsers')}:</Text>
            <Text style={styles.systemInfoValue}>
              {loading ? '...' : stats.students + stats.lecturers}
            </Text>
          </View>
          <View style={styles.systemInfoRow}>
            <Text style={styles.systemInfoLabel}>{t('admin.activeUsers')}:</Text>
            <Text style={styles.systemInfoValue}>
              {loading ? '...' : stats.students + stats.lecturers - stats.pendingUsers}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const PRIMARY_GREEN = '#047857';
const ACCENT_GREEN = '#047857';
const GREY = '#4b5563';
const GREY_LIGHT = '#374151';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  appTitle: {
    fontSize: 38,
    fontWeight: '900',
    color: PRIMARY_GREEN,
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.8,
    textShadowColor: 'rgba(37, 99, 235, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  appTagline: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  welcomeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 28,
    marginBottom: 28,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e0e7ff',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    overflow: 'hidden',
  },
  welcomeEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    fontWeight: '500',
  },
  cardsWrapper: {
    rowGap: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1.5,
    borderColor: '#e0e7ff',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  cardText: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 14,
  },
  buttonBase: {
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
    alignSelf: 'flex-start',
  },
  buttonDisabled: {
    backgroundColor: GREY_LIGHT,
  },
  buttonDisabledText: {
    color: GREY,
    fontSize: 13,
    fontWeight: '600',
  },
  buttonPrimary: {
    backgroundColor: PRIMARY_GREEN,
    shadowColor: PRIMARY_GREEN,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  buttonPrimaryText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  buttonOutline: {
    borderWidth: 1,
    borderColor: GREY,
    backgroundColor: '#ffffff',
  },
  buttonOutlineText: {
    color: GREY,
    fontSize: 13,
    fontWeight: '600',
  },
  courseItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  courseItemText: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
  },
  tipText: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  statText: {
    fontSize: 14,
    color: '#111827',
    marginTop: 6,
    fontWeight: '500',
  },
  // Admin Dashboard Styles
  header: {
    backgroundColor: PRIMARY_GREEN,
    paddingTop: 60,
    paddingBottom: 30,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: -30,
    marginHorizontal: -24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
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
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 24,
    gap: 12,
  },
  statCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    width: '48%',
    borderWidth: 1,
    borderColor: '#374151',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  statIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  quickActionsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#374151',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  actionCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionCardContent: {
    flex: 1,
  },
  actionCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  actionCardText: {
    fontSize: 13,
    color: '#6b7280',
  },
  badgeContainer: {
    marginRight: 8,
  },
  badge: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  systemInfoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#374151',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  systemInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  systemInfoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 8,
  },
  systemInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  systemInfoLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  systemInfoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
});

export { };

