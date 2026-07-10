import React from 'react';
import { PlayCircle, FileText, Calendar, Bell } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import './StudentPortal.css';

const StudentDashboard: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="sp-container">
      <div className="sp-header">
        <div>
          <h1 className="sp-greeting">Hello, {user?.name?.split(' ')[0] || 'Student'} 👋</h1>
          <p className="sp-subtitle">Ready to learn today?</p>
        </div>
        <button className="sp-icon-btn">
          <Bell size={20} />
          <span className="sp-badge">2</span>
        </button>
      </div>

      <div className="sp-section">
        <h2 className="sp-section-title">Today's Live Class</h2>
        <div className="sp-card live-card">
          <div className="live-badge">Live Now</div>
          <h3 className="live-title">Spoken English Basics</h3>
          <p className="live-time">10:00 AM - 11:30 AM</p>
          <button className="sp-btn-primary full-width mt-4">
            <PlayCircle size={18} /> Join Class
          </button>
        </div>
      </div>

      <div className="sp-section">
        <h2 className="sp-section-title">Pending Homework</h2>
        <div className="sp-card hw-card">
          <div className="hw-icon"><FileText size={20} className="text-blue-600"/></div>
          <div className="hw-info">
            <h4>Grammar Worksheet 1</h4>
            <p>Due tomorrow</p>
          </div>
          <button className="sp-btn-outline sm">View</button>
        </div>
      </div>

      <div className="sp-section">
        <h2 className="sp-section-title">Upcoming Exams</h2>
        <div className="sp-card hw-card">
          <div className="hw-icon"><Calendar size={20} className="text-purple-600"/></div>
          <div className="hw-info">
            <h4>Mid-Term Assessment</h4>
            <p>20th July, 2026</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
