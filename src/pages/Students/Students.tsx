import React, { useState, useEffect } from 'react';
import { Plus, Upload, Download, RefreshCw, Users, CheckCircle2, UserX, Sparkles, FileSpreadsheet } from 'lucide-react';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import type { Course, Batch } from '../../types/models';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { secondaryAuth } from '../../config/secondaryFirebase';
import { checkMobileExists } from '../../utils/phoneValidation';
import { validateName, validatePhoneNumber } from '../../utils/validation';
import '../../components/ui/TableStyles.css';
import './Students.css';

interface ParsedCsvStudent {
  name: string;
  phone: string;
  parentName: string;
  courseName: string;
  batchName: string;
  joiningDate: string;
  address: string;
  isValid: boolean;
  validationError?: string;
  matchedCourseId?: string;
  matchedBatchId?: string;
}

const Students: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter State
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('all');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Single Student Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [parentOrHusbandName, setParentOrHusbandName] = useState('');
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'pending'>('active');
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoStartDate, setDemoStartDate] = useState('');
  const [demoEndDate, setDemoEndDate] = useState('');

  // Bulk Upload State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedCsvStudent[]>([]);
  const [isUploadingBulk, setIsUploadingBulk] = useState(false);
  const [bulkUploadSummary, setBulkUploadSummary] = useState<string | null>(null);

  // Data
  const [students, setStudents] = useState<any[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  useEffect(() => {
    fetchStudents();
    fetchDependencies();
  }, []);

  const fetchDependencies = async () => {
    try {
      // Fetch Courses
      const cq = query(collection(db, 'courses'), where('status', '==', 'active'));
      const cSnapshot = await getDocs(cq);
      const activeCourses: Course[] = [];
      cSnapshot.forEach(doc => activeCourses.push({ documentId: doc.id, ...doc.data() } as Course));
      setCourses(activeCourses);

      // Fetch Batches
      const bq = query(collection(db, 'batches'), where('status', '==', 'active'));
      const bSnapshot = await getDocs(bq);
      const activeBatches: Batch[] = [];
      bSnapshot.forEach(doc => activeBatches.push({ documentId: doc.id, ...doc.data() } as Batch));
      setBatches(activeBatches);
    } catch (error) {
      console.error("Error fetching dependencies:", error);
    }
  };

  const fetchStudents = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'student'));
      const querySnapshot = await getDocs(q);
      const studentsList: any[] = [];
      querySnapshot.forEach((doc) => {
        studentsList.push({ documentId: doc.id, ...doc.data() });
      });
      setStudents(studentsList);
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateStudentPassword = (nameStr: string) => {
    const cleanName = nameStr.trim().split(' ')[0].toLowerCase().replace(/[^a-z]/g, '');
    const prefix = cleanName.length >= 4 ? cleanName.substring(0, 4) : cleanName.padEnd(4, 'x');
    return `${prefix}2003`;
  };

  const resetForm = () => {
    setEditingId(null);
    setFirstName('');
    setLastName('');
    setPhone('');
    setAddress('');
    setParentOrHusbandName('');
    setJoiningDate(new Date().toISOString().split('T')[0]);
    setCourseId('');
    setBatchId('');
    setStatus('active');
    setIsDemoMode(false);
    setDemoStartDate('');
    setDemoEndDate('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const firstNameVal = validateName(firstName, 'First Name');
    if (!firstNameVal.isValid) {
      alert(firstNameVal.error);
      return;
    }

    if (lastName.trim()) {
      const lastNameVal = validateName(lastName, 'Last Name');
      if (!lastNameVal.isValid) {
        alert(lastNameVal.error);
        return;
      }
    }

    if (parentOrHusbandName.trim()) {
      const parentVal = validateName(parentOrHusbandName, 'Parent/Husband Name');
      if (!parentVal.isValid) {
        alert(parentVal.error);
        return;
      }
    }

    const phoneVal = validatePhoneNumber(phone, 'Phone Number');
    if (!phoneVal.isValid) {
      alert(phoneVal.error);
      return;
    }

    setIsSubmitting(true);
    try {
      if (phone) {
        const mobileCheck = await checkMobileExists(phone, editingId);
        if (mobileCheck.exists) {
          alert(mobileCheck.message || "This mobile number is already registered to another user.");
          setIsSubmitting(false);
          return;
        }
      }

      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const authEmail = `${cleanPhone}@speakhub.com`;

      const updates: any = {
        name: firstName + (lastName ? ' ' + lastName : ''),
        phone: phone,
        mobile: phone,
        email: authEmail,
        address: address,
        parentOrHusbandName: parentOrHusbandName,
        parentName: parentOrHusbandName,
        joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
        role: 'student',
        courseIds: courseId ? [courseId] : [],
        batchIds: batchId ? [batchId] : [],
        courseId: courseId || '',
        batchId: batchId || '',
        status,
        isDemoMode,
        demoStartDate: isDemoMode && demoStartDate ? new Date(demoStartDate) : null,
        demoEndDate: isDemoMode && demoEndDate ? new Date(demoEndDate) : null,
      };

      if (!editingId) {
        // Create new user
        updates.createdAt = new Date();
        updates.forcePasswordChange = true;
        const defaultPassword = generateStudentPassword(firstName);
        updates.plainPassword = defaultPassword;

        try {
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, authEmail, defaultPassword);
          updates.uid = userCredential.user.uid;
          const newUserRef = doc(db, 'users', userCredential.user.uid);
          await setDoc(newUserRef, updates);

          alert(`Student Created Successfully!\n\nLogin Credentials:\nPhone: ${phone}\nPassword: ${defaultPassword}`);
          setStudents([...students, { documentId: userCredential.user.uid, ...updates }]);
        } catch (authError: any) {
          if (authError.code === 'auth/email-already-in-use') {
            alert('A user with this phone number already exists.');
          } else {
            throw authError;
          }
          return;
        }
      } else {
        // Edit existing user
        const userRef = doc(db, 'users', editingId);
        await setDoc(userRef, updates, { merge: true });
        setStudents(students.map(s => s.documentId === editingId ? { ...s, ...updates } : s));
      }

      setIsModalOpen(false);
      resetForm();
    } catch (error: any) {
      console.error("Error saving student:", error);
      alert("Failed to save student: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (student: any) => {
    setEditingId(student.documentId);
    const nameParts = (student.name || '').split(' ');
    setFirstName(nameParts[0] || '');
    setLastName(nameParts.slice(1).join(' ') || '');
    setPhone(student.phone || student.mobile || '');
    setAddress(student.address || '');
    setParentOrHusbandName(student.parentOrHusbandName || student.parentName || '');

    if (student.joiningDate) {
      const d = student.joiningDate?.toDate ? student.joiningDate.toDate() : new Date(student.joiningDate);
      setJoiningDate(!isNaN(d.getTime()) ? d.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    } else {
      setJoiningDate(new Date().toISOString().split('T')[0]);
    }

    setCourseId(student.courseIds?.[0] || student.courseId || '');
    setBatchId(student.batchIds?.[0] || student.batchId || '');
    setStatus(student.status || 'active');
    setIsDemoMode(student.isDemoMode || false);

    setDemoStartDate(student.demoStartDate?.toDate ? student.demoStartDate.toDate().toISOString().split('T')[0] : '');
    setDemoEndDate(student.demoEndDate?.toDate ? student.demoEndDate.toDate().toISOString().split('T')[0] : '');

    setIsModalOpen(true);
  };

  const handleDelete = async (student: any) => {
    if (window.confirm(`Are you sure you want to delete "${student.name}"?`)) {
      try {
        await deleteDoc(doc(db, 'users', student.documentId));
        setStudents(students.filter(s => s.documentId !== student.documentId));
      } catch (error: any) {
        alert("Failed to delete student: " + error.message);
      }
    }
  };

  // --- Bulk CSV Upload Handling ---
  const downloadSampleCsvTemplate = () => {
    const headers = "FullName,PhoneNumber,ParentOrHusbandName,CourseName,BatchName,JoiningDate(YYYY-MM-DD),Address\n";
    const sample1 = "Aarav Sharma,9876543210,Ramesh Sharma,Spoken English,Morning Batch 9AM,2026-08-31,Pune Maharashtra\n";
    const sample2 = "Pooja Patil,9876543211,Suresh Patil,Abacus & Vedic Maths,Evening Batch 5PM,2026-08-31,Kolhapur Maharashtra\n";
    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(headers + sample1 + sample2);
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", "speakhub_students_sample_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCsvText = (text: string) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length <= 1) {
      alert("CSV file appears to be empty or has only headers.");
      return;
    }

    const rows: ParsedCsvStudent[] = [];
    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Match comma separation handling quotes
      const parts = line.split(',').map(p => p.replace(/^["']|["']$/g, '').trim());
      const name = parts[0] || '';
      const phone = (parts[1] || '').replace(/[^0-9]/g, '');
      const parentName = parts[2] || '';
      const courseName = parts[3] || '';
      const batchName = parts[4] || '';
      const joiningDate = parts[5] || new Date().toISOString().split('T')[0];
      const address = parts[6] || '';

      // Match course & batch
      const matchedCourse = courses.find(c => c.courseName.toLowerCase() === courseName.toLowerCase());
      const matchedBatch = batches.find(b => b.batchName.toLowerCase() === batchName.toLowerCase());

      let isValid = true;
      let validationError = '';

      if (!name || name.length < 2) {
        isValid = false;
        validationError = 'Name too short';
      } else if (!phone || phone.length !== 10) {
        isValid = false;
        validationError = '10-digit phone required';
      }

      rows.push({
        name,
        phone,
        parentName,
        courseName,
        batchName,
        joiningDate,
        address,
        isValid,
        validationError,
        matchedCourseId: matchedCourse?.documentId,
        matchedBatchId: matchedBatch?.documentId
      });
    }

    setParsedRows(rows);
  };

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setBulkUploadSummary(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) parseCsvText(content);
    };
    reader.readAsText(file);
  };

  const handleProcessBulkUpload = async () => {
    const validRows = parsedRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      alert("No valid student rows to upload. Please review errors.");
      return;
    }

    setIsUploadingBulk(true);
    let successCount = 0;
    let failCount = 0;

    for (const row of validRows) {
      try {
        const cleanPhone = row.phone;
        const authEmail = `${cleanPhone}@speakhub.com`;
        const defaultPassword = generateStudentPassword(row.name);

        const newStudentData: any = {
          name: row.name,
          phone: cleanPhone,
          mobile: cleanPhone,
          email: authEmail,
          parentOrHusbandName: row.parentName,
          parentName: row.parentName,
          address: row.address,
          joiningDate: row.joiningDate ? new Date(row.joiningDate) : new Date(),
          role: 'student',
          courseIds: row.matchedCourseId ? [row.matchedCourseId] : [],
          batchIds: row.matchedBatchId ? [row.matchedBatchId] : [],
          courseId: row.matchedCourseId || '',
          batchId: row.matchedBatchId || '',
          status: 'active',
          plainPassword: defaultPassword,
          forcePasswordChange: true,
          createdAt: new Date()
        };

        // Create Auth Account
        try {
          const cred = await createUserWithEmailAndPassword(secondaryAuth, authEmail, defaultPassword);
          newStudentData.uid = cred.user.uid;
          await setDoc(doc(db, 'users', cred.user.uid), newStudentData);
        } catch (authErr: any) {
          // If auth already exists, write/merge by phone query or custom id
          const customId = `student_${cleanPhone}`;
          await setDoc(doc(db, 'users', customId), newStudentData, { merge: true });
        }

        successCount++;
      } catch (err) {
        console.error("Failed to import student row:", row, err);
        failCount++;
      }
    }

    setIsUploadingBulk(false);
    setBulkUploadSummary(`✅ Bulk Upload Complete! Successfully created ${successCount} student account(s). ${failCount > 0 ? `(${failCount} failed)` : ''}`);
    fetchStudents();
  };

  // --- Export Filtered Students to CSV ---
  const handleExportFilteredCSV = () => {
    if (filteredStudents.length === 0) {
      alert("No students to export.");
      return;
    }

    const headers = "StudentName,Phone,ParentName,Course,Batch,JoiningDate,Status\n";
    const rows = filteredStudents.map(s => {
      const cName = courses.find(c => c.documentId === (s.courseIds?.[0] || s.courseId))?.courseName || 'Unassigned';
      const bName = batches.find(b => b.documentId === (s.batchIds?.[0] || s.batchId))?.batchName || 'Unassigned';
      const jDate = s.joiningDate?.toDate ? s.joiningDate.toDate().toLocaleDateString('en-GB') : (s.joiningDate || '-');
      return `"${s.name || ''}","${s.phone || s.mobile || ''}","${s.parentOrHusbandName || s.parentName || ''}","${cName}","${bName}","${jDate}","${s.status || 'active'}"`;
    }).join('\n');

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(headers + rows);
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `speakhub_students_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered Students Computation
  const filteredStudents = students.filter(student => {
    // 1. Course Filter
    const studentCourseId = student.courseIds?.[0] || student.courseId;
    if (selectedCourseFilter !== 'all' && studentCourseId !== selectedCourseFilter) {
      return false;
    }

    // 2. Batch Filter
    const studentBatchId = student.batchIds?.[0] || student.batchId;
    if (selectedBatchFilter !== 'all' && studentBatchId !== selectedBatchFilter) {
      return false;
    }

    // 3. Status Filter
    if (selectedStatusFilter === 'active' && student.status !== 'active') return false;
    if (selectedStatusFilter === 'inactive' && student.status !== 'inactive') return false;
    if (selectedStatusFilter === 'pending' && student.status !== 'pending') return false;
    if (selectedStatusFilter === 'demo' && !student.isDemoMode) return false;

    // 4. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesName = (student.name || '').toLowerCase().includes(q);
      const matchesPhone = (student.phone || student.mobile || '').includes(q);
      const matchesParent = (student.parentOrHusbandName || student.parentName || '').toLowerCase().includes(q);
      return matchesName || matchesPhone || matchesParent;
    }

    return true;
  });

  const columns: Column<any>[] = [
    {
      key: 'name',
      header: 'Student Name',
      render: (row) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-white text-sm">{row.name}</div>
          <div className="text-xs text-slate-400 font-medium">Phone: {row.phone || row.mobile || '-'}</div>
        </div>
      )
    },
    {
      key: 'parentOrHusbandName',
      header: 'Parent / Guardian',
      render: (row) => <span className="text-slate-700 dark:text-slate-300 font-medium text-xs">{row.parentOrHusbandName || row.parentName || '-'}</span>
    },
    {
      key: 'courseId',
      header: 'Course & Batch',
      render: (row) => {
        const courseName = courses.find(c => c.documentId === (row.courseIds?.[0] || row.courseId))?.courseName || 'Unassigned';
        const batchName = batches.find(b => b.documentId === (row.batchIds?.[0] || row.batchId))?.batchName || 'Unassigned';
        return (
          <div>
            <div className="font-semibold text-xs text-indigo-600 dark:text-indigo-400">{courseName}</div>
            <div className="text-[11px] text-slate-500 font-medium">{batchName}</div>
          </div>
        );
      }
    },
    {
      key: 'joiningDate',
      header: 'Joining Date',
      render: (row) => {
        if (!row.joiningDate) return <span className="text-slate-400 text-xs">-</span>;
        const d = row.joiningDate?.toDate ? row.joiningDate.toDate() : new Date(row.joiningDate);
        return <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>;
      }
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        let badgeClass = 'inactive';
        if (row.status === 'active') badgeClass = 'active';
        if (row.status === 'pending') badgeClass = 'pending';
        return (
          <div className="flex flex-col gap-1 items-start">
            <span className={`dt-badge ${badgeClass}`}>
              {row.status ? row.status.charAt(0).toUpperCase() + row.status.slice(1) : 'Active'}
            </span>
            {row.isDemoMode && (
              <span className="text-[10px] bg-purple-100 text-purple-800 font-extrabold px-2 py-0.5 rounded-full border border-purple-200">
                DEMO
              </span>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div className="page-container">
      {/* Top Header */}
      <div className="student-master-header">
        <div>
          <h1 className="page-title">Student Master &amp; Directory</h1>
          <div className="breadcrumbs">
            <span>Dashboard</span> <span className="separator">/</span> <span className="current">Student Master</span>
          </div>
        </div>

        <div className="student-header-actions">
          <button
            type="button"
            className="btn-add-student"
            onClick={() => { resetForm(); setIsModalOpen(true); }}
          >
            <Plus size={18} />
            Add New Student
          </button>

          <button
            type="button"
            className="btn-bulk-upload"
            onClick={() => { setCsvFile(null); setParsedRows([]); setBulkUploadSummary(null); setIsBulkModalOpen(true); }}
          >
            <Upload size={16} />
            Bulk CSV Upload
          </button>

          <button
            type="button"
            className="btn-export-csv"
            onClick={handleExportFilteredCSV}
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filter & Summary Card */}
      <div className="student-filter-card">
        {/* Metric Pills */}
        <div className="student-stats-row">
          <button 
            type="button" 
            className={`student-stat-pill all ${selectedStatusFilter === 'all' ? 'selected' : ''}`}
            onClick={() => setSelectedStatusFilter('all')}
          >
            <Users size={14} /> Total Students: <strong>{students.length}</strong>
          </button>

          <button 
            type="button" 
            className={`student-stat-pill active ${selectedStatusFilter === 'active' ? 'selected' : ''}`}
            onClick={() => setSelectedStatusFilter('active')}
          >
            <CheckCircle2 size={14} /> Active: <strong>{students.filter(s => s.status === 'active').length}</strong>
          </button>

          <button 
            type="button" 
            className={`student-stat-pill inactive ${selectedStatusFilter === 'inactive' ? 'selected' : ''}`}
            onClick={() => setSelectedStatusFilter('inactive')}
          >
            <UserX size={14} /> Inactive: <strong>{students.filter(s => s.status === 'inactive' || s.status === 'pending').length}</strong>
          </button>

          <button 
            type="button" 
            className={`student-stat-pill demo ${selectedStatusFilter === 'demo' ? 'selected' : ''}`}
            onClick={() => setSelectedStatusFilter('demo')}
          >
            <Sparkles size={14} /> Demo Students: <strong>{students.filter(s => s.isDemoMode).length}</strong>
          </button>
        </div>

        {/* Filter Dropdowns Grid */}
        <div className="student-filters-grid">
          <Select
            label="Filter by Course"
            options={[{ label: 'All Courses', value: 'all' }, ...courses.map(c => ({ label: c.courseName, value: c.documentId! }))]}
            value={selectedCourseFilter}
            onChange={(e) => setSelectedCourseFilter(e.target.value)}
          />

          <Select
            label="Filter by Batch"
            options={[{ label: 'All Batches', value: 'all' }, ...batches.map(b => ({ label: b.batchName, value: b.documentId! }))]}
            value={selectedBatchFilter}
            onChange={(e) => setSelectedBatchFilter(e.target.value)}
          />

          <Select
            label="Filter by Status"
            options={[
              { label: 'All Statuses', value: 'all' },
              { label: 'Active Students', value: 'active' },
              { label: 'Inactive Students', value: 'inactive' },
              { label: 'Pending Approval', value: 'pending' },
              { label: 'Demo Mode Students', value: 'demo' }
            ]}
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
          />

          <Input
            label="Search Student"
            placeholder="Search by Name, Phone, or Parent..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <button
            type="button"
            className="btn"
            style={{ backgroundColor: '#f1f5f9', color: '#475569', height: '42px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.8rem' }}
            onClick={() => { setSelectedCourseFilter('all'); setSelectedBatchFilter('all'); setSelectedStatusFilter('all'); setSearchQuery(''); }}
          >
            <RefreshCw size={14} /> Reset
          </button>
        </div>
      </div>

      {/* Main Students Data Table */}
      <DataTable
        title={`Student Directory (${filteredStudents.length} Students)`}
        data={filteredStudents}
        columns={columns}
        onEdit={handleEdit}
        onDelete={handleDelete}
        searchPlaceholder="Search student name, phone, course..."
        isLoading={isLoading}
      />

      {/* MODAL 1: Add / Edit Single Student */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title={editingId ? "Edit Student Details" : "Register New Student"}>
        <form onSubmit={handleSubmit} className="modal-form" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '75vh', overflowY: 'auto', paddingRight: '6px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <Input label="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            <Input label="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <Input label="Mobile / WhatsApp Number" type="tel" maxLength={10} placeholder="10-digit number" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            <Input label="Parent / Guardian / Husband Name" value={parentOrHusbandName} onChange={(e) => setParentOrHusbandName(e.target.value)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <Select
              label="Assigned Course"
              options={[{ label: 'Select Course', value: '' }, ...courses.map(c => ({ label: c.courseName, value: c.documentId! }))]}
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              required
            />

            <Select
              label="Assigned Batch"
              options={[{ label: 'Select Batch', value: '' }, ...batches.map(b => ({ label: b.batchName, value: b.documentId! }))]}
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <Input label="Date of Joining" type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} required />
            <Select
              label="Account Status"
              options={[
                { label: 'Active', value: 'active' },
                { label: 'Inactive', value: 'inactive' },
                { label: 'Pending Approval', value: 'pending' }
              ]}
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              required
            />
          </div>

          <Input label="Residential Address" placeholder="City, Area, Address details..." value={address} onChange={(e) => setAddress(e.target.value)} />

          {/* Demo Mode Toggle */}
          <div style={{ backgroundColor: '#faf5ff', padding: '0.85rem', borderRadius: '12px', border: '1px solid #e9d5ff' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 700, color: '#6b21a8', cursor: 'pointer' }}>
              <input type="checkbox" checked={isDemoMode} onChange={(e) => setIsDemoMode(e.target.checked)} style={{ accentColor: '#7c3aed' }} />
              <span>Enable Demo Access for Student</span>
            </label>

            {isDemoMode && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginTop: '0.75rem' }}>
                <Input label="Demo Start Date" type="date" value={demoStartDate} onChange={(e) => setDemoStartDate(e.target.value)} required={isDemoMode} />
                <Input label="Demo End Date" type="date" value={demoEndDate} onChange={(e) => setDemoEndDate(e.target.value)} required={isDemoMode} />
              </div>
            )}
          </div>

          <div className="modal-actions" style={{ marginTop: '0.75rem' }}>
            <button type="button" className="btn" style={{ backgroundColor: '#e2e8f0', color: '#334155' }} onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ fontWeight: 800 }}>
              {isSubmitting ? 'Saving Student...' : (editingId ? 'Update Student' : 'Create & Register Student')}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Bulk CSV Upload */}
      <Modal isOpen={isBulkModalOpen} onClose={() => setIsBulkModalOpen(false)} title="Bulk Upload Students (CSV)">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '75vh', overflowY: 'auto', paddingRight: '6px' }}>
          {/* Step 1: Sample Download */}
          <div className="bulk-sample-banner">
            <div>
              <strong style={{ fontSize: '0.85rem', color: '#1e40af', display: 'block' }}>1. Download Sample Excel/CSV Template</strong>
              <span style={{ fontSize: '0.75rem', color: '#3b82f6' }}>Includes pre-formatted columns (Name, Phone, Course, Batch, etc.)</span>
            </div>
            <button
              type="button"
              className="btn"
              style={{ backgroundColor: '#ffffff', color: '#1e40af', border: '1.5px solid #93c5fd', fontWeight: 800, fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              onClick={downloadSampleCsvTemplate}
            >
              <Download size={14} /> Download Sample CSV
            </button>
          </div>

          {/* Step 2: Dropzone */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
              2. Select or Drop Your CSV File
            </label>
            <div className="bulk-dropzone" onClick={() => document.getElementById('bulk-csv-input')?.click()}>
              <FileSpreadsheet size={32} style={{ color: 'var(--primary, #e11d48)', margin: '0 auto 0.5rem auto' }} />
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>
                {csvFile ? csvFile.name : 'Click to select CSV File or drag & drop here'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                {csvFile ? `${(csvFile.size / 1024).toFixed(1)} KB` : 'Supports UTF-8 formatted CSV files'}
              </div>
              <input
                id="bulk-csv-input"
                type="file"
                accept=".csv,text/csv"
                style={{ display: 'none' }}
                onChange={handleCsvFileChange}
              />
            </div>
          </div>

          {/* Step 3: Parsed Preview */}
          {parsedRows.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                  Parsed Records Preview ({parsedRows.filter(r => r.isValid).length} Valid / {parsedRows.length} Total)
                </span>
              </div>

              <div className="bulk-preview-wrapper">
                <table className="bulk-preview-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Course</th>
                      <th>Batch</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((row, idx) => (
                      <tr key={idx} style={{ backgroundColor: row.isValid ? 'transparent' : '#fff1f2' }}>
                        <td>{idx + 1}</td>
                        <td style={{ fontWeight: 600 }}>{row.name}</td>
                        <td>{row.phone}</td>
                        <td>{row.courseName}</td>
                        <td>{row.batchName}</td>
                        <td>
                          {row.isValid ? (
                            <span style={{ color: '#059669', fontWeight: 700, fontSize: '0.75rem' }}>✓ Ready</span>
                          ) : (
                            <span style={{ color: '#e11d48', fontWeight: 700, fontSize: '0.75rem' }}>{row.validationError}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {bulkUploadSummary && (
            <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '0.85rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 700 }}>
              {bulkUploadSummary}
            </div>
          )}

          <div className="modal-actions" style={{ marginTop: '0.75rem' }}>
            <button type="button" className="btn" style={{ backgroundColor: '#e2e8f0', color: '#334155' }} onClick={() => setIsBulkModalOpen(false)}>Close</button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={isUploadingBulk || parsedRows.filter(r => r.isValid).length === 0}
              style={{ fontWeight: 800 }}
              onClick={handleProcessBulkUpload}
            >
              {isUploadingBulk ? 'Uploading Students...' : `Import ${parsedRows.filter(r => r.isValid).length} Student(s)`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Students;
