import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, AlertCircle, Eye, EyeOff, CheckCircle2, ShieldCheck, LogOut } from 'lucide-react';
import { auth, db } from '../../config/firebase';
import { updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import logo from '../../assets/logo.png';
import './Login.css';

const ChangePassword: React.FC = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
      setError('Please fill in both password fields.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    if (!auth.currentUser) {
      setError('Session expired. Please log in again.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      await updatePassword(auth.currentUser, newPassword);
      
      // Update forcePasswordChange flag in Firestore
      if (user?.id) {
        try {
          await updateDoc(doc(db, 'users', user.id), { forcePasswordChange: false });
        } catch (docErr) {
          console.warn('Could not update document by user.id:', docErr);
        }
      }
      if (auth.currentUser.uid && auth.currentUser.uid !== user?.id) {
        try {
          await updateDoc(doc(db, 'users', auth.currentUser.uid), { forcePasswordChange: false });
        } catch (_) {}
      }

      navigate('/dashboard');
    } catch (err: any) {
      console.error('Password update error:', err);
      if (err.code === 'auth/requires-recent-login') {
        setError('For security, please log out and log back in before changing your password.');
      } else {
        setError(err.message || 'Failed to update password. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        {/* Brand Header */}
        <div className="login-header">
          <div className="login-brand">
            <img src={logo} alt="Speak Hub Academy" className="login-logo-img" />
            <span className="login-brand-name">Speak Hub Academy</span>
          </div>

          <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
            <div className="login-security-badge">
              <ShieldCheck size={26} />
            </div>
            <h1 className="login-title">Update Password</h1>
            <p className="login-subtitle">
              For security reasons, you must set a new password before continuing.
            </p>
          </div>
        </div>

        {error && (
          <div className="login-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="login-form">
          {/* New Password */}
          <div className="login-field">
            <label className="login-label" htmlFor="newPassword">
              New Password
            </label>
            <div className="login-input-box">
              <Lock className="login-icon" size={17} />
              <input
                id="newPassword"
                type={showPassword ? 'text' : 'password'}
                className="login-input login-input-password"
                placeholder="Enter new password (min 6 chars)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
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
            <p className="login-hint-text">Minimum 6 characters</p>
          </div>

          {/* Confirm New Password */}
          <div className="login-field">
            <label className="login-label" htmlFor="confirmPassword">
              Confirm New Password
            </label>
            <div className="login-input-box">
              <Lock className="login-icon" size={17} />
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                className="login-input login-input-password"
                placeholder="Re-enter your new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="login-eye-btn"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex={-1}
                aria-label="Toggle confirm password visibility"
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="login-submit-btn"
            disabled={isLoading || newPassword.length < 6 || !confirmPassword}
          >
            {isLoading ? (
              <span className="login-spinner" />
            ) : (
              <>
                <CheckCircle2 size={16} />
                <span>Save & Continue</span>
              </>
            )}
          </button>

          <button 
            type="button" 
            className="login-cancel-btn"
            onClick={logout}
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;

