import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Upload, Download, RefreshCw, Users, CheckCircle2, UserX, Sparkles, FileSpreadsheet, AlertTriangle, BookOpen } from 'lucide-react';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import type { Course, Batch } from '../../types/models';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs, getDoc, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updatePassword, 
  updateEmail, 
  signOut as secondarySignOut,
  deleteUser
} from 'firebase/auth';
import { secondaryAuth } from '../../config/secondaryFirebase';
import { checkMobileExists } from '../../utils/phoneValidation';
import { validateName, validatePhoneNumber } from '../../utils/validation';
import { useAuth } from '../../contexts/AuthContext';
import '../../components/ui/TableStyles.css';
import './Students.css';

interface ParsedCsvStudent {
  name: string;
  phone: string;
  parentName: string;
  dob?: string;
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

  // Tab View State (Active Students vs Inactive Students)
  const [activeViewTab, setActiveViewTab] = useState<'active' | 'inactive'>('active');

  // Active Students Filter State
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('all');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Inactive Students Filter State (Admin Only)
  const [inactiveSearchQuery, setInactiveSearchQuery] = useState('');
  const [selectedInactiveReasonFilter, setSelectedInactiveReasonFilter] = useState('all');
  const [selectedInactiveCourseFilter, setSelectedInactiveCourseFilter] = useState('all');

  // Single Student Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [parentOrHusbandName, setParentOrHusbandName] = useState('');
  const [dob, setDob] = useState('');
  const [joiningDate, setJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive' | 'pending'>('active');
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoStartDate, setDemoStartDate] = useState('');
  const [demoEndDate, setDemoEndDate] = useState('');
  const [feeDueDate, setFeeDueDate] = useState('');
  const [feeTransactions, setFeeTransactions] = useState<any[]>([]);

  // Bulk Upload State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedCsvStudent[]>([]);
  const [isUploadingBulk, setIsUploadingBulk] = useState(false);
  const [bulkUploadSummary, setBulkUploadSummary] = useState<string | null>(null);

  // Data
  const [students, setStudents] = useState<any[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]); // Active batches (or active batches scoped to teacher)
  const [allBatches, setAllBatches] = useState<Batch[]>([]); // All batches including inactive and completed

  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher';

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

      // Fetch All Batches (Active, Inactive, Completed)
      const bSnapshot = await getDocs(collection(db, 'batches'));
      const fetchedAllBatches: Batch[] = [];
      bSnapshot.forEach(doc => fetchedAllBatches.push({ documentId: doc.id, ...doc.data() } as Batch));
      setAllBatches(fetchedAllBatches);

      // Active Batches for assignment dropdowns
      const activeBatches = fetchedAllBatches.filter(b => b.status === 'active' || !b.status);

      // Filter batches for teacher
      if (isTeacher) {
        const teacherAssignedBatchIds = new Set<string>((user as any)?.batchIds || []);
        if (user?.id) {
          try {
            const userDocSnap = await getDoc(doc(db, 'users', user.id));
            if (userDocSnap.exists()) {
              const uData = userDocSnap.data();
              (uData.batchIds || []).forEach((id: string) => teacherAssignedBatchIds.add(id));
            }
          } catch (e) {
            console.warn("Could not refresh user batchIds in Students:", e);
          }
        }

        const teacherBatches = fetchedAllBatches.filter(b => {
          const bId = b.documentId || '';
          return (
            teacherAssignedBatchIds.has(bId) ||
            b.teacherId === user?.id ||
            (user?.uid && b.teacherId === user.uid) ||
            b.teacherId === user?.email ||
            (Array.isArray((b as any).teacherIds) && (
              (b as any).teacherIds.includes(user?.id) ||
              (user?.uid && (b as any).teacherIds.includes(user.uid)) ||
              (b as any).teacherIds.includes(user?.email)
            ))
          );
        });
        setBatches(teacherBatches);
      } else {
        setBatches(activeBatches);
      }
    } catch (error) {
      console.error("Error fetching dependencies:", error);
    }
  };

  const fetchStudents = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'student'));
      const [querySnapshot, tSnapshot, bSnapshot] = await Promise.all([
        getDocs(q),
        getDocs(collection(db, 'fee_transactions')).catch(() => ({ docs: [] } as any)),
        getDocs(collection(db, 'batches')).catch(() => ({ docs: [] } as any))
      ]);
      const txs: any[] = [];
      if (tSnapshot?.docs) {
        tSnapshot.docs.forEach((doc: any) => txs.push({ documentId: doc.id, ...doc.data() }));
      }
      setFeeTransactions(txs);

      const fetchedBatches: Batch[] = [];
      if (bSnapshot?.docs) {
        bSnapshot.docs.forEach((d: any) => fetchedBatches.push({ documentId: d.id, ...d.data() } as Batch));
        setAllBatches(fetchedBatches);
      }

      let studentsList: any[] = [];
      querySnapshot.forEach((doc) => {
        studentsList.push({ documentId: doc.id, ...doc.data() });
      });

      // Strictly filter to assigned batch students for teachers
      if (isTeacher) {
        const teacherAssignedBatchIds = new Set<string>((user as any)?.batchIds || []);
        if (user?.id) {
          try {
            const userDocSnap = await getDoc(doc(db, 'users', user.id));
            if (userDocSnap.exists()) {
              const uData = userDocSnap.data();
              (uData.batchIds || []).forEach((id: string) => teacherAssignedBatchIds.add(id));
            }
          } catch (e) {
            console.warn("Could not refresh user batchIds in fetchStudents:", e);
          }
        }

        const teacherBatches = fetchedBatches.filter(b => {
          const bId = b.documentId || '';
          return (
            teacherAssignedBatchIds.has(bId) ||
            b.teacherId === user?.id ||
            (user?.uid && b.teacherId === user.uid) ||
            b.teacherId === user?.email ||
            (Array.isArray((b as any).teacherIds) && (
              (b as any).teacherIds.includes(user?.id) ||
              (user?.uid && (b as any).teacherIds.includes(user.uid)) ||
              (b as any).teacherIds.includes(user?.email)
            ))
          );
        });

        const teacherBatchIdSet = new Set(teacherBatches.map(b => b.documentId!).filter(Boolean));
        teacherAssignedBatchIds.forEach(id => teacherBatchIdSet.add(id));

        studentsList = studentsList.filter(s => {
          const sBatches = s.batchIds || (s.batchId ? [s.batchId] : []);
          return sBatches.some((bId: string) => teacherBatchIdSet.has(bId));
        });
      }

      setStudents(studentsList);
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to determine if a student is inactive (either by account status or by inactive batch)
  const getStudentInactivityInfo = (student: any) => {
    const studentBatchId = student.batchIds?.[0] || student.batchId;
    const matchedBatch = allBatches.find(b => b.documentId === studentBatchId);

    // 1. Inactive account
    if (student.status === 'inactive') {
      return {
        isInactive: true,
        reasonType: 'account_inactive',
        reasonLabel: 'Account Inactive',
        badgeStyle: { backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' },
        batchName: matchedBatch?.batchName || 'Unassigned',
        batchStatus: matchedBatch?.status || 'none'
      };
    }

    // 2. Inactive Batch
    if (matchedBatch) {
      if (matchedBatch.status === 'inactive') {
        return {
          isInactive: true,
          reasonType: 'batch_inactive',
          reasonLabel: `Inactive Batch (${matchedBatch.batchName})`,
          badgeStyle: { backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' },
          batchName: matchedBatch.batchName,
          batchStatus: 'inactive'
        };
      }
      if (matchedBatch.status === 'completed') {
        return {
          isInactive: true,
          reasonType: 'batch_completed',
          reasonLabel: `Completed Batch (${matchedBatch.batchName})`,
          badgeStyle: { backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' },
          batchName: matchedBatch.batchName,
          batchStatus: 'completed'
        };
      }
    } else if (studentBatchId) {
      // Batch assigned on student record was deleted/archived
      return {
        isInactive: true,
        reasonType: 'batch_inactive',
        reasonLabel: 'Batch Not Found / Inactive',
        badgeStyle: { backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' },
        batchName: 'Archived / Missing Batch',
        batchStatus: 'inactive'
      };
    }

    return {
      isInactive: false,
      reasonType: 'active',
      reasonLabel: 'Active',
      badgeStyle: { backgroundColor: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' },
      batchName: matchedBatch?.batchName || 'Unassigned',
      batchStatus: matchedBatch?.status || 'active'
    };
  };

  // Active Students: Not inactive and batch is active
  const activeStudents = useMemo(() => {
    return students.filter(s => !getStudentInactivityInfo(s).isInactive);
  }, [students, allBatches]);

  // Inactive Students: Either student status is inactive, or their batch is inactive/completed
  const inactiveStudents = useMemo(() => {
    return students.filter(s => getStudentInactivityInfo(s).isInactive);
  }, [students, allBatches]);

  const getStudentDueDateInfo = (student: any) => {
    let dueDateObj: Date | null = null;

    if (student.feeDueDate) {
      const d = student.feeDueDate?.toDate ? student.feeDueDate.toDate() : new Date(student.feeDueDate);
      if (!isNaN(d.getTime())) dueDateObj = d;
    }

    if (!dueDateObj) {
      const sTxs = feeTransactions
        .filter((t: any) => t.studentId === student.documentId || t.studentId === student.uid)
        .sort((a: any, b: any) => {
          const tA = (a.paymentDate?.seconds || 0) || (a.createdAt?.seconds || 0) || new Date(a.paymentDate || 0).getTime();
          const tB = (b.paymentDate?.seconds || 0) || (b.createdAt?.seconds || 0) || new Date(b.paymentDate || 0).getTime();
          return tB - tA;
        });
      const lastTx = sTxs[0];
      if (lastTx?.nextDueDate) {
        const d = lastTx.nextDueDate?.toDate ? lastTx.nextDueDate.toDate() : new Date(lastTx.nextDueDate);
        if (!isNaN(d.getTime())) dueDateObj = d;
      }
    }

    if (!dueDateObj && student.joiningDate) {
      const d = student.joiningDate?.toDate ? student.joiningDate.toDate() : new Date(student.joiningDate);
      if (!isNaN(d.getTime())) {
        const today = new Date();
        const jDay = Math.min(d.getDate(), 28);
        dueDateObj = new Date(today.getFullYear(), today.getMonth(), jDay);
      }
    }

    if (!dueDateObj) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueMidnight = new Date(dueDateObj);
    dueMidnight.setHours(0, 0, 0, 0);

    const diffDays = Math.round((dueMidnight.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const display = dueDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    if (diffDays < 0) {
      return { date: dueDateObj, display, status: 'OVERDUE', diffDays: Math.abs(diffDays), label: `Overdue (${Math.abs(diffDays)}d)`, badgeClass: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800' };
    } else if (diffDays === 0) {
      return { date: dueDateObj, display, status: 'DUE_TODAY', diffDays: 0, label: 'Due Today', badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800' };
    } else if (diffDays <= 7) {
      return { date: dueDateObj, display, status: 'DUE_SOON', diffDays, label: `Due in ${diffDays}d`, badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800' };
    } else {
      return { date: dueDateObj, display, status: 'UPCOMING', diffDays, label: 'Upcoming', badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' };
    }
  };

  const generateStudentPassword = (nameStr: string, dobInput?: string | Date | any) => {
    const cleanName = nameStr.trim().split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    let birthYear = '2003';

    if (dobInput) {
      const d = dobInput?.toDate ? dobInput.toDate() : new Date(dobInput);
      if (!isNaN(d.getTime()) && d.getFullYear() > 1900 && d.getFullYear() <= new Date().getFullYear()) {
        birthYear = d.getFullYear().toString();
      }
    }

    // Firebase Auth requires at least 6 characters (e.g. "hari" + "2003" = "hari2003")
    const namePrefix = cleanName.length >= 2 ? cleanName : cleanName.padEnd(2, 'x');
    return `${namePrefix}${birthYear}`;
  };

  const resetForm = () => {
    setEditingId(null);
    setFirstName('');
    setLastName('');
    setPhone('');
    setAddress('');
    setParentOrHusbandName('');
    setDob('');
    setJoiningDate(new Date().toISOString().split('T')[0]);
    setFeeDueDate('');
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

    if (!dob) {
      alert("Date of Birth is mandatory. Please select the student's Date of Birth.");
      return;
    }

    const dobDate = new Date(dob);
    if (isNaN(dobDate.getTime())) {
      alert("Please enter a valid Date of Birth.");
      return;
    }
    if (dobDate > new Date()) {
      alert("Date of Birth cannot be in the future.");
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
        dob: dob ? new Date(dob) : null,
        dateOfBirth: dob || null,
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
        feeDueDate: feeDueDate ? feeDueDate : null,
      };

      if (!editingId) {
        // Create new user
        updates.createdAt = new Date();
        updates.forcePasswordChange = true;
        const defaultPassword = generateStudentPassword(firstName, dob);
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
            const candidatePasswords = [
              defaultPassword,
              generateStudentPassword(firstName, ''),
              generateStudentPassword(firstName, dob),
              'komal2014',
              'Test@123',
              'password123'
            ].filter(Boolean);

            let signedInUser: any = null;
            for (const candPwd of candidatePasswords) {
              try {
                const cred = await signInWithEmailAndPassword(secondaryAuth, authEmail, candPwd);
                signedInUser = cred.user;
                break;
              } catch (e) { }
            }

            if (signedInUser) {
              try {
                await updatePassword(signedInUser, defaultPassword);
                updates.uid = signedInUser.uid;
                const newUserRef = doc(db, 'users', signedInUser.uid);
                await setDoc(newUserRef, updates);

                alert(`Student Created & Auth Account Re-synchronized Successfully!\n\nLogin Credentials:\nPhone: ${phone}\nPassword: ${defaultPassword}`);
                setStudents([...students, { documentId: signedInUser.uid, ...updates }]);
              } catch (updateErr: any) {
                alert(`Auth account exists for ${phone}, but could not update password: ` + updateErr.message);
                return;
              } finally {
                await secondarySignOut(secondaryAuth);
              }
            } else {
              alert(`A user with phone number ${phone} (${authEmail}) already exists in Firebase Authentication with an unknown password.\n\nPlease delete ${authEmail} from Firebase Console (Authentication > Users) and try saving again.`);
              return;
            }
          } else {
            throw authError;
          }
          return;
        }
      } else {
        // Edit existing user
        const existingStudent = students.find(s => s.documentId === editingId);
        const newDefaultPassword = generateStudentPassword(firstName, dob);
        let passwordUpdated = false;

        // Check if name, dob, or phone changed
        const oldNameFirst = (existingStudent?.name || '').trim().split(' ')[0];
        const oldDobDate = existingStudent?.dob?.toDate 
          ? existingStudent.dob.toDate().toISOString().split('T')[0] 
          : (existingStudent?.dateOfBirth || '');
        const nameChanged = firstName.trim().toLowerCase() !== oldNameFirst.toLowerCase();
        const dobChanged = dob !== oldDobDate;
        const phoneChanged = cleanPhone !== (existingStudent?.phone || existingStudent?.mobile || '').replace(/[^0-9]/g, '');

        if (nameChanged || dobChanged || phoneChanged || !existingStudent?.plainPassword) {
          const oldPhone = (existingStudent?.phone || existingStudent?.mobile || cleanPhone).replace(/[^0-9]/g, '');
          const oldAuthEmail = `${oldPhone}@speakhub.com`;

          const candidatePasswords = [
            existingStudent?.plainPassword,
            generateStudentPassword(existingStudent?.name || '', existingStudent?.dob || existingStudent?.dateOfBirth),
            newDefaultPassword
          ].filter(Boolean);

          let signedInUser: any = null;
          for (const candPwd of candidatePasswords) {
            try {
              const cred = await signInWithEmailAndPassword(secondaryAuth, oldAuthEmail, candPwd);
              signedInUser = cred.user;
              break;
            } catch (e) {
              // try next candidate password
            }
          }

          if (signedInUser) {
            try {
              await updatePassword(signedInUser, newDefaultPassword);
              if (authEmail !== oldAuthEmail) {
                try {
                  await updateEmail(signedInUser, authEmail);
                } catch (emailErr) {
                  console.warn("Could not update auth email:", emailErr);
                }
              }
              passwordUpdated = true;
            } catch (pErr) {
              console.warn("Could not update auth password:", pErr);
            } finally {
              await secondarySignOut(secondaryAuth);
            }
          } else {
            try {
              const cred = await createUserWithEmailAndPassword(secondaryAuth, authEmail, newDefaultPassword);
              updates.uid = cred.user.uid;
              await secondarySignOut(secondaryAuth);
              passwordUpdated = true;
            } catch (createErr) {
              console.warn("Could not create auth user on edit:", createErr);
            }
          }

          updates.plainPassword = newDefaultPassword;
          updates.forcePasswordChange = true;
        }

        const userRef = doc(db, 'users', editingId);
        await setDoc(userRef, updates, { merge: true });
        setStudents(students.map(s => s.documentId === editingId ? { ...s, ...updates } : s));

        if (passwordUpdated) {
          alert(`Student Details & Password Updated Successfully!\n\nNew Login Credentials:\nPhone: ${phone}\nPassword: ${newDefaultPassword}`);
        } else {
          alert('Student Details Updated Successfully!');
        }
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

    if (student.dob || student.dateOfBirth) {
      const dobVal = student.dob || student.dateOfBirth;
      const d = dobVal?.toDate ? dobVal.toDate() : new Date(dobVal);
      setDob(!isNaN(d.getTime()) ? d.toISOString().split('T')[0] : '');
    } else {
      setDob('');
    }

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

    if (student.feeDueDate) {
      const d = student.feeDueDate?.toDate ? student.feeDueDate.toDate() : new Date(student.feeDueDate);
      setFeeDueDate(!isNaN(d.getTime()) ? d.toISOString().split('T')[0] : '');
    } else {
      setFeeDueDate('');
    }

    setIsModalOpen(true);
  };

  const handleDelete = async (student: any) => {
    if (!window.confirm(`Are you sure you want to delete "${student.name}"?`)) return;

    try {
      // 1. Delete from Firebase Authentication
      const cleanPhone = (student.phone || student.mobile || '').replace(/[^0-9]/g, '');
      const authEmail = student.email || (cleanPhone ? `${cleanPhone}@speakhub.com` : '');

      let authDeleted = false;
      if (authEmail) {
        const candidatePasswords = [
          student.plainPassword,
          generateStudentPassword(student.name || '', student.dob || student.dateOfBirth),
          generateStudentPassword(student.name || '', ''),
          'komal2014',
          'Test@123',
          'password123'
        ].filter(Boolean);

        for (const pwd of candidatePasswords) {
          try {
            const cred = await signInWithEmailAndPassword(secondaryAuth, authEmail, pwd);
            await deleteUser(cred.user);
            authDeleted = true;
            break;
          } catch (e) {
            // try next candidate password
          }
        }

        try {
          await secondarySignOut(secondaryAuth);
        } catch (e) { }
      }

      // 2. Delete student record from Firestore
      await deleteDoc(doc(db, 'users', student.documentId));
      setStudents(students.filter(s => s.documentId !== student.documentId));

      if (authDeleted) {
        alert(`Student "${student.name}" and Firebase Authentication account deleted successfully.`);
      } else {
        alert(`Student "${student.name}" deleted from database.\n\nNote: If their Auth account used a custom password, please verify in Firebase Console.`);
      }
    } catch (error: any) {
      alert("Failed to delete student: " + error.message);
    }
  };

  // --- Bulk CSV Upload Handling ---
  const downloadSampleCsvTemplate = () => {
    const headers = "FullName,PhoneNumber,ParentOrHusbandName,DateOfBirth(YYYY-MM-DD),CourseName,BatchName,JoiningDate(YYYY-MM-DD),Address\n";
    const sample1 = "Aarav Sharma,9876543210,Ramesh Sharma,2005-05-15,Spoken English,Morning Batch 9AM,2026-08-31,Pune Maharashtra\n";
    const sample2 = "Pooja Patil,9876543211,Suresh Patil,2008-08-20,Abacus & Vedic Maths,Evening Batch 5PM,2026-08-31,Kolhapur Maharashtra\n";
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
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.split(',').map(p => p.replace(/^["']|["']$/g, '').trim());
      const name = parts[0] || '';
      const phone = (parts[1] || '').replace(/[^0-9]/g, '');
      const parentName = parts[2] || '';
      
      let dobVal = '';
      let courseName = '';
      let batchName = '';
      let joiningDate = new Date().toISOString().split('T')[0];
      let address = '';

      if (parts.length >= 8) {
        dobVal = parts[3] || '';
        courseName = parts[4] || '';
        batchName = parts[5] || '';
        joiningDate = parts[6] || new Date().toISOString().split('T')[0];
        address = parts[7] || '';
      } else {
        courseName = parts[3] || '';
        batchName = parts[4] || '';
        joiningDate = parts[5] || new Date().toISOString().split('T')[0];
        address = parts[6] || '';
      }

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
      } else if (!dobVal) {
        isValid = false;
        validationError = 'Date of Birth is required';
      }

      rows.push({
        name,
        phone,
        parentName,
        dob: dobVal,
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
        const defaultPassword = generateStudentPassword(row.name, row.dob);

        const newStudentData: any = {
          name: row.name,
          phone: cleanPhone,
          mobile: cleanPhone,
          email: authEmail,
          parentOrHusbandName: row.parentName,
          parentName: row.parentName,
          dob: row.dob ? new Date(row.dob) : null,
          dateOfBirth: row.dob || null,
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
    if (activeViewTab === 'active') {
      if (filteredActiveStudents.length === 0) {
        alert("No active students to export.");
        return;
      }

      const headers = "StudentName,Phone,ParentName,DateOfBirth,Course,Batch,JoiningDate,FeeDueDate,DueStatus,Status\n";
      const rows = filteredActiveStudents.map(s => {
        const cName = courses.find(c => c.documentId === (s.courseIds?.[0] || s.courseId))?.courseName || 'Unassigned';
        const bName = batches.find(b => b.documentId === (s.batchIds?.[0] || s.batchId))?.batchName || 'Unassigned';
        const dobVal = s.dob?.toDate ? s.dob.toDate().toLocaleDateString('en-GB') : (s.dateOfBirth || '-');
        const jDate = s.joiningDate?.toDate ? s.joiningDate.toDate().toLocaleDateString('en-GB') : (s.joiningDate || '-');
        const dueInfo = getStudentDueDateInfo(s);
        const dueStr = dueInfo ? dueInfo.display : '-';
        const dueStatusStr = dueInfo ? dueInfo.label : '-';
        return `"${s.name || ''}","${s.phone || s.mobile || ''}","${s.parentOrHusbandName || s.parentName || ''}","${dobVal}","${cName}","${bName}","${jDate}","${dueStr}","${dueStatusStr}","${s.status || 'active'}"`;
      }).join('\n');

      const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(headers + rows);
      const link = document.createElement("a");
      link.setAttribute("href", csvContent);
      link.setAttribute("download", `speakhub_active_students_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      if (filteredInactiveStudents.length === 0) {
        alert("No inactive students to export.");
        return;
      }

      const headers = "StudentName,Phone,ParentName,DateOfBirth,Course,AssignedBatch,BatchStatus,InactivityReason,JoiningDate\n";
      const rows = filteredInactiveStudents.map(s => {
        const cName = courses.find(c => c.documentId === (s.courseIds?.[0] || s.courseId))?.courseName || 'Unassigned';
        const inact = getStudentInactivityInfo(s);
        const dobVal = s.dob?.toDate ? s.dob.toDate().toLocaleDateString('en-GB') : (s.dateOfBirth || '-');
        const jDate = s.joiningDate?.toDate ? s.joiningDate.toDate().toLocaleDateString('en-GB') : (s.joiningDate || '-');
        return `"${s.name || ''}","${s.phone || s.mobile || ''}","${s.parentOrHusbandName || s.parentName || ''}","${dobVal}","${cName}","${inact.batchName}","${inact.batchStatus}","${inact.reasonLabel}","${jDate}"`;
      }).join('\n');

      const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(headers + rows);
      const link = document.createElement("a");
      link.setAttribute("href", csvContent);
      link.setAttribute("download", `speakhub_inactive_students_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Filtered Active Students Computation
  const filteredActiveStudents = useMemo(() => {
    return activeStudents.filter(student => {
      // 1. Course Filter
      const studentCourseId = student.courseIds?.[0] || student.courseId;
      if (selectedCourseFilter !== 'all' && studentCourseId !== selectedCourseFilter) {
        return false;
      }

      // 2. Batch Filter (checks all batches student belongs to)
      const sBatches = student.batchIds || (student.batchId ? [student.batchId] : []);
      if (selectedBatchFilter !== 'all' && !sBatches.includes(selectedBatchFilter)) {
        return false;
      }

      // 3. Status Filter
      if (selectedStatusFilter === 'active' && student.status !== 'active') return false;
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
  }, [activeStudents, selectedCourseFilter, selectedBatchFilter, selectedStatusFilter, searchQuery]);

  // Filtered Inactive Students Computation (For Admin)
  const filteredInactiveStudents = useMemo(() => {
    return inactiveStudents.filter(student => {
      const inact = getStudentInactivityInfo(student);

      // 1. Reason Filter
      if (selectedInactiveReasonFilter !== 'all' && inact.reasonType !== selectedInactiveReasonFilter) {
        return false;
      }

      // 2. Course Filter
      const studentCourseId = student.courseIds?.[0] || student.courseId;
      if (selectedInactiveCourseFilter !== 'all' && studentCourseId !== selectedInactiveCourseFilter) {
        return false;
      }

      // 3. Search Query
      if (inactiveSearchQuery.trim()) {
        const q = inactiveSearchQuery.toLowerCase();
        const matchesName = (student.name || '').toLowerCase().includes(q);
        const matchesPhone = (student.phone || student.mobile || '').includes(q);
        const matchesParent = (student.parentOrHusbandName || student.parentName || '').toLowerCase().includes(q);
        const matchesBatch = (inact.batchName || '').toLowerCase().includes(q);
        return matchesName || matchesPhone || matchesParent || matchesBatch;
      }

      return true;
    });
  }, [inactiveStudents, selectedInactiveReasonFilter, selectedInactiveCourseFilter, inactiveSearchQuery]);

  // Columns for Active Students Table
  const activeColumns: Column<any>[] = [
    {
      key: 'name',
      header: 'Student Name',
      render: (row) => {
        const dobDate = row.dob?.toDate ? row.dob.toDate() : (row.dateOfBirth ? new Date(row.dateOfBirth) : null);
        const dobStr = dobDate && !isNaN(dobDate.getTime()) ? dobDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : null;

        return (
          <div>
            <div className="font-bold text-slate-900 dark:text-white text-sm">{row.name}</div>
            <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5 flex-wrap">
              <span>Phone: {row.phone || row.mobile || '-'}</span>
              {dobStr && <span className="text-[11px] text-slate-500 font-semibold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">DOB: {dobStr}</span>}
              {row.plainPassword && (
                <span className="text-[11px] font-mono text-indigo-700 dark:text-indigo-300 font-semibold bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-800">
                  PWD: {row.plainPassword}
                </span>
              )}
            </div>
          </div>
        );
      }
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
        const sBatchIds = row.batchIds || (row.batchId ? [row.batchId] : []);
        const studentBatchNames = sBatchIds.map((bId: string) => allBatches.find(b => b.documentId === bId)?.batchName || bId);
        return (
          <div>
            <div className="font-semibold text-xs text-indigo-600 dark:text-indigo-400">{courseName}</div>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {studentBatchNames.length === 0 ? (
                <span className="text-[11px] text-slate-400 font-medium">Unassigned</span>
              ) : (
                studentBatchNames.map((name: string, idx: number) => (
                  <span key={idx} className="inline-block text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium px-1.5 py-0.5 rounded">
                    {name}
                  </span>
                ))
              )}
            </div>
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
      key: 'feeDueDate',
      header: 'Fee Due Date',
      render: (row) => {
        const dueInfo = getStudentDueDateInfo(row);
        if (!dueInfo) return <span className="text-slate-400 text-xs font-medium">Not set</span>;
        return (
          <div className="flex flex-col gap-1 items-start">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
              📅 {dueInfo.display}
            </span>
            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${dueInfo.badgeClass}`}>
              {dueInfo.label}
            </span>
          </div>
        );
      }
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        let badgeClass = 'active';
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

  // Columns for Inactive Students Table (Admin Only)
  const inactiveColumns: Column<any>[] = [
    {
      key: 'name',
      header: 'Student Name',
      render: (row) => {
        const dobDate = row.dob?.toDate ? row.dob.toDate() : (row.dateOfBirth ? new Date(row.dateOfBirth) : null);
        const dobStr = dobDate && !isNaN(dobDate.getTime()) ? dobDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : null;
        const phone = row.phone || row.mobile || '';

        return (
          <div>
            <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <span>{row.name}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                Inactive
              </span>
            </div>
            <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5 flex-wrap mt-1">
              <span>Phone: {phone || '-'}</span>
              {dobStr && <span className="text-[11px] text-slate-500 font-semibold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">DOB: {dobStr}</span>}
              {row.plainPassword && (
                <span className="text-[11px] font-mono text-indigo-700 dark:text-indigo-300 font-semibold bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-800">
                  PWD: {row.plainPassword}
                </span>
              )}
            </div>
          </div>
        );
      }
    },
    {
      key: 'parentOrHusbandName',
      header: 'Parent / Guardian',
      render: (row) => <span className="text-slate-700 dark:text-slate-300 font-medium text-xs">{row.parentOrHusbandName || row.parentName || '-'}</span>
    },
    {
      key: 'courseId',
      header: 'Course',
      render: (row) => {
        const courseName = courses.find(c => c.documentId === (row.courseIds?.[0] || row.courseId))?.courseName || 'Unassigned';
        return (
          <div className="font-semibold text-xs text-indigo-600 dark:text-indigo-400">
            {courseName}
          </div>
        );
      }
    },
    {
      key: 'batch',
      header: 'Assigned Batch',
      render: (row) => {
        const studentBatchId = row.batchIds?.[0] || row.batchId;
        const matched = allBatches.find(b => b.documentId === studentBatchId);
        if (!matched) {
          return <span className="text-xs text-slate-400 font-medium">No Batch Assigned</span>;
        }
        return (
          <div>
            <div className="font-semibold text-xs text-slate-800 dark:text-slate-200">{matched.batchName}</div>
            <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded mt-0.5 inline-block ${
              matched.status === 'inactive' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
              matched.status === 'completed' ? 'bg-slate-100 text-slate-700 border border-slate-200' :
              'bg-emerald-100 text-emerald-800'
            }`}>
              Batch Status: {matched.status ? matched.status.toUpperCase() : 'UNKNOWN'}
            </span>
          </div>
        );
      }
    },
    {
      key: 'inactivityReason',
      header: 'Reason for Inactive',
      render: (row) => {
        const inact = getStudentInactivityInfo(row);
        return (
          <span style={{ ...inact.badgeStyle, padding: '4px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            {inact.reasonType === 'batch_inactive' && '⚠️ '}
            {inact.reasonType === 'account_inactive' && '🛑 '}
            {inact.reasonType === 'batch_completed' && '🏁 '}
            {inact.reasonLabel}
          </span>
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
    }
  ];

  // Batch options for Add/Edit Modal (allows selecting active batches or retaining current inactive batch)
  const modalBatchOptions = useMemo(() => {
    const list = [
      { label: 'Select Batch', value: '' },
      ...batches.map(b => ({ label: `${b.batchName} (Active)`, value: b.documentId! }))
    ];
    // If editing a student assigned to an inactive batch, retain it as an option with a warning label
    if (editingId && batchId && !batches.some(b => b.documentId === batchId)) {
      const prevBatch = allBatches.find(b => b.documentId === batchId);
      if (prevBatch) {
        list.push({ label: `⚠️ ${prevBatch.batchName} (Currently Inactive)`, value: prevBatch.documentId! });
      }
    }
    return list;
  }, [batches, allBatches, editingId, batchId]);

  return (
    <div className="page-container">
      {/* Top Header */}
      <div className="student-master-header">
        <div>
          <h1 className="page-title">{isTeacher ? "My Students" : "Student Master & Directory"}</h1>
          <div className="breadcrumbs">
            <span>Dashboard</span> <span className="separator">/</span> <span className="current">{isTeacher ? "My Students" : "Student Master"}</span>
          </div>
        </div>

        <div className="student-header-actions">
          {isAdmin && (
            <button
              type="button"
              className="btn-add-student"
              onClick={() => { resetForm(); setIsModalOpen(true); }}
            >
              <Plus size={18} />
              Add New Student
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              className="btn-bulk-upload"
              onClick={() => { setCsvFile(null); setParsedRows([]); setBulkUploadSummary(null); setIsBulkModalOpen(true); }}
            >
              <Upload size={16} />
              Bulk CSV Upload
            </button>
          )}

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

      {/* Top Navigation Tabs for Admin: Active Students vs Inactive Students */}
      {isAdmin && (
        <div className="student-tab-nav">
          <button
            type="button"
            className={`student-nav-tab ${activeViewTab === 'active' ? 'active' : ''}`}
            onClick={() => setActiveViewTab('active')}
          >
            <Users size={16} />
            <span>Active Students</span>
            <span className="tab-counter-badge active-badge">{activeStudents.length}</span>
          </button>

          <button
            type="button"
            className={`student-nav-tab inactive ${activeViewTab === 'inactive' ? 'active' : ''}`}
            onClick={() => setActiveViewTab('inactive')}
          >
            <UserX size={16} />
            <span>Inactive Students</span>
            <span className="tab-counter-badge inactive-badge">{inactiveStudents.length}</span>
          </button>
        </div>
      )}

      {/* VIEW 1: ACTIVE STUDENTS */}
      {/* Teacher View Banner */}
      {isTeacher && (
        <div style={{
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '12px',
          padding: '0.85rem 1.25rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d4ed8' }}>
              <BookOpen size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1e3a8a' }}>
                Teacher View: Assigned Students
              </div>
              <div style={{ fontSize: '0.8rem', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                <span>Assigned Batches ({batches.length}):</span>
                {batches.map(b => (
                  <span key={b.documentId} style={{ backgroundColor: '#ffffff', border: '1px solid #93c5fd', borderRadius: '4px', padding: '1px 7px', fontWeight: 700, fontSize: '0.75rem', color: '#1e40af' }}>
                    {b.batchName}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e40af', backgroundColor: '#dbeafe', padding: '6px 12px', borderRadius: '20px' }}>
            {filteredActiveStudents.length} Students in Your Batches
          </div>
        </div>
      )}

      {activeViewTab === 'active' && (
        <>
          {/* Filter & Summary Card */}
          <div className="student-filter-card">
            {/* Metric Pills */}
            <div className="student-stats-row">
              <button 
                type="button" 
                className={`student-stat-pill all ${selectedStatusFilter === 'all' ? 'selected' : ''}`}
                onClick={() => setSelectedStatusFilter('all')}
              >
                <Users size={14} /> Total Active Students: <strong>{activeStudents.length}</strong>
              </button>

              <button 
                type="button" 
                className={`student-stat-pill active ${selectedStatusFilter === 'active' ? 'selected' : ''}`}
                onClick={() => setSelectedStatusFilter('active')}
              >
                <CheckCircle2 size={14} /> Regular: <strong>{activeStudents.filter(s => s.status === 'active' && !s.isDemoMode).length}</strong>
              </button>

              <button 
                type="button" 
                className={`student-stat-pill demo ${selectedStatusFilter === 'demo' ? 'selected' : ''}`}
                onClick={() => setSelectedStatusFilter('demo')}
              >
                <Sparkles size={14} /> Demo Students: <strong>{activeStudents.filter(s => s.isDemoMode).length}</strong>
              </button>

              {isAdmin && inactiveStudents.length > 0 && (
                <button 
                  type="button" 
                  className="student-stat-pill inactive"
                  onClick={() => setActiveViewTab('inactive')}
                  title="Click to view separate inactive students list"
                >
                  <UserX size={14} /> Inactive Students: <strong>{inactiveStudents.length}</strong> (View)
                </button>
              )}
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
                options={[{ label: isTeacher ? 'All My Assigned Batches' : 'All Batches', value: 'all' }, ...batches.map(b => ({ label: b.batchName, value: b.documentId! }))]}
                value={selectedBatchFilter}
                onChange={(e) => setSelectedBatchFilter(e.target.value)}
              />

              <Select
                label="Filter by Status"
                options={[
                  { label: 'All Active Statuses', value: 'all' },
                  { label: 'Active Students', value: 'active' },
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

          {/* Active Students Data Table */}
          <DataTable
            title={isTeacher ? `My Assigned Students (${filteredActiveStudents.length} Students)` : `Active Student Directory (${filteredActiveStudents.length} Students)`}
            data={filteredActiveStudents}
            columns={activeColumns}
            onEdit={isAdmin ? handleEdit : undefined}
            onDelete={isAdmin ? handleDelete : undefined}
            onRefresh={fetchStudents}
            searchPlaceholder={isTeacher ? "Search my students..." : "Search active student name, phone, course..."}
            isLoading={isLoading}
          />
        </>
      )}

      {/* VIEW 2: INACTIVE STUDENTS (ADMIN ONLY) */}
      {isAdmin && activeViewTab === 'inactive' && (
        <>
          {/* Inactive Notice Banner */}
          <div className="inactive-notice-banner">
            <div className="inactive-notice-content">
              <AlertTriangle size={20} color="#b45309" />
              <div>
                <div className="inactive-notice-title">Separate Inactive Students List (Admin View)</div>
                <div className="inactive-notice-desc">
                  Students whose assigned batch is inactive or completed, or whose accounts are marked inactive, are listed here. They are hidden from teachers and active class lists. Click <strong>Edit</strong> on any row to reassign them to an active batch!
                </div>
              </div>
            </div>
            <button
              type="button"
              className="btn"
              style={{ backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', fontWeight: 700, fontSize: '0.8rem' }}
              onClick={() => setActiveViewTab('active')}
            >
              ← Back to Active Students
            </button>
          </div>

          {/* Inactive Students Filter Card */}
          <div className="student-filter-card">
            <div className="student-filters-grid" style={{ gridTemplateColumns: '1.2fr 1.2fr 1.5fr auto' }}>
              <Select
                label="Filter by Inactivity Reason"
                options={[
                  { label: 'All Inactive Reasons', value: 'all' },
                  { label: 'Inactive Batch', value: 'batch_inactive' },
                  { label: 'Completed Batch', value: 'batch_completed' },
                  { label: 'Account Inactive', value: 'account_inactive' }
                ]}
                value={selectedInactiveReasonFilter}
                onChange={(e) => setSelectedInactiveReasonFilter(e.target.value)}
              />

              <Select
                label="Filter by Course"
                options={[{ label: 'All Courses', value: 'all' }, ...courses.map(c => ({ label: c.courseName, value: c.documentId! }))]}
                value={selectedInactiveCourseFilter}
                onChange={(e) => setSelectedInactiveCourseFilter(e.target.value)}
              />

              <Input
                label="Search Inactive Student"
                placeholder="Search by Name, Phone, Batch..."
                value={inactiveSearchQuery}
                onChange={(e) => setInactiveSearchQuery(e.target.value)}
              />

              <button
                type="button"
                className="btn"
                style={{ backgroundColor: '#f1f5f9', color: '#475569', height: '42px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.8rem' }}
                onClick={() => { setSelectedInactiveReasonFilter('all'); setSelectedInactiveCourseFilter('all'); setInactiveSearchQuery(''); }}
              >
                <RefreshCw size={14} /> Reset
              </button>
            </div>
          </div>

          {/* Inactive Students Data Table */}
          <DataTable
            title={`Inactive Students Directory (${filteredInactiveStudents.length} Students)`}
            data={filteredInactiveStudents}
            columns={inactiveColumns}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onRefresh={fetchStudents}
            searchPlaceholder="Search inactive student name, phone, batch..."
            isLoading={isLoading}
          />
        </>
      )}

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
            <Input 
              label="Date of Birth" 
              type="date" 
              max={new Date().toISOString().split('T')[0]} 
              value={dob} 
              onChange={(e) => setDob(e.target.value)} 
              required
            />
            <Input label="Date of Joining" type="date" value={joiningDate} onChange={(e) => setJoiningDate(e.target.value)} required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <Input 
              label="Fee Due Date (Optional)" 
              type="date" 
              value={feeDueDate} 
              onChange={(e) => setFeeDueDate(e.target.value)} 
              placeholder="Defaults to joining day each month"
            />
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.75rem', color: '#64748b', padding: '4px' }}>
              ℹ️ Visible to teachers in student directory and attendance. Defaults to joining day each month if left empty.
            </div>
          </div>

          <div style={{ fontSize: '0.8rem', color: '#475569', backgroundColor: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
            <span>🔑 <strong>Login Password:</strong> <code style={{ color: '#4f46e5', fontWeight: 700 }}>{generateStudentPassword(firstName || 'student', dob)}</code></span>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>(Auto-updates with First Name & Birth Year)</span>
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
              options={modalBatchOptions}
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
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
            <Input label="Residential Address" placeholder="City, Area, Address details..." value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

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

          <div className="modal-form-footer">
            <button type="button" className="btn-modal-cancel" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-modal-primary" disabled={isSubmitting}>
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

          <div className="modal-form-footer">
            <button type="button" className="btn-modal-cancel" onClick={() => setIsBulkModalOpen(false)}>Cancel</button>
            <button
              type="button"
              className="btn-modal-primary"
              disabled={isUploadingBulk || parsedRows.filter(r => r.isValid).length === 0}
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
