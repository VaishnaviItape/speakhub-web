import React from 'react';
import { User, Calendar, CreditCard, LogOut, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import './StudentPortal.css';

const StudentProfile: React.FC = () => {
  const { user, logout } = useAuth();
  
  // Mock data to represent a parent logging in and seeing their enrolled profiles/courses
  const profiles = [
    {
      id: 'STU-001',
      name: 'John Doe',
      courses: [
        {
          name: 'Spoken English Basics',
          batch: 'Morning Batch A',
          joiningDate: '2026-06-15',
          feeStatus: 'Paid',
          nextDue: '2026-07-15'
        },
        {
          name: 'Scholar Phonics',
          batch: 'Weekend Batch',
          joiningDate: '2026-06-15',
          feeStatus: 'Pending',
          nextDue: '2026-07-10'
        }
      ]
    }
  ];

  return (
    <div className="sp-container">
      <div className="sp-header flex flex-col items-center justify-center text-center pb-6 border-b border-gray-200">
        <div className="w-24 h-24 bg-[#e0e5f2] rounded-full flex items-center justify-center mb-4 mt-8">
          <User size={48} className="text-[#4318ff]" />
        </div>
        <h1 className="text-2xl font-bold text-[#2b3674]">{user?.name}</h1>
        <p className="text-[#a3aed0]">{user?.mobile}</p>
      </div>

      <div className="sp-section mt-6">
        <h2 className="sp-section-title">My Enrolled Courses</h2>
        
        {profiles.map(profile => (
          <div key={profile.id} className="mb-6">
            <h3 className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider">{profile.name} ({profile.id})</h3>
            
            {profile.courses.map((course, idx) => (
              <div key={idx} className="sp-card mb-4 border-l-4 border-[#4318ff]">
                <h4 className="text-lg font-bold text-[#2b3674]">{course.name}</h4>
                <p className="text-sm text-gray-500 mb-3">{course.batch}</p>
                
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
                  <div>
                    <span className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                      <Calendar size={12} /> Joined
                    </span>
                    <span className="font-semibold text-sm">{course.joiningDate}</span>
                  </div>
                  <div>
                    <span className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                      <CreditCard size={12} /> Fee Due
                    </span>
                    <span className="font-semibold text-sm text-red-500">{course.nextDue}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="sp-section mt-6">
        <h2 className="sp-section-title">Settings</h2>
        <div className="sp-card !p-0 overflow-hidden">
          <button className="w-full flex items-center justify-between p-4 border-b border-gray-100 hover:bg-gray-50">
            <span className="font-medium text-[#2b3674]">Fee Payment History</span>
            <ChevronRight size={18} className="text-gray-400" />
          </button>
          <button className="w-full flex items-center justify-between p-4 border-b border-gray-100 hover:bg-gray-50">
            <span className="font-medium text-[#2b3674]">Edit Profile</span>
            <ChevronRight size={18} className="text-gray-400" />
          </button>
          <button 
            onClick={logout}
            className="w-full flex items-center justify-between p-4 hover:bg-red-50 text-red-500"
          >
            <span className="font-medium flex items-center gap-2"><LogOut size={18} /> Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentProfile;
