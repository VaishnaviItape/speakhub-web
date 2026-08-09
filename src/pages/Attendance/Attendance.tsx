import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle2, XCircle, Clock, Save, UserCheck, Search, Filter } from 'lucide-react';
import Select from '../../components/forms/Select';
import Input from '../../components/forms/Input';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import type { Batch } from '../../types/models';
import { useAuth } from '../../contexts/AuthContext';
import '../../components/ui/TableStyles.css';

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
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
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

        <div className="flex gap-2">
          <button 
            type="button"
            onClick={() => handleMarkAll('present')}
            disabled={studentList.length === 0}
            className="btn bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold flex-1 flex justify-center items-center gap-1 py-2.5 rounded-md"
          >
            <CheckCircle2 size={16} /> Mark All Present
          </button>

          <button 
            type="button"
            onClick={() => handleMarkAll('absent')}
            disabled={studentList.length === 0}
            className="btn bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-bold flex-1 flex justify-center items-center gap-1 py-2.5 rounded-md"
          >
            <XCircle size={16} /> Mark All Absent
          </button>
        </div>
      </div>

      {/* Summary Cards Banner */}
      {selectedBatchId && studentList.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <UserCheck size={24} />
            </div>
            <div>
              <div className="text-xs text-gray-500 font-medium">Total Students</div>
              <div className="text-xl font-bold text-gray-900">{totalCount}</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-green-50 text-green-600 rounded-lg">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <div className="text-xs text-gray-500 font-medium">Present Today</div>
              <div className="text-xl font-bold text-green-700">{presentCount}</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-red-50 text-red-600 rounded-lg">
              <XCircle size={24} />
            </div>
            <div>
              <div className="text-xs text-gray-500 font-medium">Absent Today</div>
              <div className="text-xl font-bold text-red-700">{absentCount}</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
              <Calendar size={24} />
            </div>
            <div>
              <div className="text-xs text-gray-500 font-medium">Attendance Rate</div>
              <div className="text-xl font-bold text-purple-900">{attendancePercentage}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Main Student Attendance List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Table Search & Status */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center flex-wrap gap-4 bg-gray-50/50">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-800 text-base">Students Sheet</h3>
            {hasLoadedAttendance && (
              <span className="text-xs bg-green-100 text-green-800 font-bold px-2.5 py-0.5 rounded border border-green-200 flex items-center gap-1">
                <CheckCircle2 size={12} /> Previously Saved
              </span>
            )}
          </div>

          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Search student name or phone..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-indigo-500 focus:border-indigo-500"
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
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200 text-xs text-gray-700 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">#</th>
                  <th className="py-3.5 px-4">Student Name</th>
                  <th className="py-3.5 px-4">Mobile</th>
                  <th className="py-3.5 px-4 text-center">Attendance Status</th>
                  <th className="py-3.5 px-4">Remarks / Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {filteredStudents.map((student, idx) => (
                  <tr key={student.userId} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-gray-400 text-xs">{idx + 1}</td>
                    <td className="py-3 px-4 font-bold text-gray-900">{student.studentName}</td>
                    <td className="py-3 px-4 text-xs font-medium text-gray-600">{student.phone || '-'}</td>
                    <td className="py-3 px-4">
                      <div className="flex justify-center items-center gap-1 bg-gray-100 p-1 rounded-lg max-w-xs mx-auto border border-gray-200">
                        <button
                          type="button"
                          onClick={() => handleStatusChange(student.userId, 'present')}
                          className={`flex-1 py-1.5 px-3 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                            student.status === 'present' 
                              ? 'bg-emerald-600 text-white shadow-sm' 
                              : 'text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          <CheckCircle2 size={14} /> Present
                        </button>

                        <button
                          type="button"
                          onClick={() => handleStatusChange(student.userId, 'absent')}
                          className={`flex-1 py-1.5 px-3 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                            student.status === 'absent' 
                              ? 'bg-rose-600 text-white shadow-sm' 
                              : 'text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          <XCircle size={14} /> Absent
                        </button>

                        <button
                          type="button"
                          onClick={() => handleStatusChange(student.userId, 'late')}
                          className={`flex-1 py-1.5 px-3 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                            student.status === 'late' 
                              ? 'bg-amber-500 text-white shadow-sm' 
                              : 'text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          <Clock size={14} /> Late
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <input 
                        type="text" 
                        placeholder="Add remark (optional)..." 
                        value={student.remarks}
                        onChange={(e) => handleRemarksChange(student.userId, e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-indigo-500 focus:border-indigo-500"
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
          <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
            <span className="text-xs text-gray-500 font-medium">
              Showing {filteredStudents.length} of {studentList.length} students
            </span>

            <button 
              onClick={handleSaveAttendance}
              disabled={isSaving}
              className="btn bg-green-600 text-white hover:bg-green-700 font-bold flex items-center gap-2 px-6 py-2 rounded-lg shadow-sm transition-all"
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
