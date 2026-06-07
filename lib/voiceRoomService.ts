import { createDailyRoom, getDailyRoomName, isDailyConfigured } from '@/lib/dailyVoiceService';
import { auth, db } from '@/lib/firebaseConfig';
import {
  arrayRemove,
  arrayUnion,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

export type VoiceRoom = {
  id: string;
  passwordHash: string;
  hostUid: string;
  hostName: string;
  title: string;
  jitsiRoomName: string;
  dailyRoomName?: string;
  dailyRoomUrl?: string;
  memberUids: string[];
  memberNames: Record<string, string>;
  isActive: boolean;
};

export function hashVoiceRoomPassword(password: string): string {
  let hash = 5381;
  for (let i = 0; i < password.length; i++) {
    hash = (hash * 33) ^ password.charCodeAt(i);
  }
  return `sb_${(hash >>> 0).toString(36)}_${password.length}`;
}

function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function generateJitsiRoomName(): string {
  return `studybuddy_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function getCurrentUserName(): Promise<string> {
  const user = auth.currentUser;
  if (!user) return 'User';
  const snap = await getDoc(doc(db, 'users', user.uid));
  if (!snap.exists()) return 'User';
  const data = snap.data() as { fullName?: string; username?: string };
  return data.fullName || data.username || 'User';
}

export async function createVoiceRoom(
  password: string,
  title?: string,
): Promise<{ roomId: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error('NOT_AUTHENTICATED');
  if (password.trim().length < 4) throw new Error('PASSWORD_TOO_SHORT');

  const roomId = generateRoomId();
  const hostName = await getCurrentUserName();
  const dailyRoomName = getDailyRoomName(roomId);
  let dailyRoomUrl = '';
  if (isDailyConfigured()) {
    try {
      dailyRoomUrl = await createDailyRoom(dailyRoomName);
    } catch {
      dailyRoomUrl = '';
    }
  }

  await setDoc(doc(db, 'voiceRooms', roomId), {
    id: roomId,
    passwordHash: hashVoiceRoomPassword(password.trim()),
    hostUid: user.uid,
    hostName,
    title: title?.trim() || `Room ${roomId}`,
    jitsiRoomName: generateJitsiRoomName(),
    dailyRoomName,
    dailyRoomUrl: dailyRoomUrl || undefined,
    memberUids: [user.uid],
    memberNames: { [user.uid]: hostName },
    createdAt: serverTimestamp(),
    isActive: true,
  });

  return { roomId };
}

export async function joinVoiceRoom(roomId: string, password: string): Promise<VoiceRoom> {
  const user = auth.currentUser;
  if (!user) throw new Error('NOT_AUTHENTICATED');

  const normalizedId = roomId.trim().toUpperCase();
  const roomRef = doc(db, 'voiceRooms', normalizedId);
  const snap = await getDoc(roomRef);

  if (!snap.exists()) throw new Error('ROOM_NOT_FOUND');

  const data = snap.data() as VoiceRoom;
  if (!data.isActive) throw new Error('ROOM_INACTIVE');
  if (data.passwordHash !== hashVoiceRoomPassword(password.trim())) {
    throw new Error('WRONG_PASSWORD');
  }

  const memberName = await getCurrentUserName();
  const memberNames = { ...(data.memberNames || {}), [user.uid]: memberName };

  await updateDoc(roomRef, {
    memberUids: arrayUnion(user.uid),
    memberNames,
  });

  return { ...data, id: normalizedId, memberNames };
}

export async function leaveVoiceRoom(roomId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;

  const roomRef = doc(db, 'voiceRooms', roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) return;

  const data = snap.data() as VoiceRoom;

  if (data.hostUid === user.uid) {
    await updateDoc(roomRef, {
      isActive: false,
      memberUids: [],
      memberNames: {},
      closedAt: serverTimestamp(),
    });
    return;
  }

  const memberNames = { ...(data.memberNames || {}) };
  delete memberNames[user.uid];

  await updateDoc(roomRef, {
    memberUids: arrayRemove(user.uid),
    memberNames,
  });
}

export function subscribeVoiceRoom(
  roomId: string,
  callback: (room: VoiceRoom | null) => void,
): () => void {
  return onSnapshot(doc(db, 'voiceRooms', roomId), (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    callback({ id: snap.id, ...(snap.data() as Omit<VoiceRoom, 'id'>) });
  });
}

/** Public meet.jit.si now requires moderator login; ffmuc allows anonymous first-joiner as host. */
export const JITSI_DOMAIN = 'meet.ffmuc.net';

export function buildJitsiMeetingUrl(roomName: string, displayName: string): string {
  const room = encodeURIComponent(roomName);
  const name = encodeURIComponent(displayName);
  const hash = [
    'config.prejoinPageEnabled=false',
    'config.prejoinConfig.enabled=false',
    'config.enableLobby=false',
    'config.startWithAudioMuted=true',
    'config.startWithVideoMuted=true',
    'config.enableNoAudioDetection=false',
    'config.enableNoisyMicDetection=false',
    'config.disableDeepLinking=true',
    'config.requireDisplayName=false',
    'config.hideLoginButton=true',
    'config.enableWelcomePage=false',
    'interfaceConfig.SHOW_JITSI_WATERMARK=false',
    'interfaceConfig.SHOW_BRAND_WATERMARK=false',
    'interfaceConfig.HIDE_LOGIN_BUTTON=true',
    'interfaceConfig.MOBILE_APP_PROMO=false',
    'interfaceConfig.DISPLAY_WELCOME_FOOTER=false',
    'interfaceConfig.TOOLBAR_BUTTONS=["microphone","camera","toggle-camera","chat","raisehand","participants-pane","tileview","settings","hangup"]',
    'interfaceConfig.TOOLBAR_ALWAYS_VISIBLE=false',
    'interfaceConfig.HIDE_INVITE_MORE_HEADER=true',
    'config.toolbarConfig.alwaysVisible=false',
    'config.disableInviteFunctions=true',
    `userInfo.displayName=${name}`,
  ].join('&');
  return `https://${JITSI_DOMAIN}/${room}#${hash}`;
}

export const JITSI_FLIP_CAMERA_SCRIPT = `
  (function () {
    function getConference() {
      try {
        if (typeof APP !== 'undefined' && APP.store) {
          return APP.store.getState()['features/base/conference'].conference;
        }
      } catch (e) {}
      return null;
    }
    function getLocalVideoTrack() {
      try {
        var conference = getConference();
        if (!conference || !conference.getLocalTracks) return null;
        var tracks = conference.getLocalTracks();
        for (var i = 0; i < tracks.length; i++) {
          if (tracks[i].getType && tracks[i].getType() === 'video') {
            return tracks[i];
          }
        }
      } catch (e) {}
      return null;
    }
    function ensureVideoOn(done) {
      try {
        if (typeof APP !== 'undefined' && APP.conference && APP.conference.isLocalVideoMuted()) {
          APP.conference.toggleVideoMuted(false, true);
          setTimeout(done, 1000);
          return;
        }
      } catch (e) {}
      done();
    }
    function clickFlipButton() {
      var selectors = [
        '[data-testid="toggle-camera-button"]',
        '[aria-label="Flip camera"]',
        '[aria-label*="flip"]',
        '[aria-label*="Flip"]',
        '[aria-label*="facing"]',
      ];
      for (var i = 0; i < selectors.length; i++) {
        var direct = document.querySelector(selectors[i]);
        if (direct) {
          direct.click();
          return true;
        }
      }
      return false;
    }
    function flipWithSdk() {
      if (typeof JitsiMeetJS === 'undefined') return Promise.resolve(false);
      var oldTrack = getLocalVideoTrack();
      if (!oldTrack) return Promise.resolve(false);
      var current = window.__sbFacing || 'user';
      try {
        if (oldTrack.getCameraFacingMode) {
          current = oldTrack.getCameraFacingMode() || current;
        }
      } catch (e) {}
      var next = current === 'environment' ? 'user' : 'environment';
      window.__sbFacing = next;
      var conference = getConference();
      if (!conference) return Promise.resolve(false);
      return JitsiMeetJS.createLocalTracks({
        devices: ['video'],
        facingMode: next,
      })
        .then(function (tracks) {
          var newTrack = tracks && tracks[0];
          if (!newTrack) return false;
          return conference.replaceTrack(oldTrack, newTrack).then(function () {
            try {
              oldTrack.dispose();
            } catch (e) {}
            return true;
          });
        })
        .catch(function () {
          return false;
        });
    }
    ensureVideoOn(function () {
      flipWithSdk().then(function (ok) {
        if (!ok) {
          if (!clickFlipButton()) {
            setTimeout(clickFlipButton, 500);
          }
        }
      });
    });
  })();
  true;
`;

export const JITSI_JOIN_SCRIPT = `
  (function () {
    function clickByText(matchers) {
      var nodes = document.querySelectorAll('button, [role="button"], a');
      for (var i = 0; i < nodes.length; i++) {
        var text = (nodes[i].innerText || nodes[i].textContent || '').trim().toLowerCase();
        for (var j = 0; j < matchers.length; j++) {
          if (text.indexOf(matchers[j]) !== -1) {
            nodes[i].click();
            return true;
          }
        }
      }
      return false;
    }
    function liftToolbar() {
      var styleId = 'sb-jitsi-toolbar-lift';
      if (document.getElementById(styleId)) return;
      var style = document.createElement('style');
      style.id = styleId;
      style.textContent = [
        '.new-toolbox.visible, #new-toolbox.visible { bottom: calc(env(safe-area-inset-bottom, 0px) + 14px) !important; }',
      ].join('\\n');
      document.head.appendChild(style);
    }
    function hideInviteUi() {
      var inviteLabels = ['invite more people', 'share the meeting link', 'share meeting invitation', 'הזמן'];
      document.querySelectorAll('button, [role="button"], h1, h2, h3, span, div').forEach(function (el) {
        var t = (el.innerText || el.textContent || '').trim().toLowerCase();
        for (var i = 0; i < inviteLabels.length; i++) {
          if (t === inviteLabels[i] || t.indexOf('invite more') !== -1) {
            var panel = el.closest('[role="dialog"], .modal, .invite-more');
            if (panel) {
              panel.style.setProperty('display', 'none', 'important');
            }
          }
        }
      });
      document.querySelectorAll('[aria-label*="nvite"], [data-testid*="invite"]').forEach(function (el) {
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('pointer-events', 'none', 'important');
      });
    }
    function hideBranding() {
      var labels = ['manual', 'faq', 'contact'];
      document.querySelectorAll('a, span, div, button, p').forEach(function (el) {
        var t = (el.innerText || el.textContent || '').trim().toLowerCase();
        for (var i = 0; i < labels.length; i++) {
          if (t === labels[i]) {
            el.style.setProperty('display', 'none', 'important');
            if (el.parentElement) {
              el.parentElement.style.setProperty('display', 'none', 'important');
            }
          }
        }
      });
      document.querySelectorAll('a[href*="wiki"], a[href*="ffmuc"]').forEach(function (a) {
        a.style.setProperty('display', 'none', 'important');
        a.style.setProperty('pointer-events', 'none', 'important');
      });
    }
    function dismissBlockers() {
      clickByText(['dismiss', 'close', 'סגור']);
      clickByText(['start meeting', 'join meeting', 'join now', 'הצטרף']);
      hideBranding();
      hideInviteUi();
      liftToolbar();
    }
    function notifyIfLeft() {
      var path = (window.location.pathname || '').toLowerCase();
      var href = (window.location.href || '').toLowerCase();
      if (path === '/' || href.indexOf('/wiki') !== -1 || href.indexOf('/static/close') !== -1) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage('leftMeeting');
        }
      }
    }
    dismissBlockers();
    setTimeout(dismissBlockers, 800);
    setTimeout(dismissBlockers, 2000);
    setInterval(dismissBlockers, 2000);
    setInterval(notifyIfLeft, 800);
    window.addEventListener('popstate', notifyIfLeft);
  })();
  true;
`;
