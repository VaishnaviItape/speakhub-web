import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Users, GraduationCap, BookOpen, CalendarDays, Activity, UserPlus, Clock } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Link } from 'react-router-dom';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    students: 0,
    teachers: 0,
    courses: 0,
    batches: 0,
  });
  
  const [recentInquiries, setRecentInquiries] = useState<any[]>([]);
  const [recentBatches, setRecentBatches] = useState<any[]>([]);
  
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

        // Fetch Recent Inquiries
        const inqQuery = query(collection(db, 'inquiries'), orderBy('createdAt', 'desc'), limit(5));
        const inqSnapshot = await getDocs(inqQuery);
        const inqList = inqSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Fetch Recent Batches (Using start date or just limit if start date not easily sortable)
        const rbQuery = query(collection(db, 'batches'), where('status', '==', 'active'), limit(4));
        const rbSnapshot = await getDocs(rbQuery);
        const rbList = rbSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        setRecentInquiries(inqList);
        setRecentBatches(rbList);

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

  const pieData = [
    { name: 'Students', value: stats.students, color: '#4f46e5' },
    { name: 'Teachers', value: stats.teachers, color: '#10b981' },
    { name: 'Courses', value: stats.courses, color: '#f59e0b' },
    { name: 'Batches', value: stats.batches, color: '#f43f5e' }
  ].filter(d => d.value > 0);


  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard Overview</h1>
          <div className="breadcrumbs">
            <span>Speak Hub</span> <span className="separator">/</span> <span className="current">Dashboard</span>
          </div>
        </div>
        <div className="header-actions">
          <div className="date-badge">
            <CalendarDays size={16} />
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading your dashboard...</p>
        </div>
      ) : (
        <div className="dashboard-content">
          {/* Top Stat Cards */}
          <div className="premium-overview-cards">
            <div className="premium-card card-indigo">
              <div className="premium-icon-wrapper">
                <GraduationCap size={28} />
              </div>
              <div>
                <div className="premium-label">Total Students</div>
                <div className="premium-value">{stats.students}</div>
              </div>
            </div>

            <div className="premium-card card-emerald">
              <div className="premium-icon-wrapper">
                <Users size={28} />
              </div>
              <div>
                <div className="premium-label">Total Teachers</div>
                <div className="premium-value">{stats.teachers}</div>
              </div>
            </div>

            <div className="premium-card card-amber">
              <div className="premium-icon-wrapper">
                <BookOpen size={28} />
              </div>
              <div>
                <div className="premium-label">Active Courses</div>
                <div className="premium-value">{stats.courses}</div>
              </div>
            </div>

            <div className="premium-card card-rose">
              <div className="premium-icon-wrapper">
                <CalendarDays size={28} />
              </div>
              <div>
                <div className="premium-label">Active Batches</div>
                <div className="premium-value">{stats.batches}</div>
              </div>
            </div>
          </div>

          {/* Main Grid for Charts and Feeds */}
          <div className="dashboard-grid">
            {/* Left Column: Charts */}
            <div className="dashboard-main-col">
              <div className="dashboard-card">
                <div className="card-header">
                  <h3 className="card-title">
                    <div className="card-title-icon"><Activity size={18} /></div>
                    Academy Distribution
                  </h3>
                </div>
                <div className="chart-container" style={{ height: 300 }}>
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value, name) => [value, name]}
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                        />
                        <Legend verticalAlign="bottom" height={36} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="empty-chart">No data available to display</div>
                  )}
                </div>
              </div>
              
              <div className="dashboard-card mt-6">
                <div className="card-header">
                  <h3 className="card-title">
                    <div className="card-title-icon"><Clock size={18} /></div>
                    Active Batches Snapshot
                  </h3>
                  <Link to="/batches" className="card-action">View All</Link>
                </div>
                <div className="card-body p-0">
                  <div className="feed-list">
                    {recentBatches.length > 0 ? recentBatches.map(batch => (
                      <div key={batch.id} className="feed-item">
                        <div className="feed-item-icon bg-amber-100 text-amber-600">
                          <Users size={16} />
                        </div>
                        <div className="feed-item-content">
                          <h4>{batch.batchName}</h4>
                          <p>{new Date(batch.startDate?.seconds * 1000).toLocaleDateString() || 'N/A'}</p>
                        </div>
                        <div className="feed-item-badge">Active</div>
                      </div>
                    )) : (
                      <div className="p-4 text-center text-sm text-gray-500">No active batches</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Recent Activity */}
            <div className="dashboard-side-col">
              <div className="dashboard-card h-full">
                <div className="card-header">
                  <h3 className="card-title">
                    <div className="card-title-icon"><UserPlus size={18} /></div>
                    Recent Enquiries
                  </h3>
                  <Link to="/enquiries" className="card-action">View All</Link>
                </div>
                <div className="card-body p-0">
                  <div className="feed-list">
                    {recentInquiries.length > 0 ? recentInquiries.map(inq => (
                      <div key={inq.id} className="feed-item">
                        <div className="feed-item-icon bg-indigo-100 text-indigo-600">
                          {inq.studentName.charAt(0).toUpperCase()}
                        </div>
                        <div className="feed-item-content">
                          <h4>{inq.studentName}</h4>
                          <p>{inq.courseName}</p>
                        </div>
                        <div className="feed-item-right">
                          <span className={`status-dot ${inq.status === 'New' ? 'dot-blue' : 'dot-green'}`}></span>
                          <span className="text-xs text-gray-500">
                            {inq.createdAt?.seconds ? new Date(inq.createdAt.seconds * 1000).toLocaleDateString() : 'Recent'}
                          </span>
                        </div>
                      </div>
                    )) : (
                      <div className="p-4 text-center text-sm text-gray-500">No recent enquiries</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
