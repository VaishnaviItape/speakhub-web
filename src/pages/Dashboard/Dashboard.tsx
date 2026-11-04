import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, getDoc, doc, orderBy, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Users, GraduationCap, BookOpen, CalendarDays, Activity, UserPlus, Clock } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';

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

        // Fetch Active Batches
        const batchesQuery = query(collection(db, 'batches'), where('status', '==', 'active'));
        const batchesSnapshot = await getDocs(batchesQuery);
        let allBatches = batchesSnapshot.docs.map(doc => ({ id: doc.id, documentId: doc.id, ...doc.data() }));

        let teacherBatchIds = new Set<string>((user as any)?.batchIds || []);
        if (isTeacher) {
          if (user?.id) {
            try {
              const uDoc = await getDoc(doc(db, 'users', user.id));
              if (uDoc.exists()) {
                const uData = uDoc.data();
                (uData.batchIds || []).forEach((id: string) => teacherBatchIds.add(id));
              }
            } catch (e) {
              console.warn("Could not refresh user batchIds in Dashboard:", e);
            }
          }

          allBatches = allBatches.filter((b: any) => {
            const bId = (b.documentId || b.id) as string;
            return (
              teacherBatchIds.has(bId) ||
              b.teacherId === user?.id || 
              (user?.uid && b.teacherId === user.uid) ||
              b.teacherId === user?.email || 
              (Array.isArray(b.teacherIds) && (
                b.teacherIds.includes(user?.id) ||
                (user?.uid && b.teacherIds.includes(user.uid)) ||
                b.teacherIds.includes(user?.email)
              ))
            );
          });
          allBatches.forEach((b: any) => teacherBatchIds.add((b.documentId || b.id) as string));
        }

        // Fetch Students
        const studentsQuery = query(collection(db, 'users'), where('role', '==', 'student'));
        const studentsSnapshot = await getDocs(studentsQuery);
        let studentDocs = studentsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        if (isTeacher) {
          studentDocs = studentDocs.filter((s: any) => {
            const sBatches = s.batchIds || (s.batchId ? [s.batchId] : []);
            return sBatches.some((bId: string) => teacherBatchIds.has(bId));
          });
        }
        const totalStudents = studentDocs.length;

        // Fetch Total Teachers
        let totalTeachers = 1;
        if (!isTeacher) {
          const teachersQuery = query(collection(db, 'users'), where('role', '==', 'teacher'));
          const teachersSnapshot = await getDocs(teachersQuery);
          totalTeachers = teachersSnapshot.size;
        }

        // Fetch Active Courses
        const coursesQuery = query(collection(db, 'courses'), where('status', '==', 'active'));
        const coursesSnapshot = await getDocs(coursesQuery);
        const activeCourses = coursesSnapshot.size;

        // Fetch Recent Inquiries (Admin only)
        if (!isTeacher) {
          const inqQuery = query(collection(db, 'inquiries'), orderBy('createdAt', 'desc'), limit(5));
          const inqSnapshot = await getDocs(inqQuery);
          const inqList = inqSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setRecentInquiries(inqList);
        } else {
          setRecentInquiries([]);
        }

        // Recent Batches
        setRecentBatches(allBatches.slice(0, 4));

        setStats({
          students: totalStudents,
          teachers: totalTeachers,
          courses: activeCourses,
          batches: allBatches.length,
        });
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardStats();
  }, [isTeacher, user]);

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

            {/* Right Column: Recent Activity (Admin) or Teacher Quick Actions (Teacher) */}
            <div className="dashboard-side-col">
              {!isTeacher ? (
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
              ) : (
                <div className="dashboard-card h-full">
                  <div className="card-header">
                    <h3 className="card-title">
                      <div className="card-title-icon"><Activity size={18} /></div>
                      Teacher Shortcuts
                    </h3>
                  </div>
                  <div className="card-body p-4 flex flex-col gap-3">
                    <Link to="/fees" className="p-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl border border-emerald-200 flex items-center justify-between transition-all">
                      <div>
                        <div className="font-bold text-sm">Student Fee Dues</div>
                        <div className="text-xs text-emerald-600">View upcoming &amp; overdue fee dates for your batch</div>
                      </div>
                      <span className="text-xs font-bold px-2 py-1 bg-white rounded-md shadow-xs">View Dues →</span>
                    </Link>

                    <Link to="/attendance" className="p-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-xl border border-indigo-200 flex items-center justify-between transition-all">
                      <div>
                        <div className="font-bold text-sm">Mark Attendance</div>
                        <div className="text-xs text-indigo-600">Record daily or bulk attendance for your batches</div>
                      </div>
                      <span className="text-xs font-bold px-2 py-1 bg-white rounded-md shadow-xs">Mark →</span>
                    </Link>

                    <Link to="/students" className="p-3 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl border border-amber-200 flex items-center justify-between transition-all">
                      <div>
                        <div className="font-bold text-sm">My Students Directory</div>
                        <div className="text-xs text-amber-600">Profiles of students enrolled in your batches</div>
                      </div>
                      <span className="text-xs font-bold px-2 py-1 bg-white rounded-md shadow-xs">Open →</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
