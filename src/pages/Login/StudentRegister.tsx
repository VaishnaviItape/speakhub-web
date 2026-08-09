import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Phone, Mail, KeyRound, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, addDoc, collection } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import logo from '../../assets/logo.png';
import './Login.css';

const StudentRegister: React.FC = () => {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanMobile = mobile.replace(/[^0-9]/g, '');
    if (cleanMobile.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      // Formulate Auth Email alias if no email provided
      const authEmail = email.trim() ? email.trim() : `${cleanMobile}@speakhub.com`;
      
      // Create user credential in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, authEmail, password);
      const uid = userCredential.user.uid;

      const now = new Date();
      const demoDays = 7;
      const demoEndDate = new Date(now.getTime() + demoDays * 24 * 60 * 60 * 1000);

      // 1. Create document in `users` collection
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, {
        uid,
        name: name.trim(),
        mobile: cleanMobile,
        phone: cleanMobile,
        email: authEmail,
        role: 'student',
        status: 'active',
        isDemoMode: true,
        demoStartDate: now,
        demoEndDate: demoEndDate,
        demoDays: demoDays,
        batchIds: [],
        createdAt: now,
        updatedAt: now
      });

      // 2. Create document in `students` collection
      const studentCode = `STU-${Math.floor(100000 + Math.random() * 900000)}`;
      await addDoc(collection(db, 'students'), {
        studentCode,
        userId: uid,
        firstName: name.trim(),
        lastName: '',
        phone: cleanMobile,
        courseIds: [],
        batchIds: [],
        joiningDate: now,
        status: 'active'
      });

      // Navigate to student portal
      navigate('/student/dashboard');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This mobile number or email is already registered. Please sign in.');
      } else {
        setError(err.message || 'Failed to register. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card" style={{ maxWidth: '440px' }}>
        <div className="login-header">
          <div className="login-logo-container">
            <img src={logo} alt="Speak Hub Logo" className="login-logo-img" />
            <span className="login-logo-text">Speak Hub Academy</span>
          </div>
          <h1 className="login-title">Student Registration</h1>
          <p className="login-subtitle">Sign up to get 7 days free demo access</p>
        </div>

        {error && (
          <div className="login-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleRegister}>
          <div className="login-form-group">
            <label className="login-form-label">Full Name *</label>
            <div className="login-input-wrapper">
              <User className="login-input-icon" />
              <input
                type="text"
                className="login-input"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="login-form-group">
            <label className="login-form-label">Mobile Number (Used for Login) *</label>
            <div className="login-input-wrapper">
              <Phone className="login-input-icon" />
              <input
                type="tel"
                className="login-input"
                placeholder="10-digit mobile number"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                maxLength={10}
                required
              />
            </div>
          </div>

          <div className="login-form-group">
            <label className="login-form-label">Email Address (Optional)</label>
            <div className="login-input-wrapper">
              <Mail className="login-input-icon" />
              <input
                type="email"
                className="login-input"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="login-form-group">
            <label className="login-form-label">Set Password *</label>
            <div className="login-input-wrapper">
              <KeyRound className="login-input-icon" />
              <input
                type="password"
                className="login-input"
                placeholder="Create a password (min 6 chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="login-form-group">
            <label className="login-form-label">Confirm Password *</label>
            <div className="login-input-wrapper">
              <KeyRound className="login-input-icon" />
              <input
                type="password"
                className="login-input"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="login-button"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="loader">Creating Account...</span>
            ) : (
              <>
                <CheckCircle2 size={20} />
                Register & Start Demo
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <Link to="/login" style={{ color: 'var(--primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
            <ArrowLeft size={16} /> Already have an account? Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default StudentRegister;
