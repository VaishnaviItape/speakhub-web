import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import type { Student } from '../../types/models';
import { ChevronDown } from 'lucide-react';
import '../../components/ui/TableStyles.css'; // Keep page container styles

const Students: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentMobile, setParentMobile] = useState('');
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  // Dummy Data
  const [students, setStudents] = useState<Student[]>([]);

  useEffect(() => {
    // Simulate loading to show loader skeleton
    const timer = setTimeout(() => {
      setStudents([
        { 
          documentId: '1', 
          studentCode: 'STU-001', 
          userId: 'user1',
          firstName: 'John', 
          lastName: 'Doe',
          parentName: 'Richard Doe',
          parentMobile: '1234567890',
          courseIds: ['Course1'],
          batchIds: ['Batch1'],
          joiningDate: new Date(),
          status: 'active' 
        }
      ]);
      setIsLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newStudent: Student = {
      documentId: Math.random().toString(36).substr(2, 9),
      studentCode,
      userId: 'temp_user_id',
      firstName,
      lastName,
      parentName,
      parentMobile,
      courseIds: [courseId],
      batchIds: [batchId],
      joiningDate: new Date(),
      status
    };
    setStudents([...students, newStudent]);
    setIsModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setStudentCode('');
    setParentName('');
    setParentMobile('');
    setCourseId('');
    setBatchId('');
    setStatus('active');
  };

  const handleEdit = (student: Student) => {
    // Fill form and open modal
    setStudentCode(student.studentCode);
    setFirstName(student.firstName);
    setLastName(student.lastName);
    setParentName(student.parentName || '');
    setParentMobile(student.parentMobile || '');
    setCourseId(student.courseIds[0] || '');
    setBatchId(student.batchIds[0] || '');
    setStatus(student.status);
    setIsModalOpen(true);
  };

  const handleDelete = (student: Student) => {
    setStudents(students.filter(s => s.documentId !== student.documentId));
  };

  const columns: Column<Student>[] = [
    {
      key: 'studentCode',
      header: 'Code',
      render: (row) => <span className="font-medium">{row.studentCode}</span>
    },
    {
      key: 'name',
      header: 'Name',
      render: (row) => `${row.firstName} ${row.lastName}`
    },
    {
      key: 'courseId',
      header: 'Course / Batch',
      render: (row) => (
        <div>
          <div>{row.courseIds.join(', ')}</div>
          <div style={{ fontSize: '0.75rem', color: '#a3aed0' }}>{row.batchIds.join(', ')}</div>
        </div>
      )
    },
    {
      key: 'parentName',
      header: 'Parent Contact',
      render: (row) => (
        <div>
          <div>{row.parentName || '-'}</div>
          <div style={{ fontSize: '0.75rem', color: '#a3aed0' }}>{row.parentMobile || '-'}</div>
        </div>
      )
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
          <h1 className="page-title">Students</h1>
          <div className="breadcrumbs">
            <span>Dashboard</span> <span className="separator">/</span> <span className="current">Students</span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} />
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

      {/* Add Student Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Student Request">
        <form onSubmit={handleSubmit} className="modal-form">
          <Input 
            label="Student Code" 
            placeholder="e.g. STU-001"
            value={studentCode}
            onChange={(e) => setStudentCode(e.target.value)}
            required 
          />
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="First Name" 
              placeholder="Enter first name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required 
            />
            <Input 
              label="Last Name" 
              placeholder="Enter last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required 
            />
          </div>
          <Input 
            label="Parent Name" 
            placeholder="Enter parent name"
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
          />
          <Input 
            label="Parent Mobile" 
            placeholder="Enter mobile number"
            value={parentMobile}
            onChange={(e) => setParentMobile(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select 
              label="Course" 
              options={[
                {label: 'Select Course', value: ''},
                {label: 'Spoken English Basics', value: 'Course1'}, 
                {label: 'Advanced English', value: 'Course2'}
              ]} 
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              required
            />
            <Select 
              label="Batch" 
              options={[
                {label: 'Select Batch', value: ''},
                {label: 'Morning Batch (Mon-Wed)', value: 'Batch1'}
              ]} 
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              required
            />
          </div>
          <Select 
            label="Status" 
            options={[{label: 'Active', value: 'active'}, {label: 'Inactive', value: 'inactive'}]} 
            value={status}
            onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
          />
          
          <div className="modal-actions">
            <button type="submit" className="btn btn-success">Save Student</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Students;
