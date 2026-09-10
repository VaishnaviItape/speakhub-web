import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Search, Sun, Moon, X, ArrowRight, CornerDownLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSidebarSearch } from '../../contexts/SidebarSearchContext';
import { MENU_GROUPS, type MenuItem } from './menuConfig';
import './Header.css';

interface MatchedMenuItem extends MenuItem {
  groupTitle: string;
}

const Header: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { searchTerm, setSearchTerm, clearSearch } = useSidebarSearch();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  // Keyboard shortcut Ctrl+K or / to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsDropdownOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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

  // Filter matching menu items
  const searchResults: MatchedMenuItem[] = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return [];

    const results: MatchedMenuItem[] = [];

    MENU_GROUPS.forEach((group) => {
      if (group.adminOnly && !isAdmin) return;

      group.items.forEach((item) => {
        if (item.adminOnly && !isAdmin) return;

        const titleMatch = item.title.toLowerCase().includes(query);
        const keywordMatch = item.keywords?.some((k) => k.toLowerCase().includes(query));
        const groupMatch = group.title.toLowerCase().includes(query);
        const descMatch = item.description?.toLowerCase().includes(query);

        if (titleMatch || keywordMatch || groupMatch || descMatch) {
          results.push({
            ...item,
            groupTitle: group.title,
          });
        }
      });
    });

    return results;
  }, [searchTerm, isAdmin]);

  // Handle keyboard navigation inside search input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isDropdownOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setIsDropdownOpen(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(searchResults.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev <= 0 ? searchResults.length - 1 : prev - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults.length > 0 && searchResults[selectedIndex]) {
        handleSelectMenu(searchResults[selectedIndex].path);
      }
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleSelectMenu = (path: string) => {
    navigate(path);
    setIsDropdownOpen(false);
  };

  const handleClear = () => {
    clearSearch();
    setIsDropdownOpen(false);
    inputRef.current?.focus();
  };

  const userName = user?.name || user?.email || 'User';
  const userRole = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Admin';
  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=f59e0b&color=fff`;

  return (
    <header className="header">
      <div className="header-left">
        <button className="menu-btn" title="Toggle Menu">
          <Menu size={20} className="text-muted" />
        </button>

        {/* Global Search Bar */}
        <div className="search-bar-wrapper" ref={searchContainerRef}>
          <div className={`search-bar ${isDropdownOpen && searchTerm ? 'search-bar-active' : ''}`}>
            <Search size={16} className="text-muted search-icon" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search sidebar menus... (Ctrl+K)"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSelectedIndex(0);
                setIsDropdownOpen(true);
              }}
              onFocus={() => {
                if (searchTerm.trim()) {
                  setIsDropdownOpen(true);
                }
              }}
              onKeyDown={handleKeyDown}
            />
            {searchTerm ? (
              <button
                type="button"
                className="search-clear-btn"
                onClick={handleClear}
                title="Clear search"
              >
                <X size={14} />
              </button>
            ) : (
              <span className="search-shortcut">⌘K</span>
            )}
          </div>

          {/* Search Dropdown Results */}
          {isDropdownOpen && searchTerm.trim() && (
            <div className="search-results-dropdown">
              <div className="search-dropdown-header">
                <span className="search-dropdown-title">
                  Sidebar Menus ({searchResults.length})
                </span>
                <span className="search-dropdown-hint">Press ↵ to navigate</span>
              </div>

              {searchResults.length > 0 ? (
                <div className="search-results-list">
                  {searchResults.map((item, index) => {
                    const IconComponent = item.icon;
                    const isSelected = index === selectedIndex;
                    return (
                      <div
                        key={item.id}
                        className={`search-result-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleSelectMenu(item.path)}
                        onMouseEnter={() => setSelectedIndex(index)}
                      >
                        <div className="result-icon-box">
                          <IconComponent size={18} />
                        </div>
                        <div className="result-info">
                          <div className="result-title-row">
                            <span className="result-title">{item.title}</span>
                            <span className="result-group-badge">{item.groupTitle}</span>
                          </div>
                          {item.description && (
                            <span className="result-description">{item.description}</span>
                          )}
                        </div>
                        <div className="result-arrow">
                          {isSelected ? (
                            <CornerDownLeft size={14} className="result-action-icon" />
                          ) : (
                            <ArrowRight size={14} className="result-action-icon" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="search-no-results">
                  <p>No menus matching "{searchTerm}"</p>
                  <span>Try searching for "Dashboard", "Fees", "Homework", "Exams"...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="header-right">
        <button className="icon-btn" onClick={toggleDarkMode} title="Toggle theme">
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
