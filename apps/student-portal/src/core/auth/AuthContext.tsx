import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { onAuthStateChanged, User, signOut as firebaseSignOut } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { ref, onValue, set, onDisconnect } from "firebase/database";
import { auth, db, rtdb, getDeviceSessionId, claimSession, watchSessionCollision } from "@messflow/shared-core";
import { toast } from "sonner";
import { offlineStorage } from "../../shared/lib/offline/storage";

// Interface for our custom user document in Firestore
export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  rollNo: string;
  walletBalance: number;
  createdAt: string;
  isRegistered: boolean;
  status: "active" | "disabled" | "pending";
  photoURL?: string;
  activeSessionId?: string;
}

// Generate or retrieve a unique ID for this browser instance
// This persists across tab reloads but is shared across all tabs of this browser
// Use shared-core for APP_SESSION_ID logic directly when needed, 
// but we keep this local constant for immediate presence mapping if preferred
const APP_SESSION_ID = getDeviceSessionId();

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  updateUserProfile: (profile: UserProfile) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  logout: async () => {},
  updateUserProfile: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const registrationListenerRef = useRef<(() => void) | null>(null);
  const statusListenerRef = useRef<(() => void) | null>(null);
  const sessionListenerRef = useRef<(() => void) | null>(null);

  // Cold Start: Try to load from cache immediately
  useEffect(() => {
    offlineStorage.getProfile().then((cached) => {
      if (cached) {
        setUserProfile(cached as UserProfile);
        setLoading(false); // Let the UI paint immediately while Firebase catches up
      }
    }).catch(console.error);
  }, []);

  /**
   * Builds a UserProfile from the students master record.
   * Called both on initial login and when the registration watcher fires.
   */
  const buildRegisteredProfile = useCallback(async (
    currentUser: User,
    email: string,
    regNo: string
  ): Promise<UserProfile | null> => {
    const studentDocRef = doc(db, "students", regNo);
    const studentDocSnap = await getDoc(studentDocRef);
    if (!studentDocSnap.exists()) return null;

    const studentData = studentDocSnap.data();

    // RE-LINK UID if missing, or UPDATE active session
    const updates: any = {};
    if (!studentData.uid || studentData.uid !== currentUser.uid) {
      updates.uid = currentUser.uid;
    }
    // We remove the Firestore activeSessionId tracking from here, using RTDB instead.

    if (Object.keys(updates).length > 0) {
      await updateDoc(studentDocRef, updates);
    }

    // Set Session ID to RTDB for immediate presence / lockout listening
    // Moved to onAuthStateChanged to ensure it happens before watcher is started

    const userDocRef = doc(db, "users", currentUser.uid);
    const existingSnap = await getDoc(userDocRef);
    const existing = existingSnap.exists() ? existingSnap.data() : null;

    const profile: UserProfile = {
      uid: currentUser.uid,
      email: email,
      name: studentData.name || existing?.name || currentUser.displayName || "Unknown Student",
      rollNo: studentData.regNo || regNo,
      walletBalance: studentData.balance !== undefined ? studentData.balance : (existing?.walletBalance || 0),
      isRegistered: true,
      status: studentData.status || "active",
      photoURL: currentUser.photoURL || existing?.photoURL,
      createdAt: existing?.createdAt || new Date().toISOString()
    };

    await setDoc(userDocRef, profile);
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
        
        // CHECK 1: If account is disabled, force logout immediately
        if (latestData.status === "disabled") {
          toast.error("Account Access Revoked: Your account has been disabled. Please contact administration.");
          firebaseSignOut(auth);
          return;
        }

        // We moved the session ID check to the distinct RTDB listener below.

        setUserProfile(prev => {
          if (!prev) return null;
          const updatedProfile = {
            ...prev,
            status: latestData.status || "active",
            walletBalance: latestData.balance !== undefined ? latestData.balance : prev.walletBalance,
            name: latestData.name || prev.name,
            activeSessionId: latestData.activeSessionId
          };
          offlineStorage.saveProfile(updatedProfile);
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
      
      if (currentUser) {
        try {
          const email = currentUser.email?.toLowerCase().trim();
          if (!email) {
            await firebaseSignOut(auth);
            setLoading(false);
            return;
          }

          // --- Domain Restriction ---
          const isVITEmail = email.endsWith("@vitstudent.ac.in");
          
          if (!isVITEmail) {
            console.error("Unauthorized Domain Access Blocked:", email);
            toast.error("Access restricted to @vitstudent.ac.in accounts.");
            await firebaseSignOut(auth);
            setUser(null);
            setUserProfile(null);
            setLoading(false);
            return;
          }

          setUser(currentUser);

          // Claim session and start watching for collisions
          await claimSession(currentUser.uid);
          await new Promise(resolve => setTimeout(resolve, 500));
          sessionListenerRef.current = watchSessionCollision(currentUser.uid, () => {
            toast.error("Security Alert: Logged in from another device.");
            firebaseSignOut(auth);
          });

          // Fetch the user's profile document
          const userDocRef = doc(db, "users", currentUser.uid);
          let userDocSnap = await getDoc(userDocRef);

          let currentProfile: UserProfile | null = userDocSnap.exists() ? (userDocSnap.data() as UserProfile) : null;
          let studentData: any = null;
          let regNo: string | null = currentProfile?.rollNo || null;

          // 1. If we don't have a rollNo yet, try to find the student in the registry
          if (!regNo || regNo === "UNREGISTERED") {
            const registeredDocRef = doc(db, "registered_students", email);
            const registeredDocSnap = await getDoc(registeredDocRef);
            if (registeredDocSnap.exists()) {
              regNo = registeredDocSnap.data().regNo;
            } else {
              // Fallback: Search students by email
              const studentsRef = collection(db, "students");
              const q = query(studentsRef, where("email", "==", email));
              const querySnapshot = await getDocs(q);
              if (!querySnapshot.empty) {
                regNo = querySnapshot.docs[0].data().regNo;
              }
            }
          }

          // 2. Fetch the latest data from the master 'students' collection if regNo is known
          if (regNo && regNo !== "UNREGISTERED") {
            const profile = await buildRegisteredProfile(currentUser, email, regNo);
            if (profile) {
              setUserProfile(profile);
              offlineStorage.saveProfile(profile);
              startStatusWatcher(regNo);
              setLoading(false);
              return; // Done — registered student
            }
          }

          // 3. If we reach here, the student is currently unregistered
          if (currentProfile && currentProfile.isRegistered) {
            // Edge case: had a profile marked registered but student record is gone
            setUserProfile(currentProfile);
            if (currentProfile.rollNo !== "UNREGISTERED") {
              startStatusWatcher(currentProfile.rollNo);
            }
          } else {
            // UNREGISTERED GUEST
            const guestProfile: UserProfile = {
              uid: currentUser.uid,
              email: email,
              name: currentUser.displayName || "Guest Student",
              rollNo: "UNREGISTERED",
              walletBalance: 0,
              isRegistered: false,
              status: "pending",
              photoURL: currentUser.photoURL || undefined,
              createdAt: currentProfile?.createdAt || new Date().toISOString()
            };
            await setDoc(userDocRef, guestProfile);
            setUserProfile(guestProfile);

            // ──────────────────────────────────────────────────────────
            // REGISTRATION WATCHER: Listen for admin to register this
            // student in real-time. When the doc appears/updates,
            // automatically upgrade the profile.
            // ──────────────────────────────────────────────────────────
            const regDocRef = doc(db, "registered_students", email);
            registrationListenerRef.current = onSnapshot(regDocRef, async (snap) => {
              if (snap.exists()) {
                const newRegNo = snap.data().regNo;
                if (newRegNo) {
                  try {
                    const upgraded = await buildRegisteredProfile(currentUser, email, newRegNo);
                    if (upgraded) {
                      setUserProfile(upgraded);
                      startStatusWatcher(newRegNo); // START WATCHER HERE TOO
                      toast.success("Your account has been activated! Welcome to Messfloww.");
                    }
                  } catch (err) {
                    console.error("Error upgrading profile from registration watcher:", err);
                  }
                  // Once registered, stop watching registration, but status watcher continues
                  if (registrationListenerRef.current) {
                    registrationListenerRef.current();
                    registrationListenerRef.current = null;
                  }
                }
              }
            });
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return () => {
      unsubscribe();
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
    <AuthContext.Provider value={{ user, userProfile, loading, logout, updateUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
