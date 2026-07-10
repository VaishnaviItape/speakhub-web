import React, { useState, useEffect } from 'react';
import { Plus, ChevronDown, Upload, FileText, CheckSquare, Edit, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import { db } from '../../config/firebase';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, serverTimestamp } from 'firebase/firestore';
import { uploadFile } from '../../utils/storageService';
import { sendEmail } from '../../utils/emailService';
import type { Homework, Course, Batch, Subject, User } from '../../types/models';
import '../../components/ui/TableStyles.css';

const HomeworkPage: React.FC = () => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Data State
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);

  // Form State
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [topic, setTopic] = useState('');
  const [partChapter, setPartChapter] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  
  const [file, setFile] = useState<File | null>(null);
  const [maximumMarks, setMaximumMarks] = useState<number>(100);
  const [allowLateSubmission, setAllowLateSubmission] = useState(false);
  const [submissionType, setSubmissionType] = useState<string[]>(['Image', 'PDF', 'Text']);
  const [maxAudioDuration, setMaxAudioDuration] = useState<number>(2);
  const [maxVideoDuration, setMaxVideoDuration] = useState<number>(5);
  const [videoQuality, setVideoQuality] = useState<'Low' | 'Medium' | 'High'>('Medium');
  
  const [viewsData, setViewsData] = useState<any>({});

  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [publishDate, setPublishDate] = useState('');
  const [publishTime, setPublishTime] = useState('');
  const [status, setStatus] = useState<'draft' | 'scheduled' | 'published' | 'closed'>('draft');

  useEffect(() => {
    fetchFormData();
    fetchHomeworks();
  }, []);

  const fetchFormData = async () => {
    try {
      const cSnap = await getDocs(collection(db, 'courses'));
      setCourses(cSnap.docs.map(d => ({ documentId: d.id, ...d.data() } as Course)));
      const bSnap = await getDocs(collection(db, 'batches'));
      setBatches(bSnap.docs.map(d => ({ documentId: d.id, ...d.data() } as Batch)));
      const sSnap = await getDocs(collection(db, 'subjects'));
      setSubjects(sSnap.docs.map(d => ({ documentId: d.id, ...d.data() } as Subject)));
      const tSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'teacher')));
      setTeachers(tSnap.docs.map(d => ({ documentId: d.id, ...d.data() } as User)));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchHomeworks = async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, 'homeworks'));
      const hwList = snap.docs.map(d => ({ documentId: d.id, ...d.data() } as Homework));
      setHomeworks(hwList);

      const viewsSnap = await getDocs(query(collection(db, 'content_views'), where('contentType', '==', 'homework')));
      const viewsMap: any = {};
      viewsSnap.forEach(d => {
         const v = d.data();
         if (!viewsMap[v.contentId]) viewsMap[v.contentId] = new Set();
         viewsMap[v.contentId].add(v.studentId);
      });

      const sSnap = await getDocs(query(collection(db, 'users'), where('status', '==', 'active')));
      const students = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const batchCounts: any = {};
      students.forEach((s: any) => {
        (s.batchIds || []).forEach((bid: string) => {
           batchCounts[bid] = (batchCounts[bid] || 0) + 1;
        });
      });

      const finalViews: any = {};
      hwList.forEach(hw => {
         const viewed = viewsMap[hw.documentId!] ? viewsMap[hw.documentId!].size : 0;
         const total = batchCounts[hw.batchId] || 0;
         finalViews[hw.documentId!] = { viewed, notViewed: Math.max(0, total - viewed), total };
      });
      setViewsData(finalViews);

    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotifyStudents = async (targetBatchId: string, titleStr: string) => {
    try {
      const q = query(collection(db, 'users'), where('batchIds', 'array-contains', targetBatchId), where('status', '==', 'active'));
      const snap = await getDocs(q);
      snap.forEach(userDoc => {
        const student = userDoc.data();
        sendEmail(
          student.email,
          `New Homework Assigned: ${titleStr}`,
          `Hello ${student.name},\n\nA new homework titled "${titleStr}" has been published to your batch.\nPlease check your student dashboard for instructions and due date.\n\nThanks,\nSpeak Hub Academy`
        );
      });
    } catch (e) {
      console.error("Failed to notify students", e);
    }
  };

  const toggleSubmissionType = (type: string) => {
    if (submissionType.includes(type)) {
      setSubmissionType(submissionType.filter(t => t !== type));
    } else {
      setSubmissionType([...submissionType, type]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let finalFileUrl = '';
      if (file) {
        finalFileUrl = await uploadFile(file, 'homework_attachments');
      }

      const hwData: Partial<Homework> = {
        courseId, batchId, subjectId, teacherId, topic, partChapter, title, description, instructions,
        maximumMarks, allowLateSubmission, submissionType,
        maxAudioDuration, maxVideoDuration, videoQuality,
        dueDate: dueDate ? new Date(dueDate) : new Date(),
        dueTime,
        publishDate: publishDate ? new Date(publishDate) : new Date(),
        publishTime, status
      };

      if (finalFileUrl) hwData.attachmentUrl = finalFileUrl;

      if (editingId) {
        await updateDoc(doc(db, 'homeworks', editingId), hwData);
      } else {
        await addDoc(collection(db, 'homeworks'), hwData);
      }

      if (status === 'published' && (!editingId || true)) {
        handleNotifyStudents(batchId, title);
      }

      setIsModalOpen(false);
      resetForm();
      fetchHomeworks();
    } catch (e) {
      console.error(e);
      alert("Error saving homework.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setCourseId(''); setBatchId(''); setSubjectId(''); setTeacherId('');
    setTopic(''); setPartChapter(''); setTitle(''); setDescription(''); setInstructions('');
    setFile(null); setMaximumMarks(100); setAllowLateSubmission(false);
    setSubmissionType(['Image', 'PDF', 'Text']);
    setMaxAudioDuration(2); setMaxVideoDuration(5); setVideoQuality('Medium');
    setDueDate(''); setDueTime(''); setPublishDate(''); setPublishTime('');
    setStatus('draft');
  };

  const handleEdit = (hw: Homework) => {
    setEditingId(hw.documentId!);
    setCourseId(hw.courseId); setBatchId(hw.batchId); setSubjectId(hw.subjectId); setTeacherId(hw.teacherId);
    setTopic(hw.topic || ''); setPartChapter(hw.partChapter || ''); setTitle(hw.title); 
    setDescription(hw.description); setInstructions(hw.instructions || '');
    setMaximumMarks(hw.maximumMarks || 100); setAllowLateSubmission(hw.allowLateSubmission || false);
    setSubmissionType(hw.submissionType || ['Image', 'PDF', 'Text']);
    setMaxAudioDuration(hw.maxAudioDuration || 2);
    setMaxVideoDuration(hw.maxVideoDuration || 5);
    setVideoQuality(hw.videoQuality || 'Medium');
    setDueDate(hw.dueDate instanceof Date ? hw.dueDate.toISOString().split('T')[0] : (hw.dueDate as any)?.toDate?.().toISOString().split('T')[0] || '');
    setDueTime(hw.dueTime || '');
    setPublishDate(hw.publishDate instanceof Date ? hw.publishDate.toISOString().split('T')[0] : (hw.publishDate as any)?.toDate?.().toISOString().split('T')[0] || '');
    setPublishTime(hw.publishTime || '');
    setStatus(hw.status);
    setIsModalOpen(true);
  };

  const handleDelete = async (hw: Homework) => {
    if(confirm("Are you sure you want to delete this assignment?")) {
      await deleteDoc(doc(db, 'homeworks', hw.documentId!));
      fetchHomeworks();
    }
  };

  const columns: Column<Homework>[] = [
    {
      key: 'title',
      header: 'Title & Details',
      render: (row) => (
        <div>
          <div className="font-medium text-blue-800">{row.title}</div>
          <div className="text-xs text-[var(--text-muted)] truncate max-w-[200px]" title={row.description}>{row.topic} - {row.partChapter}</div>
        </div>
      )
    },
    {
      key: 'courseInfo',
      header: 'Target Audience',
      render: (row) => {
        const cName = courses.find(c => c.documentId === row.courseId)?.courseName || row.courseId;
        const bName = batches.find(b => b.documentId === row.batchId)?.batchName || row.batchId;
        return (
          <div>
            <div className="font-medium text-sm">{cName}</div>
            <div className="text-xs text-blue-600 font-bold">{bName}</div>
          </div>
        )
      }
    },
    {
      key: 'views',
      header: 'Engagement',
      render: (row) => {
        const stats = viewsData[row.documentId!] || { viewed: 0, notViewed: 0, total: 0 };
        return (
          <div className="text-xs">
            <div className="text-green-700 font-bold">Viewed: {stats.viewed}</div>
            <div className="text-red-700 font-bold">Not Viewed: {stats.notViewed}</div>
            <div className="text-gray-500 mt-1">Total: {stats.total}</div>
          </div>
        );
      }
    },
    {
      key: 'schedule',
      header: 'Schedule',
      render: (row) => {
        const dDate = row.dueDate instanceof Date ? row.dueDate.toLocaleDateString() : (row.dueDate as any)?.toDate?.().toLocaleDateString();
        return (
          <div>
            <div className="text-xs"><span className="text-gray-500">Due:</span> <span className="font-bold text-red-600">{dDate} {row.dueTime}</span></div>
            {row.allowLateSubmission && <div className="text-xs text-orange-500">Late Submission Allowed</div>}
          </div>
        )
      }
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span className={`px-2 py-1 rounded text-xs font-bold ${row.status === 'published' ? 'bg-green-100 text-green-800' : row.status === 'closed' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
          {row.status.toUpperCase()}
        </span>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex gap-2 items-center">
          <button className="bg-blue-600 text-white px-2 py-1 text-xs font-bold rounded flex items-center gap-1" onClick={() => navigate(`/homework/${row.documentId}/review`)}>
            <CheckSquare size={12}/> Review Submissions
          </button>
          <button className="text-blue-600 hover:bg-blue-50 p-1 rounded" onClick={() => handleEdit(row)}><Edit size={16}/></button>
          <button className="text-red-600 hover:bg-red-50 p-1 rounded" onClick={() => handleDelete(row)}><Trash2 size={16}/></button>
        </div>
      )
    }
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Homework Assignments</h1>
          <div className="breadcrumbs">
            <span>Dashboard</span> <span className="separator">/</span> <span className="current">Homework</span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setIsModalOpen(true); }}>
          <Plus size={16} /> Assign Homework
        </button>
      </div>

      <DataTable 
        title="Homework Directory" 
        data={homeworks} 
        columns={columns} 
        searchPlaceholder="Search homework..."
        isLoading={isLoading}
      />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Edit Homework" : "Assign Homework"}>
        <form onSubmit={handleSubmit} className="modal-form" style={{maxHeight: '75vh', overflowY: 'auto', paddingRight: '10px'}}>
          
          <div className="bg-gray-50 p-3 rounded-lg mb-4 border border-gray-200">
            <h4 className="font-bold text-gray-700 mb-2">Target Assignment</h4>
            <div className="grid grid-cols-2 gap-4">
              <Select label="Course" options={[{label: 'Select Course', value: ''}, ...courses.map(c => ({label: c.courseName, value: c.documentId!}))]} value={courseId} onChange={(e) => setCourseId(e.target.value)} required />
              <Select label="Batch" options={[{label: 'Select Batch', value: ''}, ...batches.map(b => ({label: b.batchName, value: b.documentId!}))]} value={batchId} onChange={(e) => setBatchId(e.target.value)} required />
              <Select label="Subject" options={[{label: 'Select Subject', value: ''}, ...subjects.map(s => ({label: s.subjectName, value: s.documentId!}))]} value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required />
              <Select label="Teacher" options={[{label: 'Select Teacher', value: ''}, ...teachers.map(t => ({label: t.name!, value: t.documentId!}))]} value={teacherId} onChange={(e) => setTeacherId(e.target.value)} required />
            </div>
          </div>

          <div className="bg-blue-50 p-3 rounded-lg mb-4 border border-blue-100">
            <h4 className="font-bold text-blue-800 mb-2">Content Hierarchy</h4>
            <Input label="Title" placeholder="e.g. Grammar Worksheet 1" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Input label="Topic" placeholder="e.g. Tenses" value={topic} onChange={(e) => setTopic(e.target.value)} />
              <Input label="Part / Chapter" placeholder="e.g. Part 2" value={partChapter} onChange={(e) => setPartChapter(e.target.value)} />
            </div>
            <div className="mt-4">
              <Input label="Description" placeholder="Briefly describe the task..." value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Detailed Instructions</label>
              <textarea 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all min-h-[80px]"
                placeholder="List steps for the students..."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-yellow-50 p-3 rounded-lg mb-4 border border-yellow-200">
            <h4 className="font-bold text-yellow-800 mb-2">Submission Requirements & Attachments</h4>
            <div className="grid grid-cols-2 gap-4 mb-4">
               <Input label="Maximum Marks" type="number" value={maximumMarks.toString()} onChange={(e) => setMaximumMarks(Number(e.target.value))} required />
               <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Allow Late Submission</label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={allowLateSubmission} onChange={(e) => setAllowLateSubmission(e.target.checked)} /> Yes, allow students to submit late
                  </label>
               </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Allowed Submission Types</label>
              <div className="flex flex-wrap gap-2">
                {['Image', 'PDF', 'Document', 'Text', 'Audio Recording', 'Audio File Upload', 'Video Recording', 'Video Upload'].map(type => (
                  <label key={type} className="flex items-center gap-1 bg-white px-3 py-1 rounded border border-gray-300 text-sm">
                    <input type="checkbox" checked={submissionType.includes(type)} onChange={() => toggleSubmissionType(type)} /> {type}
                  </label>
                ))}
              </div>
            </div>

            {(submissionType.some(t => t.includes('Audio') || t.includes('Video'))) && (
              <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-white rounded border border-gray-200">
                <Input label="Max Audio Duration (mins)" type="number" value={maxAudioDuration.toString()} onChange={(e) => setMaxAudioDuration(Number(e.target.value))} />
                <Input label="Max Video Duration (mins)" type="number" value={maxVideoDuration.toString()} onChange={(e) => setMaxVideoDuration(Number(e.target.value))} />
                <Select label="Video Quality" options={[{label:'Low',value:'Low'},{label:'Medium',value:'Medium'},{label:'High',value:'High'}]} value={videoQuality} onChange={(e) => setVideoQuality(e.target.value as any)} />
              </div>
            )}

            <div className="border-2 border-dashed border-gray-300 p-6 rounded-lg text-center bg-white hover:bg-gray-50">
              <FileText className="mx-auto text-gray-400 mb-2" />
              <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full text-sm text-gray-500" />
              <p className="text-xs text-gray-400 mt-2">Attach a worksheet or reference file</p>
            </div>
          </div>

          <div className="bg-green-50 p-3 rounded-lg mb-6 border border-green-200">
            <h4 className="font-bold text-green-800 mb-2">Scheduling & Deadlines</h4>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Input label="Publish Date" type="date" value={publishDate} onChange={(e) => setPublishDate(e.target.value)} required />
              <Input label="Publish Time" type="time" value={publishTime} onChange={(e) => setPublishTime(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4 border-t border-green-200 pt-4">
              <Input label="Due Date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
              <Input label="Due Time" type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} required />
            </div>
            <div className="mt-4">
              <Select 
                label="Status" 
                options={[
                  {label: 'Draft', value: 'draft'}, 
                  {label: 'Scheduled', value: 'scheduled'},
                  {label: 'Published', value: 'published'},
                  {label: 'Closed', value: 'closed'}
                ]} 
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
              />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn bg-gray-200 text-gray-800" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : (editingId ? 'Update Homework' : 'Save & Publish')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default HomeworkPage;
