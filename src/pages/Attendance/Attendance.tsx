import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle2, XCircle, Clock, Save, UserCheck, Search, Filter } from 'lucide-react';
import Select from '../../components/forms/Select';
import Input from '../../components/forms/Input';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import type { Batch } from '../../types/models';
import { useAuth } from '../../contexts/AuthContext';
import '../../components/ui/TableStyles.css';
import './Attendance.css';

interface StudentAttendanceItem {
  userId: string;
  studentName: string;
  phone?: string;
  status: 'present' | 'absent' | 'late' | 'leave';
  remarks: string;
  existingDocId?: string;
}

const Attendance: React.FC = () => {
  const { user } = useAuth();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const [studentList, setStudentList] = useState<StudentAttendanceItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasLoadedAttendance, setHasLoadedAttendance] = useState(false);

  useEffect(() => {
    fetchBatches();
  }, []);

  useEffect(() => {
    if (selectedBatchId && selectedDate) {
      fetchStudentsAndAttendance();
    } else {
      setStudentList([]);
    }
  }, [selectedBatchId, selectedDate]);

  const fetchBatches = async () => {
    try {
      const bq = query(collection(db, 'batches'), where('status', '==', 'active'));
      const bSnapshot = await getDocs(bq);
      const activeBatches: Batch[] = [];
      bSnapshot.forEach(d => activeBatches.push({ documentId: d.id, ...d.data() } as Batch));
      setBatches(activeBatches);
      if (activeBatches.length > 0 && activeBatches[0].documentId) {
        setSelectedBatchId(activeBatches[0].documentId);
      }
    } catch (error) {
      console.error("Error fetching batches:", error);
    }
  };

  const fetchStudentsAndAttendance = async () => {
    if (!selectedBatchId || !selectedDate) return;
    setIsLoading(true);
    try {
      // 1. Fetch Students in Batch
      // Find users where batchIds array contains selectedBatchId or batchId matches
      const uQ1 = query(collection(db, 'users'), where('batchIds', 'array-contains', selectedBatchId));
      const uSnap1 = await getDocs(uQ1);

      const studentsMap: { [userId: string]: any } = {};
      uSnap1.forEach(d => {
        const data = d.data();
        if (data.role === 'student' && data.status === 'active') {
          studentsMap[d.id] = { userId: d.id, name: data.name || data.firstName || 'Student', phone: data.phone || data.mobile };
        }
      });

      // Fallback: Also check `students` collection for batchIds array-contains
      const sQ = query(collection(db, 'students'), where('batchIds', 'array-contains', selectedBatchId));
      const sSnap = await getDocs(sQ);
      sSnap.forEach(d => {
        const data = d.data();
        const uid = data.userId || d.id;
        if (!studentsMap[uid]) {
          studentsMap[uid] = {
            userId: uid,
            name: `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Student',
            phone: data.phone
          };
        }
      });

      // 2. Fetch Existing Attendance Records for this batch & date
      const attQ = query(
        collection(db, 'attendance'),
        where('batchId', '==', selectedBatchId),
        where('date', '==', selectedDate)
      );
      const attSnap = await getDocs(attQ);

      const existingAttendanceMap: { [studentId: string]: { status: any; remarks: string; docId: string } } = {};
      attSnap.forEach(d => {
        const data = d.data();
        existingAttendanceMap[data.studentId] = {
          status: data.status,
          remarks: data.remarks || '',
          docId: d.id
        };
      });

      setHasLoadedAttendance(!attSnap.empty);

      // 3. Assemble Student Attendance items
      const items: StudentAttendanceItem[] = Object.values(studentsMap).map(s => {
        const existing = existingAttendanceMap[s.userId];
        return {
          userId: s.userId,
          studentName: s.name,
          phone: s.phone || '',
          status: existing ? existing.status : 'present', // Default to present
          remarks: existing ? existing.remarks : '',
          existingDocId: existing ? existing.docId : undefined
        };
      });

      setStudentList(items);
    } catch (error) {
      console.error("Error fetching attendance data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = (userId: string, newStatus: 'present' | 'absent' | 'late' | 'leave') => {
    setStudentList(prev => prev.map(item => item.userId === userId ? { ...item, status: newStatus } : item));
  };

  const handleRemarksChange = (userId: string, newRemarks: string) => {
    setStudentList(prev => prev.map(item => item.userId === userId ? { ...item, remarks: newRemarks } : item));
  };

  const handleMarkAll = (status: 'present' | 'absent') => {
    setStudentList(prev => prev.map(item => ({ ...item, status })));
  };

  const handleSaveAttendance = async () => {
    if (!selectedBatchId || !selectedDate) {
      alert("Please select a batch and date.");
      return;
    }

    if (studentList.length === 0) {
      alert("No students found in this batch to mark attendance.");
      return;
    }

    setIsSaving(true);
    try {
      const batch = writeBatch(db);

      studentList.forEach(item => {
        // Document ID format: batchId_date_studentId for unique daily record
        const docId = item.existingDocId || `${selectedBatchId}_${selectedDate}_${item.userId}`;
        const attRef = doc(db, 'attendance', docId);

        batch.set(attRef, {
          batchId: selectedBatchId,
          date: selectedDate,
          studentId: item.userId,
          studentName: item.studentName,
          status: item.status,
          remarks: item.remarks || '',
          markedBy: user?.name || 'Teacher/Admin',
          markedById: user?.id || '',
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        }, { merge: true });
      });

      await batch.commit();
      alert("Attendance Saved Successfully!");
      setHasLoadedAttendance(true);
    } catch (error: any) {
      console.error("Error saving attendance:", error);
      alert("Failed to save attendance: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredStudents = studentList.filter(s =>
    s.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.phone?.includes(searchQuery)
  );

  const presentCount = studentList.filter(s => s.status === 'present').length;
  const absentCount = studentList.filter(s => s.status === 'absent').length;
  const lateCount = studentList.filter(s => s.status === 'late' || s.status === 'leave').length;
  const totalCount = studentList.length;
  const attendancePercentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header flex justify-between items-center w-full mb-4">
        <div>
          <h1 className="page-title">Student Attendance</h1>
          <div className="breadcrumbs">
            <span>Dashboard</span> <span className="separator">/</span> <span className="current">Attendance</span>
          </div>
        </div>

        {studentList.length > 0 && (
          <button
            onClick={handleSaveAttendance}
            disabled={isSaving}
            className="btn bg-green-600 text-white hover:bg-green-700 font-bold flex items-center gap-2 px-5 py-2.5 rounded-lg shadow-sm transition-all"
          >
            <Save size={18} />
            {isSaving ? 'Saving...' : 'Save Attendance'}
          </button>
        )}
      </div>

      {/* Selector Toolbar */}
      <div className="premium-toolbar">
        <Select
          label="Select Batch *"
          options={[
            { label: 'Select Batch', value: '' },
            ...batches.map(b => ({ label: b.batchName, value: b.documentId || '' }))
          ]}
          value={selectedBatchId}
          onChange={(e) => setSelectedBatchId(e.target.value)}
        />

        <Input
          type="date"
          label="Attendance Date *"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />

        <div className="premium-toolbar-buttons">
          <button
            type="button"
            onClick={() => handleMarkAll('present')}
            disabled={studentList.length === 0}
            className="btn-emerald"
          >
            <CheckCircle2 size={16} /> Mark All Present
          </button>

          <button
            type="button"
            onClick={() => handleMarkAll('absent')}
            disabled={studentList.length === 0}
            className="btn-rose"
          >
            <XCircle size={16} /> Mark All Absent
          </button>
        </div>
      </div>

      {/* Premium Overview Cards */}
      {/* Premium Overview Cards */}
      {selectedBatchId && studentList.length > 0 && (
        <div className="premium-overview-cards">
          <div className="premium-card card-indigo">
            <div className="premium-icon-wrapper">
              <UserCheck size={32} />
            </div>
            <div>
              <div className="premium-label">Total Students</div>
              <div className="premium-value">{totalCount}</div>
            </div>
          </div>

          <div className="premium-card card-emerald">
            <div className="premium-icon-wrapper">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <div className="premium-label">Present Today</div>
              <div className="premium-value">{presentCount}</div>
            </div>
          </div>

          <div className="premium-card card-rose">
            <div className="premium-icon-wrapper">
              <XCircle size={32} />
            </div>
            <div>
              <div className="premium-label">Absent Today</div>
              <div className="premium-value">{absentCount}</div>
            </div>
          </div>

          <div className="premium-card card-amber">
            <div className="premium-icon-wrapper">
              <Calendar size={32} />
            </div>
            <div>
              <div className="premium-label">Attendance Rate</div>
              <div className="premium-value">{attendancePercentage}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Main Student Attendance List */}
      <div className="premium-table-container">
        {/* Table Search & Status */}
        <div className="premium-table-header">
          <div className="premium-title-wrapper">
            <div className="premium-title-icon">
              <Calendar size={20} />
            </div>
            <h3 className="premium-title">Students Sheet</h3>
            {hasLoadedAttendance && (
              <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1 shadow-sm">
                <CheckCircle2 size={12} /> Previously Saved
              </span>
            )}
          </div>

          <div className="search-wrapper" style={{ minWidth: '250px' }}>
            <Search className="search-icon" size={16} />
            <input
              type="text"
              placeholder="Search student name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="premium-search-input"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
            Loading batch students...
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            {selectedBatchId ? "No active students found in this batch." : "Please select a batch to mark attendance."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Student Name</th>
                  <th>Mobile</th>
                  <th style={{ textAlign: 'center' }}>Attendance Status</th>
                  <th>Remarks / Note</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student, idx) => (
                  <tr key={student.userId}>
                    <td style={{ color: 'var(--text-light)', fontWeight: '600' }}>{idx + 1}</td>
                    <td style={{ fontWeight: '700', color: 'var(--text-main)' }}>{student.studentName}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{student.phone || '-'}</td>
                    <td>
                      <div className="status-toggle-group">
                        <button
                          type="button"
                          onClick={() => handleStatusChange(student.userId, 'present')}
                          className={`status-btn ${student.status === 'present' ? 'active-present' : ''}`}
                        >
                          <CheckCircle2 size={14} /> Present
                        </button>

                        <button
                          type="button"
                          onClick={() => handleStatusChange(student.userId, 'absent')}
                          className={`status-btn ${student.status === 'absent' ? 'active-absent' : ''}`}
                        >
                          <XCircle size={14} /> Absent
                        </button>

                        <button
                          type="button"
                          onClick={() => handleStatusChange(student.userId, 'late')}
                          className={`status-btn ${student.status === 'late' ? 'active-late' : ''}`}
                        >
                          <Clock size={14} /> Late
                        </button>
                      </div>
                    </td>
                    <td>
                      <input
                        type="text"
                        placeholder="Add remark (optional)..."
                        value={student.remarks}
                        onChange={(e) => handleRemarksChange(student.userId, e.target.value)}
                        className="premium-input"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Bottom Save Bar */}
        {studentList.length > 0 && (
          <div className="bottom-save-bar">
            <span className="bottom-save-text">
              Showing {filteredStudents.length} of {studentList.length} students
            </span>

            <button
              onClick={handleSaveAttendance}
              disabled={isSaving}
              className="btn-save-attendance"
            >
              <Save size={18} />
              {isSaving ? 'Saving Attendance...' : 'Save Attendance'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Attendance;
