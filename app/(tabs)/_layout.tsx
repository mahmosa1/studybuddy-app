// app/(tabs)/_layout.tsx
import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { auth, db } from '@/lib/firebaseConfig';

type UserRole = 'student' | 'lecturer' | 'admin' | null;
type UserStatus = 'pending' | 'active' | 'blocked' | 'rejected' | null;

export default function TabLayout() {
  const router = useRouter();
  const { t } = useTranslation();

  const [role, setRole] = useState<UserRole>(null);
  const [status, setStatus] = useState<UserStatus>(null);
  const [loadingRole, setLoadingRole] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoadingRole(true);

      try {
        if (!user) {
          setRole(null);
          setStatus(null);
          router.replace('/(auth)/login');
          return;
        }

        const snap = await getDoc(doc(db, 'users', user.uid));
        const data = snap.data() as any;

        const nextRole = (data?.role as UserRole) ?? null;
        const nextStatus = (data?.status as UserStatus) ?? null;

        setRole(nextRole);
        setStatus(nextStatus);

        if (nextStatus === 'pending' || nextStatus === 'rejected') {
          router.replace('/(auth)/pending-approval');
          return;
        }

        if (nextStatus === 'blocked') {
          router.replace('/(auth)/login');
          return;
        }

        // active -> allow tabs
      } catch (err) {
        console.log('Failed to load user role/status:', err);
        setRole(null);
        setStatus(null);
        router.replace('/(auth)/login');
      } finally {
        setLoadingRole(false);
      }
    });

    return unsubscribe;
  }, [router]);

  // בזמן טעינת ה-role לא מציירים כלום
  if (loadingRole) {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#047857',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 0,
          borderBottomWidth: 0,
          height: 70,
          paddingBottom: 10,
          paddingTop: 8,
          shadowColor: 'transparent',
          shadowOpacity: 0,
          shadowRadius: 0,
          shadowOffset: { width: 0, height: 0 },
          elevation: 0,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      {/* Home */}
      <Tabs.Screen
        name="index"
        options={{
          title: t('home.tabName'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              color={color}
              size={focused ? 26 : 24}
            />
          ),
        }}
      />

      {/* Search */}
      <Tabs.Screen
        name="search"
        options={{
          title: t('search.title'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'search' : 'search-outline'}
              color={color}
              size={focused ? 26 : 24}
            />
          ),
        }}
      />

      {/* Feed - Only for students */}
      <Tabs.Screen
        name="feed"
        options={{
          title: t('feed.title'),
          href: role === 'student' ? undefined : null,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'newspaper' : 'newspaper-outline'}
              color={color}
              size={focused ? 26 : 24}
            />
          ),
        }}
      />

      {/* Practice - Hidden (moved to courses page) */}
      <Tabs.Screen
        name="practice"
        options={{
          href: null, // Hide this tab
        }}
      />

      {/* My Courses */}
      <Tabs.Screen
        name="courses"
        options={{
          title: t('courses.title'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'book' : 'book-outline'}
              color={color}
              size={focused ? 26 : 24}
            />
          ),
        }}
      />

      {/* Profile */}
      <Tabs.Screen
        name="profile"
        options={{
          title: t('profile.title'),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              color={color}
              size={focused ? 26 : 24}
            />
          ),
        }}
      />

      {/* Admin – Only visible for admins */}
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          href: role === 'admin' ? undefined : null,
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'shield-checkmark' : 'shield-outline'}
              color={color}
              size={focused ? 26 : 24}
            />
          ),
        }}
      />
    </Tabs>
  );
}
