import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import type { Batch, Course, User } from '../../types/models';
import { db } from '../../config/firebase';
import { collection, query, getDocs, addDoc, updateDoc, doc, deleteDoc, where, arrayUnion } from 'firebase/firestore';
import { validateBatchName } from '../../utils/validation';

const Batches: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form State
  const [batchName, setBatchName] = useState('');
  const [courseId, setCourseId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [youtubeVideoUrl, setYoutubeVideoUrl] = useState('');
  const [status, setStatus] = useState<'active' | 'completed' | 'inactive'>('active');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Data
  const [batches, setBatches] = useState<Batch[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);

  const fetchDependencies = async () => {
    try {
      // Fetch Courses
      const cq = query(collection(db, 'courses'), where('status', '==', 'active'));
      const cSnapshot = await getDocs(cq);
      const activeCourses: Course[] = [];
      cSnapshot.forEach(doc => activeCourses.push({ documentId: doc.id, ...doc.data() } as Course));
      setCourses(activeCourses);

      // Fetch Teachers
      const tq = query(collection(db, 'users'), where('role', '==', 'teacher'), where('status', '==', 'active'));
      const tSnapshot = await getDocs(tq);
      const activeTeachers: User[] = [];
      tSnapshot.forEach(doc => activeTeachers.push({ documentId: doc.id, ...doc.data() } as User));
      setTeachers(activeTeachers);

    } catch (error) {
      console.error("Error fetching dependencies:", error);
    }
  };

  const fetchBatches = async () => {
    try {
      setIsLoading(true);
      const q = query(collection(db, 'batches'));
      const snapshot = await getDocs(q);
      const fetchedBatches: Batch[] = [];
      snapshot.forEach(doc => {
        fetchedBatches.push({ documentId: doc.id, ...doc.data() } as Batch);
      });
      setBatches(fetchedBatches);
    } catch (error) {
      console.error("Error fetching batches:", error);
      alert("Failed to load batches");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDependencies();
    fetchBatches();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nameVal = validateBatchName(batchName, 'Batch Name');
    if (!nameVal.isValid) { alert(nameVal.error); return; }

    if (!courseId || !teacherId || !startDate) {
      alert("Please fill in all required fields");
      return;
    }

    setIsSaving(true);

    try {
      const batchData: any = {
        batchName,
        courseId,
        teacherId,
        meetingLink,
        youtubeVideoUrl: youtubeVideoUrl.trim(),
        demoVideoUrl: youtubeVideoUrl.trim(),
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        status
      };

      let newBatchId = editingId;
      if (editingId) {
        await updateDoc(doc(db, 'batches', editingId), batchData);
      } else {
        const docRef = await addDoc(collection(db, 'batches'), batchData);
        newBatchId = docRef.id;
      }

      // If a YouTube video is attached, also sync to youtube_videos collection
      if (youtubeVideoUrl.trim()) {
        try {
          await addDoc(collection(db, 'youtube_videos'), {
            title: `${batchName} - Introduction & Demo Lecture`,
            youtubeUrl: youtubeVideoUrl.trim(),
            category: 'New Batch Demo',
            batchId: newBatchId,
            batchName: batchName,
            description: `Official introduction & orientation video for batch: ${batchName}`,
            createdAt: new Date()
          });
        } catch (vErr) {
          console.warn("Could not sync youtube_videos collection", vErr);
        }
      }

      // Assign the batch to the teacher's profile
      if (teacherId && newBatchId) {
        try {
          await updateDoc(doc(db, 'users', teacherId), {
            batchIds: arrayUnion(newBatchId)
          });
        } catch (err) {
          console.error("Could not assign batch to teacher document", err);
        }
      }

      setIsModalOpen(false);
      resetForm();
      fetchBatches();
    } catch (error) {
      console.error("Error saving batch:", error);
      alert("Failed to save batch");
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setBatchName('');
    setCourseId('');
    setTeacherId('');
    setStartDate('');
    setEndDate('');
    setMeetingLink('');
    setYoutubeVideoUrl('');
    setStatus('active');
    setEditingId(null);
  };

  const handleEdit = (batch: any) => {
    setBatchName(batch.batchName);
    setCourseId(batch.courseId);
    setTeacherId(batch.teacherId);
    setMeetingLink(batch.meetingLink || '');
    setYoutubeVideoUrl(batch.youtubeVideoUrl || batch.demoVideoUrl || '');
    setStatus(batch.status);
    
    // Format dates for input[type="date"]
    let sDate = '';
    let eDate = '';
    if (batch.startDate instanceof Date) { sDate = batch.startDate.toISOString().split('T')[0]; }
    else if ((batch.startDate as any)?.toDate) { sDate = (batch.startDate as any).toDate().toISOString().split('T')[0]; }
    
    if (batch.endDate instanceof Date) { eDate = batch.endDate.toISOString().split('T')[0]; }
    else if ((batch.endDate as any)?.toDate) { eDate = (batch.endDate as any).toDate().toISOString().split('T')[0]; }
    
    setStartDate(sDate);
    setEndDate(eDate);
    setEditingId(batch.documentId || null);
    setIsModalOpen(true);
  };

  const handleDelete = async (batch: Batch) => {
    if (!batch.documentId) return;
    if (window.confirm('Are you sure you want to delete this batch?')) {
      try {
        await deleteDoc(doc(db, 'batches', batch.documentId));
        fetchBatches();
      } catch (error) {
        console.error("Error deleting batch:", error);
        alert("Failed to delete batch");
      }
    }
  };

  const getCourseName = (id: string) => courses.find(c => c.documentId === id)?.courseName || id;
  const getTeacherName = (id: string) => teachers.find(t => t.documentId === id)?.name || id;

  const formatDate = (dateValue: any) => {
    if (!dateValue) return 'N/A';
    if (dateValue instanceof Date) return dateValue.toLocaleDateString();
    if (dateValue.toDate) return dateValue.toDate().toLocaleDateString();
    return new Date(dateValue).toLocaleDateString();
  };

  const columns: Column<Batch>[] = [
    {
      key: 'batchName',
      header: 'Batch Name',
      render: (row) => <span className="font-medium">{row.batchName}</span>
    },
    {
      key: 'courseId',
      header: 'Course',
      render: (row) => getCourseName(row.courseId)
    },
    {
      key: 'teacherId',
      header: 'Teacher',
      render: (row) => getTeacherName(row.teacherId)
    },
    {
      key: 'startDate',
      header: 'Start Date',
      render: (row) => formatDate(row.startDate)
    },
    {
      key: 'endDate',
      header: 'End Date',
      render: (row) => formatDate(row.endDate)
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
      <div className="page-header">
        <div>
          <h1 className="page-title">Batches</h1>
          <div className="breadcrumbs">
            <span>Dashboard</span> <span className="separator">/</span> <span className="current">Batches</span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setIsModalOpen(true); }}>
          <Plus size={16} />
          Create Batch
        </button>
      </div>

      <DataTable 
        title="Batch Records" 
        data={batches} 
        columns={columns} 
        onEdit={handleEdit}
        onDelete={handleDelete}
        searchPlaceholder="Search batches..."
        isLoading={isLoading}
      />

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title={editingId ? "Edit Batch" : "Create Batch"}>
        <form onSubmit={handleSubmit} className="modal-form">
          <Input 
            label="Batch Name" 
            placeholder="e.g. SEP-2026 Morning"
            value={batchName}
            onChange={(e) => setBatchName(e.target.value)}
            required 
          />
          <Select 
            label="Select Course" 
            options={courses.map(c => ({ label: c.courseName, value: c.documentId || '' }))} 
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            required
          />
          <Select 
            label="Assign Teacher" 
            options={teachers.map(t => ({ label: t.name || t.email || '', value: t.documentId || '' }))} 
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Start Date" 
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required 
            />
            <Input 
              label="End Date (Optional)" 
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <Input 
            label="Online Meeting Link (Optional)" 
            type="url"
            placeholder="e.g. Zoom or Google Meet link"
            value={meetingLink}
            onChange={(e) => setMeetingLink(e.target.value)}
          />
          <Input 
            label="YouTube Orientation / Demo Video Link (Optional)" 
            type="url"
            placeholder="e.g. https://youtu.be/Uhg80b2TJVs"
            value={youtubeVideoUrl}
            onChange={(e) => setYoutubeVideoUrl(e.target.value)}
          />
          <Select 
            label="Status" 
            options={[
              {label: 'Active', value: 'active'}, 
              {label: 'Completed', value: 'completed'},
              {label: 'Inactive', value: 'inactive'}
            ]} 
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
          />
          
          <div className="modal-actions">
            <button type="submit" className="btn btn-success" disabled={isSaving}>
              {isSaving ? "Saving..." : (editingId ? "Update Batch" : "Create Batch")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Batches;
