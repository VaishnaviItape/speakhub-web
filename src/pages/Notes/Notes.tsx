import React, { useState, useEffect } from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import type { Note } from '../../types/models';
import '../../components/ui/TableStyles.css';

const Notes: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form State
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [fileType, setFileType] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  // Dummy Data
  const [notes, setNotes] = useState<Note[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setNotes([
        { 
          documentId: '1', 
          courseId: 'Course1', 
          batchId: 'Batch1',
          subjectId: 'Subject1',
          teacherId: 'Teacher1', 
          title: 'Introduction to Grammar',
          description: 'Basic grammar rules for beginners.',
          fileUrl: 'https://example.com/notes.pdf',
          fileType: 'PDF',
          status: 'active',
          createdAt: new Date()
        }
      ]);
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newNote: Note = {
      documentId: Math.random().toString(36).substr(2, 9),
      courseId,
      batchId,
      subjectId,
      teacherId,
      title,
      description,
      fileUrl,
      fileType,
      status,
      createdAt: new Date()
    };
    setNotes([...notes, newNote]);
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
    setFileUrl('');
    setFileType('');
    setStatus('active');
  };

  const handleEdit = (note: Note) => {
    setCourseId(note.courseId);
    setBatchId(note.batchId);
    setSubjectId(note.subjectId);
    setTeacherId(note.teacherId);
    setTitle(note.title);
    setDescription(note.description);
    setFileUrl(note.fileUrl);
    setFileType(note.fileType);
    setStatus(note.status);
    setIsModalOpen(true);
  };

  const handleDelete = (note: Note) => {
    setNotes(notes.filter(n => n.documentId !== note.documentId));
  };

  const columns: Column<Note>[] = [
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
      key: 'fileUrl',
      header: 'Attachment',
      render: (row) => (
        row.fileUrl ? (
          <a href={row.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
            <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-mono">{row.fileType || 'Link'}</span>
            View
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
    }
  ];

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Study Notes</h1>
          <div className="breadcrumbs">
            <span>Dashboard</span> <span className="separator">/</span> <span className="current">Notes</span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} />
          Upload Notes
        </button>
      </div>

      <DataTable 
        title="Notes & Materials" 
        data={notes} 
        columns={columns} 
        onEdit={handleEdit}
        onDelete={handleDelete}
        searchPlaceholder="Search notes..."
        isLoading={isLoading}
      />

      {/* Add Note Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Upload Study Notes">
        <form onSubmit={handleSubmit} className="modal-form">
          <Input 
            label="Title" 
            placeholder="e.g. Chapter 1: Grammar Rules"
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
            label="Description" 
            placeholder="Briefly describe the contents..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="grid grid-cols-[1fr_auto] gap-4">
             <Input 
              label="File URL" 
              placeholder="e.g. https://storage.google.com/..."
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              required
            />
             <Select 
              label="Type" 
              options={[
                {label: 'PDF Notes', value: 'PDF'},
                {label: 'Video Lesson', value: 'Video'},
                {label: 'Worksheet', value: 'Worksheet'},
                {label: 'Practice Sheet', value: 'Practice Sheet'},
                {label: 'Previous Paper', value: 'Previous Paper'},
                {label: 'Live Class Link', value: 'Live Link'}
              ]} 
              value={fileType}
              onChange={(e) => setFileType(e.target.value)}
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
            <button type="submit" className="btn btn-success">Save Notes</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Notes;
