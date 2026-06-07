import { ShareVoiceRoomModal } from '@/frontend/components/voice/ShareVoiceRoomModal';
import { AppHeader } from '@/frontend/components/ui/AppHeader';
import { AppScreen } from '@/frontend/components/ui/AppScreen';
import { layout, radius, spacing } from '@/frontend/styles/designSystem';
import { useAppTheme } from '@/frontend/styles/useAppTheme';
import {
  isDailyConfigured,
  isDailyNativeAvailable,
  resolveDailyRoomUrl,
} from '@/lib/dailyVoiceService';
import { useUser } from '@/lib/UserContext';
import {
  buildJitsiMeetingUrl,
  JITSI_FLIP_CAMERA_SCRIPT,
  JITSI_JOIN_SCRIPT,
  leaveVoiceRoom,
  subscribeVoiceRoom,
  VoiceRoom,
} from '@/lib/voiceRoomService';
import type { DailyVoiceCallHandle } from '@/frontend/components/voice/DailyVoiceCall';
import { Ionicons } from '@expo/vector-icons';
import { requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  AppState,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

export default function VoiceRoomScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { colors } = useAppTheme();
  const { firebaseUser } = useUser();
  const isRtl = i18n.language === 'he';
  const { roomId, password } = useLocalSearchParams<{ roomId: string; password?: string }>();

  const [room, setRoom] = useState<VoiceRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMembers, setShowMembers] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [callActive, setCallActive] = useState(true);
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaDenied, setMediaDenied] = useState(false);
  const [DailyVoiceCall, setDailyVoiceCall] = useState<React.ComponentType<{
    ref?: React.Ref<DailyVoiceCallHandle>;
    roomUrl: string;
    displayName: string;
    onError?: (message: string) => void;
  }> | null>(null);
  const leavingRef = useRef(false);
  const wasActiveRef = useRef<boolean | null>(null);
  const webViewRef = useRef<WebView>(null);
  const dailyRef = useRef<DailyVoiceCallHandle>(null);
  const useNativeDaily = isDailyConfigured() && isDailyNativeAvailable();

  useEffect(() => {
    if (!useNativeDaily) {
      setDailyVoiceCall(null);
      return;
    }
    let cancelled = false;
    import('@/frontend/components/voice/DailyVoiceCall')
      .then((mod) => {
        if (!cancelled) setDailyVoiceCall(() => mod.DailyVoiceCall);
      })
      .catch(() => {
        if (!cancelled) setDailyVoiceCall(null);
      });
    return () => {
      cancelled = true;
    };
  }, [useNativeDaily]);

  const resolvedRoomId = useMemo(
    () => (Array.isArray(roomId) ? roomId[0] : roomId || '').toUpperCase(),
    [roomId],
  );

  const isHost = room?.hostUid === firebaseUser?.uid;
  const myName = firebaseUser?.uid
    ? room?.memberNames?.[firebaseUser.uid] || firebaseUser.displayName || 'User'
    : '';

  const jitsiUrl = useMemo(() => {
    if (!room?.jitsiRoomName || !myName) return '';
    return buildJitsiMeetingUrl(room.jitsiRoomName, myName);
  }, [myName, room?.jitsiRoomName]);

  const dailyRoomUrl = useMemo(() => {
    if (!room) return '';
    return resolveDailyRoomUrl(room);
  }, [room]);

  const prepareMedia = useCallback(async () => {
    setMediaDenied(false);
    setMediaReady(false);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setMediaDenied(true);
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: true,
      });
      setMediaReady(true);
    } catch {
      setMediaDenied(true);
    }
  }, []);

  useEffect(() => {
    void prepareMedia();
  }, [prepareMedia]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' || state === 'background') {
        void setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
          shouldPlayInBackground: true,
        }).catch(() => undefined);
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!resolvedRoomId) return;
    const unsub = subscribeVoiceRoom(resolvedRoomId, (next) => {
      setRoom(next);
      setLoading(false);
    });
    return unsub;
  }, [resolvedRoomId]);

  const resetAudioMode = useCallback(async () => {
    try {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
      });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!room) return;

    if (wasActiveRef.current === true && !room.isActive && !leavingRef.current) {
      leavingRef.current = true;
      setCallActive(false);
      void resetAudioMode();
      Alert.alert(t('voiceRoom.roomClosedTitle'), t('voiceRoom.roomClosedByHost'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ]);
    }

    wasActiveRef.current = room.isActive;
  }, [room, resetAudioMode, router, t]);

  const handleLeave = useCallback(async () => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setCallActive(false);
    if (resolvedRoomId) {
      await leaveVoiceRoom(resolvedRoomId);
    }
    await resetAudioMode();
    router.back();
  }, [resolvedRoomId, resetAudioMode, router]);

  const handleFlipCamera = useCallback(() => {
    if (useNativeDaily && dailyRef.current) {
      void dailyRef.current.flipCamera().catch(() => {
        Alert.alert(t('common.error'), t('voiceRoom.flipCameraFailed'));
      });
      return;
    }
    webViewRef.current?.injectJavaScript(JITSI_FLIP_CAMERA_SCRIPT);
  }, [t, useNativeDaily]);

  const handleWebViewNavigation = useCallback(
    (url: string) => {
      if (!callActive || leavingRef.current || !room?.jitsiRoomName) return;
      const normalized = url.toLowerCase();
      const roomKey = room.jitsiRoomName.toLowerCase();
      const stillInMeeting = normalized.includes(roomKey);
      const leftMeeting =
        normalized.includes('/wiki') ||
        normalized.includes('/static/close') ||
        (/meet\.ffmuc\.net\/?([?#]|$)/.test(normalized) && !stillInMeeting);
      if (leftMeeting) {
        void handleLeave();
      }
    },
    [callActive, handleLeave, room?.jitsiRoomName],
  );

  if (loading) {
    return (
      <AppScreen>
        <AppHeader title={t('voiceRoom.title')} onBack={() => router.back()} />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </AppScreen>
    );
  }

  if (!room) {
    return (
      <AppScreen>
        <AppHeader title={t('voiceRoom.title')} onBack={() => router.back()} />
        <View style={styles.centered}>
          <Text style={{ color: colors.textSecondary }}>{t('voiceRoom.roomNotFound')}</Text>
        </View>
      </AppScreen>
    );
  }

  if (!room.isActive) {
    return (
      <AppScreen>
        <AppHeader title={room.title} onBack={() => router.back()} />
        <View style={styles.centered}>
          <Text style={[styles.closedTitle, { color: colors.textPrimary }, isRtl && styles.rtlText]}>
            {t('voiceRoom.roomInactive')}
          </Text>
          <Text style={[styles.closedHint, { color: colors.textSecondary }, isRtl && styles.rtlText]}>
            {t('voiceRoom.roomClosedByHost')}
          </Text>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen safeAreaEdges={['top', 'left', 'right']}>
      <AppHeader
        title={room.title}
        onBack={() => {
          Alert.alert(t('voiceRoom.leaveTitle'), t('voiceRoom.leaveMessage'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('voiceRoom.leave'), style: 'destructive', onPress: () => void handleLeave() },
          ]);
        }}
        rightSlot={
          <View style={styles.headerActions}>
            {isHost ? (
              <TouchableOpacity
                onPress={() => setShowShareModal(true)}
                style={styles.headerBtn}
                accessibilityRole="button"
                accessibilityLabel={t('voiceRoom.shareRoom')}
              >
                <Ionicons name="share-outline" size={22} color={colors.primary} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={() => setShowMembers((v) => !v)} style={styles.headerBtn}>
              <Ionicons name="people-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>
        }
      />

      {isHost ? (
        <View style={styles.credentialsBar}>
          <View style={[styles.credentialChip, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Text style={[styles.credentialLabel, { color: colors.textSecondary }]}>{t('voiceRoom.roomId')}</Text>
            <Text style={[styles.credentialValue, { color: colors.textPrimary }]}>{room.id}</Text>
          </View>
          {password ? (
            <View style={[styles.credentialChip, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <Text style={[styles.credentialLabel, { color: colors.textSecondary }]}>{t('voiceRoom.password')}</Text>
              <Text style={[styles.credentialValue, { color: colors.textPrimary }]}>{password}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.voicePane}>
        {callActive && mediaReady && !mediaDenied ? (
          <TouchableOpacity
            style={[
              styles.flipCameraBtn,
              isRtl ? styles.flipCameraBtnRtl : null,
              { backgroundColor: `${colors.surface}E6`, borderColor: colors.border },
            ]}
            onPress={handleFlipCamera}
            accessibilityRole="button"
            accessibilityLabel={t('voiceRoom.flipCamera')}
            activeOpacity={0.85}
          >
            <Ionicons name="camera-reverse-outline" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        ) : null}
        {mediaDenied ? (
          <View style={styles.webviewLoading}>
            <Ionicons name="mic-off-outline" size={32} color={colors.textSecondary} />
            <Text style={[styles.permissionText, { color: colors.textSecondary }, isRtl && styles.rtlText]}>
              {t('voiceRoom.micPermissionDenied')}
            </Text>
            <TouchableOpacity
              style={[styles.retryBtn, { backgroundColor: colors.primary }]}
              onPress={() => void prepareMedia()}
            >
              <Text style={{ color: colors.textOnPrimary, fontWeight: '700' }}>{t('voiceRoom.micPermissionRetry')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {!mediaDenied && !mediaReady ? (
          <View style={styles.webviewLoading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ color: colors.textSecondary, marginTop: 8 }}>{t('voiceRoom.preparingMic')}</Text>
          </View>
        ) : null}
        {useNativeDaily && DailyVoiceCall && dailyRoomUrl && callActive && mediaReady && myName ? (
          <DailyVoiceCall
            ref={dailyRef}
            roomUrl={dailyRoomUrl}
            displayName={myName}
            onError={() => Alert.alert(t('common.error'), t('voiceRoom.connecting'))}
          />
        ) : null}
        {(!useNativeDaily || !DailyVoiceCall) && jitsiUrl && callActive && mediaReady ? (
          <WebView
            ref={webViewRef}
            source={{ uri: jitsiUrl }}
            style={styles.webview}
            allowsInlineMediaPlayback
            allowsFullscreenVideo
            allowsPictureInPictureMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
            javaScriptEnabled
            javaScriptCanOpenWindowsAutomatically={false}
            domStorageEnabled
            setSupportMultipleWindows={false}
            injectedJavaScript={JITSI_JOIN_SCRIPT}
            onNavigationStateChange={(navState) => handleWebViewNavigation(navState.url)}
            onMessage={(event) => {
              if (event.nativeEvent.data === 'leftMeeting') {
                void handleLeave();
              }
            }}
            bounces={false}
            scrollEnabled={false}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.webviewLoading}>
                <ActivityIndicator color={colors.primary} />
                <Text style={{ color: colors.textSecondary, marginTop: 8 }}>{t('voiceRoom.connecting')}</Text>
              </View>
            )}
          />
        ) : null}
      </View>

      {showMembers ? (
        <View style={[styles.membersPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.membersTitle, { color: colors.textPrimary }, isRtl && styles.rtlText]}>
            {t('voiceRoom.participants', { count: room.memberUids?.length || 0 })}
          </Text>
          <ScrollView style={styles.membersList} showsVerticalScrollIndicator={false}>
            {(room.memberUids || []).map((uid) => {
              const name = room.memberNames?.[uid] || uid.slice(0, 6);
              const isRoomHost = uid === room.hostUid;
              return (
                <View key={uid} style={[styles.memberRow, isRtl && styles.rtlRow]}>
                  <Text style={[styles.memberName, { color: colors.textPrimary }, isRtl && styles.rtlText]} numberOfLines={1}>
                    {name}
                    {isRoomHost ? ` (${t('voiceRoom.host')})` : ''}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {isHost && password ? (
        <ShareVoiceRoomModal
          visible={showShareModal}
          roomId={room.id}
          password={password}
          roomTitle={room.title}
          onClose={() => setShowShareModal(false)}
        />
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  closedTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  closedHint: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: spacing.sm },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  credentialsBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.sm,
  },
  credentialChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  credentialLabel: { fontSize: 11, fontWeight: '600' },
  credentialValue: { fontSize: 15, fontWeight: '800', marginTop: 2, letterSpacing: 1 },
  voicePane: { flex: 1, minHeight: 280, position: 'relative' },
  flipCameraBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flipCameraBtnRtl: { right: undefined, left: 12 },
  webview: { flex: 1, backgroundColor: '#000' },
  webviewLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  permissionText: { fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.md },
  retryBtn: { borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  membersPanel: {
    borderTopWidth: 1,
    maxHeight: 220,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  membersTitle: { fontSize: 14, fontWeight: '800', marginBottom: spacing.sm },
  membersList: { maxHeight: 180 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  memberName: { fontSize: 14, fontWeight: '600' },
  rtlRow: { flexDirection: 'row-reverse' },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
});
