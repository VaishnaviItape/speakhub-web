import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Phone, KeyRound, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import logo from '../../assets/logo.png';
import './Login.css';

const Login: React.FC = () => {
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { loginWithEmail } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobile.trim() || !password) {
      setError('Please enter your mobile number and password.');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const result = await loginWithEmail(mobile.trim(), password);
      
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
            <img src={logo} alt="Speak Hub Logo" className="login-logo-img" />
            <span className="login-logo-text">Speak Hub</span>
          </div>
          <h1 className="login-title">Welcome Back</h1>
          <p className="login-subtitle">Sign in with your mobile number to access your courses</p>
        </div>

        {error && (
          <div className="login-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="login-form-group">
            <label className="login-form-label" htmlFor="mobile">Mobile Number</label>
            <div className="login-input-wrapper">
              <Phone className="login-input-icon" />
              <input
                id="mobile"
                type="tel"
                className="login-input"
                placeholder="Enter 10-digit mobile number"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
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

        <div className="demo-credentials" style={{ marginTop: '20px' }}>
          <p>
            New Student?{' '}
            <Link to="/register-student" style={{ color: '#2563eb', fontWeight: 'bold', textDecoration: 'none' }}>
              Register for Free Demo Class
            </Link>
          </p>
          <p style={{ marginTop: '10px' }}>
            New deployment? <Link to="/register-admin" style={{ color: 'var(--primary)', fontWeight: 'bold', textDecoration: 'none' }}>Register an Admin Account</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
