import React, { useState, useEffect } from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import type { User } from '../../types/models';
import { db } from '../../config/firebase';
import { secondaryAuth } from '../../config/secondaryFirebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, query, getDocs, updateDoc, doc, setDoc, where, serverTimestamp } from 'firebase/firestore';
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
  const [editingId, setEditingId] = useState<string | null>(null);

  // Data
  const [teachers, setTeachers] = useState<User[]>([]);

  const fetchTeachers = async () => {
    try {
      setIsLoading(true);
      const q = query(collection(db, 'users'), where('role', '==', 'teacher'));
      const snapshot = await getDocs(q);
      const fetchedTeachers: User[] = [];
      snapshot.forEach(doc => {
        fetchedTeachers.push({ documentId: doc.id, ...doc.data() } as User);
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
    fetchTeachers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !email) {
      alert("Please fill in all required fields.");
      return;
    }

    try {
      setIsSaving(true);
      const fullName = `${firstName} ${lastName}`;

      if (editingId) {
        // Update existing teacher
        await updateDoc(doc(db, 'users', editingId), {
          name: fullName,
          email,
          mobile,
          status,
          updatedAt: serverTimestamp()
        });
      } else {
        // Create new Teacher Account in Firebase Auth
        const defaultPassword = mobile ? mobile : 'Teacher@123';
        
        let uid = '';
        try {
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, defaultPassword);
          uid = userCredential.user.uid;
        } catch (authError: any) {
          if (authError.code === 'auth/email-already-in-use') {
            alert("A user with this email already exists. You cannot add them again.");
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
          email,
          mobile,
          role: 'teacher',
          status,
          forcePasswordChange: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      setIsModalOpen(false);
      resetForm();
      fetchTeachers();
    } catch (error) {
      console.error("Error saving teacher:", error);
      alert("Failed to save teacher.");
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
    setEditingId(null);
  };

  const handleEdit = (teacher: User) => {
    const parts = (teacher.name || '').split(' ');
    setFirstName(parts[0] || '');
    setLastName(parts.slice(1).join(' ') || '');
    setEmail(teacher.email);
    setMobile(teacher.mobile || '');
    setStatus(teacher.status as 'active' | 'inactive');
    setEditingId(teacher.documentId || null);
    setIsModalOpen(true);
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
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span className={`dt-badge ${row.status === 'active' ? 'active' : 'inactive'}`}>
          {row.status ? row.status.charAt(0).toUpperCase() + row.status.slice(1) : 'Unknown'}
        </span>
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
        searchPlaceholder="Search teachers..."
        isLoading={isLoading}
      />

      {/* Add Teacher Modal */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title={editingId ? "Edit Teacher" : "Add Teacher"}>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="First Name" 
              placeholder="John"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required 
            />
            <Input 
              label="Last Name" 
              placeholder="Doe"
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
            <p className="text-xs text-gray-500 mb-4 mt-1">A login account will automatically be created using this email.</p>
          )}
          
          <Input 
            label="Mobile Number (Optional)" 
            placeholder="+1 234 567 890"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
          />
          <Select 
            label="Status" 
            options={[{label: 'Active', value: 'active'}, {label: 'Inactive', value: 'inactive'}]} 
            value={status}
            onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
          />
          
          <div className="modal-actions">
            <button type="submit" className="btn btn-success" disabled={isSaving}>
              {isSaving ? "Saving..." : (editingId ? "Update Teacher" : "Create Teacher Account")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Teachers;
