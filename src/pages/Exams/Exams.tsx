import React, { useState, useEffect } from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import type { Exam } from '../../types/models';
import '../../components/ui/TableStyles.css';

const Exams: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form State
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [title, setTitle] = useState('');
  const [examType, setExamType] = useState<'MCQ' | 'Reading' | 'Speaking' | 'Abacus'>('MCQ');
  const [duration, setDuration] = useState('');
  const [passingMarks, setPassingMarks] = useState('');
  const [totalMarks, setTotalMarks] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  // Dummy Data
  const [exams, setExams] = useState<Exam[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setExams([
        { 
          documentId: '1', 
          courseId: 'Course1', 
          batchId: 'Batch1',
          subjectId: 'Subject1',
          title: 'Mid-Term Grammar Assessment',
          examType: 'MCQ',
          duration: 60,
          passingMarks: 40,
          totalMarks: 100,
          status: 'active'
        }
      ]);
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newExam: Exam = {
      documentId: Math.random().toString(36).substr(2, 9),
      courseId,
      batchId,
      subjectId,
      title,
      examType,
      duration: Number(duration),
      passingMarks: Number(passingMarks),
      totalMarks: Number(totalMarks),
      status
    };
    setExams([...exams, newExam]);
    setIsModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setCourseId('');
    setBatchId('');
    setSubjectId('');
    setTitle('');
    setExamType('MCQ');
    setDuration('');
    setPassingMarks('');
    setTotalMarks('');
    setStatus('active');
  };

  const handleEdit = (exam: Exam) => {
    setCourseId(exam.courseId);
    setBatchId(exam.batchId);
    setSubjectId(exam.subjectId);
    setTitle(exam.title);
    setExamType(exam.examType || 'MCQ');
    setDuration(exam.duration.toString());
    setPassingMarks(exam.passingMarks.toString());
    setTotalMarks(exam.totalMarks.toString());
    setStatus(exam.status);
    setIsModalOpen(true);
  };

  const handleDelete = (exam: Exam) => {
    setExams(exams.filter(e => e.documentId !== exam.documentId));
  };

  const columns: Column<Exam>[] = [
    {
      key: 'title',
      header: 'Exam Title',
      render: (row) => (
        <div>
          <span className="font-medium">{row.title}</span>
          <div className="text-xs text-blue-600 font-bold mt-1">{row.examType}</div>
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
      key: 'duration',
      header: 'Duration',
      render: (row) => `${row.duration} mins`
    },
    {
      key: 'marks',
      header: 'Marks (Pass/Total)',
      render: (row) => (
        <div>
          <span className="text-green-600 font-bold">{row.passingMarks}</span>
          <span className="text-[var(--text-muted)] mx-1">/</span>
          <span className="text-[var(--text-main)] font-bold">{row.totalMarks}</span>
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
    },
    {
      key: 'actions',
      header: 'Questions',
      render: (row) => (
        <a href={`/exams/${row.documentId}/questions`} className="text-blue-600 hover:underline text-sm font-medium">
          Manage Questions
        </a>
      )
    }
  ];

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Exams</h1>
          <div className="breadcrumbs">
            <span>Dashboard</span> <span className="separator">/</span> <span className="current">Exams</span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} />
          Create Exam
        </button>
      </div>

      <DataTable 
        title="Exam Management" 
        data={exams} 
        columns={columns} 
        onEdit={handleEdit}
        onDelete={handleDelete}
        searchPlaceholder="Search exams..."
        isLoading={isLoading}
      />

      {/* Add Exam Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New Exam">
        <form onSubmit={handleSubmit} className="modal-form">
          <Input 
            label="Exam Title" 
            placeholder="e.g. Mid-Term Assessment"
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
                {label: 'Scholar Phonics', value: 'CoursePhonics'},
                {label: 'Abacus', value: 'CourseAbacus'}
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
              label="Exam Type" 
              options={[
                {label: 'MCQ (Multiple Choice)', value: 'MCQ'},
                {label: 'Reading Assessment', value: 'Reading'},
                {label: 'Speaking Assessment', value: 'Speaking'},
                {label: 'Abacus Speed Test', value: 'Abacus'}
              ]} 
              value={examType}
              onChange={(e) => setExamType(e.target.value as any)}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input 
              type="number"
              label="Duration (Mins)" 
              placeholder="60"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              required
            />
            <Input 
              type="number"
              label="Total Marks" 
              placeholder="100"
              value={totalMarks}
              onChange={(e) => setTotalMarks(e.target.value)}
              required
            />
            <Input 
              type="number"
              label="Passing Marks" 
              placeholder="40"
              value={passingMarks}
              onChange={(e) => setPassingMarks(e.target.value)}
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
            <button type="submit" className="btn btn-success">Save Exam</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Exams;
