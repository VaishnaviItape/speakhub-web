import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import DataTable, { type Column } from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import { db } from '../../config/firebase';
import { secondaryAuth } from '../../config/secondaryFirebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, query, getDocs, updateDoc, doc, setDoc, where, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { checkMobileExists } from '../../utils/phoneValidation';
import { validateName, validateEmail, validatePhoneNumber } from '../../utils/validation';

interface Employee {
  documentId?: string;
  name?: string;
  email: string;
  mobile?: string;
  role: string;
  plainPassword?: string;
  status: 'active' | 'inactive';
  createdAt?: any;
}

const roleOptions = [
  { label: 'Super Admin', value: 'admin' },
  { label: 'Teacher', value: 'teacher' },
  { label: 'Manager', value: 'manager' }
];

const statusOptions = [
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
];

const Employees: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    mobile: '',
    role: 'admin',
    status: 'active'
  });

  const fetchEmployees = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, 'users'), where('role', 'in', ['admin', 'teacher', 'manager']));
      const snapshot = await getDocs(q);
      const fetched: Employee[] = [];
      snapshot.forEach(doc => {
        fetched.push({ documentId: doc.id, ...doc.data() } as Employee);
      });
      setEmployees(fetched);
    } catch (error) {
      console.error("Error fetching employees:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const columns: Column<Employee>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
            {row.name ? row.name.charAt(0).toUpperCase() : 'E'}
          </div>
          <span className="font-semibold text-[var(--text-main)]">{row.name}</span>
        </div>
      )
    },
    { key: 'email', header: 'Email' },
    { key: 'mobile', header: 'Mobile', render: (row) => row.mobile || '-' },
    { 
      key: 'role', 
      header: 'Role', 
      render: (row) => (
        <span className="capitalize font-medium text-purple-700 bg-purple-50 px-2 py-1 rounded text-xs border border-purple-100">
          {row.role === 'admin' ? 'Super Admin' : row.role}
        </span>
      )
    },
    {
      key: 'plainPassword',
      header: 'Initial Password',
      render: (row) => (
        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded border border-gray-200">
          {row.plainPassword || 'Changed/Unknown'}
        </span>
      )
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const fnVal = validateName(formData.firstName, 'First Name');
    if (!fnVal.isValid) { alert(fnVal.error); return; }

    if (formData.lastName.trim()) {
      const lnVal = validateName(formData.lastName, 'Last Name');
      if (!lnVal.isValid) { alert(lnVal.error); return; }
    }

    const emailVal = validateEmail(formData.email, 'Email Address');
    if (!emailVal.isValid) { alert(emailVal.error); return; }

    if (formData.mobile.trim()) {
      const mobVal = validatePhoneNumber(formData.mobile, 'Mobile Number');
      if (!mobVal.isValid) { alert(mobVal.error); return; }
    }

    try {
      if (formData.mobile.trim()) {
        const mobileCheck = await checkMobileExists(formData.mobile.trim(), editingId);
        if (mobileCheck.exists) {
          alert(mobileCheck.message || "This mobile number is already registered to another user.");
          return;
        }
      }

      setIsSaving(true);
      const fullName = `${formData.firstName} ${formData.lastName}`.trim();

      if (editingId) {
        // Update
        await updateDoc(doc(db, 'users', editingId), {
          name: fullName,
          email: formData.email,
          mobile: formData.mobile,
          role: formData.role,
          status: formData.status,
          updatedAt: serverTimestamp()
        });
        alert("Employee updated successfully.");
      } else {
        // Create
        const defaultPassword = formData.mobile ? formData.mobile : Math.random().toString(36).slice(-8);
        
        let uid = '';
        try {
          const userCred = await createUserWithEmailAndPassword(secondaryAuth, formData.email, defaultPassword);
          uid = userCred.user.uid;
        } catch (authError: any) {
          if (authError.code === 'auth/email-already-in-use') {
             alert(`Account creation failed: The email ${formData.email} is already in use by another account.`);
             setIsSaving(false);
             return;
          } else {
             throw authError;
          }
        }

        await setDoc(doc(db, 'users', uid), {
          uid,
          name: fullName,
          email: formData.email,
          mobile: formData.mobile,
          role: formData.role,
          status: formData.status,
          forcePasswordChange: true,
          plainPassword: defaultPassword,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        alert(`Success! Employee created.\n\nPlease share these credentials:\nEmail: ${formData.email}\nPassword: ${defaultPassword}`);
      }

      setIsModalOpen(false);
      resetForm();
      fetchEmployees();
    } catch (error: any) {
      console.error(error);
      alert("Error saving employee: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({ firstName: '', lastName: '', email: '', mobile: '', role: 'admin', status: 'active' });
  };

  const handleEdit = (emp: Employee) => {
    const parts = (emp.name || '').split(' ');
    setFormData({
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ') || '',
      email: emp.email,
      mobile: emp.mobile || '',
      role: emp.role || 'admin',
      status: emp.status || 'active'
    });
    setEditingId(emp.documentId || null);
    setIsModalOpen(true);
  };

  const handleDelete = async (emp: Employee) => {
    if (window.confirm(`Are you sure you want to delete ${emp.name}?`)) {
      try {
        await deleteDoc(doc(db, 'users', emp.documentId!));
        setEmployees(employees.filter(e => e.documentId !== emp.documentId));
      } catch (error: any) {
        alert("Failed to delete employee: " + error.message);
      }
    }
  };

  return (
    <div className="page-container flex flex-col gap-6">
      <div className="page-header flex justify-between items-center w-full">
        <div>
          <h1 className="page-title">Employees & Admins</h1>
          <div className="breadcrumbs">
            <span className="text-primary">Dashboard</span> <span className="separator">/</span> <span className="current">Employees</span>
          </div>
        </div>
        <button className="btn btn-primary flex items-center justify-center gap-2" onClick={() => { resetForm(); setIsModalOpen(true); }}>
          <Plus size={18} />
          Add Employee
        </button>
      </div>

      <DataTable 
        title="Staff Directory"
        columns={columns} 
        data={employees} 
        onEdit={handleEdit}
        onDelete={handleDelete}
        isLoading={isLoading}
        searchPlaceholder="Search staff..."
      />

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); resetForm(); }} 
        title={editingId ? "Edit Employee" : "Add New Employee"}
      >
        <form onSubmit={handleSave} className="modal-form">
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" name="firstName" placeholder="First Name" value={formData.firstName} onChange={handleInputChange} required />
            <Input label="Last Name" name="lastName" placeholder="Last Name" value={formData.lastName} onChange={handleInputChange} />
          </div>
          <div className="mb-4">
            <Input label="Email Address" name="email" type="email" placeholder="Email Address" value={formData.email} onChange={handleInputChange} required disabled={!!editingId} />
            {!editingId && <p className="text-xs text-gray-500 mt-1">A login account will automatically be created using this email.</p>}
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Input label="Mobile Number" name="mobile" placeholder="Mobile Number" value={formData.mobile} onChange={handleInputChange} />
            <Select label="System Role" name="role" options={roleOptions} value={formData.role} onChange={handleInputChange} required />
          </div>
          <Select label="Account Status" name="status" options={statusOptions} value={formData.status} onChange={handleInputChange} required />
          
          <div className="modal-form-footer">
            <button type="button" className="btn-modal-cancel" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-modal-primary" disabled={isSaving}>
              {isSaving ? "Saving..." : (editingId ? "Update Employee" : "Create Employee Account")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Employees;
