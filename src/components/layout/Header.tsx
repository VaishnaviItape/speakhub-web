import React, { useState, useEffect } from 'react';
import { Menu, Search, Sun, Moon, ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import './Header.css';
const Header: React.FC = () => {
  const { user } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Check local storage or system preference on mount
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    
    if (newMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  };
  
  const userName = user?.name || user?.email || 'User';
  const userRole = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Admin';
  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=f59e0b&color=fff`;
  return (
    <header className="header">
      <div className="header-left">
        <button className="menu-btn">
          <Menu size={20} className="text-muted" />
        </button>
        <div className="search-bar">
          <Search size={16} className="text-muted" />
          <input type="text" placeholder="Search anything's" />
        </div>
      </div>
      
      <div className="header-right">
        <button className="icon-btn" onClick={toggleDarkMode}>
          {isDarkMode ? <Sun size={20} className="text-muted" /> : <Moon size={20} className="text-muted" />}
        </button>
        <div className="divider"></div>
        
        <div className="user-profile">
          <div className="user-info text-right">
            <span className="user-name">{userName}</span>
            <span className="user-role">{userRole}</span>
          </div>
          <div className="user-avatar">
            <img src={avatarUrl} alt="User" />
            <span className="online-indicator"></span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
