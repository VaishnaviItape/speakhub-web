import React, { useState, useEffect } from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import type { Subject, Course } from '../../types/models';
import { db } from '../../config/firebase';
import { collection, query, getDocs, addDoc, updateDoc, doc, deleteDoc, where } from 'firebase/firestore';
import '../../components/ui/TableStyles.css';

const Subjects: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form State
  const [subjectName, setSubjectName] = useState('');
  const [courseId, setCourseId] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Data
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  const fetchCourses = async () => {
    try {
      const q = query(collection(db, 'courses'), where('status', '==', 'active'));
      const snapshot = await getDocs(q);
      const activeCourses: Course[] = [];
      snapshot.forEach(doc => {
        activeCourses.push({ documentId: doc.id, ...doc.data() } as Course);
      });
      setCourses(activeCourses);
    } catch (error) {
      console.error("Error fetching courses:", error);
    }
  };

  const fetchSubjects = async () => {
    try {
      setIsLoading(true);
      const q = query(collection(db, 'subjects'));
      const snapshot = await getDocs(q);
      const fetchedSubjects: Subject[] = [];
      snapshot.forEach(doc => {
        fetchedSubjects.push({ documentId: doc.id, ...doc.data() } as Subject);
      });
      setSubjects(fetchedSubjects);
    } catch (error) {
      console.error("Error fetching subjects:", error);
      alert("Failed to load subjects");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
    fetchSubjects();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) {
      alert("Please select a course");
      return;
    }

    try {
      if (editingId) {
        await updateDoc(doc(db, 'subjects', editingId), {
          subjectName,
          courseId,
          status
        });
      } else {
        await addDoc(collection(db, 'subjects'), {
          subjectName,
          courseId,
          status
        });
      }
      setIsModalOpen(false);
      resetForm();
      fetchSubjects();
    } catch (error) {
      console.error("Error saving subject:", error);
      alert("Failed to save subject");
    }
  };

  const resetForm = () => {
    setSubjectName('');
    setCourseId('');
    setStatus('active');
    setEditingId(null);
  };

  const handleEdit = (subject: Subject) => {
    setSubjectName(subject.subjectName);
    setCourseId(subject.courseId);
    setStatus(subject.status);
    setEditingId(subject.documentId || null);
    setIsModalOpen(true);
  };

  const handleDelete = async (subject: Subject) => {
    if (!subject.documentId) return;
    if (window.confirm('Are you sure you want to delete this subject?')) {
      try {
        await deleteDoc(doc(db, 'subjects', subject.documentId));
        fetchSubjects();
      } catch (error) {
        console.error("Error deleting subject:", error);
        alert("Failed to delete subject");
      }
    }
  };

  const getCourseName = (cId: string) => {
    return courses.find(c => c.documentId === cId)?.courseName || cId;
  };

  const columns: Column<Subject>[] = [
    {
      key: 'subjectName',
      header: 'Subject Name',
      render: (row) => <span className="font-medium">{row.subjectName}</span>
    },
    {
      key: 'courseId',
      header: 'Course',
      render: (row) => getCourseName(row.courseId)
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span className={`dt-badge ${row.status === 'active' ? 'active' : 'inactive'}`}>
          {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
        </span>
      )
    }
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Subjects</h1>
          <div className="breadcrumbs">
            <span>Dashboard</span> <span className="separator">/</span> <span className="current">Subjects</span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setIsModalOpen(true); }}>
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
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title={editingId ? "Edit Subject" : "Add Subject"}>
        <form onSubmit={handleSubmit} className="modal-form">
          <Input 
            label="Subject Name" 
            placeholder="e.g. Grammar"
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
            required 
          />
          <Select 
            label="Select Course" 
            options={courses.map(c => ({ label: c.courseName, value: c.documentId || '' }))} 
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
          />
          <Select 
            label="Status" 
            options={[{label: 'Active', value: 'active'}, {label: 'Inactive', value: 'inactive'}]} 
            value={status}
            onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
          />
          
          <div className="modal-actions">
            <button type="submit" className="btn btn-success">{editingId ? "Update Subject" : "Save Subject"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Subjects;
