import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Home, BookOpen, PenTool, FileText, User } from 'lucide-react';
import './StudentLayout.css';

const StudentLayout: React.FC = () => {
  return (
    <div className="student-app-container">
      {/* Main Content Area */}
      <main className="student-main-content">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="student-bottom-nav">
        <NavLink to="/student/dashboard" className={({isActive}) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <Home size={24} />
          <span>Home</span>
        </NavLink>
        <NavLink to="/student/courses" className={({isActive}) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <BookOpen size={24} />
          <span>Courses</span>
        </NavLink>
        <NavLink to="/student/homework" className={({isActive}) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <PenTool size={24} />
          <span>Homework</span>
        </NavLink>
        <NavLink to="/student/exams" className={({isActive}) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <FileText size={24} />
          <span>Exams</span>
        </NavLink>
        <NavLink to="/student/profile" className={({isActive}) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <User size={24} />
          <span>Profile</span>
        </NavLink>
      </nav>
    </div>
  );
};

export default StudentLayout;
