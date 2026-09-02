import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import type { Course } from '../../types/models';
import { db } from '../../config/firebase';
import { collection, query, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { validateName, validatePositiveNumber } from '../../utils/validation';
import '../../components/ui/TableStyles.css';

const Courses: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form State
  const [courseName, setCourseName] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('');
  const [monthlyFee, setMonthlyFee] = useState('');
  const [modeBadge, setModeBadge] = useState('ONLINE');
  const [demoVideoUrl, setDemoVideoUrl] = useState('https://youtube.com/@speakhubacademy?si=ZSnvnh5MzSqXPrpM');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Data
  const [courses, setCourses] = useState<Course[]>([]);

  const fetchCourses = async () => {
    try {
      setIsLoading(true);
      const q = query(collection(db, 'courses'));
      const querySnapshot = await getDocs(q);
      const fetchedCourses: Course[] = [];
      querySnapshot.forEach((doc) => {
        fetchedCourses.push({ documentId: doc.id, ...doc.data() } as Course);
      });
      setCourses(fetchedCourses);
    } catch (error) {
      console.error("Error fetching courses:", error);
      alert("Failed to load courses");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nameVal = validateName(courseName, 'Course Name');
    if (!nameVal.isValid) { alert(nameVal.error); return; }

    const feeVal = validatePositiveNumber(monthlyFee, 'Monthly Fee');
    if (!feeVal.isValid) { alert(feeVal.error); return; }

    setIsSaving(true);
    try {
      const coursePayload = {
        courseName,
        description,
        duration,
        monthlyFee: Number(monthlyFee),
        modeBadge,
        demoVideoUrl,
        status
      };

      if (editingId) {
        // Update existing course
        const courseRef = doc(db, 'courses', editingId);
        await updateDoc(courseRef, coursePayload);
      } else {
        // Add new course
        await addDoc(collection(db, 'courses'), coursePayload);
      }
      setIsModalOpen(false);
      resetForm();
      fetchCourses();
    } catch (error) {
      console.error("Error saving course:", error);
      alert("Failed to save course");
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setCourseName('');
    setDescription('');
    setDuration('');
    setMonthlyFee('');
    setModeBadge('ONLINE');
    setDemoVideoUrl('https://youtube.com/@speakhubacademy?si=ZSnvnh5MzSqXPrpM');
    setStatus('active');
    setEditingId(null);
  };

  const handleEdit = (course: any) => {
    setCourseName(course.courseName);
    setDescription(course.description);
    setDuration(course.duration);
    setMonthlyFee(course.monthlyFee?.toString() || '');
    setModeBadge(course.modeBadge || 'ONLINE');
    setDemoVideoUrl(course.demoVideoUrl || 'https://youtube.com/@speakhubacademy?si=ZSnvnh5MzSqXPrpM');
    setStatus(course.status);
    setEditingId(course.documentId || null);
    setIsModalOpen(true);
  };

  const handleDelete = async (course: Course) => {
    if (!course.documentId) return;
    if (window.confirm('Are you sure you want to delete this course?')) {
      try {
        await deleteDoc(doc(db, 'courses', course.documentId));
        fetchCourses();
      } catch (error) {
        console.error("Error deleting course:", error);
        alert("Failed to delete course");
      }
    }
  };

  const columns: Column<Course>[] = [
    {
      key: 'courseName',
      header: 'Course Name',
      render: (row) => <span className="font-medium">{row.courseName}</span>
    },
    // {
    //   key: 'description',
    //   header: 'Description',
    //   render: (row) => <div className="max-w-xs truncate" title={row.description}>{row.description}</div>
    // },
    {
      key: 'duration',
      header: 'Duration'
    },
    {
      key: 'monthlyFee',
      header: 'Monthly Fee',
      render: (row) => <span className="font-bold text-green-700">₹{row.monthlyFee || 0}</span>
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
        <button className="btn btn-primary" onClick={() => { resetForm(); setIsModalOpen(true); }}>
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

      {/* Add/Edit Course Modal */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title={editingId ? "Edit Course" : "Add Course"}>
        <form onSubmit={handleSubmit} className="modal-form">
          <Input 
            label="Course Name" 
            placeholder="e.g. Spoken English Basics"
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
            required 
          />
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Duration" 
              placeholder="e.g. 3 Months"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              required 
            />
            <Input 
              label="Monthly Fee (₹)" 
              type="number"
              placeholder="e.g. 800"
              value={monthlyFee}
              onChange={(e) => setMonthlyFee(e.target.value)}
              required 
            />
          </div>
          <Input 
            label="Description (Optional)" 
            placeholder="Course details and syllabus overview..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Mode / Badge" 
              placeholder="e.g. ONLINE, OFFLINE, HYBRID"
              value={modeBadge}
              onChange={(e) => setModeBadge(e.target.value)}
            />
            <Select 
              label="Status" 
              options={[{label: 'Active', value: 'active'}, {label: 'Inactive', value: 'inactive'}]} 
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
            />
          </div>
          <Input 
            label="Demo Video Link (YouTube / Web)" 
            placeholder="https://youtube.com/@speakhubacademy?si=ZSnvnh5MzSqXPrpM"
            value={demoVideoUrl}
            onChange={(e) => setDemoVideoUrl(e.target.value)}
          />
          
          <div className="modal-form-footer">
            <button type="button" className="btn-modal-cancel" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-modal-primary" disabled={isSaving}>
              {isSaving ? "Saving..." : (editingId ? "Update Course" : "Save Course")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Courses;
