// app/index.tsx
import { Redirect, type Href } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { auth, db } from '@/lib/firebaseConfig';

type UserRole = 'student' | 'lecturer' | 'admin';
type UserStatus = 'pending' | 'active' | 'blocked' | 'rejected';

export default function Index() {
  const [target, setTarget] = useState<Href | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setTarget('/(auth)/login');
        return;
      }

      try {
        const snap = await getDoc(doc(db, 'users', user.uid));

        if (!snap.exists()) {
          setTarget('/(auth)/login');
          return;
        }

        const data = snap.data() as {
          role: UserRole;
          status: UserStatus;
        };

        if (data.status === 'pending' || data.status === 'rejected') {
          setTarget('/(auth)/pending-approval');
          return;
        }

        if (data.status === 'blocked') {
          setTarget('/(auth)/login');
          return;
        }

        // active
        setTarget('/(tabs)');
      } catch (e) {
        setTarget('/(auth)/login');
      }
    });

    return unsubscribe;
  }, []);

  if (!target) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' }}>
        <ActivityIndicator size="large" color="#047857" />
      </View>
    );
  }

  return <Redirect href={target} />;
}
