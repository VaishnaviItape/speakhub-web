import React, { useState, useEffect } from 'react';
import { PlayCircle, FileText, Calendar, Bell, Lock, Video, AlertTriangle, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../config/firebase';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import './StudentPortal.css';

// Demo static videos dataset
const DEMO_VIDEOS = [
  {
    id: 'demo-1',
    title: 'English Fluency & Spoken Basics',
    duration: '15 mins',
    teacher: 'Sarah Jenkins',
    thumbnail: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&q=80&w=400',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
  },
  {
    id: 'demo-2',
    title: 'Public Speaking & Confidence Masterclass',
    duration: '20 mins',
    teacher: 'David Miller',
    thumbnail: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&q=80&w=400',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
  },
  {
    id: 'demo-3',
    title: 'Grammar Essentials & Conversation Practice',
    duration: '18 mins',
    teacher: 'Anita Sharma',
    thumbnail: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=400',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
  }
];

const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const [liveClass, setLiveClass] = useState<any>(null);
  const [pendingHw, setPendingHw] = useState<any[]>([]);
  const [upcomingExams, setUpcomingExams] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDemoVideo, setSelectedDemoVideo] = useState<any | null>(null);

  // Demo status metrics
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isDemoExpired, setIsDemoExpired] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [hasBatch, setHasBatch] = useState(false);

  useEffect(() => {
    if (user?.id) fetchDashboardData();
  }, [user]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const userSnap = await getDoc(doc(db, 'users', user!.id));
      if (userSnap.exists()) {
        const uData = userSnap.data();
        const batchIds = uData.batchIds || [];
        setHasBatch(batchIds.length > 0);

        // Check Demo mode & expiry date
        const demoMode = uData.isDemoMode ?? true; // Default to demo if unassigned
        setIsDemoMode(demoMode);

        if (uData.demoEndDate) {
          const endDate = uData.demoEndDate.toDate ? uData.demoEndDate.toDate() : new Date(uData.demoEndDate);
          const now = new Date();
          const diffMs = endDate.getTime() - now.getTime();
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

          if (diffMs <= 0) {
            setIsDemoExpired(true);
            setDaysRemaining(0);
          } else {
            setIsDemoExpired(false);
            setDaysRemaining(diffDays);
          }
        }
        
        if (batchIds.length > 0) {
          // Fetch Batch info for Next Class
          const bSnap = await getDoc(doc(db, 'batches', batchIds[0]));
          if (bSnap.exists()) {
            const bData = bSnap.data();
            setLiveClass({
              name: bData.batchName,
              meetingLink: bData.meetingLink || '',
              time: "Upcoming Session"
            });
          }

          // Fetch Pending Homework for this batch
          const hwQ = query(collection(db, 'homework'), where('batchId', '==', batchIds[0]), limit(2));
          const hwSnap = await getDocs(hwQ);
          const hwList: any[] = [];
          hwSnap.forEach(doc => {
            const data = doc.data();
            let due = 'No Due Date';
            if (data.dueDate) {
               const date = data.dueDate.toDate ? data.dueDate.toDate() : new Date(data.dueDate);
               due = date.toLocaleDateString();
            }
            hwList.push({ id: doc.id, title: data.title, due });
          });
          setPendingHw(hwList);

          // Fetch Upcoming Exams
          const exQ = query(collection(db, 'exams'), where('batchId', '==', batchIds[0]), limit(2));
          const exSnap = await getDocs(exQ);
          const exList: any[] = [];
          exSnap.forEach(doc => {
            const data = doc.data();
            exList.push({ id: doc.id, title: data.title, type: data.examType });
          });
          setUpcomingExams(exList);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="sp-container">
      <div className="sp-header">
        <div>
          <h1 className="sp-greeting">Hello, {user?.name?.split(' ')[0] || 'Student'} 👋</h1>
          <p className="sp-subtitle">Welcome to Speak Hub Academy</p>
        </div>
        <button className="sp-icon-btn">
          <Bell size={20} />
          <span className="sp-badge">1</span>
        </button>
      </div>

      {/* DEMO STATUS BANNER */}
      {isDemoExpired ? (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <AlertTriangle size={24} color="#dc2626" />
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', color: '#991b1b', fontWeight: 'bold' }}>
              Demo Period Expired
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#7f1d1d' }}>
              Your demo access has ended. Live meeting links are disabled. Please contact administration to assign your permanent batch and complete fee payment.
            </p>
          </div>
        </div>
      ) : isDemoMode && daysRemaining !== null && (
        <div style={{
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '12px',
          padding: '14px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={20} color="#2563eb" />
            <div>
              <span style={{ fontWeight: 'bold', color: '#1e40af', fontSize: '14px' }}>Free Demo Account</span>
              <span style={{ fontSize: '13px', color: '#3b82f6', marginLeft: '8px' }}>
                ({daysRemaining} day{daysRemaining > 1 ? 's' : ''} remaining)
              </span>
            </div>
          </div>
          <span style={{ fontSize: '12px', background: '#dbeafe', color: '#1e40af', padding: '4px 10px', borderRadius: '20px', fontWeight: 600 }}>
            Demo Mode Active
          </span>
        </div>
      )}

      {/* NEXT CLASS / LIVE CLASS SECTION */}
      <div className="sp-section">
        <h2 className="sp-section-title">Classroom & Live Sessions</h2>
        {isLoading ? (
          <p className="text-gray-500 text-sm">Loading classroom info...</p>
        ) : isDemoExpired ? (
          /* EXPIRED DEMO ACCESS DENIED CARD */
          <div className="sp-card" style={{ backgroundColor: '#fafafa', borderColor: '#e5e7eb', textAlign: 'center', padding: '32px 20px' }}>
            <Lock size={36} style={{ margin: '0 auto 12px', color: '#9ca3af' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#374151' }}>Live Classroom Locked</h3>
            <p style={{ fontSize: '13px', color: '#6b7280', maxWidth: '400px', margin: '8px auto 16px' }}>
              Your demo access expired. Access to live meeting links is currently restricted.
            </p>
            <button className="sp-btn-primary" style={{ opacity: 0.6, cursor: 'not-allowed' }} disabled>
              Meeting Link Disabled
            </button>
          </div>
        ) : hasBatch && liveClass ? (
          /* ACTIVE BATCH CLASSROOM CARD */
          <div className="sp-card live-card">
            <div className="live-badge">Scheduled Batch</div>
            <h3 className="live-title">{liveClass.name}</h3>
            <p className="live-time">{liveClass.time}</p>

            {liveClass.meetingLink ? (
              <a 
                href={liveClass.meetingLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="sp-btn-primary full-width mt-4"
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none' }}
              >
                <PlayCircle size={18} /> Join Live Class
              </a>
            ) : (
              <button className="sp-btn-primary full-width mt-4">
                <PlayCircle size={18} /> Enter Classroom
              </button>
            )}
          </div>
        ) : (
          /* UNASSIGNED STUDENT DEMO BANNER */
          <div className="sp-card" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', color: '#fff', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Video size={20} color="#818cf8" />
              <span style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#a5b4fc' }}>
                Unassigned Demo Account
              </span>
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '8px', color: '#fff' }}>
              Welcome to Speak Hub Academy Demo Portal
            </h3>
            <p style={{ fontSize: '13px', color: '#c7d2fe', marginBottom: '16px', lineHeight: '1.5' }}>
              You are currently viewing demo materials. Watch recorded sample sessions below. Once your batch is assigned by our academic team, your live class schedule and meeting link will appear here.
            </p>
          </div>
        )}
      </div>

      {/* DEMO RECORDED CLASSES (ALWAYS SHOWN FOR DEMO / UNASSIGNED STUDENTS) */}
      {(!hasBatch || isDemoMode) && (
        <div className="sp-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 className="sp-section-title" style={{ margin: 0 }}>Featured Demo Classes</h2>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>Sample Lectures</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
            {DEMO_VIDEOS.map((vid) => (
              <div 
                key={vid.id} 
                className="sp-card" 
                style={{ padding: 0, overflow: 'hidden', cursor: 'pointer', border: '1px solid #e5e7eb' }}
                onClick={() => setSelectedDemoVideo(vid)}
              >
                <div style={{ position: 'relative', height: '140px' }}>
                  <img src={vid.thumbnail} alt={vid.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <PlayCircle size={44} color="#ffffff" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
                  </div>
                  <span style={{
                    position: 'absolute',
                    bottom: '8px',
                    right: '8px',
                    backgroundColor: 'rgba(0,0,0,0.75)',
                    color: '#fff',
                    fontSize: '11px',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}>
                    {vid.duration}
                  </span>
                </div>
                <div style={{ padding: '12px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1f2937', marginBottom: '4px', lineHeight: '1.3' }}>
                    {vid.title}
                  </h4>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
                    Instructor: {vid.teacher}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PENDING HOMEWORK SECTION */}
      <div className="sp-section">
        <h2 className="sp-section-title">Pending Homework</h2>
        {isLoading ? (
          <p className="text-gray-500 text-sm">Loading...</p>
        ) : pendingHw.length > 0 ? (
          pendingHw.map(hw => (
            <div key={hw.id} className="sp-card hw-card mb-3">
              <div className="hw-icon"><FileText size={20} className="text-blue-600"/></div>
              <div className="hw-info">
                <h4>{hw.title}</h4>
                <p>Due: {hw.due}</p>
              </div>
              <button className="sp-btn-outline sm">View</button>
            </div>
          ))
        ) : (
          <p className="text-gray-500 text-sm bg-gray-50 p-4 rounded-lg">
            {hasBatch ? "No pending homework. Great job!" : "Homework assignments will appear here once you are enrolled in a batch."}
          </p>
        )}
      </div>

      {/* UPCOMING EXAMS SECTION */}
      <div className="sp-section">
        <h2 className="sp-section-title">Upcoming Exams</h2>
        {isLoading ? (
          <p className="text-gray-500 text-sm">Loading...</p>
        ) : upcomingExams.length > 0 ? (
          upcomingExams.map(ex => (
            <div key={ex.id} className="sp-card hw-card mb-3">
              <div className="hw-icon"><Calendar size={20} className="text-purple-600"/></div>
              <div className="hw-info">
                <h4>{ex.title}</h4>
                <p>{ex.type} Exam</p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-gray-500 text-sm bg-gray-50 p-4 rounded-lg">
            {hasBatch ? "No upcoming exams." : "Exams will be available after joining a live batch."}
          </p>
        )}
      </div>

      {/* DEMO VIDEO MODAL */}
      {selectedDemoVideo && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            maxWidth: '640px',
            width: '100%',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>{selectedDemoVideo.title}</h3>
              <button 
                onClick={() => setSelectedDemoVideo(null)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '8px' }}>
                <iframe 
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                  src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1"
                  title={selectedDemoVideo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                  allowFullScreen
                ></iframe>
              </div>
              <p style={{ marginTop: '14px', fontSize: '13px', color: '#6b7280' }}>
                Demonstration Lecture by {selectedDemoVideo.teacher}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
