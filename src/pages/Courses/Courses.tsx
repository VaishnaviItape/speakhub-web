import React, { useState, useEffect } from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import type { Course } from '../../types/models';
import '../../components/ui/TableStyles.css';

const Courses: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form State
  const [courseName, setCourseName] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  // Dummy Data
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setCourses([
        { documentId: '1', courseName: 'Spoken English Basics', description: 'Beginner level english speaking course', duration: '3 Months', status: 'active' },
        { documentId: '2', courseName: 'Advanced English', description: 'Advanced grammar and vocabulary', duration: '6 Months', status: 'active' }
      ]);
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newCourse: Course = {
      documentId: Math.random().toString(36).substr(2, 9),
      courseName,
      description,
      duration,
      status
    };
    setCourses([...courses, newCourse]);
    setIsModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setCourseName('');
    setDescription('');
    setDuration('');
    setStatus('active');
  };

  const handleEdit = (course: Course) => {
    setCourseName(course.courseName);
    setDescription(course.description);
    setDuration(course.duration);
    setStatus(course.status);
    setIsModalOpen(true);
  };

  const handleDelete = (course: Course) => {
    setCourses(courses.filter(c => c.documentId !== course.documentId));
  };

  const columns: Column<Course>[] = [
    {
      key: 'courseName',
      header: 'Course Name',
      render: (row) => <span className="font-medium">{row.courseName}</span>
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => <div className="max-w-xs truncate" title={row.description}>{row.description}</div>
    },
    {
      key: 'duration',
      header: 'Duration'
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
          <h1 className="page-title">Courses</h1>
          <div className="breadcrumbs">
            <span>Dashboard</span> <span className="separator">/</span> <span className="current">Courses</span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} />
          Add Course
        </button>
      </div>

      <DataTable 
        title="Course Records" 
        data={courses} 
        columns={columns} 
        onEdit={handleEdit}
        onDelete={handleDelete}
        searchPlaceholder="Search courses..."
        isLoading={isLoading}
      />

      {/* Add Course Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Course Request">
        <form onSubmit={handleSubmit} className="modal-form">
          <Input 
            label="Course Name" 
            placeholder="e.g. Spoken English Basics"
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
            required 
          />
          <Input 
            label="Duration" 
            placeholder="e.g. 3 Months"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            required 
          />
          <Input 
            label="Description" 
            placeholder="Course details and syllabus overview..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required 
          />
          <Select 
            label="Status" 
            options={[{label: 'Active', value: 'active'}, {label: 'Inactive', value: 'inactive'}]} 
            value={status}
            onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
          />
          
          <div className="modal-actions">
            <button type="submit" className="btn btn-success">Save Course</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Courses;
