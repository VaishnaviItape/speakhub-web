import React from 'react';
import './forms.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input: React.FC<InputProps> = ({ label, error, className = '', ...props }) => {
  return (
    <div className={`form-group ${className}`}>
      {label && <label className="form-label">{label}</label>}
      <input className={`form-input ${error ? 'border-red-500' : ''}`} {...props} />
      {error && <span className="form-error">{error}</span>}
    </div>
  );
};

export default Input;
