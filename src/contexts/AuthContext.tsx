import React, { createContext, useContext, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface User {
  id: string;
  mobile: string;
  name: string;
  role: 'admin' | 'teacher' | 'student';
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  sendOtp: (mobile: string) => Promise<boolean>;
  verifyOtp: (otp: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [pendingMobile, setPendingMobile] = useState<string | null>(null);
  const navigate = useNavigate();

  // Mock valid mobile numbers
  const validUsers: Record<string, { user: User }> = {
    '1234567890': {
      user: { id: '1', mobile: '1234567890', name: 'Admin User', role: 'admin' }
    },
    '9876543210': {
      user: { id: '2', mobile: '9876543210', name: 'Teacher User', role: 'teacher' }
    },
    '5555555555': {
      user: { id: '3', mobile: '5555555555', name: 'Student User', role: 'student' }
    }
  };

  const sendOtp = async (mobile: string): Promise<boolean> => {
    // In production, this will use firebase.auth().signInWithPhoneNumber
    return new Promise((resolve) => {
      setTimeout(() => {
        const userEntry = validUsers[mobile];
        if (userEntry) {
          setPendingMobile(mobile);
          // For demo, we assume OTP is sent. The mock OTP will be "123456".
          console.log(`Mock OTP '123456' sent to ${mobile}`);
          resolve(true);
        } else {
          resolve(false);
        }
      }, 1000);
    });
  };

  const verifyOtp = async (otp: string): Promise<boolean> => {
    // In production, this will use confirmationResult.confirm(otp)
    return new Promise((resolve) => {
      setTimeout(() => {
        if (otp === '123456' && pendingMobile) {
          const userEntry = validUsers[pendingMobile];
          if (userEntry) {
            setUser(userEntry.user);
            setPendingMobile(null);
            resolve(true);
          } else {
            resolve(false);
          }
        } else {
          resolve(false);
        }
      }, 1000);
    });
  };

  const logout = () => {
    setUser(null);
    setPendingMobile(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, sendOtp, verifyOtp, logout }}>
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
