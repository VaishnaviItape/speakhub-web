import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, KeyRound, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import './Login.css';

const Login: React.FC = () => {
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'mobile' | 'otp'>('mobile');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { sendOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const success = await sendOtp(mobile);
      if (success) {
        setStep('otp');
      } else {
        setError('Number not registered. Please contact admin.');
      }
    } catch (err) {
      setError('An error occurred while sending OTP. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const success = await verifyOtp(otp);
      if (success) {
        navigate('/dashboard');
      } else {
        setError('Invalid OTP. Please try again.');
      }
    } catch (err) {
      setError('An error occurred during verification. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo-container">
            <div className="login-logo-icon"></div>
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

        {step === 'mobile' ? (
          <form onSubmit={handleSendOtp}>
            <div className="login-form-group">
              <label className="login-form-label" htmlFor="mobile">Mobile Number</label>
              <div className="login-input-wrapper">
                <Phone className="login-input-icon" />
                <input
                  id="mobile"
                  type="tel"
                  className="login-input"
                  placeholder="e.g. 1234567890"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                  maxLength={10}
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="login-button"
              disabled={isLoading || mobile.length < 10}
            >
              {isLoading ? (
                <span className="loader">Sending OTP...</span>
              ) : (
                <>
                  <LogIn size={20} />
                  Send OTP
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp}>
            <div className="login-form-group">
              <label className="login-form-label" htmlFor="otp">Enter OTP</label>
              <div className="login-input-wrapper">
                <KeyRound className="login-input-icon" />
                <input
                  id="otp"
                  type="text"
                  className="login-input"
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  maxLength={6}
                  required
                />
              </div>
              <p style={{ fontSize: '12px', color: '#10b981', marginTop: '4px' }}>
                For demo, use OTP: 123456
              </p>
            </div>

            <button 
              type="submit" 
              className="login-button"
              disabled={isLoading || otp.length < 6}
            >
              {isLoading ? (
                <span className="loader">Verifying...</span>
              ) : (
                <>
                  <LogIn size={20} />
                  Verify & Login
                </>
              )}
            </button>
            <button 
              type="button" 
              style={{
                width: '100%', 
                background: 'transparent', 
                border: 'none', 
                color: '#64748b', 
                marginTop: '1rem',
                cursor: 'pointer'
              }}
              onClick={() => {
                setStep('mobile');
                setOtp('');
              }}
            >
              Change Mobile Number
            </button>
          </form>
        )}

        <div className="demo-credentials">
          <p>Demo Numbers:</p>
          <ul>
            <li><span>Admin:</span> <span>1234567890</span></li>
            <li><span>Teacher:</span> <span>9876543210</span></li>
            <li><span>Student:</span> <span>5555555555</span></li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Login;
