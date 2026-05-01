import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { onAuthStateChanged, User, signOut as firebaseSignOut } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { auth, db, getDeviceSessionId, claimSession, watchSessionCollision, UserProfile } from "@messflow/shared-core";
import { toast } from "sonner";
import { offlineStorage } from "../../shared/lib/offline/storage";

export type UserType = 'internal' | 'external' | 'loading';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  userType: UserType;
  loading: boolean;
  logout: () => Promise<void>;
  updateUserProfile: (profile: UserProfile) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  userType: 'loading',
  loading: true,
  logout: async () => {},
  updateUserProfile: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userType, setUserType] = useState<UserType>('loading');
  const [loading, setLoading] = useState(true);
  
  const registrationListenerRef = useRef<(() => void) | null>(null);
  const statusListenerRef = useRef<(() => void) | null>(null);
  const sessionListenerRef = useRef<(() => void) | null>(null);

  // Cold Start: Restore cached profile for offline display only.
  // userType is NOT set from cache — it must be confirmed by the Firestore lookup on each session.
  useEffect(() => {
    offlineStorage.getProfile().then((cached) => {
      if (cached) {
        setUserProfile(cached as UserProfile);
        // Note: we intentionally do NOT set userType here.
        // The network lookup in onAuthStateChanged is the single source of truth for userType.
      }
    }).catch(console.error);
  }, []);

  const buildRegisteredProfile = useCallback(async (
    currentUser: User,
    email: string,
    regNo: string
  ): Promise<UserProfile | null> => {
    const studentDocRef = doc(db, "students", regNo);
    const studentDocSnap = await getDoc(studentDocRef);
    if (!studentDocSnap.exists()) return null;

    const studentData = studentDocSnap.data();

    const updates: any = {};
    if (!studentData.uid || studentData.uid !== currentUser.uid) {
      updates.uid = currentUser.uid;
    }
    
    if (currentUser.displayName && (!studentData.name || studentData.name.trim() === "" || studentData.name.toLowerCase() === "unknown student")) {
      updates.name = currentUser.displayName;
    }

    if (Object.keys(updates).length > 0) {
      await updateDoc(studentDocRef, updates);
      if (updates.name) studentData.name = updates.name;
    }

    const userDocRef = doc(db, "users", currentUser.uid);
    const existingSnap = await getDoc(userDocRef);
    const existing = existingSnap.exists() ? existingSnap.data() : null;

    const profile: UserProfile = {
      uid: currentUser.uid,
      email: email,
      name: studentData.name || existing?.name || currentUser.displayName || "Unknown Student",
      rollNo: studentData.regNo || regNo,
      walletBalance: studentData.balance !== undefined ? studentData.balance : (studentData.credits !== undefined ? studentData.credits : (existing?.walletBalance || 0)),
      userType: "internal",
      status: studentData.status || "active",
      photoURL: currentUser.photoURL || existing?.photoURL,
      createdAt: existing?.createdAt || new Date().toISOString(),
      isEnrolled: studentData.isNightMessEnrolled === true || ((studentData.balance > 0) && (studentData.status === "active"))
    };

    console.log(`[AuthContext] Building registered profile for ${email} (uid: ${currentUser.uid}, regNo: ${regNo})`);
    await setDoc(userDocRef, profile, { merge: true });
    return profile;
  }, []);

  const startStatusWatcher = useCallback((regNo: string) => {
    if (statusListenerRef.current) {
      statusListenerRef.current();
    }
    const studentDocRef = doc(db, "students", regNo);
    statusListenerRef.current = onSnapshot(studentDocRef, (snap) => {
      if (snap.exists()) {
        const latestData = snap.data();
        
        if (latestData.status === "disabled") {
          toast.error("Account Access Revoked: Your account has been disabled. Please contact administration.");
          firebaseSignOut(auth);
          return;
        }

        setUserProfile(prev => {
          if (!prev) return null;
          const updatedProfile: UserProfile = {
            ...prev,
            status: latestData.status || "active",
            walletBalance: latestData.balance !== undefined ? latestData.balance : (latestData.credits !== undefined ? latestData.credits : prev.walletBalance),
            name: latestData.name || prev.name,
            activeSessionId: latestData.activeSessionId,
            isEnrolled: latestData.isNightMessEnrolled === true || ((latestData.balance > 0) && (latestData.status === "active"))
          };
          offlineStorage.saveProfile(updatedProfile);

          // Keep users/{uid} in sync with latest balance from students collection
          if (prev.uid && (prev.walletBalance !== updatedProfile.walletBalance || prev.status !== updatedProfile.status)) {
            console.log(`[AuthContext] Syncing updated balance (${updatedProfile.walletBalance}) or status to users/${prev.uid}`);
            const userRef = doc(db, "users", prev.uid);
            setDoc(userRef, { 
              walletBalance: updatedProfile.walletBalance,
              status: updatedProfile.status
            }, { merge: true }).catch(console.error);
          }

          return updatedProfile;
        });
      }
    });
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (registrationListenerRef.current) {
        registrationListenerRef.current();
        registrationListenerRef.current = null;
      }
      if (statusListenerRef.current) {
        statusListenerRef.current();
        statusListenerRef.current = null;
      }
      if (sessionListenerRef.current) {
        sessionListenerRef.current();
        sessionListenerRef.current = null;
      }

      setUser(currentUser);
      
      if (!currentUser) {
        setUserProfile(null);
        setUserType('loading');
        setLoading(false);
        return;
      }

      try {
        const email = currentUser.email?.toLowerCase().trim();
        if (!email) {
          await firebaseSignOut(auth);
          setLoading(false);
          return;
        }

        const userDocRef = doc(db, "users", currentUser.uid);
        let userDocSnap = await getDoc(userDocRef);
        let currentProfile: UserProfile | null = userDocSnap.exists() ? (userDocSnap.data() as UserProfile) : null;

        const registeredDocRef = doc(db, "registered_students", email);
        const registeredDocSnap = await getDoc(registeredDocRef);
        
        let regNo: string | null = null;

        if (registeredDocSnap.exists()) {
          regNo = registeredDocSnap.data().regNo;
        } else {
          // Fallback: Search students by email
          const studentsRef = collection(db, "students");
          const q = query(studentsRef, where("email", "==", email));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            regNo = querySnapshot.docs[0].data().regNo;
          } else if (currentProfile?.rollNo && currentProfile.rollNo !== "EXTERNAL") {
            // Fallback to previously linked rollNo if email match fails (e.g., due to case mismatch)
            regNo = currentProfile.rollNo;
          }
        }

        if (regNo) {
          console.log(`[AuthContext] Resolved regNo ${regNo} for user ${email}`);
          // USER IS INTERNAL
          const profile = await buildRegisteredProfile(currentUser, email, regNo);
          if (profile) {
            setUserProfile(profile);
            setUserType('internal');
            offlineStorage.saveProfile(profile);
            
            // Only start session collision for internals
            await claimSession(currentUser.uid);
            sessionListenerRef.current = watchSessionCollision(currentUser.uid, () => {
              toast.error("Security Alert: Logged in from another device.");
              firebaseSignOut(auth);
            }, false);

            startStatusWatcher(regNo);
            
            setLoading(false);
            return;
          }
        }

        console.log(`[AuthContext] User ${email} is external (guest)`);
        // USER IS EXTERNAL (Guest)
        const guestProfile: UserProfile = {
          uid: currentUser.uid,
          email: email,
          name: currentUser.displayName || "Guest",
          rollNo: "EXTERNAL",
          walletBalance: 0,
          userType: "external",
          status: "active",
          photoURL: currentUser.photoURL || undefined,
          createdAt: currentProfile?.createdAt || new Date().toISOString(),
          isEnrolled: false
        };
        await setDoc(userDocRef, guestProfile);
        setUserProfile(guestProfile);
        setUserType('external');
        offlineStorage.saveProfile(guestProfile);

        // REGISTRATION WATCHER: Watch if admin registers this email
        registrationListenerRef.current = onSnapshot(registeredDocRef, async (snap) => {
          if (snap.exists()) {
            const newRegNo = snap.data().regNo;
            if (newRegNo) {
              try {
                const upgraded = await buildRegisteredProfile(currentUser, email, newRegNo);
                if (upgraded) {
                  setUserProfile(upgraded);
                  setUserType('internal');
                  offlineStorage.saveProfile(upgraded);
                  
                  // Start tracking session and status
                  await claimSession(currentUser.uid);
                  sessionListenerRef.current = watchSessionCollision(currentUser.uid, () => {
                    toast.error("Security Alert: Logged in from another device.");
                    firebaseSignOut(auth);
                  }, false);
                  
                  startStatusWatcher(newRegNo);
                  toast.success("Your account has been activated! Welcome to Messfloww.");
                }
              } catch (err) {
                console.error("Error upgrading profile:", err);
              }
              if (registrationListenerRef.current) {
                registrationListenerRef.current();
                registrationListenerRef.current = null;
              }
            }
          }
        });

      } catch (error) {
        console.error("Error fetching user profile:", error);
        setUserProfile(null);
        setUserType('loading');
      }
      
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (registrationListenerRef.current) registrationListenerRef.current();
      if (statusListenerRef.current) statusListenerRef.current();
      if (sessionListenerRef.current) sessionListenerRef.current();
    };
  }, [buildRegisteredProfile, startStatusWatcher]);

  const logout = async () => {
    await offlineStorage.saveProfile(null);
    await offlineStorage.clearCart();
    await firebaseSignOut(auth);
  };

  const updateUserProfile = (profile: UserProfile) => {
    setUserProfile(profile);
    offlineStorage.saveProfile(profile);
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, userType, loading, logout, updateUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
