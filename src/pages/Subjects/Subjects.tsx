import React, { useState, useEffect } from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import type { Subject } from '../../types/models';
import '../../components/ui/TableStyles.css';

const Subjects: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form State
  const [courseId, setCourseId] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  // Dummy Data
  const [subjects, setSubjects] = useState<Subject[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSubjects([
        { documentId: '1', courseId: 'Course1', subjectName: 'Grammar', status: 'active' },
        { documentId: '2', courseId: 'Course1', subjectName: 'Vocabulary', status: 'active' }
      ]);
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newSubject: Subject = {
      documentId: Math.random().toString(36).substr(2, 9),
      courseId,
      subjectName,
      status
    };
    setSubjects([...subjects, newSubject]);
    setIsModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setCourseId('');
    setSubjectName('');
    setStatus('active');
  };

  const handleEdit = (subject: Subject) => {
    setCourseId(subject.courseId);
    setSubjectName(subject.subjectName);
    setStatus(subject.status);
    setIsModalOpen(true);
  };

  const handleDelete = (subject: Subject) => {
    setSubjects(subjects.filter(s => s.documentId !== subject.documentId));
  };

  const columns: Column<Subject>[] = [
    {
      key: 'subjectName',
      header: 'Subject Name',
      render: (row) => <span className="font-medium">{row.subjectName}</span>
    },
    {
      key: 'courseId',
      header: 'Course ID'
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
          <h1 className="page-title">Subjects</h1>
          <div className="breadcrumbs">
            <span>Dashboard</span> <span className="separator">/</span> <span className="current">Subjects</span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} />
          Add Subject
        </button>
      </div>

      <DataTable 
        title="Subject Records" 
        data={subjects} 
        columns={columns} 
        onEdit={handleEdit}
        onDelete={handleDelete}
        searchPlaceholder="Search subjects..."
        isLoading={isLoading}
      />

      {/* Add Subject Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Subject Request">
        <form onSubmit={handleSubmit} className="modal-form">
          <Input 
            label="Subject Name" 
            placeholder="e.g. Grammar"
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
            required 
          />
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
            label="Status" 
            options={[{label: 'Active', value: 'active'}, {label: 'Inactive', value: 'inactive'}]} 
            value={status}
            onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
          />
          
          <div className="modal-actions">
            <button type="submit" className="btn btn-success">Save Subject</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Subjects;
