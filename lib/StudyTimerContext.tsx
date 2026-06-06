import { GlobalStudyTimerFab } from '@/frontend/components/study/GlobalStudyTimerFab';
import { StudyTimerModal } from '@/frontend/components/study/StudyTimerModal';
import {
  shouldShowTimerFab,
  StudyTimerPhase,
  StudyTimerSession,
} from '@/frontend/components/study/timerFabConstants';
import { useUser } from '@/lib/UserContext';
import { useSegments } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

const IDLE_SESSION: StudyTimerSession = {
  phase: 'setup',
  remainingSeconds: 0,
  totalSeconds: 0,
};

type StudyTimerContextValue = {
  visible: boolean;
  session: StudyTimerSession;
  statsRefreshKey: number;
  openTimer: () => void;
  closeTimer: () => void;
  syncTimerSession: (session: StudyTimerSession) => void;
  notifySessionSaved: () => void;
};

const StudyTimerContext = createContext<StudyTimerContextValue | null>(null);

export function StudyTimerProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [session, setSession] = useState<StudyTimerSession>(IDLE_SESSION);
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);
  const { firebaseUser, role, status } = useUser();
  const segments = useSegments();

  const openTimer = useCallback(() => setVisible(true), []);
  const closeTimer = useCallback(() => setVisible(false), []);
  const syncTimerSession = useCallback((next: StudyTimerSession) => {
    setSession(next);
  }, []);
  const notifySessionSaved = useCallback(() => {
    setStatsRefreshKey((key) => key + 1);
  }, []);

  useEffect(() => {
    if (visible && !shouldShowTimerFab(segments)) {
      setVisible(false);
    }
  }, [segments, visible]);

  const showFab = useMemo(() => {
    if (!firebaseUser || role !== 'student') return false;
    if (status === 'pending' || status === 'rejected' || status === 'blocked') return false;
    return shouldShowTimerFab(segments);
  }, [firebaseUser, role, segments, status]);

  const value = useMemo(
    () => ({
      visible,
      session,
      statsRefreshKey,
      openTimer,
      closeTimer,
      syncTimerSession,
      notifySessionSaved,
    }),
    [closeTimer, notifySessionSaved, openTimer, session, statsRefreshKey, syncTimerSession, visible],
  );

  return (
    <StudyTimerContext.Provider value={value}>
      <View style={styles.root} pointerEvents="box-none">
        {children}
        <StudyTimerModal
          visible={visible}
          onClose={closeTimer}
          syncTimerSession={syncTimerSession}
          onSessionSaved={notifySessionSaved}
        />
        {showFab && !visible ? <GlobalStudyTimerFab onPress={openTimer} /> : null}
      </View>
    </StudyTimerContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

export function useStudyTimer() {
  const context = useContext(StudyTimerContext);
  if (!context) {
    throw new Error('useStudyTimer must be used within StudyTimerProvider');
  }
  return context;
}

export type { StudyTimerPhase };
