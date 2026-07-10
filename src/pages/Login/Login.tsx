import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, KeyRound, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import './Login.css';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { loginWithEmail } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const result = await loginWithEmail(email, password);
      
      if (result.success) {
        if (result.forcePasswordChange) {
          navigate('/change-password');
        } else {
          navigate('/dashboard');
        }
      } else {
        setError(result.error || 'Failed to login. Please check your credentials.');
      }
    } catch (err: any) {
      setError('An error occurred during login. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo-container">
            <img src="/logo.png" alt="Speak Hub Logo" className="login-logo-img" />
            <span className="login-logo-text">Speak Hub</span>
          </div>
          <h1 className="login-title">Welcome</h1>
          <p className="login-subtitle">Sign in to access your dashboard</p>
        </div>

        {error && (
          <div className="login-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="login-form-group">
            <label className="login-form-label" htmlFor="email">Email Address</label>
            <div className="login-input-wrapper">
              <Mail className="login-input-icon" />
              <input
                id="email"
                type="email"
                className="login-input"
                placeholder="e.g. admin@speakhub.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="login-form-group">
            <label className="login-form-label" htmlFor="password">Password</label>
            <div className="login-input-wrapper">
              <KeyRound className="login-input-icon" />
              <input
                id="password"
                type="password"
                className="login-input"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              <span className="loader">Logging in...</span>
            ) : (
              <>
                <LogIn size={20} />
                Sign In
              </>
            )}
          </button>
        </form>

        <div className="demo-credentials">
          <p>Login with your Firebase Auth Credentials.</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
