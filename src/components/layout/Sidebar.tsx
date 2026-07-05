import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Layers, 
  Puzzle, 
  Type, 
  FormInput, 
  Table2, 
  PieChart, 
  HelpCircle,
  Users,
  Shield
} from 'lucide-react';
import './Sidebar.css';

const Sidebar: React.FC = () => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-container">
          <div className="logo-icon"></div>
          <span className="logo-text">GXON</span>
        </div>
      </div>

      <div className="sidebar-nav-container">
        <div className="nav-group">
          <span className="nav-group-title">MASTERS</span>
          <nav className="nav-menu">
            <NavLink to="/dashboard" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </NavLink>
            <NavLink to="/employees" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <Users size={18} />
              <span>Employees</span>
            </NavLink>
            <NavLink to="/settings/roles" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <Shield size={18} />
              <span>Roles Master</span>
            </NavLink>
          </nav>
        </div>

        <div className="nav-group">
          <span className="nav-group-title">COMPONENTS</span>
          <nav className="nav-menu">
            <NavLink to="/extended" className="nav-item">
              <Layers size={18} />
              <span>Extended UI</span>
            </NavLink>
            <NavLink to="/icons" className="nav-item">
              <Type size={18} />
              <span>Icons</span>
            </NavLink>
          </nav>
        </div>

        <div className="nav-group">
          <span className="nav-group-title">FORMS & TABLES</span>
          <nav className="nav-menu">
            <NavLink to="/forms" className="nav-item">
              <FormInput size={18} />
              <span>Form Elements</span>
            </NavLink>
            <NavLink to="/tables" className="nav-item">
              <Table2 size={18} />
              <span>Table</span>
            </NavLink>
          </nav>
        </div>

        <div className="nav-group">
          <span className="nav-group-title">CHARTS & MAPS</span>
          <nav className="nav-menu">
            <NavLink to="/charts" className="nav-item">
              <PieChart size={18} />
              <span>Charts</span>
            </NavLink>
          </nav>
        </div>
      </div>

      <div className="sidebar-footer">
        <button className="btn btn-outline w-full help-btn">
          <HelpCircle size={18} />
          Help and Support
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
