import React, { useState, useEffect } from 'react';
import { Plus, BookOpen } from 'lucide-react';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import type { User, Batch } from '../../types/models';
import { db } from '../../config/firebase';
import { secondaryAuth } from '../../config/secondaryFirebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { 
  collection, 
  query, 
  getDocs, 
  updateDoc, 
  doc, 
  setDoc, 
  where, 
  serverTimestamp, 
  deleteDoc 
} from 'firebase/firestore';
import { checkMobileExists } from '../../utils/phoneValidation';
import { validateName, validateEmail, validatePhoneNumber } from '../../utils/validation';
import '../../components/ui/TableStyles.css';

const Teachers: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Data
  const [teachers, setTeachers] = useState<User[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  // Fetch batches so batchIds can be displayed with human-readable names
  const fetchBatches = async () => {
    try {
      const snap = await getDocs(collection(db, 'batches'));
      const batchList: Batch[] = [];
      snap.forEach(d => {
        batchList.push({ documentId: d.id, ...d.data() } as Batch);
      });
      setBatches(batchList);
    } catch (err) {
      console.error("Error fetching batches:", err);
    }
  };

  const fetchTeachers = async () => {
    try {
      setIsLoading(true);
      const q = query(collection(db, 'users'), where('role', '==', 'teacher'));
      const snapshot = await getDocs(q);
      const fetchedTeachers: User[] = [];
      snapshot.forEach(docSnap => {
        fetchedTeachers.push({ documentId: docSnap.id, ...docSnap.data() } as User);
      });
      setTeachers(fetchedTeachers);
    } catch (error) {
      console.error("Error fetching teachers:", error);
      alert("Failed to load teachers");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
    fetchTeachers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const fnVal = validateName(firstName, 'First Name');
    if (!fnVal.isValid) { alert(fnVal.error); return; }

    const lnVal = validateName(lastName, 'Last Name');
    if (!lnVal.isValid) { alert(lnVal.error); return; }

    const emailVal = validateEmail(email, 'Email Address');
    if (!emailVal.isValid) { alert(emailVal.error); return; }

    if (mobile.trim()) {
      const mobVal = validatePhoneNumber(mobile, 'Mobile Number');
      if (!mobVal.isValid) { alert(mobVal.error); return; }
    }

    try {
      if (mobile.trim()) {
        const mobileCheck = await checkMobileExists(mobile.trim(), editingId);
        if (mobileCheck.exists) {
          alert(mobileCheck.message || "This mobile number is already registered to another user.");
          return;
        }
      }

      setIsSaving(true);
      const fullName = `${firstName} ${lastName}`.trim();

      if (editingId) {
        // Update existing teacher
        await updateDoc(doc(db, 'users', editingId), {
          name: fullName,
          email: email.trim(),
          mobile: mobile.trim(),
          status,
          batchIds: selectedBatchIds,
          updatedAt: serverTimestamp()
        });
      } else {
        // Standard teacher default password
        const defaultPassword = 'Teacher@123';
        
        let uid = '';
        try {
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), defaultPassword);
          uid = userCredential.user.uid;
        } catch (authError: any) {
          if (authError.code === 'auth/email-already-in-use') {
            alert("A user with this email already exists in Authentication.");
            setIsSaving(false);
            return;
          } else {
            throw authError;
          }
        }

        // Save profile to users collection
        await setDoc(doc(db, 'users', uid), {
          uid,
          name: fullName,
          email: email.trim(),
          mobile: mobile.trim(),
          role: 'teacher',
          status,
          forcePasswordChange: true,
          batchIds: selectedBatchIds,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        alert(`Teacher Account Created Successfully!\n\nCredentials:\nEmail: ${email.trim()}\nPassword: ${defaultPassword}\nMobile: ${mobile.trim()}`);
      }

      setIsModalOpen(false);
      resetForm();
      fetchTeachers();
    } catch (error: any) {
      console.error("Error saving teacher:", error);
      alert("Failed to save teacher: " + (error.message || "Unknown error"));
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setMobile('');
    setStatus('active');
    setSelectedBatchIds([]);
    setEditingId(null);
  };

  const handleEdit = (teacher: User) => {
    const parts = (teacher.name || '').split(' ');
    setFirstName(parts[0] || '');
    setLastName(parts.slice(1).join(' ') || '');
    setEmail(teacher.email || '');
    setMobile(teacher.mobile || '');
    setStatus((teacher.status as 'active' | 'inactive') || 'active');
    setSelectedBatchIds(teacher.batchIds || []);
    setEditingId(teacher.documentId || null);
    setIsModalOpen(true);
  };

  const handleDelete = async (teacher: User) => {
    if (window.confirm(`Are you sure you want to delete teacher ${teacher.name}?`)) {
      try {
        await deleteDoc(doc(db, 'users', teacher.documentId!));
        setTeachers(teachers.filter(t => t.documentId !== teacher.documentId));
      } catch (error: any) {
        alert("Failed to delete teacher: " + error.message);
      }
    }
  };

  const getAssignedBatchNames = (batchIds?: string[]) => {
    if (!batchIds || !Array.isArray(batchIds) || batchIds.length === 0) return [];
    return batchIds.map(bId => {
      const match = batches.find(b => b.documentId === bId);
      return match ? match.batchName : bId;
    });
  };

  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'Teacher Name',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
            {row.name ? row.name.charAt(0).toUpperCase() : 'T'}
          </div>
          <span className="font-medium">{row.name}</span>
        </div>
      )
    },
    {
      key: 'email',
      header: 'Email'
    },
    {
      key: 'mobile',
      header: 'Mobile',
      render: (row) => row.mobile || 'N/A'
    },
    {
      key: 'batchIds',
      header: 'Assigned Batches',
      render: (row) => {
        const batchNames = getAssignedBatchNames(row.batchIds);
        if (batchNames.length === 0) {
          return <span className="text-gray-400 text-xs italic">No Batches</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {batchNames.map((name, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <BookOpen size={10} />
                {name}
              </span>
            ))}
          </div>
        );
      }
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (row) => (
        <div className="flex justify-center items-center">
          <span className={`dt-badge ${row.status === 'active' ? 'active' : 'inactive'}`}>
            {row.status ? row.status.charAt(0).toUpperCase() + row.status.slice(1) : 'Unknown'}
          </span>
        </div>
      )
    }
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Teachers</h1>
          <div className="breadcrumbs">
            <span>Dashboard</span> <span className="separator">/</span> <span className="current">Teachers</span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setIsModalOpen(true); }}>
          <Plus size={16} />
          Add Teacher
        </button>
      </div>

      <DataTable 
        title="Teacher Records" 
        data={teachers} 
        columns={columns} 
        onEdit={handleEdit}
        onDelete={handleDelete}
        onRefresh={() => { fetchBatches(); fetchTeachers(); }}
        searchPlaceholder="Search teachers..."
        isLoading={isLoading}
      />

      {/* Add / Edit Teacher Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); resetForm(); }} 
        title={editingId ? "Edit Teacher" : "Add Teacher"}
      >
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="First Name" 
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required 
            />
            <Input 
              label="Last Name" 
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required 
            />
          </div>
          <Input 
            label="Email Address" 
            type="email"
            placeholder="teacher@speakhub.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!!editingId}
            required 
          />
          {!editingId && (
            <p className="text-xs text-gray-500 mb-4 mt-1">
              Default password will be <code>Teacher@123</code>. (Force change on first login).
            </p>
          )}
          
          <Input 
            label="Mobile Number" 
            placeholder="e.g. 9096170701"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
          />

          {/* Batch Selector */}
          <div className="form-group mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Assign Batches
            </label>
            <div className="border rounded p-2 max-h-36 overflow-y-auto space-y-1 bg-white">
              {batches.length === 0 ? (
                <span className="text-xs text-gray-400">No batches available</span>
              ) : (
                batches.map(b => (
                  <label key={b.documentId} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 p-1 rounded">
                    <input 
                      type="checkbox" 
                      checked={selectedBatchIds.includes(b.documentId!)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedBatchIds([...selectedBatchIds, b.documentId!]);
                        } else {
                          setSelectedBatchIds(selectedBatchIds.filter(id => id !== b.documentId));
                        }
                      }}
                    />
                    <span>{b.batchName}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <Select 
            label="Status" 
            options={[{label: 'Active', value: 'active'}, {label: 'Inactive', value: 'inactive'}]} 
            value={status}
            onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
          />
          
          <div className="modal-form-footer">
            <button type="button" className="btn-modal-cancel" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-modal-primary" disabled={isSaving}>
              {isSaving ? "Saving..." : (editingId ? "Update Teacher" : "Create Teacher Account")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Teachers;
