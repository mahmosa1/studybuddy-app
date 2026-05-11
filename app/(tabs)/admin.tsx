// app/(tabs)/admin.tsx
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';

export default function AdminTabRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/pending-approvals');
  }, [router]);

  return null;
}
