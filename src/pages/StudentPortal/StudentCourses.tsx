import React, { useState, useEffect } from 'react';
import { BookOpen, Calendar, Lock, ShieldCheck } from 'lucide-react';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import './StudentPortal.css';

const StudentCourses: React.FC = () => {
  const { user } = useAuth();
  const [courses, setCourses] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [feeDetails, setFeeDetails] = useState<any | null>(null);
  const [hasBatchAssigned, setHasBatchAssigned] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.id) fetchCoursesAndNotes();
  }, [user]);

  const fetchCoursesAndNotes = async () => {
    setIsLoading(true);
    try {
      const userSnap = await getDoc(doc(db, 'users', user!.id));
      if (userSnap.exists()) {
        const uData = userSnap.data();
        const courseIds = uData.courseIds || [];
        const batchIds = uData.batchIds || [];
        
        const isAssigned = batchIds.length > 0;
        setHasBatchAssigned(isAssigned);

        // Fetch Course Details or default public courses for demo
        const courseList = [];
        if (courseIds.length > 0) {
          for (const cId of courseIds) {
            const cSnap = await getDoc(doc(db, 'courses', cId));
            if (cSnap.exists()) {
              courseList.push({
                id: cId,
                name: cSnap.data().courseName,
                description: cSnap.data().description || ''
              });
            }
          }
        } else {
          // Public Demo Courses for unassigned students
          const publicCoursesSnap = await getDocs(query(collection(db, 'courses')));
          publicCoursesSnap.forEach(d => {
            courseList.push({
              id: d.id,
              name: d.data().courseName,
              description: d.data().description || ''
            });
          });
        }
        setCourses(courseList);

        // Fetch Notes for assigned batches with multi-batch and toggle visibility support
        if (isAssigned) {
          const notesSnap = await getDocs(collection(db, 'notes'));
          const noteList: any[] = [];
          notesSnap.forEach(d => {
            const data = d.data();
            if ((data.status || '').toLowerCase() === 'draft' || (data.status || '').toLowerCase() === 'inactive') {
              return;
            }

            // Check toggle visibility
            let isExplicitlyDisabled = false;
            let isExplicitlyEnabled = false;
            if (data.batchVisibility && typeof data.batchVisibility === 'object') {
              for (const bId of batchIds) {
                if (data.batchVisibility[bId] === false) isExplicitlyDisabled = true;
                if (data.batchVisibility[bId] === true) isExplicitlyEnabled = true;
              }
            }

            if (isExplicitlyDisabled) return;

            const isBatchMatch = isExplicitlyEnabled ||
              !data.batchId ||
              data.batchId === 'all' ||
              batchIds.includes(data.batchId) ||
              (Array.isArray(data.batchIds) && (data.batchIds.includes('all') || data.batchIds.some((b: string) => batchIds.includes(b))));

            if (!isBatchMatch) return;

            let date = 'Unknown Date';
            if (data.createdAt) {
               const dObj = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
               date = dObj.toLocaleDateString();
            }
            noteList.push({
              id: d.id,
              ...data,
              date
            });
          });
          setNotes(noteList);

          // Fetch Fee Details for assigned student
          const feeQ = query(collection(db, 'studentFeePlans'), where('studentId', '==', user!.id));
          const feeSnap = await getDocs(feeQ);
          if (!feeSnap.empty) {
            setFeeDetails(feeSnap.docs[0].data());
          }
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
        <h1 className="sp-greeting">My Courses & Materials</h1>
        <p className="sp-subtitle">Access your course structure, study materials, and batch details.</p>
      </div>

      {/* FEE STATUS BANNER - SHOWN ONLY WHEN BATCH IS ASSIGNED */}
      {hasBatchAssigned && feeDetails && (
        <div style={{
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={24} color="#16a34a" />
            <div>
              <h4 style={{ margin: 0, fontSize: '15px', color: '#166534', fontWeight: 'bold' }}>Enrolled & Fee Plan Assigned</h4>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#15803d' }}>
                Billing Cycle: {feeDetails.billingFrequency || 'Monthly'} | Paid Amount: ₹{feeDetails.totalPaid || 0}
              </p>
            </div>
          </div>
          <span style={{ fontSize: '12px', background: '#dcfce7', color: '#15803d', padding: '4px 12px', borderRadius: '20px', fontWeight: 'bold' }}>
            {feeDetails.status ? feeDetails.status.toUpperCase() : 'ACTIVE'}
          </span>
        </div>
      )}

      {/* UNASSIGNED DEMO NOTICE ABOUT FEES */}
      {!hasBatchAssigned && (
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px dashed #cbd5e1',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <Lock size={20} color="#64748b" />
          <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>
            Fee structures and official batch payment receipts will be unlocked once an administrator assigns your batch.
          </p>
        </div>
      )}

      <div className="sp-section mt-4">
        {isLoading ? (
          <p className="text-gray-500 text-center py-8">Loading courses...</p>
        ) : courses.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-xl shadow-sm border border-gray-100">
            <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">No active course enrollments yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {courses.map(course => (
              <div key={course.id} className="sp-card" style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <h2 className="sp-section-title text-[#2b3674]" style={{ margin: 0 }}>{course.name}</h2>
                    {course.description && <p className="text-sm text-gray-500 mt-1">{course.description}</p>}
                  </div>
                  {!hasBatchAssigned && (
                    <span style={{ fontSize: '11px', background: '#e0e7ff', color: '#3730a3', padding: '3px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                      Demo Preview
                    </span>
                  )}
                </div>
                
                <div className="space-y-3 mt-4">
                  <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '8px' }}>Course Study Notes & Resources</h4>
                  {notes.filter(n => n.courseId === course.id).length === 0 ? (
                    <p className="text-xs text-gray-400 italic bg-gray-50 p-3 rounded-lg">
                      {hasBatchAssigned ? "No study notes uploaded for this course yet." : "Sample notes and downloadable resources will be published here upon batch assignment."}
                    </p>
                  ) : (
                    notes.filter(n => n.courseId === course.id).map(note => (
                      <div key={note.id} className="sp-card border-l-4 border-indigo-500 flex justify-between items-center py-3">
                        <div>
                          <h4 className="font-bold text-[#2b3674] text-sm">{note.title}</h4>
                          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                            <Calendar size={12} /> {note.date}
                          </p>
                        </div>
                        {note.fileUrl && (
                          <a 
                            href={note.fileUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-md text-xs font-bold hover:bg-indigo-100 transition-colors"
                          >
                            Download
                          </a>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentCourses;
