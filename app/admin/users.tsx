// app/admin/users.tsx
import { AppCard } from '@/frontend/components/ui/AppCard';
import { AppHeader } from '@/frontend/components/ui/AppHeader';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { spacing } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
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
    I18nManager,
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
  const { colors } = useAppTheme();
  const isRtl = I18nManager.isRTL;
  const [users, setUsers] = useState<UserItem[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'student' | 'lecturer' | 'admin' | 'pending' | 'blocked'>('all');
  const [loading, setLoading] = useState(true);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    const searchMatchedUsers = searchQuery.trim()
      ? users.filter(
        (user) =>
          user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (user.fullName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (user.username || '').toLowerCase().includes(searchQuery.toLowerCase())
      )
      : users;

    const filterMatchedUsers = searchMatchedUsers.filter((user) => {
      switch (selectedFilter) {
        case 'student':
          return user.role === 'student';
        case 'lecturer':
          return user.role === 'lecturer';
        case 'admin':
          return user.role === 'admin';
        case 'pending':
          return user.status === 'pending';
        case 'blocked':
          return user.status === 'blocked';
        default:
          return true;
      }
    });

    setFilteredUsers(filterMatchedUsers);
  }, [searchQuery, selectedFilter, users]);

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
        return colors.success;
      case 'pending':
        return colors.warning;
      case 'blocked':
        return colors.danger;
      default:
        return colors.textSecondary;
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
    <AppCard style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.cardAccentLine, { backgroundColor: getStatusColor(item.status) }]} />
      <View style={[styles.cardHeader, isRtl && styles.rtlRow]}>
        {item.profilePictureUrl ? (
          <Image
            source={{ uri: item.profilePictureUrl }}
            style={[
              styles.profileImage,
              {
                borderColor:
                  item.status === 'blocked'
                    ? colors.danger
                    : item.status === 'pending'
                      ? colors.warning
                      : colors.primary,
              },
            ]}
          />
        ) : (
          <View style={[styles.profilePlaceholder, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Text style={[styles.profileInitials, { color: colors.textPrimary }]}>{getInitials(item)}</Text>
          </View>
        )}
        <View style={styles.userInfo}>
          <Text style={[styles.email, { color: colors.textPrimary }, isRtl && styles.rtlText]}>{item.email}</Text>
          <Text style={[styles.smallText, { color: colors.textSecondary }, isRtl && styles.rtlText]}>
            {item.fullName ?? t('admin.noName')} · {item.username ?? t('admin.noUsername')}
          </Text>
          <View style={[styles.metaRow, isRtl && styles.rtlRow]}>
            <View style={[styles.roleBadge, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }, isRtl && styles.rtlRow]}>
              <Ionicons
                name={item.role === 'lecturer' ? 'person-outline' : 'school-outline'}
                size={12}
                color={colors.primary}
              />
              <Text style={[styles.roleText, { color: colors.primary }]}>{t(`auth.${item.role}`)}</Text>
            </View>
            <View style={[styles.statusPill, { borderColor: getStatusColor(item.status), backgroundColor: colors.surfaceElevated }, isRtl && styles.rtlRow]}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
              <Text style={[styles.statusPillText, { color: getStatusColor(item.status) }]}>
                {t(`admin.status.${item.status}`)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={[styles.actionsRow, { borderTopColor: colors.border }, isRtl && styles.rtlRow]}>
        {item.status === 'blocked' ? (
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.secondaryActionButton,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.success,
              },
            ]}
            onPress={() => handleUnblockUser(item.uid)}
            disabled={updatingUid === item.uid}
          >
            {updatingUid === item.uid ? (
              <ActivityIndicator color={colors.success} />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
                <Text style={[styles.secondaryActionText, { color: colors.success }]}>{t('admin.unblock')}</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.secondaryActionButton,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.danger,
              },
            ]}
            onPress={() => handleBlockUser(item.uid)}
            disabled={updatingUid === item.uid}
          >
            {updatingUid === item.uid ? (
              <ActivityIndicator color={colors.danger} />
            ) : (
              <>
                <Ionicons name="ban-outline" size={16} color={colors.danger} />
                <Text style={[styles.secondaryActionText, { color: colors.danger }]}>{t('admin.block')}</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.danger }]}
          onPress={() => handleDeleteUser(item.uid)}
          disabled={updatingUid === item.uid}
        >
          {updatingUid === item.uid ? (
            <ActivityIndicator color={colors.textOnPrimary} />
          ) : (
            <>
              <Ionicons
                name="trash-outline"
                size={15}
                color={colors.textOnPrimary}
              />
              <Text style={[styles.actionText, { color: colors.textOnPrimary }]}>{t('common.delete')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </AppCard>
  );

  const filterOptions: Array<{ key: 'all' | 'student' | 'lecturer' | 'admin' | 'pending' | 'blocked'; label: string }> = [
    { key: 'all', label: t('admin.users.filterAll') },
    { key: 'student', label: t('admin.users.filterStudents') },
    { key: 'lecturer', label: t('admin.users.filterLecturers') },
    { key: 'admin', label: t('admin.users.filterAdmins') },
    { key: 'pending', label: t('admin.users.filterPending') },
    { key: 'blocked', label: t('admin.users.filterBlocked') },
  ];

  return (
    <AppScreen>
      <View style={styles.screenInner}>
        <View pointerEvents="none" style={styles.pageDecor}>
          <View style={[styles.decorGlowPrimary, { backgroundColor: colors.primary }]} />
          <View style={[styles.decorGlowAccent, { backgroundColor: colors.accent }]} />
        </View>
        <AppHeader title={t('admin.userManagement')} onBack={() => router.back()} />
        <ScrollView
          style={styles.mainScroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <AppCard style={[styles.searchPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.searchBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }, isRtl && styles.rtlRow]}>
            <Ionicons
              name="search-outline"
              size={18}
              color={colors.textSecondary}
              style={[styles.searchIcon, isRtl && styles.rtlSearchIcon]}
            />
            <TextInput
              style={[
                styles.searchInput,
                {
                  color: colors.textPrimary,
                  textAlign: isRtl ? 'right' : 'left',
                },
              ]}
              placeholder={t('admin.searchUsersPlaceholder')}
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </AppCard>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.filterRow, isRtl && styles.rtlRow]}
          style={styles.filterScroll}
        >
          {filterOptions.map((option) => {
            const isSelected = selectedFilter === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.surfaceMuted,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setSelectedFilter(option.key)}
                activeOpacity={0.85}
              >
                <Text style={[styles.filterChipText, { color: isSelected ? colors.textOnPrimary : colors.textPrimary }]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {!loading && filteredUsers.length > 0 && (
          <Text style={[styles.resultsCount, { color: colors.textSecondary }, isRtl && styles.rtlText]}>
            {filteredUsers.length === 1
              ? t('admin.userFound', { count: filteredUsers.length })
              : t('admin.usersFound', { count: filteredUsers.length })}
          </Text>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t('admin.loadingUsers')}</Text>
          </View>
        ) : filteredUsers.length === 0 ? (
          <AppCard style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons
              name={searchQuery ? "search-outline" : "people-outline"}
              size={44}
              color={colors.textSecondary}
            />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }, isRtl && styles.rtlText]}>
              {searchQuery ? t('admin.noUsersFound') : t('admin.noUsersInSystem')}
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }, isRtl && styles.rtlText]}>
              {searchQuery
                ? t('admin.tryAdjustingSearch')
                : t('admin.usersWillAppear')}
            </Text>
          </AppCard>
        ) : (
          <View style={styles.usersList}>
            {filteredUsers.map((item) => (
              <View key={item.uid}>{renderUser({ item })}</View>
            ))}
          </View>
        )}
      </ScrollView>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screenInner: {
    flex: 1,
  },
  pageDecor: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 260,
    zIndex: 0,
    overflow: 'hidden',
  },
  decorGlowPrimary: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    top: -56,
    right: -36,
    opacity: 0.08,
  },
  decorGlowAccent: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    top: 72,
    left: -28,
    opacity: 0.1,
  },
  mainScroll: {
    flex: 1,
    zIndex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  searchPanel: {
    marginBottom: spacing.sm,
  },
  filterScroll: {
    marginBottom: spacing.sm,
  },
  filterRow: {
    gap: 8,
    paddingHorizontal: 2,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    minHeight: 46,
  },
  searchIcon: {
    marginRight: 8,
  },
  rtlSearchIcon: {
    marginRight: 0,
    marginLeft: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  resultsCount: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.sm,
    paddingHorizontal: 4,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 42,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 36,
    marginTop: spacing.sm,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  usersList: {
    gap: 10,
  },
  card: {
    overflow: 'hidden',
  },
  cardAccentLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.55,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 12,
    borderWidth: 2,
  },
  profilePlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
  },
  profileInitials: {
    fontSize: 18,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
  },
  email: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  smallText: {
    fontSize: 12,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
    gap: 4,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    minHeight: 36,
    gap: 6,
  },
  secondaryActionButton: {
    borderWidth: 1,
  },
  secondaryActionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  actionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  rtlRow: {
    flexDirection: 'row-reverse',
  },
  rtlText: {
    textAlign: 'right',
  },
});

