import React, { useState, useEffect } from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import type { Homework } from '../../types/models';
import '../../components/ui/TableStyles.css';

const HomeworkPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form State
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  // Dummy Data
  const [homeworks, setHomeworks] = useState<Homework[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setHomeworks([
        { 
          documentId: '1', 
          courseId: 'Course1', 
          batchId: 'Batch1',
          subjectId: 'Subject1',
          teacherId: 'Teacher1', 
          title: 'Grammar Worksheet 1',
          description: 'Complete the attached worksheet on basic tenses.',
          attachmentUrl: 'https://example.com/worksheet.pdf',
          dueDate: new Date(Date.now() + 86400000 * 3), // 3 days from now
          status: 'active'
        }
      ]);
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newHomework: Homework = {
      documentId: Math.random().toString(36).substr(2, 9),
      courseId,
      batchId,
      subjectId,
      teacherId,
      title,
      description,
      attachmentUrl,
      dueDate: new Date(dueDate),
      status
    };
    setHomeworks([...homeworks, newHomework]);
    setIsModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setCourseId('');
    setBatchId('');
    setSubjectId('');
    setTeacherId('');
    setTitle('');
    setDescription('');
    setAttachmentUrl('');
    setDueDate('');
    setStatus('active');
  };

  const handleEdit = (hw: Homework) => {
    setCourseId(hw.courseId);
    setBatchId(hw.batchId);
    setSubjectId(hw.subjectId);
    setTeacherId(hw.teacherId);
    setTitle(hw.title);
    setDescription(hw.description);
    setAttachmentUrl(hw.attachmentUrl || '');
    setDueDate(hw.dueDate instanceof Date ? hw.dueDate.toISOString().split('T')[0] : '');
    setStatus(hw.status);
    setIsModalOpen(true);
  };

  const handleDelete = (hw: Homework) => {
    setHomeworks(homeworks.filter(h => h.documentId !== hw.documentId));
  };

  const columns: Column<Homework>[] = [
    {
      key: 'title',
      header: 'Title & Details',
      render: (row) => (
        <div>
          <div className="font-medium">{row.title}</div>
          <div className="text-xs text-[var(--text-muted)] truncate max-w-[200px]" title={row.description}>{row.description}</div>
        </div>
      )
    },
    {
      key: 'courseInfo',
      header: 'Course Info',
      render: (row) => (
        <div>
          <div>{row.courseId} <span className="text-[var(--text-muted)] text-xs">({row.subjectId})</span></div>
          <div className="text-xs text-[var(--text-muted)]">{row.batchId}</div>
        </div>
      )
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      render: (row) => (
        row.dueDate instanceof Date ? row.dueDate.toLocaleDateString() : 'Invalid Date'
      )
    },
    {
      key: 'attachment',
      header: 'Attachment',
      render: (row) => (
        row.attachmentUrl ? (
          <a href={row.attachmentUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
            View File
          </a>
        ) : <span className="text-[var(--text-muted)]">-</span>
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
    },
    {
      key: 'actions',
      header: 'Submissions',
      render: (row) => (
        <a href={`/homework/${row.documentId}/submissions`} className="text-blue-600 hover:underline text-sm font-medium">
          View Submissions
        </a>
      )
    }
  ];

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Homework</h1>
          <div className="breadcrumbs">
            <span>Dashboard</span> <span className="separator">/</span> <span className="current">Homework</span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} />
          Assign Homework
        </button>
      </div>

      <DataTable 
        title="Homework Assignments" 
        data={homeworks} 
        columns={columns} 
        onEdit={handleEdit}
        onDelete={handleDelete}
        searchPlaceholder="Search homework..."
        isLoading={isLoading}
      />

      {/* Add Homework Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Assign Homework">
        <form onSubmit={handleSubmit} className="modal-form">
          <Input 
            label="Title" 
            placeholder="e.g. Grammar Worksheet 1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required 
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
              label="Subject" 
              options={[
                {label: 'Select Subject', value: ''},
                {label: 'Grammar', value: 'Subject1'}, 
                {label: 'Vocabulary', value: 'Subject2'}
              ]} 
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select 
              label="Batch" 
              options={[
                {label: 'Select Batch', value: ''},
                {label: 'Morning Batch A', value: 'Batch1'}
              ]} 
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              required
            />
            <Select 
              label="Teacher" 
              options={[
                {label: 'Select Teacher', value: ''},
                {label: 'John Doe', value: 'Teacher1'}
              ]} 
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              required
            />
          </div>

          <Input 
            label="Description & Instructions" 
            placeholder="Explain what the students need to do..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Attachment URL (Optional)" 
              placeholder="e.g. https://storage.google.com/..."
              value={attachmentUrl}
              onChange={(e) => setAttachmentUrl(e.target.value)}
            />
            <Input 
              type="date"
              label="Due Date" 
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </div>

          <Select 
            label="Status" 
            options={[
              {label: 'Active', value: 'active'}, 
              {label: 'Inactive', value: 'inactive'}
            ]} 
            value={status}
            onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
          />
          
          <div className="modal-actions">
            <button type="submit" className="btn btn-success">Save Assignment</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default HomeworkPage;
