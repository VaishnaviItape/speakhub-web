import React from 'react';
import { Menu, Search, Sun, MessageSquare, Bell, Calendar, ChevronDown } from 'lucide-react';
import './Header.css';

const Header: React.FC = () => {
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
        <button className="icon-btn">
          <Sun size={20} className="text-muted" />
        </button>
        <div className="divider"></div>
        <button className="icon-btn relative">
          <MessageSquare size={20} className="text-muted" />
          <span className="badge">2</span>
        </button>
        <button className="icon-btn relative">
          <Bell size={20} className="text-muted" />
        </button>
        <button className="icon-btn">
          <Calendar size={20} className="text-muted" />
        </button>
        
        <div className="user-profile">
          <div className="user-info">
            <span className="user-name">Robert Brown</span>
            <span className="user-role">Manager <ChevronDown size={14} className="inline" /></span>
          </div>
          <div className="user-avatar">
            <img src="https://ui-avatars.com/api/?name=Robert+Brown&background=f59e0b&color=fff" alt="User" />
            <span className="online-indicator"></span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
