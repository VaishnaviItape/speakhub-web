import React, { useState, useEffect } from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import type { Course, Batch } from '../../types/models';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs, updateDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { secondaryAuth } from '../../config/secondaryFirebase';
import { auth } from '../../config/firebase';
import { sendEmail } from '../../utils/emailService';
import { checkMobileExists } from '../../utils/phoneValidation';
import { validateName, validatePhoneNumber } from '../../utils/validation';
import '../../components/ui/TableStyles.css';

const Students: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
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

    try {
      if (phone) {
        const mobileCheck = await checkMobileExists(phone, editingId);
        if (mobileCheck.exists) {
          alert(mobileCheck.message || "This mobile number is already registered to another user.");
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

      const generateStudentPassword = (nameStr: string) => {
        const cleanName = nameStr.trim().split(' ')[0].toLowerCase().replace(/[^a-z]/g, '');
        const prefix = cleanName.length >= 4 ? cleanName.substring(0, 4) : cleanName.padEnd(4, 'x');
        return `${prefix}2003`;
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

          alert(`Student Created Successfully!\n\nPlease share these login credentials with the student:\nPhone Number: ${phone}\nPassword: ${defaultPassword}`);

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
        let isApproving = false;
        const studentToEdit = students.find(s => s.documentId === editingId);

        if (studentToEdit && studentToEdit.status === 'pending' && status === 'active') {
          isApproving = true;
        }

        const userRef = doc(db, 'users', editingId);

        if (isApproving) {
          const studentPhone = studentToEdit.phone || studentToEdit.mobile || phone;
          if (studentPhone) {
            try {
              const studentAuthEmail = `${studentPhone.replace(/[^0-9]/g, '')}@speakhub.com`;
              const defaultPassword = generateStudentPassword(studentToEdit.name || firstName);
              await createUserWithEmailAndPassword(secondaryAuth, studentAuthEmail, defaultPassword);

              updates.forcePasswordChange = true;
              updates.plainPassword = defaultPassword;

              alert(`Student Approved Successfully!\n\nPlease share these login credentials with the student:\nPhone Number: ${studentPhone}\nPassword: ${defaultPassword}`);
            } catch (authError: any) {
              if (authError.code === 'auth/email-already-in-use') {
                console.log("User already exists in Firebase Auth, just updating Firestore.");
                alert(`Student Approved Successfully!\n\nNote: The phone number ${studentPhone} already has an account set up.`);
              } else {
                throw authError;
              }
            }
          }
        }

        await updateDoc(userRef, updates);
        setStudents(students.map(s => s.documentId === editingId ? { ...s, ...updates } : s));
      }

      setIsModalOpen(false);
      resetForm();
    } catch (error: any) {
      console.error('Error saving student:', error);
      alert('Failed to save student: ' + error.message);
    }
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
  };

  const handleEdit = (student: any) => {
    const names = student.name ? student.name.split(' ') : [''];
    setEditingId(student.documentId);
    setFirstName(names[0] || '');
    setLastName(names.slice(1).join(' ') || '');
    setPhone(student.phone || student.mobile || '');
    setAddress(student.address || '');
    setParentOrHusbandName(student.parentOrHusbandName || student.parentName || '');

    if (student.joiningDate?.toDate) {
      setJoiningDate(student.joiningDate.toDate().toISOString().split('T')[0]);
    } else if (student.joiningDate) {
      const dStr = String(student.joiningDate);
      setJoiningDate(dStr.includes('T') ? dStr.split('T')[0] : dStr);
    } else {
      setJoiningDate(new Date().toISOString().split('T')[0]);
    }

    setCourseId(student.courseIds?.[0] || '');
    setBatchId(student.batchIds?.[0] || '');
    setStatus(student.status || 'pending');
    setIsDemoMode(student.isDemoMode || false);

    setDemoStartDate(student.demoStartDate?.toDate ? student.demoStartDate.toDate().toISOString().split('T')[0] : (student.demoStartDate instanceof Date ? student.demoStartDate.toISOString().split('T')[0] : ''));
    setDemoEndDate(student.demoEndDate?.toDate ? student.demoEndDate.toDate().toISOString().split('T')[0] : (student.demoEndDate instanceof Date ? student.demoEndDate.toISOString().split('T')[0] : ''));

    setIsModalOpen(true);
  };

  const handleDelete = async (student: any) => {
    if (window.confirm(`Are you sure you want to delete ${student.name}?`)) {
      try {
        await deleteDoc(doc(db, 'users', student.documentId));
        setStudents(students.filter(s => s.documentId !== student.documentId));
      } catch (error: any) {
        alert("Failed to delete student: " + error.message);
      }
    }
  };

  const columns: Column<any>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => <span className="font-medium">{row.name}</span>
    },
    {
      key: 'parentOrHusbandName',
      header: 'Parent / Husband Name',
      render: (row) => <span className="text-gray-700 font-medium">{row.parentOrHusbandName || row.parentName || '-'}</span>
    },
    {
      key: 'phone',
      header: 'Phone / Address',
      render: (row) => (
        <div>
          <div className="font-medium">{row.phone || row.mobile || '-'}</div>
          <div style={{ fontSize: '0.75rem', color: '#a3aed0' }}>{row.address || 'No address provided'}</div>
        </div>
      )
    },
    {
      key: 'joiningDate',
      header: 'Date of Joining',
      render: (row) => {
        if (!row.joiningDate) return <span className="text-gray-400">-</span>;
        const d = row.joiningDate?.toDate ? row.joiningDate.toDate() : new Date(row.joiningDate);
        return <span className="text-xs text-gray-700 font-medium">{isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-GB')}</span>;
      }
    },
    {
      key: 'courseId',
      header: 'Course / Batch',
      render: (row) => {
        const courseName = courses.find(c => c.documentId === row.courseIds?.[0])?.courseName || 'Unassigned';
        const batchName = batches.find(b => b.documentId === row.batchIds?.[0])?.batchName || 'Unassigned';
        return (
          <div>
            <div>{courseName}</div>
            <div style={{ fontSize: '0.75rem', color: '#a3aed0' }}>{batchName}</div>
          </div>
        );
      }
    },
    // {
    //   key: 'plainPassword',
    //   header: 'Initial Password',
    //   render: (row) => (
    //     <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded border border-gray-200">
    //       {row.plainPassword || 'Changed/Unknown'}
    //     </span>
    //   )
    // },
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
      <div className="page-header flex justify-between items-center w-full">
        <div>
          <h1 className="page-title">Students & Approvals</h1>
          <div className="breadcrumbs">
            <span>Dashboard</span> <span className="separator">/</span> <span className="current">Students</span>
          </div>
        </div>
        <button
          className="btn flex items-center justify-center gap-2 bg-red-600 text-white hover:bg-red-700 px-4 py-2 rounded-md font-medium transition-colors"
          onClick={() => { resetForm(); setIsModalOpen(true); }}
        >
          <Plus size={18} />
          Add Student
        </button>
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

          <div className="grid grid-cols-2 gap-4 mb-4">
            <Input
              label="Parent / Husband Name"
              value={parentOrHusbandName}
              onChange={(e) => setParentOrHusbandName(e.target.value)}
              placeholder="e.g. Vishnu Itape"
            />
            <Input
              label="Date of Joining"
              type="date"
              value={joiningDate}
              onChange={(e) => setJoiningDate(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <Input
              label="Phone Number"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required={!editingId}
              placeholder="e.g. 9876543210"
            />
            <Input
              label="Address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Full address"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Assign Course"
              options={[
                { label: 'Select Course', value: '' },
                ...courses.map(c => ({ label: c.courseName, value: c.documentId || '' }))
              ]}
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            />
            <Select
              label="Assign Batch"
              options={[
                { label: 'Select Batch', value: '' },
                ...batches
                  .filter(b => !courseId || b.courseId === courseId) // Optionally filter batches by selected course
                  .map(b => ({ label: b.batchName, value: b.documentId || '' }))
              ]}
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
            />
          </div>

          <Select
            label="Status"
            options={[
              { label: 'Pending', value: 'pending' },
              { label: 'Active (Approve)', value: 'active' },
              { label: 'Inactive', value: 'inactive' }
            ]}
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
          />

          {status === 'active' && students.find(s => s.documentId === editingId)?.status === 'pending' && (
            <p className="text-sm text-green-600 mt-2 font-medium">
              Approving this student will generate a default password credentials notification.
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
