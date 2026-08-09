import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, KeyRound, User, Phone, UserPlus, AlertCircle } from 'lucide-react';
import logo from '../../assets/logo.png';
import './Login.css';
import { auth, db } from '../../config/firebase';
import { createUserWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { setDoc, doc, serverTimestamp } from 'firebase/firestore';

const AdminSignup: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCred.user.uid;

      await setDoc(doc(db, 'users', uid), {
        uid,
        name,
        email,
        mobile,
        role: 'admin',
        status: 'active',
        forcePasswordChange: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Sign out so they are forced to log in properly (avoids data fetch race conditions)
      await firebaseSignOut(auth);

      alert("Admin account created successfully! Please log in with your new credentials.");
      navigate('/login');
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already in use.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else {
        setError('Failed to create account. ' + err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card" style={{ maxWidth: '450px' }}>
        <div className="login-header">
          <div className="login-logo-container">
            <img src={logo} alt="Speak Hub Logo" className="login-logo-img" />
            <span className="login-logo-text">Speak Hub</span>
          </div>
          <h1 className="login-title">Register Admin</h1>
          <p className="login-subtitle">Create the first Super Admin account</p>
        </div>

        {error && (
          <div className="login-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSignup}>
          <div className="login-form-group">
            <label className="login-form-label">Full Name *</label>
            <div className="login-input-wrapper">
              <User className="login-input-icon" />
              <input type="text" className="login-input" placeholder="e.g. John Doe" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          </div>

          <div className="login-form-group">
            <label className="login-form-label">Email Address *</label>
            <div className="login-input-wrapper">
              <Mail className="login-input-icon" />
              <input type="email" className="login-input" placeholder="e.g. admin@speakhub.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>

          <div className="login-form-group">
            <label className="login-form-label">Mobile Number</label>
            <div className="login-input-wrapper">
              <Phone className="login-input-icon" />
              <input type="text" className="login-input" placeholder="+1 234 567 890" value={mobile} onChange={(e) => setMobile(e.target.value)} />
            </div>
          </div>

          <div className="login-form-group">
            <label className="login-form-label">Password *</label>
            <div className="login-input-wrapper">
              <KeyRound className="login-input-icon" />
              <input type="password" className="login-input" placeholder="Min 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          </div>

          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? <span className="loader">Creating...</span> : <><UserPlus size={20} /> Create Admin</>}
          </button>
        </form>

        <div className="demo-credentials" style={{ marginTop: '20px' }}>
          <p>Already have an account? <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 'bold', textDecoration: 'none' }}>Sign In here</Link></p>
        </div>
      </div>
    </div>
  );
};

export default AdminSignup;
