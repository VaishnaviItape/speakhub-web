import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users,
  Shield,
  BookOpen,
  GraduationCap,
  Briefcase,
  BookMarked,
  FileText,
  Calendar,
  PenTool,
  HelpCircle,
  CreditCard,
  LogOut,
  BarChart3
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import './Sidebar.css';

const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-container">
          <img src="/logo.png" alt="Speak Hub Logo" className="logo-img" />
          <span className="logo-text">Speak Hub</span>
        </div>
      </div>

      <div className="sidebar-nav-container">
        <div className="nav-group">
          <span className="nav-group-title">MAIN</span>
          <nav className="nav-menu">
            <NavLink to="/dashboard" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </NavLink>
          </nav>
        </div>

        <div className="nav-group">
          <span className="nav-group-title">ACADEMICS</span>
          <nav className="nav-menu">
            <NavLink to="/courses" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <BookOpen size={18} />
              <span>Courses</span>
            </NavLink>
            <NavLink to="/subjects" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <BookMarked size={18} />
              <span>Subjects</span>
            </NavLink>
            <NavLink to="/batches" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <Calendar size={18} />
              <span>Batches</span>
            </NavLink>
          </nav>
        </div>
        
        <div className="nav-group">
          <span className="nav-group-title">USERS</span>
          <nav className="nav-menu">
            <NavLink to="/students" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <GraduationCap size={18} />
              <span>Students</span>
            </NavLink>
            {isAdmin && (
              <>
                <NavLink to="/teachers" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                  <Briefcase size={18} />
                  <span>Teachers</span>
                </NavLink>
                <NavLink to="/users" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                  <Users size={18} />
                  <span>All Users</span>
                </NavLink>
                <NavLink to="/settings/roles" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                  <Shield size={18} />
                  <span>Roles</span>
                </NavLink>
              </>
            )}
          </nav>
        </div>

        <div className="nav-group">
          <span className="nav-group-title">RESOURCES & EXAMS</span>
          <nav className="nav-menu">
            <NavLink to="/notes" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <FileText size={18} />
              <span>Notes</span>
            </NavLink>
            <NavLink to="/homework" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <PenTool size={18} />
              <span>Homework</span>
            </NavLink>
            <NavLink to="/exams" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <FileText size={18} />
              <span>Exams</span>
            </NavLink>
          </nav>
        </div>

        {isAdmin && (
          <div className="nav-group">
            <span className="nav-group-title">FINANCE</span>
            <nav className="nav-menu">
              <NavLink to="/fees/plans" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                <FileText size={18} />
                <span>Fee Plans</span>
              </NavLink>
              <NavLink to="/fees" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                <CreditCard size={18} />
                <span>Fees Collection</span>
              </NavLink>
              <NavLink to="/fees/reports" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                <FileText size={18} />
                <span>Fee Reports</span>
              </NavLink>
            </nav>
          </div>
        )}

        {isAdmin && (
          <div className="nav-group">
            <span className="nav-group-title">ANALYTICS</span>
            <nav className="nav-menu">
              <NavLink to="/reports" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
                <BarChart3 size={18} />
                <span>Reports Center</span>
              </NavLink>
            </nav>
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
