import React, { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { LogOut, Search, X, SearchX } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSidebarSearch } from '../../contexts/SidebarSearchContext';
import { MENU_GROUPS } from './menuConfig';
import logo from '../../assets/logo.png';
import './Sidebar.css';

const highlightMatch = (text: string, query: string) => {
  if (!query.trim()) return text;
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return text;
  return (
    <>
      {text.substring(0, index)}
      <mark className="sidebar-search-highlight">{text.substring(index, index + query.length)}</mark>
      {text.substring(index + query.length)}
    </>
  );
};

const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const { searchTerm, setSearchTerm, clearSearch } = useSidebarSearch();
  const isAdmin = user?.role === 'admin';

  // Filter menu groups and items based on search term & permissions
  const filteredGroups = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return MENU_GROUPS.map((group) => {
      if (group.adminOnly && !isAdmin) return null;

      const visibleItems = group.items.filter((item) => {
        if (item.adminOnly && !isAdmin) return false;
        if (!query) return true;

        const titleMatch = item.title.toLowerCase().includes(query);
        const keywordMatch = item.keywords?.some((k) => k.toLowerCase().includes(query));
        const groupMatch = group.title.toLowerCase().includes(query);
        const descMatch = item.description?.toLowerCase().includes(query);

        return titleMatch || keywordMatch || groupMatch || descMatch;
      });

      if (visibleItems.length === 0) return null;

      return {
        ...group,
        items: visibleItems,
      };
    }).filter((g): g is NonNullable<typeof g> => g !== null);
  }, [searchTerm, isAdmin]);

  const totalMatchingItems = useMemo(() => {
    return filteredGroups.reduce((acc, g) => acc + g.items.length, 0);
  }, [filteredGroups]);

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-container">
          <img src={logo} alt="Speak Hub Logo" className="logo-img" />
          <span className="logo-text">Speak Hub</span>
        </div>
      </div>

      {/* In-Sidebar Search Filter */}
      <div className="sidebar-search-container">
        <div className="sidebar-search-box">
          <Search size={15} className="sidebar-search-icon" />
          <input
            type="text"
            placeholder="Search menus..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm ? (
            <button
              type="button"
              className="sidebar-search-clear"
              onClick={clearSearch}
              title="Clear filter"
            >
              <X size={13} />
            </button>
          ) : null}
        </div>
        {searchTerm ? (
          <div className="sidebar-search-status">
            <span>
              {totalMatchingItems} {totalMatchingItems === 1 ? 'menu' : 'menus'} found
            </span>
            <button type="button" onClick={clearSearch}>
              Reset
            </button>
          </div>
        ) : null}
      </div>

      <div className="sidebar-nav-container">
        {filteredGroups.length > 0 ? (
          filteredGroups.map((group) => (
            <div key={group.title} className="nav-group">
              <span className="nav-group-title">{group.title}</span>
              <nav className="nav-menu">
                {group.items.map((item) => {
                  const IconComponent = item.icon;
                  return (
                    <NavLink
                      key={item.id}
                      to={item.path}
                      className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    >
                      <IconComponent size={18} />
                      <span>{highlightMatch(item.title, searchTerm)}</span>
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          ))
        ) : (
          <div className="sidebar-empty-search">
            <SearchX size={28} className="sidebar-empty-icon" />
            <p className="sidebar-empty-title">No menus found</p>
            <span className="sidebar-empty-desc">No matches for "{searchTerm}"</span>
            <button type="button" className="sidebar-empty-btn" onClick={clearSearch}>
              Show All Menus
            </button>
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        <button 
          onClick={logout}
          className="btn w-full flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 border border-red-200"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
