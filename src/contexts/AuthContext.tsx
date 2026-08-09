import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../config/firebase';
import { signInWithEmailAndPassword, signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';

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

      if (snapshot.empty && uid) {
        const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', uid)));
        if (!userDoc.empty) {
          snapshot = userDoc;
        }
      }
      
      if (!snapshot.empty) {
        const docSnap = snapshot.docs[0];
        const data = docSnap.data();
        
        setUser({
          id: docSnap.id,
          email: data.email,
          phone: data.phone || data.mobile,
          address: data.address,
          name: data.name || data.firstName || 'User',
          role: data.role || 'student',
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

  const loginWithEmail = async (identifier: string, password: string) => {
    try {
      let authCredentialEmail = identifier.trim();
      if (!authCredentialEmail.includes('@')) {
        const cleanPhone = authCredentialEmail.replace(/[^0-9]/g, '');
        authCredentialEmail = `${cleanPhone}@speakhub.com`;
      }

      await signInWithEmailAndPassword(auth, authCredentialEmail, password);
      
      let q = query(collection(db, 'users'), where('email', '==', identifier));
      let snapshot = await getDocs(q);

      if (snapshot.empty) {
        q = query(collection(db, 'users'), where('phone', '==', identifier));
        snapshot = await getDocs(q);
      }

      if (snapshot.empty) {
        const cleanPhone = identifier.replace(/[^0-9]/g, '');
        q = query(collection(db, 'users'), where('mobile', '==', cleanPhone));
        snapshot = await getDocs(q);
      }
      
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        return { success: true, forcePasswordChange: data.forcePasswordChange };
      }
      return { success: true, forcePasswordChange: false };
    } catch (error: any) {
      return { success: false, error: error.message };
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
