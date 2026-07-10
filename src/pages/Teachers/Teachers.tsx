import React, { useState, useEffect } from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import type { User } from '../../types/models';
import '../../components/ui/TableStyles.css';

const Teachers: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form State
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  // Dummy Data
  const [teachers, setTeachers] = useState<User[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTeachers([
        { 
          documentId: '1', 
          uid: 'uid1',
          role: 'teacher',
          email: 'teacher1@speakhub.com', 
          mobile: '9876543210',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newTeacher: User = {
      documentId: Math.random().toString(36).substr(2, 9),
      uid: 'temp_uid',
      role: 'teacher',
      email,
      mobile,
      status,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    setTeachers([...teachers, newTeacher]);
    setIsModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setEmail('');
    setMobile('');
    setStatus('active');
  };

  const handleEdit = (teacher: User) => {
    setEmail(teacher.email);
    setMobile(teacher.mobile || '');
    setStatus(teacher.status);
    setIsModalOpen(true);
  };

  const handleDelete = (teacher: User) => {
    setTeachers(teachers.filter(t => t.documentId !== teacher.documentId));
  };

  const columns: Column<User>[] = [
    {
      key: 'email',
      header: 'Email',
      render: (row) => <span className="font-medium">{row.email}</span>
    },
    {
      key: 'mobile',
      header: 'Mobile',
      render: (row) => <span>{row.mobile || '-'}</span>
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <button className={`dt-badge ${row.status === 'active' ? 'active' : 'inactive'}`}>
          {row.status.charAt(0).toUpperCase() + row.status.slice(1)} <ChevronDown size={14} />
        </button>
      )
    }
  ];

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Teachers</h1>
          <div className="breadcrumbs">
            <span>Dashboard</span> <span className="separator">/</span> <span className="current">Teachers</span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
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
        searchPlaceholder="Search teachers..."
        isLoading={isLoading}
      />

      {/* Add Teacher Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Teacher Request">
        <form onSubmit={handleSubmit} className="modal-form">
          <Input 
            label="Email Address" 
            type="email"
            placeholder="e.g. teacher@speakhub.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required 
          />
          <Input 
            label="Mobile Number" 
            placeholder="e.g. 9876543210"
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
            <button type="submit" className="btn btn-success">Save Teacher</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Teachers;
