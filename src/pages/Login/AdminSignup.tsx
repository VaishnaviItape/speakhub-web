import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, User, Phone, UserPlus, AlertCircle, Eye, EyeOff } from 'lucide-react';
import logo from '../../assets/logo.png';
import './Login.css';
import { auth, db } from '../../config/firebase';
import { createUserWithEmailAndPassword, signOut as firebaseSignOut, deleteUser } from 'firebase/auth';
import type { User as FirebaseAuthUser } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { checkMobileExists } from '../../utils/phoneValidation';
import { validateName, validateEmail, validatePhoneNumber } from '../../utils/validation';

const AdminSignup: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const nameVal = validateName(name, 'Full Name');
    if (!nameVal.isValid) { setError(nameVal.error || ''); return; }

    const emailVal = validateEmail(email, 'Email Address');
    if (!emailVal.isValid) { setError(emailVal.error || ''); return; }

    if (mobile.trim()) {
      const mobVal = validatePhoneNumber(mobile, 'Mobile Number');
      if (!mobVal.isValid) { setError(mobVal.error || ''); return; }
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setError('');
    setIsLoading(true);

    let createdUser: FirebaseAuthUser | null = null;
    try {
      if (mobile.trim()) {
        const mobileCheck = await checkMobileExists(mobile.trim());
        if (mobileCheck.exists) {
          setError(mobileCheck.message || 'This mobile number is already registered to another user.');
          setIsLoading(false);
          return;
        }
      }

      const userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      createdUser = userCred.user;
      const uid = userCred.user.uid;

      await setDoc(doc(db, 'users', uid), {
        uid,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        mobile: mobile.trim(),
        phone: mobile.trim(),
        role: 'admin',
        status: 'active',
        forcePasswordChange: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Sign out so they log in with credentials
      await firebaseSignOut(auth);

      alert("Admin account created successfully! Please log in with your credentials.");
      navigate('/login');
    } catch (err: any) {
      if (createdUser) {
        try {
          await deleteUser(createdUser);
        } catch (cleanupErr) {
          console.error("Failed to cleanup auth user after db error", cleanupErr);
        }
      }
      
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please sign in or use another email.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else {
        setError('Failed to create account. ' + (err.message || 'Please try again.'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card" style={{ maxWidth: '400px' }}>
        {/* Brand Header */}
        <div className="login-header">
          <div className="login-brand">
            <img src={logo} alt="Speak Hub Logo" className="login-logo-img" />
            <span className="login-brand-name">Speak Hub</span>
          </div>
          <h1 className="login-title">Register Admin</h1>
          <p className="login-subtitle">Create an administrator account</p>
        </div>

        {error && (
          <div className="login-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSignup} className="login-form">
          <div className="login-field">
            <label className="login-label" htmlFor="admin-name">
              Full Name *
            </label>
            <div className="login-input-box">
              <User className="login-icon" size={17} />
              <input
                id="admin-name"
                type="text"
                className="login-input"
                placeholder="e.g. Rahul Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
            </div>
          </div>

          <div className="login-field">
            <label className="login-label" htmlFor="admin-email">
              Email Address *
            </label>
            <div className="login-input-box">
              <Mail className="login-icon" size={17} />
              <input
                id="admin-email"
                type="email"
                className="login-input"
                placeholder="admin@speakhub.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="login-field">
            <label className="login-label" htmlFor="admin-mobile">
              Mobile Number (Optional)
            </label>
            <div className="login-input-box">
              <Phone className="login-icon" size={17} />
              <input
                id="admin-mobile"
                type="tel"
                className="login-input"
                placeholder="10-digit mobile number"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                autoComplete="tel"
              />
            </div>
          </div>

          <div className="login-field">
            <label className="login-label" htmlFor="admin-password">
              Password *
            </label>
            <div className="login-input-box">
              <Lock className="login-icon" size={17} />
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                className="login-input login-input-password"
                placeholder="Create password (min 6 chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="login-eye-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="login-submit-btn" 
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="login-spinner" />
            ) : (
              <>
                <UserPlus size={16} />
                <span>Create Admin Account</span>
              </>
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>
            Already have an account?{' '}
            <Link to="/login" className="login-footer-link">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminSignup;
