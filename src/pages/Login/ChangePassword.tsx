import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Lock, AlertCircle } from 'lucide-react';
import { auth, db } from '../../config/firebase';
import { updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import './Login.css';

const ChangePassword: React.FC = () => {
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (!auth.currentUser || !user) {
      setError("You must be logged in to change your password.");
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      await updatePassword(auth.currentUser, newPassword);
      
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, { forcePasswordChange: false });

      navigate('/dashboard');
    } catch (err: any) {
      setError('Failed to update password. You may need to log out and log back in.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo-container">
            <Lock size={32} color="#4f46e5" />
          </div>
          <h1 className="login-title">Update Password</h1>
          <p className="login-subtitle">For security reasons, you must change your default password before continuing.</p>
        </div>

        {error && (
          <div className="login-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword}>
          <div className="login-form-group">
            <label className="login-form-label" htmlFor="newPassword">New Password</label>
            <div className="login-input-wrapper">
              <KeyRound className="login-input-icon" />
              <input
                id="newPassword"
                type="password"
                className="login-input"
                placeholder="Enter new password (min 6 chars)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="login-button"
            disabled={isLoading || newPassword.length < 6}
          >
            {isLoading ? (
              <span className="loader">Updating...</span>
            ) : (
              'Update Password'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePassword;
