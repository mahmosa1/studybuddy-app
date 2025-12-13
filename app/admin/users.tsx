// app/admin/users.tsx
import { db } from '@/lib/firebaseConfig';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

type UserItem = {
  uid: string;
  email: string;
  fullName?: string;
  username?: string;
  role: string;
  status: string;
  profilePictureUrl?: string | null;
};

export default function AdminUsersManagementScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = users.filter(
        (user) =>
          user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (user.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (user.username || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(users);
    }
  }, [searchQuery, users]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);

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
          profilePictureUrl: data.profilePictureUrl,
        });
      });

      setUsers(list);
      setFilteredUsers(list);
    } catch (err) {
      console.log('Error loading users:', err);
      Alert.alert(t('common.error'), t('admin.failedToLoadUsers'));
    } finally {
      setLoading(false);
    }
  };

  const handleBlockUser = async (uid: string) => {
    Alert.alert(t('admin.blockUser'), t('admin.blockUserConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('admin.block'),
        style: 'destructive',
        onPress: async () => {
          try {
            setUpdatingUid(uid);
            await updateDoc(doc(db, 'users', uid), {
              status: 'blocked',
            });
            await loadUsers();
          } catch (err) {
            console.log('Block user error:', err);
            Alert.alert(t('common.error'), t('admin.failedToBlock'));
          } finally {
            setUpdatingUid(null);
          }
        },
      },
    ]);
  };

  const handleUnblockUser = async (uid: string) => {
    try {
      setUpdatingUid(uid);
      await updateDoc(doc(db, 'users', uid), {
        status: 'active',
      });
      await loadUsers();
    } catch (err) {
      console.log('Unblock user error:', err);
      Alert.alert(t('common.error'), t('admin.failedToUnblock'));
    } finally {
      setUpdatingUid(null);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    Alert.alert(
      t('admin.deleteUser'),
      t('admin.deleteUserConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              setUpdatingUid(uid);
              await deleteDoc(doc(db, 'users', uid));
              await loadUsers();
            } catch (err) {
              console.log('Delete user error:', err);
              Alert.alert(t('common.error'), t('admin.failedToDeleteUser'));
            } finally {
              setUpdatingUid(null);
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#22c55e';
      case 'pending':
        return ACCENT_GREEN;
      case 'blocked':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const getInitials = (item: UserItem) => {
    if (item.fullName) {
      const parts = item.fullName.split(' ').filter(Boolean);
      if (parts.length === 1) return parts[0][0]?.toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    if (item.username) return item.username[0]?.toUpperCase();
    if (item.email) return item.email[0]?.toUpperCase();
    return '?';
  };

  const renderUser = ({ item }: { item: UserItem }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        {item.profilePictureUrl ? (
          <Image
            source={{ uri: item.profilePictureUrl }}
            style={styles.profileImage}
          />
        ) : (
          <View style={styles.profilePlaceholder}>
            <Text style={styles.profileInitials}>{getInitials(item)}</Text>
          </View>
        )}
        <View style={styles.userInfo}>
          <Text style={styles.email}>{item.email}</Text>
          <Text style={styles.smallText}>
            {item.fullName ?? t('admin.noName')} · {item.username ?? t('admin.noUsername')}
          </Text>
          <View style={styles.roleBadge}>
            <Ionicons
              name={item.role === 'lecturer' ? 'person' : 'school'}
              size={12}
              color="#ffffff"
            />
            <Text style={styles.roleText}>{t(`auth.${item.role}`)}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.statusPill, { borderColor: getStatusColor(item.status) }]}>
        <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
        <Text style={[styles.statusPillText, { color: getStatusColor(item.status) }]}>
          {t(`admin.status.${item.status}`)}
        </Text>
      </View>

      <View style={styles.actionsRow}>
        {item.status === 'blocked' ? (
          <TouchableOpacity
            style={[styles.actionButton, styles.unblockButton]}
            onPress={() => handleUnblockUser(item.uid)}
            disabled={updatingUid === item.uid}
          >
            {updatingUid === item.uid ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={16} color="#ffffff" />
                <Text style={styles.actionText}>{t('admin.unblock')}</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionButton, styles.blockButton]}
            onPress={() => handleBlockUser(item.uid)}
            disabled={updatingUid === item.uid}
          >
            {updatingUid === item.uid ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="ban-outline" size={16} color="#ffffff" />
                <Text style={styles.actionText}>{t('admin.block')}</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeleteUser(item.uid)}
          disabled={updatingUid === item.uid}
        >
          {updatingUid === item.uid ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Ionicons name="trash-outline" size={16} color="#ffffff" />
                <Text style={styles.actionText}>{t('common.delete')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

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
          <Ionicons name="people" size={32} color="#ffffff" />
          <Text style={styles.headerTitle}>{t('admin.userManagement')}</Text>
          <Text style={styles.headerSubtitle}>
            {t('admin.userManagementDescription')}
          </Text>
        </View>

        {/* Search Box */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={20} color="#6b7280" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('admin.searchUsersPlaceholder')}
              placeholderTextColor="#6b7280"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#6b7280" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Results Count */}
        {!loading && filteredUsers.length > 0 && (
          <Text style={styles.resultsCount}>
            {filteredUsers.length === 1 
              ? t('admin.userFound', { count: filteredUsers.length })
              : t('admin.usersFound', { count: filteredUsers.length })}
          </Text>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={PRIMARY_GREEN} />
            <Text style={styles.loadingText}>{t('admin.loadingUsers')}</Text>
          </View>
        ) : filteredUsers.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name={searchQuery ? "search-outline" : "people-outline"}
              size={64}
              color="#6b7280"
            />
            <Text style={styles.emptyTitle}>
              {searchQuery ? t('admin.noUsersFound') : t('admin.noUsersInSystem')}
            </Text>
            <Text style={styles.emptyText}>
              {searchQuery
                ? t('admin.tryAdjustingSearch')
                : t('admin.usersWillAppear')}
            </Text>
          </View>
        ) : (
          <View style={styles.usersList}>
            {filteredUsers.map((item) => (
              <View key={item.uid}>{renderUser({ item })}</View>
            ))}
          </View>
        )}
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
    marginBottom: -30,
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
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 16,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#374151',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  resultsCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    marginTop: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#6b7280',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    marginTop: 20,
    marginHorizontal: 20,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#374151',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  usersList: {
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#374151',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
    borderWidth: 2,
    borderColor: PRIMARY_GREEN,
  },
  profilePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#374151',
  },
  profileInitials: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  userInfo: {
    flex: 1,
  },
  email: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  smallText: {
    color: '#6b7280',
    fontSize: 13,
    marginBottom: 8,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: PRIMARY_GREEN,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  roleText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  blockButton: {
    backgroundColor: ACCENT_GREEN,
  },
  unblockButton: {
    backgroundColor: '#22c55e',
  },
  deleteButton: {
    backgroundColor: '#ef4444',
  },
  actionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});

