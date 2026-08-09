import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import './forms.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input: React.FC<InputProps> = ({ label, error, className = '', type, ...props }) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className={`form-group ${className}`}>
      {label && (
        <label className="form-label">
          {label} {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div style={{ position: 'relative', width: '100%' }}>
        <input
          type={isPassword ? (showPassword ? 'text' : 'password') : type}
          className={`form-input ${error ? 'border-red-500' : ''}`}
          style={isPassword ? { paddingRight: '2.5rem' } : undefined}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0
            }}
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error && <span className="form-error">{error}</span>}
    </div>
  );
};

export default Input;
