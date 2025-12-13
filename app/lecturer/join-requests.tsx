// app/lecturer/join-requests.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const PRIMARY_GREEN = '#047857';
const ACCENT_GREEN = '#10b981';

type JoinRequest = {
  id: string;
  studentName: string;
  studentEmail: string;
  courseName: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  requestDate: string;
};

// Mock join requests
const MOCK_JOIN_REQUESTS: JoinRequest[] = [
  {
    id: '1',
    studentName: 'John Doe',
    studentEmail: 'john@example.com',
    courseName: 'Advanced Algorithms',
    status: 'Pending',
    requestDate: '2 days ago',
  },
  {
    id: '2',
    studentName: 'Jane Smith',
    studentEmail: 'jane@example.com',
    courseName: 'Database Systems',
    status: 'Pending',
    requestDate: '1 day ago',
  },
  {
    id: '3',
    studentName: 'Bob Johnson',
    studentEmail: 'bob@example.com',
    courseName: 'Advanced Algorithms',
    status: 'Approved',
    requestDate: '1 week ago',
  },
];

export default function LecturerJoinRequestsScreen() {
  const router = useRouter();
  const [requests, setRequests] = useState<JoinRequest[]>(MOCK_JOIN_REQUESTS);

  const handleApprove = (requestId: string) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: 'Approved' as const } : r))
    );
    Alert.alert('Success', 'Join request approved.');
  };

  const handleReject = (requestId: string) => {
    Alert.alert(
      'Reject Request',
      'Are you sure you want to reject this join request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: () => {
            setRequests((prev) =>
              prev.map((r) => (r.id === requestId ? { ...r, status: 'Rejected' as const } : r))
            );
            Alert.alert('Request Rejected', 'The student has been notified.');
          },
        },
      ]
    );
  };

  const pendingRequests = requests.filter((r) => r.status === 'Pending');

  const renderRequest = ({ item }: { item: JoinRequest }) => (
    <View style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <View style={styles.studentInfo}>
          <Text style={styles.studentName}>{item.studentName}</Text>
          <Text style={styles.studentEmail}>{item.studentEmail}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: item.status === 'Pending' ? '#f59e0b' : item.status === 'Approved' ? ACCENT_GREEN : '#ef4444' }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>
      <Text style={styles.courseName}>Course: {item.courseName}</Text>
      <View style={styles.requestFooter}>
        <View style={styles.dateInfo}>
          <Ionicons name="calendar-outline" size={14} color="#6b7280" />
          <Text style={styles.dateText}>Requested {item.requestDate}</Text>
        </View>
        {item.status === 'Pending' && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              onPress={() => handleApprove(item.id)}
            >
              <Ionicons name="checkmark-circle" size={16} color="#ffffff" />
              <Text style={styles.actionButtonText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => handleReject(item.id)}
            >
              <Ionicons name="close-circle" size={16} color="#ffffff" />
              <Text style={styles.actionButtonText}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Join Requests</Text>
        <View style={{ width: 24 }} />
      </View>

      {pendingRequests.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle" size={64} color={ACCENT_GREEN} />
          <Text style={styles.emptyTitle}>No Pending Requests</Text>
          <Text style={styles.emptyText}>
            All join requests have been processed.
          </Text>
        </View>
      ) : (
        <FlatList
          data={pendingRequests}
          renderItem={renderRequest}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  requestCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  studentEmail: {
    fontSize: 13,
    color: '#6b7280',
  },
  courseName: {
    fontSize: 14,
    fontWeight: '600',
    color: PRIMARY_GREEN,
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  requestFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: 12,
    color: '#6b7280',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  approveButton: {
    backgroundColor: ACCENT_GREEN,
  },
  rejectButton: {
    backgroundColor: '#ef4444',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});

