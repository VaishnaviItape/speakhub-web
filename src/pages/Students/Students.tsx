import React, { useState, useEffect } from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { secondaryAuth } from '../../config/secondaryFirebase';
import { sendEmail } from '../../utils/emailService';
import '../../components/ui/TableStyles.css';

const Students: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'pending'>('active');
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoStartDate, setDemoStartDate] = useState('');
  const [demoEndDate, setDemoEndDate] = useState('');

  // Data
  const [students, setStudents] = useState<any[]>([]);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, 'users'), where('role', 'in', ['student', 'parent']));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;

    try {
      let isApproving = false;
      const studentToEdit = students.find(s => s.documentId === editingId);
      
      if (studentToEdit && studentToEdit.status === 'pending' && status === 'active') {
        isApproving = true;
      }

      const userRef = doc(db, 'users', editingId);
      const updates: any = {
        name: firstName + (lastName ? ' ' + lastName : ''),
        courseIds: [courseId],
        batchIds: [batchId],
        status,
        isDemoMode,
        demoStartDate: isDemoMode && demoStartDate ? new Date(demoStartDate) : null,
        demoEndDate: isDemoMode && demoEndDate ? new Date(demoEndDate) : null,
      };

      if (isApproving) {
        updates.forcePasswordChange = true;
        
        // Generate Default Password
        const defaultPassword = Math.random().toString(36).slice(-8);

        // Create Auth User via secondary app to prevent admin logout
        if (studentToEdit.email) {
          try {
            await createUserWithEmailAndPassword(secondaryAuth, studentToEdit.email, defaultPassword);
            // Send Approval Email
            await sendEmail(
              studentToEdit.email,
              'Your Speak Hub Academy Account is Approved!',
              `Hello ${firstName},\n\nYour account has been approved and you have been assigned to your batch.\n\nLogin Email: ${studentToEdit.email}\nDefault Password: ${defaultPassword}\n\nPlease log in. You will be asked to change your password on your first login.\n\nThank you,\nSpeak Hub Academy`
            );
          } catch (authError: any) {
            if (authError.code === 'auth/email-already-in-use') {
              console.log("User already exists in Firebase Auth, just updating Firestore.");
            } else {
              throw authError;
            }
          }
        }
      }

      await updateDoc(userRef, updates);

      // Refresh data locally
      setStudents(students.map(s => s.documentId === editingId ? { ...s, ...updates } : s));
      setIsModalOpen(false);
      resetForm();
    } catch (error: any) {
      console.error('Error updating student:', error);
      alert('Failed to update student: ' + error.message);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFirstName('');
    setLastName('');
    setCourseId('');
    setBatchId('');
    setStatus('active');
  };

  const handleEdit = (student: any) => {
    const names = student.name ? student.name.split(' ') : [''];
    setEditingId(student.documentId);
    setFirstName(names[0] || '');
    setLastName(names.slice(1).join(' ') || '');
    setCourseId(student.courseIds?.[0] || '');
    setBatchId(student.batchIds?.[0] || '');
    setStatus(student.status || 'pending');
    setIsDemoMode(student.isDemoMode || false);
    
    setDemoStartDate(student.demoStartDate?.toDate ? student.demoStartDate.toDate().toISOString().split('T')[0] : (student.demoStartDate instanceof Date ? student.demoStartDate.toISOString().split('T')[0] : ''));
    setDemoEndDate(student.demoEndDate?.toDate ? student.demoEndDate.toDate().toISOString().split('T')[0] : (student.demoEndDate instanceof Date ? student.demoEndDate.toISOString().split('T')[0] : ''));
    
    setIsModalOpen(true);
  };

  const handleDelete = (student: any) => {
    // In a real app, delete from Firestore or soft delete
    setStudents(students.filter(s => s.documentId !== student.documentId));
  };

  const columns: Column<any>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => <span className="font-medium">{row.name}</span>
    },
    {
      key: 'email',
      header: 'Email / Phone',
      render: (row) => (
        <div>
          <div>{row.email || '-'}</div>
          <div style={{ fontSize: '0.75rem', color: '#a3aed0' }}>{row.phone || row.mobile || '-'}</div>
        </div>
      )
    },
    {
      key: 'courseId',
      header: 'Course / Batch',
      render: (row) => (
        <div>
          <div>{row.courseIds?.join(', ') || 'Unassigned'}</div>
          <div style={{ fontSize: '0.75rem', color: '#a3aed0' }}>{row.batchIds?.join(', ') || 'Unassigned'}</div>
        </div>
      )
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
            <button className={`dt-badge ${badgeClass}`}>
              {row.status ? row.status.charAt(0).toUpperCase() + row.status.slice(1) : 'Unknown'} <ChevronDown size={14} />
            </button>
            {row.isDemoMode && (
              <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded">DEMO</span>
            )}
          </div>
        )
      }
    }
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Students & Approvals</h1>
          <div className="breadcrumbs">
            <span>Dashboard</span> <span className="separator">/</span> <span className="current">Students</span>
          </div>
        </div>
      </div>

      <DataTable 
        title="Student Records" 
        data={students} 
        columns={columns} 
        onEdit={handleEdit}
        onDelete={handleDelete}
        searchPlaceholder="Search students..."
        isLoading={isLoading}
      />

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title="Manage Student">
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="First Name" 
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required 
            />
            <Input 
              label="Last Name" 
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <Select 
              label="Assign Course" 
              options={[
                {label: 'Select Course', value: ''},
                {label: 'Spoken English Basics', value: 'Course1'}, 
                {label: 'Advanced English', value: 'Course2'}
              ]} 
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            />
            <Select 
              label="Assign Batch" 
              options={[
                {label: 'Select Batch', value: ''},
                {label: 'Morning Batch (Mon-Wed)', value: 'Batch1'}
              ]} 
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
            />
          </div>
          
          <Select 
            label="Status" 
            options={[
              {label: 'Pending', value: 'pending'},
              {label: 'Active (Approve)', value: 'active'},
              {label: 'Inactive', value: 'inactive'}
            ]} 
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
          />
          
          {status === 'active' && students.find(s => s.documentId === editingId)?.status === 'pending' && (
            <p className="text-sm text-green-600 mt-2 font-medium">
              Approving this student will generate a default password and send an email notification.
            </p>
          )}

          <div className="mt-4 p-4 border border-purple-200 bg-purple-50 rounded-lg">
             <label className="flex items-center gap-2 mb-3 cursor-pointer">
               <input type="checkbox" checked={isDemoMode} onChange={(e) => setIsDemoMode(e.target.checked)} className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500" />
               <span className="font-medium text-purple-800">Enable Demo Period</span>
             </label>
             
             {isDemoMode && (
               <div className="grid grid-cols-2 gap-4">
                 <Input label="Demo Start Date" type="date" value={demoStartDate} onChange={(e) => setDemoStartDate(e.target.value)} required />
                 <Input label="Demo End Date" type="date" value={demoEndDate} onChange={(e) => setDemoEndDate(e.target.value)} required />
               </div>
             )}
          </div>

          <div className="modal-actions">
            <button type="submit" className="btn btn-success">Save Student</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Students;
