import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Users, GraduationCap, BookOpen, CalendarDays } from 'lucide-react';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    students: 0,
    teachers: 0,
    courses: 0,
    batches: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        setIsLoading(true);

        // Fetch Total Students
        const studentsQuery = query(collection(db, 'users'), where('role', '==', 'student'));
        const studentsSnapshot = await getDocs(studentsQuery);
        const totalStudents = studentsSnapshot.size;

        // Fetch Total Teachers
        const teachersQuery = query(collection(db, 'users'), where('role', '==', 'teacher'));
        const teachersSnapshot = await getDocs(teachersQuery);
        const totalTeachers = teachersSnapshot.size;

        // Fetch Active Courses
        const coursesQuery = query(collection(db, 'courses'), where('status', '==', 'active'));
        const coursesSnapshot = await getDocs(coursesQuery);
        const activeCourses = coursesSnapshot.size;

        // Fetch Active Batches
        const batchesQuery = query(collection(db, 'batches'), where('status', '==', 'active'));
        const batchesSnapshot = await getDocs(batchesQuery);
        const activeBatches = batchesSnapshot.size;

        setStats({
          students: totalStudents,
          teachers: totalTeachers,
          courses: activeCourses,
          batches: activeBatches,
        });
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardStats();
  }, []);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Speak Hub Academy Overview</h1>
          <div className="breadcrumbs">
            <span>Dashboard</span> <span className="separator">/</span> <span className="current">Overview</span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="dashboard-stats-grid">
          {/* Students Card */}
          <div className="stat-card">
            <div className="stat-icon-wrapper bg-blue-100 text-blue-600">
              <GraduationCap size={28} />
            </div>
            <div className="stat-content">
              <h3 className="stat-title">Total Students</h3>
              <h2 className="stat-value">{stats.students}</h2>
              <p className="stat-desc">Registered students</p>
            </div>
          </div>

          {/* Teachers Card */}
          <div className="stat-card">
            <div className="stat-icon-wrapper bg-green-100 text-green-600">
              <Users size={28} />
            </div>
            <div className="stat-content">
              <h3 className="stat-title">Total Teachers</h3>
              <h2 className="stat-value">{stats.teachers}</h2>
              <p className="stat-desc">Active instructors</p>
            </div>
          </div>

          {/* Courses Card */}
          <div className="stat-card">
            <div className="stat-icon-wrapper bg-purple-100 text-purple-600">
              <BookOpen size={28} />
            </div>
            <div className="stat-content">
              <h3 className="stat-title">Active Courses</h3>
              <h2 className="stat-value">{stats.courses}</h2>
              <p className="stat-desc">Published curriculum</p>
            </div>
          </div>

          {/* Batches Card */}
          <div className="stat-card">
            <div className="stat-icon-wrapper bg-yellow-100 text-yellow-600">
              <CalendarDays size={28} />
            </div>
            <div className="stat-content">
              <h3 className="stat-title">Active Batches</h3>
              <h2 className="stat-value">{stats.batches}</h2>
              <p className="stat-desc">Ongoing cohorts</p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Welcome to Speak Hub Academy ERP</h3>
        <p className="text-gray-600">
          Your dashboard provides a high-level overview of academy operations. Use the sidebar to manage students, courses, batches, and fee collections.
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
