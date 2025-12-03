// lib/UserContext.tsx
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, {
    createContext,
    ReactNode,
    useContext,
    useEffect,
    useState,
} from 'react';
import { auth, db } from './firebaseConfig';

type UserRole = 'student' | 'lecturer' | 'admin' | null;
type UserStatus = 'pending' | 'active' | 'rejected' | null;

type UserContextValue = {
  firebaseUser: User | null;
  role: UserRole;
  status: UserStatus;
  loading: boolean;
};

const UserContext = createContext<UserContextValue>({
  firebaseUser: null,
  role: null,
  status: null,
  loading: true,
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [status, setStatus] = useState<UserStatus>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (!user) {
        setRole(null);
        setStatus(null);
        setLoading(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const data = snap.data() as any;
          setRole((data.role as UserRole) ?? null);
          setStatus((data.status as UserStatus) ?? null);
        } else {
          setRole(null);
          setStatus(null);
        }
      } catch (e) {
        console.log('Error loading user role:', e);
        setRole(null);
        setStatus(null);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  return (
    <UserContext.Provider value={{ firebaseUser, role, status, loading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
