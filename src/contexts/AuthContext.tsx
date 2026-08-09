import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../config/firebase';
import { signInWithEmailAndPassword, signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

interface User {
  id: string;
  email?: string;
  phone?: string;
  address?: string;
  name: string;
  role: 'admin' | 'teacher' | 'student';
  status: string;
  forcePasswordChange?: boolean;
  batchIds?: string[];
  isDemoMode?: boolean;
  demoStartDate?: any;
  demoEndDate?: any;
  demoDays?: number;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  loginWithEmail: (identifier: string, password: string) => Promise<{ success: boolean; forcePasswordChange?: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await fetchAndSetUserData(firebaseUser.email || '', firebaseUser.uid);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const fetchAndSetUserData = async (emailOrPhone: string, uid?: string) => {
    try {
      let data: any = null;
      let docId = uid || '';

      // 1. Direct document ID lookup in `users` collection by UID
      if (uid) {
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          data = userSnap.data();
          docId = userSnap.id;
        }
      }

      // 2. Fallback query if direct lookup did not find document
      if (!data) {
        let cleanInput = emailOrPhone.trim();
        let q = query(collection(db, 'users'), where('email', '==', cleanInput));
        let snapshot = await getDocs(q);

        if (snapshot.empty && cleanInput.includes('@speakhub.com')) {
          const rawPhone = cleanInput.replace('@speakhub.com', '');
          q = query(collection(db, 'users'), where('phone', '==', rawPhone));
          snapshot = await getDocs(q);

          if (snapshot.empty) {
            q = query(collection(db, 'users'), where('mobile', '==', rawPhone));
            snapshot = await getDocs(q);
          }
        }

        if (snapshot.empty) {
          const cleanPhone = cleanInput.replace(/[^0-9]/g, '');
          if (cleanPhone.length >= 10) {
            q = query(collection(db, 'users'), where('phone', '==', cleanPhone));
            snapshot = await getDocs(q);

            if (snapshot.empty) {
              q = query(collection(db, 'users'), where('mobile', '==', cleanPhone));
              snapshot = await getDocs(q);
            }
          }
        }

        if (!snapshot.empty) {
          const docSnap = snapshot.docs[0];
          data = docSnap.data();
          docId = docSnap.id;
        }
      }
      
      if (data) {
        // BLOCK STUDENT LOGIN ON WEB APP
        if (data.role === 'student') {
          console.warn("Student user attempted login on web app. Signing out.");
          await firebaseSignOut(auth);
          setUser(null);
          return;
        }

        setUser({
          id: docId,
          email: data.email,
          phone: data.phone || data.mobile,
          address: data.address,
          name: data.name || data.firstName || 'User',
          role: data.role || 'teacher',
          status: data.status || 'active',
          forcePasswordChange: data.forcePasswordChange,
          batchIds: data.batchIds || [],
          isDemoMode: data.isDemoMode,
          demoStartDate: data.demoStartDate,
          demoEndDate: data.demoEndDate,
          demoDays: data.demoDays
        });

        // Forced redirect logic
        if (data.forcePasswordChange && location.pathname !== '/change-password') {
          navigate('/change-password');
        }
      } else {
        console.warn("User document not found in Firestore.");
        setUser(null);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      setUser(null);
    }
  };

  const checkUserRoleAndReturn = async (uid: string) => {
    const userDocRef = doc(db, 'users', uid);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      if (userData.role === 'student') {
        await firebaseSignOut(auth);
        setUser(null);
        return {
          success: false,
          error: 'Student login is restricted to the Mobile App. Please download and log in using the Speak Hub Mobile App.'
        };
      }
      return { success: true, forcePasswordChange: userData.forcePasswordChange };
    }

    return { success: true, forcePasswordChange: false };
  };

  const loginWithEmail = async (identifier: string, password: string) => {
    try {
      const cleanInput = identifier.trim();

      // If input is an email address
      if (cleanInput.includes('@')) {
        const userCred = await signInWithEmailAndPassword(auth, cleanInput, password);
        return await checkUserRoleAndReturn(userCred.user.uid);
      }

      // Input is a mobile number
      const cleanPhone = cleanInput.replace(/[^0-9]/g, '');
      const last10 = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone;
      const aliasEmail = `${last10}@speakhub.com`;

      // Method A: Try direct sign-in with alias email
      try {
        const userCred = await signInWithEmailAndPassword(auth, aliasEmail, password);
        return await checkUserRoleAndReturn(userCred.user.uid);
      } catch (aliasErr: any) {
        // If wrong password, throw immediately
        if (aliasErr.code === 'auth/wrong-password') {
          throw aliasErr;
        }
      }

      // Method B: Search Firestore users collection for real email address linked to mobile number
      let targetEmail = '';
      try {
        const variations = [last10, `+91${last10}`, `91${last10}`, cleanPhone];
        const numVal = Number(last10);
        if (!isNaN(numVal)) variations.push(numVal as any);

        let foundDoc: any = null;
        for (const field of ['phone', 'mobile']) {
          for (const val of variations) {
            if (foundDoc) break;
            const q = query(collection(db, 'users'), where(field, '==', val));
            const snap = await getDocs(q);
            if (!snap.empty) {
              foundDoc = snap.docs[0].data();
            }
          }
        }

        if (!foundDoc && last10.length >= 10) {
          const allUsersSnap = await getDocs(collection(db, 'users'));
          allUsersSnap.forEach((uDoc) => {
            if (foundDoc) return;
            const uData = uDoc.data();
            const pStr = (uData.phone || uData.mobile || '').toString().replace(/[^0-9]/g, '');
            if (pStr.length >= 10 && pStr.slice(-10) === last10) {
              foundDoc = uData;
            }
          });
        }

        if (foundDoc && foundDoc.email) {
          targetEmail = foundDoc.email;
        }
      } catch (e) {
        console.warn("Firestore mobile search error:", e);
      }

      if (targetEmail && targetEmail !== aliasEmail) {
        const userCred = await signInWithEmailAndPassword(auth, targetEmail, password);
        return await checkUserRoleAndReturn(userCred.user.uid);
      }

      throw { code: 'auth/invalid-credential', message: 'Invalid credentials' };
    } catch (error: any) {
      if (
        error.code === 'auth/user-not-found' ||
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/invalid-credential'
      ) {
        return { success: false, error: 'Invalid mobile number/email or password. Please check your credentials.' };
      }
      return { success: false, error: error.message || 'Login failed. Please try again.' };
    }
  };

  const logout = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, loading, loginWithEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
