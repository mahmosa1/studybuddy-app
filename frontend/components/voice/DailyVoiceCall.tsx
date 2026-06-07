import { useAppTheme } from '@/frontend/styles/useAppTheme';
import Daily, { DailyCall, DailyEvent, DailyMediaView, DailyParticipant } from '@daily-co/react-native-daily-js';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

export type DailyVoiceCallHandle = {
  setMicrophoneEnabled: (enabled: boolean) => Promise<void>;
  setCameraEnabled: (enabled: boolean) => Promise<void>;
  flipCamera: () => Promise<void>;
};

type DailyVoiceCallProps = {
  roomUrl: string;
  displayName: string;
  onJoined?: () => void;
  onError?: (message: string) => void;
};

function getPlayableTrack(participant: DailyParticipant) {
  const camera = participant.tracks.video;
  if (camera?.track && camera.state === 'playable') {
    return { video: camera.track, audio: participant.tracks.audio?.track };
  }
  return { video: null, audio: participant.tracks.audio?.track };
}

export const DailyVoiceCall = forwardRef<DailyVoiceCallHandle, DailyVoiceCallProps>(function DailyVoiceCall(
  { roomUrl, displayName, onJoined, onError },
  ref,
) {
  const { colors } = useAppTheme();
  const callRef = useRef<DailyCall | null>(null);
  const [participants, setParticipants] = useState<Record<string, DailyParticipant>>({});
  const [joining, setJoining] = useState(true);

  const refreshParticipants = useCallback((call: DailyCall) => {
    const all = call.participants();
    setParticipants({ ...all });
  }, []);

  useEffect(() => {
    const call = Daily.createCallObject();
    callRef.current = call;

    const events: DailyEvent[] = ['participant-joined', 'participant-updated', 'participant-left', 'joined-meeting'];
    const handler = () => refreshParticipants(call);

    events.forEach((event) => call.on(event, handler));
    call.on('error', (ev) => {
      onError?.(ev?.errorMsg || 'Daily error');
    });
    call.on('joined-meeting', () => {
      setJoining(false);
      onJoined?.();
      refreshParticipants(call);
    });

    void call
      .join({
        url: roomUrl,
        userName: displayName,
        startVideoOff: true,
        startAudioOff: true,
      })
      .catch(() => {
        setJoining(false);
        onError?.('JOIN_FAILED');
      });

    return () => {
      events.forEach((event) => call.off(event, handler));
      void call.leave();
      call.destroy();
      callRef.current = null;
    };
  }, [displayName, onError, onJoined, refreshParticipants, roomUrl]);

  useImperativeHandle(ref, () => ({
    setMicrophoneEnabled: async (enabled: boolean) => {
      await callRef.current?.setLocalAudio(enabled);
    },
    setCameraEnabled: async (enabled: boolean) => {
      await callRef.current?.setLocalVideo(enabled);
    },
    flipCamera: async () => {
      const call = callRef.current;
      if (!call) return;
      const local = call.participants().local;
      if (!local?.video) {
        await call.setLocalVideo(true);
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
      await call.cycleCamera();
    },
  }));

  const { mainParticipant, thumbnails } = useMemo(() => {
    const list = Object.values(participants);
    const local = list.find((p) => p.local);
    const remote = list.filter((p) => !p.local);
    const main = remote[0] || local || null;
    const thumbs = list.filter((p) => p.session_id !== main?.session_id);
    return { mainParticipant: main, thumbnails: thumbs };
  }, [participants]);

  const mainTracks = mainParticipant ? getPlayableTrack(mainParticipant) : { video: null, audio: null };

  return (
    <View style={styles.root}>
      {joining ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}

      {mainParticipant && mainTracks.video ? (
        <DailyMediaView
          videoTrack={mainTracks.video}
          audioTrack={mainTracks.audio}
          mirror={mainParticipant.local}
          objectFit="cover"
          style={styles.mainVideo}
        />
      ) : (
        <View style={[styles.placeholder, { backgroundColor: '#1a1a1a' }]}>
          <Text style={{ color: colors.textSecondary }}>{displayName}</Text>
        </View>
      )}

      {thumbnails.length > 0 ? (
        <View style={styles.thumbRow}>
          {thumbnails.map((participant) => {
            const tracks = getPlayableTrack(participant);
            if (!tracks.video) return null;
            return (
              <DailyMediaView
                key={participant.session_id}
                videoTrack={tracks.video}
                audioTrack={tracks.audio}
                mirror={participant.local}
                objectFit="cover"
                style={styles.thumb}
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  centered: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  mainVideo: { flex: 1 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  thumbRow: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    gap: 6,
  },
  thumb: {
    width: 88,
    height: 132,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
