import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Save, 
  UserCheck, 
  Search, 
  Download, 
  Users,
  CalendarCheck,
  CalendarRange,
  PartyPopper,
  Plus,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import Select from '../../components/forms/Select';
import Input from '../../components/forms/Input';
import EmptyState from '../../components/ui/EmptyState';
import { db } from '../../config/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  serverTimestamp,
  writeBatch,
  addDoc,
  deleteDoc,
  onSnapshot,
  orderBy
} from 'firebase/firestore';
import type { Batch } from '../../types/models';
import { useAuth } from '../../contexts/AuthContext';
import '../../components/ui/TableStyles.css';
import './Attendance.css';

interface StudentAttendanceItem {
  userId: string;
  studentName: string;
  phone?: string;
  status: 'present' | 'absent' | 'late' | 'leave' | 'holiday';
  remarks: string;
  existingDocId?: string;
}

interface Holiday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  description?: string;
  createdBy?: string;
}

const Attendance: React.FC = () => {
  const { user } = useAuth();
  
  // Tab State: 'single' (Daily Sheet) vs 'bulk' (Bulk Date Range Sheet)
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');

  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const [studentList, setStudentList] = useState<StudentAttendanceItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'absent' | 'late'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasLoadedAttendance, setHasLoadedAttendance] = useState(false);

  // Bulk Date Range State
  const [, setIsRangeModalOpen] = useState(false);
  const [rangeBatchId, setRangeBatchId] = useState('');
  const [fromDate, setFromDate] = useState('2026-08-01');
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [rangeStatus, setRangeStatus] = useState<'present' | 'absent' | 'late'>('present');
  const [excludeSundays, setExcludeSundays] = useState(true);
  const [excludeSaturdays, setExcludeSaturdays] = useState(false);
  const [excludeHolidays, setExcludeHolidays] = useState(true);
  const [isApplyingRange, setIsApplyingRange] = useState(false);

  // Range Student Selection States
  const [rangeStudents, setRangeStudents] = useState<{ userId: string; name: string; phone?: string }[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [isFetchingRangeStudents, setIsFetchingRangeStudents] = useState(false);

  // Holiday States
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [showHolidayPanel, setShowHolidayPanel] = useState(false);
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayDate, setNewHolidayDate] = useState(new Date().toISOString().split('T')[0]);
  const [newHolidayDescription, setNewHolidayDescription] = useState('');
  const [isSavingHoliday, setIsSavingHoliday] = useState(false);

  useEffect(() => {
    fetchBatches();
    // Real-time holiday listener
    const hq = query(collection(db, 'holidays'), orderBy('date', 'desc'));
    const unsubHolidays = onSnapshot(hq, (snap) => {
      const list: Holiday[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as Holiday);
      });
      setHolidays(list);
    }, (err) => {
      console.error('Holiday snapshot error:', err);
    });
    return () => unsubHolidays();
  }, []);

  useEffect(() => {
    if (selectedBatchId && selectedDate) {
      fetchStudentsAndAttendance();
    } else {
      setStudentList([]);
    }
  }, [selectedBatchId, selectedDate]);

  const holidaySet = new Set(holidays.map(h => h.date));
  const currentDateHoliday = holidays.find(h => h.date === selectedDate);

  const fetchBatches = async () => {
    try {
      const bq = query(collection(db, 'batches'), where('status', '==', 'active'));
      const bSnapshot = await getDocs(bq);
      const activeBatches: Batch[] = [];
      bSnapshot.forEach(d => activeBatches.push({ documentId: d.id, ...d.data() } as Batch));
      setBatches(activeBatches);
      if (activeBatches.length > 0 && activeBatches[0].documentId) {
        const firstBatchId = activeBatches[0].documentId;
        setSelectedBatchId(firstBatchId);
        setRangeBatchId(firstBatchId);
        loadRangeStudents(firstBatchId);
      }
    } catch (error) {
      console.error("Error fetching batches:", error);
    }
  };

  const fetchStudentsAndAttendance = async () => {
    if (!selectedBatchId || !selectedDate) return;
    setIsLoading(true);
    try {
      const studentsMap: { [userId: string]: any } = {};

      const uQ1 = query(collection(db, 'users'), where('batchIds', 'array-contains', selectedBatchId));
      const uQ2 = query(collection(db, 'users'), where('batchId', '==', selectedBatchId));

      const [uSnap1, uSnap2] = await Promise.all([
        getDocs(uQ1).catch(() => ({ forEach: () => {} } as any)),
        getDocs(uQ2).catch(() => ({ forEach: () => {} } as any))
      ]);

      const processUserDoc = (d: any) => {
        const data = d.data();
        const isStudentRole = !data.role || data.role === 'student' || data.role === 'Student';
        const isActiveStatus = !data.status || data.status === 'active' || data.status === 'Active';
        if (isStudentRole && isActiveStatus) {
          studentsMap[d.id] = {
            userId: d.id,
            name: data.name || data.studentName || `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Student',
            phone: data.phone || data.mobile || ''
          };
        }
      };

      uSnap1.forEach(processUserDoc);
      uSnap2.forEach(processUserDoc);

      const sQ1 = query(collection(db, 'students'), where('batchIds', 'array-contains', selectedBatchId));
      const sQ2 = query(collection(db, 'students'), where('batchId', '==', selectedBatchId));

      const [sSnap1, sSnap2] = await Promise.all([
        getDocs(sQ1).catch(() => ({ forEach: () => {} } as any)),
        getDocs(sQ2).catch(() => ({ forEach: () => {} } as any))
      ]);

      const processStudentDoc = (d: any) => {
        const data = d.data();
        const uid = data.userId || d.id;
        if (!studentsMap[uid]) {
          studentsMap[uid] = {
            userId: uid,
            name: `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.name || 'Student',
            phone: data.phone || data.mobile || ''
          };
        }
      };

      sSnap1.forEach(processStudentDoc);
      sSnap2.forEach(processStudentDoc);

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

      // Determine default status: if it's a holiday, default to 'holiday'
      const isHoliday = holidaySet.has(selectedDate);
      const defaultStatus = isHoliday ? 'holiday' : 'present';

      const items: StudentAttendanceItem[] = Object.values(studentsMap).map(s => {
        const existing = existingAttendanceMap[s.userId];
        return {
          userId: s.userId,
          studentName: s.name,
          phone: s.phone || '',
          status: existing ? existing.status : defaultStatus,
          remarks: existing ? existing.remarks : (isHoliday ? currentDateHoliday?.name || 'Holiday' : ''),
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

  const handleStatusChange = (userId: string, newStatus: 'present' | 'absent' | 'late' | 'leave' | 'holiday') => {
    setStudentList(prev => prev.map(item => item.userId === userId ? { ...item, status: newStatus } : item));
  };

  const handleRemarksChange = (userId: string, newRemarks: string) => {
    setStudentList(prev => prev.map(item => item.userId === userId ? { ...item, remarks: newRemarks } : item));
  };

  const handleMarkAll = (status: 'present' | 'absent' | 'holiday') => {
    setStudentList(prev => prev.map(item => ({ ...item, status: status })));
  };

  const handleSaveAttendance = async () => {
    if (!selectedBatchId || !selectedDate) {
      alert("Please select a batch and date.");
      return;
    }

    if (selectedDate > todayStr) {
      alert("Cannot mark attendance for future dates.");
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
        const docId = item.existingDocId || `${selectedBatchId}_${selectedDate}_${item.userId}`;
        const attRef = doc(db, 'attendance', docId);

        batch.set(attRef, {
          batchId: selectedBatchId,
          date: selectedDate,
          studentId: item.userId,
          studentName: item.studentName,
          status: item.status,
          remarks: item.remarks || '',
          isHoliday: item.status === 'holiday',
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

  // ─── Holiday CRUD ────────────────────────────────────────────────────────────

  const handleAddHoliday = async () => {
    if (!newHolidayName.trim()) {
      alert("Please enter a holiday name.");
      return;
    }
    if (!newHolidayDate) {
      alert("Please select a date for the holiday.");
      return;
    }
    setIsSavingHoliday(true);
    try {
      await addDoc(collection(db, 'holidays'), {
        date: newHolidayDate,
        name: newHolidayName.trim(),
        description: newHolidayDescription.trim(),
        createdBy: user?.name || 'Admin',
        createdById: user?.id || '',
        createdAt: serverTimestamp()
      });
      setNewHolidayName('');
      setNewHolidayDescription('');
      alert(`✅ Holiday "${newHolidayName.trim()}" added for ${newHolidayDate}`);
    } catch (err: any) {
      console.error("Error adding holiday:", err);
      alert("Failed to add holiday: " + err.message);
    } finally {
      setIsSavingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (holidayId: string, holidayName: string) => {
    if (!confirm(`Delete holiday "${holidayName}"?`)) return;
    try {
      await deleteDoc(doc(db, 'holidays', holidayId));
    } catch (err: any) {
      alert("Failed to delete: " + err.message);
    }
  };

  // ─── Range ───────────────────────────────────────────────────────────────────

  const loadRangeStudents = async (batchId: string) => {
    if (!batchId) {
      setRangeStudents([]);
      setSelectedStudentIds([]);
      return;
    }
    setIsFetchingRangeStudents(true);
    try {
      const studentsMap: { [userId: string]: any } = {};

      const uQ1 = query(collection(db, 'users'), where('batchIds', 'array-contains', batchId));
      const uQ2 = query(collection(db, 'users'), where('batchId', '==', batchId));

      const [uSnap1, uSnap2] = await Promise.all([
        getDocs(uQ1).catch(() => ({ forEach: () => {} } as any)),
        getDocs(uQ2).catch(() => ({ forEach: () => {} } as any))
      ]);

      const processUserDoc = (d: any) => {
        const data = d.data();
        const isStudentRole = !data.role || data.role === 'student' || data.role === 'Student';
        const isActiveStatus = !data.status || data.status === 'active' || data.status === 'Active';
        if (isStudentRole && isActiveStatus) {
          studentsMap[d.id] = {
            userId: d.id,
            name: data.name || data.studentName || `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Student',
            phone: data.phone || data.mobile || ''
          };
        }
      };

      uSnap1.forEach(processUserDoc);
      uSnap2.forEach(processUserDoc);

      const sQ1 = query(collection(db, 'students'), where('batchIds', 'array-contains', batchId));
      const sQ2 = query(collection(db, 'students'), where('batchId', '==', batchId));

      const [sSnap1, sSnap2] = await Promise.all([
        getDocs(sQ1).catch(() => ({ forEach: () => {} } as any)),
        getDocs(sQ2).catch(() => ({ forEach: () => {} } as any))
      ]);

      const processStudentDoc = (d: any) => {
        const data = d.data();
        const uid = data.userId || d.id;
        if (!studentsMap[uid]) {
          studentsMap[uid] = {
            userId: uid,
            name: `${data.firstName || ''} ${data.lastName || ''}`.trim() || data.name || 'Student',
            phone: data.phone || data.mobile || ''
          };
        }
      };

      sSnap1.forEach(processStudentDoc);
      sSnap2.forEach(processStudentDoc);

      const list = Object.values(studentsMap);
      setRangeStudents(list);
      setSelectedStudentIds(list.map(s => s.userId));
    } catch (e) {
      console.error("Error loading range students:", e);
    } finally {
      setIsFetchingRangeStudents(false);
    }
  };



  const handleApplyRangeAttendance = async () => {
    const targetBatchId = rangeBatchId || selectedBatchId;
    if (!targetBatchId) {
      alert("Please select a batch for date range attendance.");
      return;
    }
    if (!fromDate || !toDate) {
      alert("Please select both From Date and To Date.");
      return;
    }
    if (fromDate > toDate) {
      alert("From Date cannot be after To Date.");
      return;
    }
    if (toDate > todayStr) {
      alert("To Date cannot be in the future.");
      return;
    }
    if (selectedStudentIds.length === 0) {
      alert("Please select at least one student.");
      return;
    }

    setIsApplyingRange(true);
    try {
      const targetStudents = rangeStudents.filter(s => selectedStudentIds.includes(s.userId));
      if (targetStudents.length === 0) {
        alert("No selected students found.");
        setIsApplyingRange(false);
        return;
      }

      const dateList: string[] = [];
      const current = new Date(fromDate);
      const end = new Date(toDate);

      while (current <= end) {
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, '0');
        const day = String(current.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${day}`;

        const dayOfWeek = current.getDay();
        const isSunday = dayOfWeek === 0;
        const isSaturday = dayOfWeek === 6;
        const isHoliday = excludeHolidays && holidaySet.has(dateString);

        if ((!excludeSundays || !isSunday) && (!excludeSaturdays || !isSaturday) && !isHoliday) {
          if (dateString <= todayStr) {
            dateList.push(dateString);
          }
        }
        current.setDate(current.getDate() + 1);
      }

      if (dateList.length === 0) {
        alert("No valid dates found in the selected range (all dates may be weekends or holidays).");
        setIsApplyingRange(false);
        return;
      }

      let batch = writeBatch(db);
      let operationCount = 0;

      for (const dStr of dateList) {
        for (const student of targetStudents) {
          const docId = `${targetBatchId}_${dStr}_${student.userId}`;
          const attRef = doc(db, 'attendance', docId);

          batch.set(attRef, {
            batchId: targetBatchId,
            date: dStr,
            studentId: student.userId,
            studentName: student.name,
            status: rangeStatus,
            isHoliday: false,
            remarks: `Bulk marked as ${rangeStatus}`,
            markedBy: user?.name || 'Teacher/Admin',
            markedById: user?.id || '',
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp()
          }, { merge: true });

          operationCount++;
          if (operationCount >= 450) {
            await batch.commit();
            batch = writeBatch(db);
            operationCount = 0;
          }
        }
      }

      if (operationCount > 0) {
        await batch.commit();
      }

      const skippedHolidays = excludeHolidays ? holidays.filter(h => h.date >= fromDate && h.date <= toDate).length : 0;
      alert(`✅ Success! Bulk attendance marked as "${rangeStatus.toUpperCase()}" for ${dateList.length} days across ${targetStudents.length} selected students (${dateList.length * targetStudents.length} total records).${skippedHolidays > 0 ? `\n\n🎉 ${skippedHolidays} holiday(s) were automatically skipped.` : ''}`);
      setIsRangeModalOpen(false);

      if (selectedBatchId === targetBatchId) {
        fetchStudentsAndAttendance();
      }
    } catch (err: any) {
      console.error("Bulk attendance error:", err);
      alert("Failed to apply bulk attendance: " + err.message);
    } finally {
      setIsApplyingRange(false);
    }
  };

  const handleDownloadCSV = () => {
    if (studentList.length === 0) {
      alert("No attendance data available to download.");
      return;
    }
    const currentBatchName = batches.find(b => b.documentId === selectedBatchId)?.batchName || 'Batch';
    const headers = ["Index", "Student Name", "Phone", "Status", "Date", "Batch", "Remarks"];
    const rows = filteredStudents.map((s, idx) => [
      idx + 1,
      `"${s.studentName.replace(/"/g, '""')}"`,
      `"${(s.phone || '').replace(/"/g, '""')}"`,
      `"${s.status.toUpperCase()}"`,
      `"${selectedDate}"`,
      `"${currentBatchName.replace(/"/g, '""')}"`,
      `"${(s.remarks || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Attendance_${currentBatchName}_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredStudents = studentList.filter(s => {
    const matchesSearch = s.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (s.phone && s.phone.includes(searchQuery));
    const matchesStatus = statusFilter === 'all' ? true : 
                          statusFilter === 'late' ? (s.status === 'late' || s.status === 'leave') : 
                          s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const presentCount = studentList.filter(s => s.status === 'present').length;
  const absentCount = studentList.filter(s => s.status === 'absent').length;
  const lateCount = studentList.filter(s => s.status === 'late' || s.status === 'leave').length;
  const holidayCount = studentList.filter(s => s.status === 'holiday').length;
  const totalCount = studentList.length;
  const attendancePercentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  const getTodayDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getTodayDateString();

  // Holidays in the currently displayed month/year for reference
  const holidaysInRange = holidays.filter(h => h.date >= fromDate && h.date <= toDate);

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

        <div className="flex items-center gap-3">
          {/* Holiday Management Toggle */}
          <button
            type="button"
            onClick={() => setShowHolidayPanel(prev => !prev)}
            className={`btn flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-sm transition-all cursor-pointer text-xs font-bold ${showHolidayPanel ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}
          >
            <PartyPopper size={16} />
            Manage Holidays
            {holidays.length > 0 && (
              <span className="bg-amber-600 text-white text-xs rounded-full px-1.5 py-0.5 ml-1">{holidays.length}</span>
            )}
          </button>

          {activeTab === 'single' && studentList.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleDownloadCSV}
                className="btn bg-slate-700 text-white hover:bg-slate-800 font-bold flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-sm transition-all cursor-pointer text-xs"
              >
                <Download size={16} />
                Export CSV
              </button>

              <button
                onClick={handleSaveAttendance}
                disabled={isSaving}
                className="btn bg-green-600 text-white hover:bg-green-700 font-bold flex items-center gap-2 px-5 py-2.5 rounded-lg shadow-sm transition-all cursor-pointer text-xs"
              >
                <Save size={16} />
                {isSaving ? 'Saving...' : 'Save Attendance'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ─── Holiday Management Panel ─────────────────────────────────── */}
      {showHolidayPanel && (
        <div className="holiday-panel">
          <div className="holiday-panel-header">
            <div className="holiday-panel-title-row">
              <div className="holiday-panel-icon">
                <PartyPopper size={22} />
              </div>
              <div>
                <h3 className="holiday-panel-title">Holiday Management</h3>
                <p className="holiday-panel-subtitle">Add or remove holidays. Holidays are highlighted on the calendar and can be skipped in bulk attendance.</p>
              </div>
            </div>
          </div>

          {/* Add Holiday Form */}
          <div className="holiday-add-form">
            <div className="holiday-form-grid">
              <div>
                <label className="holiday-field-label">Holiday Date *</label>
                <input
                  type="date"
                  value={newHolidayDate}
                  onChange={e => setNewHolidayDate(e.target.value)}
                  className="holiday-date-input"
                />
              </div>
              <div>
                <label className="holiday-field-label">Holiday Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Independence Day"
                  value={newHolidayName}
                  onChange={e => setNewHolidayName(e.target.value)}
                  className="holiday-name-input"
                />
              </div>
              <div>
                <label className="holiday-field-label">Description (optional)</label>
                <input
                  type="text"
                  placeholder="Short description..."
                  value={newHolidayDescription}
                  onChange={e => setNewHolidayDescription(e.target.value)}
                  className="holiday-name-input"
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handleAddHoliday}
                  disabled={isSavingHoliday}
                  className="holiday-add-btn"
                >
                  <Plus size={16} />
                  {isSavingHoliday ? 'Saving...' : 'Add Holiday'}
                </button>
              </div>
            </div>
          </div>

          {/* Holiday List */}
          {holidays.length === 0 ? (
            <div className="holiday-empty">
              <PartyPopper size={32} color="#d97706" />
              <p>No holidays added yet. Add your first holiday above.</p>
            </div>
          ) : (
            <div className="holiday-list">
              {holidays.map(h => (
                <div key={h.id} className="holiday-list-item">
                  <div className="holiday-list-icon">🎉</div>
                  <div className="holiday-list-info">
                    <span className="holiday-list-name">{h.name}</span>
                    <span className="holiday-list-date">{new Date(h.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    {h.description && <span className="holiday-list-desc">{h.description}</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteHoliday(h.id, h.name)}
                    className="holiday-delete-btn"
                    title="Delete holiday"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2 Main Navigation Tabs - Segmented Control Bar */}
      <div className="attendance-nav-tabs">
        <button
          type="button"
          onClick={() => setActiveTab('single')}
          className={`attendance-tab-btn ${activeTab === 'single' ? 'active' : ''}`}
        >
          <span className="attendance-tab-icon">
            <CalendarCheck size={18} />
          </span>
          <span>Single Day Attendance</span>
          <span className="attendance-tab-badge">Daily</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('bulk');
            const bId = rangeBatchId || selectedBatchId || (batches.length > 0 ? batches[0].documentId || '' : '');
            if (bId) {
              setRangeBatchId(bId);
              loadRangeStudents(bId);
            }
          }}
          className={`attendance-tab-btn ${activeTab === 'bulk' ? 'active' : ''}`}
        >
          <span className="attendance-tab-icon">
            <CalendarRange size={18} />
          </span>
          <span>Bulk Date Range Attendance</span>
          <span className="attendance-tab-badge">Multi-Date</span>
        </button>
      </div>

      {/* TAB 2: BULK DATE RANGE ATTENDANCE VIEW */}
      {activeTab === 'bulk' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Top Control Panel */}
          <div className="bulk-config-card">
            <div className="bulk-config-header">
              <div className="bulk-config-header-left">
                <div className="bulk-config-icon-box">
                  <CalendarRange size={24} />
                </div>
                <div>
                  <h3 className="bulk-config-title">
                    Bulk Date Range Configuration
                  </h3>
                  <p className="bulk-config-subtitle">
                    Select target batch, date range, status, and choose which students to apply bulk attendance for.
                  </p>
                </div>
              </div>
            </div>

            <div className="bulk-config-grid">
              <div>
                <Select
                  label="Target Batch *"
                  options={[
                    { label: 'Select Batch', value: '' },
                    ...batches.map(b => ({ label: b.batchName, value: b.documentId || '' }))
                  ]}
                  value={rangeBatchId}
                  onChange={(e) => {
                    const bId = e.target.value;
                    setRangeBatchId(bId);
                    loadRangeStudents(bId);
                  }}
                />
              </div>

              <div>
                <Input
                  type="date"
                  label="From Date *"
                  value={fromDate}
                  max={todayStr}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>

              <div>
                <Input
                  type="date"
                  label="To Date *"
                  value={toDate}
                  max={todayStr}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>

              <div>
                <Select
                  label="Attendance Status *"
                  options={[
                    { label: '🟢 Present', value: 'present' },
                    { label: '🔴 Absent', value: 'absent' },
                    { label: '🟡 Late', value: 'late' }
                  ]}
                  value={rangeStatus}
                  onChange={(e) => setRangeStatus(e.target.value as any)}
                />
              </div>
            </div>

            <div className="bulk-config-footer">
              <div className="bulk-checkbox-group">
                <label className="bulk-checkbox-label">
                  <input
                    type="checkbox"
                    checked={excludeSundays}
                    onChange={(e) => setExcludeSundays(e.target.checked)}
                    className="bulk-checkbox-input"
                  />
                  <span>Exclude Sundays (Skip Sundays)</span>
                </label>

                <label className="bulk-checkbox-label">
                  <input
                    type="checkbox"
                    checked={excludeSaturdays}
                    onChange={(e) => setExcludeSaturdays(e.target.checked)}
                    className="bulk-checkbox-input"
                  />
                  <span>Exclude Saturdays (Skip Saturdays)</span>
                </label>

                <label className="bulk-checkbox-label bulk-checkbox-label--holiday">
                  <input
                    type="checkbox"
                    checked={excludeHolidays}
                    onChange={(e) => setExcludeHolidays(e.target.checked)}
                    className="bulk-checkbox-input"
                  />
                  <span>🎉 Exclude Holidays (Skip {holidaysInRange.length} holiday{holidaysInRange.length !== 1 ? 's' : ''} in range)</span>
                </label>

                {/* Show holidays in range */}
                {excludeHolidays && holidaysInRange.length > 0 && (
                  <div className="bulk-holidays-in-range">
                    {holidaysInRange.map(h => (
                      <span key={h.id} className="bulk-holiday-chip">
                        🎉 {h.name} ({h.date})
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="bulk-footer-actions">
                <div className="bulk-status-badge">
                  <Users size={16} color="var(--primary, #e11d48)" />
                  <span>
                    Status: <strong style={{ color: 'var(--primary, #e11d48)' }}>{rangeStatus.toUpperCase()}</strong> | Selected: <strong>{selectedStudentIds.length} Students</strong>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleApplyRangeAttendance}
                  disabled={isApplyingRange || selectedStudentIds.length === 0}
                  className="btn-apply-bulk"
                >
                  <Save size={16} />
                  {isApplyingRange ? 'Applying Bulk Attendance...' : `Apply Bulk Attendance (${selectedStudentIds.length} Students)`}
                </button>
              </div>
            </div>
          </div>

          {/* Embedded Student Selection Sheet */}
          <div className="premium-table-container">
            <div className="premium-table-header">
              <div className="premium-title-wrapper">
                <div className="premium-title-icon">
                  <Users size={20} />
                </div>
                <h3 className="premium-title">Students Selection Sheet</h3>
                <span className="attendance-tab-badge" style={{ backgroundColor: '#fff1f2', color: 'var(--primary, #e11d48)', padding: '4px 10px', fontSize: '0.75rem' }}>
                  {selectedStudentIds.length} of {rangeStudents.length} Selected
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setSelectedStudentIds(rangeStudents.map(s => s.userId))}
                  className="bulk-select-btn"
                >
                  Select All ({rangeStudents.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStudentIds([])}
                  className="bulk-deselect-btn"
                >
                  Deselect All
                </button>

                <div className="search-wrapper" style={{ minWidth: '220px' }}>
                  <Search className="search-icon" size={16} />
                  <input
                    type="text"
                    placeholder="Search student name or phone..."
                    value={modalSearchQuery}
                    onChange={(e) => setModalSearchQuery(e.target.value)}
                    className="premium-search-input"
                  />
                </div>
              </div>
            </div>

            {isFetchingRangeStudents ? (
              <div className="p-12 text-center text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                Loading batch students...
              </div>
            ) : rangeStudents.length === 0 ? (
              <EmptyState 
                title={rangeBatchId ? "No active students found" : "Select a batch"}
                description={rangeBatchId ? "There are no active enrolled students found in this batch for the selected date range." : "Please choose a batch from the dropdown above to view students."}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="premium-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>Select</th>
                      <th>#</th>
                      <th>Student Name</th>
                      <th>Mobile</th>
                      <th style={{ textAlign: 'center' }}>Selection Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rangeStudents
                      .filter(s => s.name.toLowerCase().includes(modalSearchQuery.toLowerCase()) || (s.phone && s.phone.includes(modalSearchQuery)))
                      .map((student, idx) => {
                        const isSelected = selectedStudentIds.includes(student.userId);
                        return (
                          <tr
                            key={student.userId}
                            onClick={() => {
                              setSelectedStudentIds(prev =>
                                prev.includes(student.userId)
                                  ? prev.filter(id => id !== student.userId)
                                  : [...prev, student.userId]
                              );
                            }}
                            className={`cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''}`}
                          >
                            <td>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}} // Handled by tr click
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                            </td>
                            <td style={{ color: 'var(--text-light)', fontWeight: '600' }}>{idx + 1}</td>
                            <td>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 font-bold flex items-center justify-center text-xs shadow-sm border border-indigo-200 dark:border-indigo-800">
                                  {student.name ? student.name.charAt(0).toUpperCase() : 'S'}
                                </div>
                                <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>{student.name}</span>
                              </div>
                            </td>
                            <td style={{ color: 'var(--text-muted)' }}>{student.phone || '-'}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                isSelected 
                                  ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300' 
                                  : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                              }`}>
                                {isSelected ? '✓ Included in Bulk' : '✕ Excluded'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* TAB 1: SINGLE DAY ATTENDANCE VIEW */
        <div className="space-y-6">
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
              max={todayStr}
              onChange={(e) => {
                const val = e.target.value;
                if (val > todayStr) {
                  alert("Future dates are disabled for attendance.");
                  setSelectedDate(todayStr);
                } else {
                  setSelectedDate(val);
                }
              }}
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

              <button
                type="button"
                onClick={() => handleMarkAll('holiday')}
                disabled={studentList.length === 0}
                className="btn-holiday"
              >
                <PartyPopper size={16} /> Mark All Holiday
              </button>
            </div>
          </div>

          {/* ─── Holiday Banner ───────────────────────────────────────────── */}
          {currentDateHoliday && (
            <div className="holiday-banner">
              <div className="holiday-banner-icon">🎉</div>
              <div className="holiday-banner-content">
                <div className="holiday-banner-title">Holiday: {currentDateHoliday.name}</div>
                {currentDateHoliday.description && (
                  <div className="holiday-banner-desc">{currentDateHoliday.description}</div>
                )}
                <div className="holiday-banner-note">
                  <AlertTriangle size={13} />
                  All students have been defaulted to "Holiday" status. You can still change individual statuses.
                </div>
              </div>
              <div className="holiday-banner-date">
                {new Date(currentDateHoliday.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
          )}

          {/* Overview Cards */}
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

              {holidayCount > 0 && (
                <div className="premium-card card-holiday">
                  <div className="premium-icon-wrapper">
                    <PartyPopper size={32} />
                  </div>
                  <div>
                    <div className="premium-label">Holiday</div>
                    <div className="premium-value">{holidayCount}</div>
                  </div>
                </div>
              )}
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

              <div className="flex items-center gap-3">
                {/* Quick Status Filter Pills */}
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      statusFilter === 'all' 
                        ? 'bg-indigo-600 text-white shadow-sm' 
                        : 'text-slate-600 dark:text-slate-300 hover:text-indigo-600'
                    }`}
                  >
                    All ({studentList.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatusFilter('present')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      statusFilter === 'present' 
                        ? 'bg-emerald-600 text-white shadow-sm' 
                        : 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50'
                    }`}
                  >
                    Present ({presentCount})
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatusFilter('absent')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      statusFilter === 'absent' 
                        ? 'bg-rose-600 text-white shadow-sm' 
                        : 'text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50'
                    }`}
                  >
                    Absent ({absentCount})
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatusFilter('late')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      statusFilter === 'late' 
                        ? 'bg-amber-600 text-white shadow-sm' 
                        : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50'
                    }`}
                  >
                    Late ({lateCount})
                  </button>
                </div>

                <div className="search-wrapper" style={{ minWidth: '220px' }}>
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
            </div>

            {isLoading ? (
              <div className="p-12 text-center text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                Loading batch students...
              </div>
            ) : filteredStudents.length === 0 ? (
              <EmptyState 
                title={selectedBatchId ? (searchQuery ? "No matching students found" : "No active students in this batch") : "Select a batch"}
                description={selectedBatchId ? (searchQuery ? `No student matched "${searchQuery}".` : "There are currently no active students assigned to this batch.") : "Please select a batch from the dropdown above to load the student roster."}
              />
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
                      <tr key={student.userId} className={student.status === 'holiday' ? 'holiday-row' : ''}>
                        <td style={{ color: 'var(--text-light)', fontWeight: '600' }}>{idx + 1}</td>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 font-bold flex items-center justify-center text-xs shadow-sm border border-indigo-200 dark:border-indigo-800">
                              {student.studentName ? student.studentName.charAt(0).toUpperCase() : 'S'}
                            </div>
                            <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>{student.studentName}</span>
                          </div>
                        </td>
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

                            <button
                              type="button"
                              onClick={() => handleStatusChange(student.userId, 'holiday')}
                              className={`status-btn ${student.status === 'holiday' ? 'active-holiday' : ''}`}
                            >
                              🎉 Holiday
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
      )}
    </div>
  );
};

export default Attendance;
