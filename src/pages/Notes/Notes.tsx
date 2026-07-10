import React, { useState, useEffect } from 'react';
import { Plus, ChevronDown, Upload, Link as LinkIcon, Edit, Trash2 } from 'lucide-react';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import { db } from '../../config/firebase';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, serverTimestamp } from 'firebase/firestore';
import { uploadFile } from '../../utils/storageService';
import { sendEmail } from '../../utils/emailService';
import type { Note, Course, Batch, Subject, User } from '../../types/models';
import '../../components/ui/TableStyles.css';

const Notes: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Data State
  const [notes, setNotes] = useState<Note[]>([]);
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
  const [uploadMode, setUploadMode] = useState<'file' | 'link'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [externalVideoLink, setExternalVideoLink] = useState('');
  const [youtubeLink, setYoutubeLink] = useState('');
  const [referenceLink, setReferenceLink] = useState('');
  const [publishDate, setPublishDate] = useState('');
  const [publishTime, setPublishTime] = useState('');
  const [status, setStatus] = useState<'draft' | 'scheduled' | 'published' | 'inactive'>('draft');
  const [viewsData, setViewsData] = useState<any>({});

  useEffect(() => {
    fetchFormData();
    fetchNotes();
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

  const fetchNotes = async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, 'notes'));
      const notesList = snap.docs.map(d => ({ documentId: d.id, ...d.data() } as Note));
      setNotes(notesList);

      const viewsSnap = await getDocs(query(collection(db, 'content_views'), where('contentType', '==', 'note')));
      const viewsMap: any = {};
      const durationMap: any = {};
      viewsSnap.forEach(d => {
         const v = d.data();
         if (!viewsMap[v.contentId]) {
           viewsMap[v.contentId] = new Set();
           durationMap[v.contentId] = [];
         }
         viewsMap[v.contentId].add(v.studentId);
         if (v.totalReadingDuration) durationMap[v.contentId].push(v.totalReadingDuration);
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
      notesList.forEach(n => {
         const viewed = viewsMap[n.documentId!] ? viewsMap[n.documentId!].size : 0;
         const total = batchCounts[n.batchId] || 0;
         const durations = durationMap[n.documentId!] || [];
         const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a:number,b:number)=>a+b, 0) / durations.length) : 0;
         finalViews[n.documentId!] = { viewed, notViewed: Math.max(0, total - viewed), total, avgDuration };
      });
      setViewsData(finalViews);

    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNotifyStudents = async (targetBatchId: string, noteTitle: string) => {
    try {
      const q = query(collection(db, 'users'), where('batchIds', 'array-contains', targetBatchId), where('status', '==', 'active'));
      const snap = await getDocs(q);
      snap.forEach(userDoc => {
        const student = userDoc.data();
        sendEmail(
          student.email,
          `New Study Notes Available: ${noteTitle}`,
          `Hello ${student.name},\n\nNew study notes titled "${noteTitle}" have been published to your batch.\nPlease check your student dashboard.\n\nThanks,\nSpeak Hub Academy`
        );
      });
    } catch (e) {
      console.error("Failed to notify students", e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let finalFileUrl = '';
      if (uploadMode === 'file' && file) {
        finalFileUrl = await uploadFile(file, 'notes');
      }

      const noteData: Partial<Note> = {
        courseId, batchId, subjectId, teacherId, topic, partChapter, title, description,
        fileUrl: finalFileUrl,
        externalVideoLink, youtubeLink, referenceLink,
        publishDate: publishDate ? new Date(publishDate) : new Date(),
        publishTime, status
      };

      if (editingId) {
        await updateDoc(doc(db, 'notes', editingId), noteData);
      } else {
        noteData.createdAt = serverTimestamp() as any;
        await addDoc(collection(db, 'notes'), noteData);
      }

      if (status === 'published' && (!editingId || true)) { // Simplified: notify if it hits published
        handleNotifyStudents(batchId, title);
      }

      setIsModalOpen(false);
      resetForm();
      fetchNotes();
    } catch (e) {
      console.error(e);
      alert("Error saving note.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setCourseId(''); setBatchId(''); setSubjectId(''); setTeacherId('');
    setTopic(''); setPartChapter(''); setTitle(''); setDescription('');
    setUploadMode('file'); setFile(null);
    setExternalVideoLink(''); setYoutubeLink(''); setReferenceLink('');
    setPublishDate(''); setPublishTime(''); setStatus('draft');
  };

  const handleEdit = (note: Note) => {
    setEditingId(note.documentId!);
    setCourseId(note.courseId); setBatchId(note.batchId); setSubjectId(note.subjectId); setTeacherId(note.teacherId);
    setTopic(note.topic || ''); setPartChapter(note.partChapter || ''); setTitle(note.title); setDescription(note.description);
    setUploadMode(note.fileUrl ? 'file' : 'link');
    setExternalVideoLink(note.externalVideoLink || ''); setYoutubeLink(note.youtubeLink || ''); setReferenceLink(note.referenceLink || '');
    setStatus(note.status);
    setIsModalOpen(true);
  };

  const handleDelete = async (note: Note) => {
    if(confirm("Are you sure you want to delete this note?")) {
      await deleteDoc(doc(db, 'notes', note.documentId!));
      fetchNotes();
    }
  };

  const columns: Column<Note>[] = [
    {
      key: 'title',
      header: 'Title & Details',
      render: (row) => (
        <div>
          <div className="font-medium">{row.title}</div>
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
        const sName = subjects.find(s => s.documentId === row.subjectId)?.subjectName || row.subjectId;
        return (
          <div>
            <div className="font-medium text-sm">{cName} &rarr; {sName}</div>
            <div className="text-xs text-blue-600 font-bold">{bName}</div>
          </div>
        )
      }
    },
    {
      key: 'content',
      header: 'Content',
      render: (row) => (
        <div className="flex gap-2">
          {row.fileUrl && <a href={row.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 bg-blue-50 px-2 rounded text-xs">File</a>}
          {row.youtubeLink && <a href={row.youtubeLink} target="_blank" rel="noreferrer" className="text-red-600 bg-red-50 px-2 rounded text-xs">YouTube</a>}
          {row.externalVideoLink && <a href={row.externalVideoLink} target="_blank" rel="noreferrer" className="text-purple-600 bg-purple-50 px-2 rounded text-xs">Video</a>}
        </div>
      )
    },
    {
      key: 'views',
      header: 'Engagement',
      render: (row) => {
        const stats = viewsData[row.documentId!] || { viewed: 0, notViewed: 0, total: 0, avgDuration: 0 };
        return (
          <div className="text-xs">
            <div className="text-green-700 font-bold">Viewed: {stats.viewed}</div>
            <div className="text-red-700 font-bold">Not Viewed: {stats.notViewed}</div>
            {stats.avgDuration > 0 && <div className="text-blue-600 font-bold mt-1">Avg Time: {stats.avgDuration}s</div>}
          </div>
        );
      }
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span className={`px-2 py-1 rounded text-xs font-bold ${row.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
          {row.status.toUpperCase()}
        </span>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex gap-2">
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
          <h1 className="page-title">Study Notes</h1>
          <div className="breadcrumbs">
            <span>Dashboard</span> <span className="separator">/</span> <span className="current">Notes</span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setIsModalOpen(true); }}>
          <Plus size={16} /> Upload Notes
        </button>
      </div>

      <DataTable 
        title="Notes Database" 
        data={notes} 
        columns={columns} 
        searchPlaceholder="Search notes..."
        isLoading={isLoading}
      />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Edit Notes" : "Upload Study Notes"}>
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
            <Input label="Title" placeholder="e.g. Chapter 1: Grammar Rules" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Input label="Topic" placeholder="e.g. Algebra" value={topic} onChange={(e) => setTopic(e.target.value)} />
              <Input label="Part / Chapter" placeholder="e.g. Chapter 4" value={partChapter} onChange={(e) => setPartChapter(e.target.value)} />
            </div>
            <div className="mt-4">
              <Input label="Description" placeholder="Briefly describe the contents..." value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>

          <div className="bg-yellow-50 p-3 rounded-lg mb-4 border border-yellow-200">
            <h4 className="font-bold text-yellow-800 mb-2">Media & Attachments</h4>
            <div className="flex gap-4 mb-4">
              <label className="flex items-center gap-2">
                <input type="radio" name="uploadMode" checked={uploadMode === 'file'} onChange={() => setUploadMode('file')} /> Upload File
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="uploadMode" checked={uploadMode === 'link'} onChange={() => setUploadMode('link')} /> External Links
              </label>
            </div>
            
            {uploadMode === 'file' ? (
              <div className="border-2 border-dashed border-gray-300 p-6 rounded-lg text-center hover:bg-gray-50">
                <Upload className="mx-auto text-gray-400 mb-2" />
                <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full text-sm text-gray-500" />
                <p className="text-xs text-gray-400 mt-2">Supported: PDF, DOCX, PPTX, Images</p>
              </div>
            ) : (
              <div className="grid gap-4">
                <Input label="YouTube Link" placeholder="https://youtube.com/..." value={youtubeLink} onChange={(e) => setYoutubeLink(e.target.value)} />
                <Input label="External Video Link" placeholder="https://vimeo.com/..." value={externalVideoLink} onChange={(e) => setExternalVideoLink(e.target.value)} />
                <Input label="Reference Document Link" placeholder="https://docs.google.com/..." value={referenceLink} onChange={(e) => setReferenceLink(e.target.value)} />
              </div>
            )}
          </div>

          <div className="bg-gray-50 p-3 rounded-lg mb-6 border border-gray-200">
            <h4 className="font-bold text-gray-700 mb-2">Publishing & Status</h4>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Publish Date" type="date" value={publishDate} onChange={(e) => setPublishDate(e.target.value)} />
              <Input label="Publish Time" type="time" value={publishTime} onChange={(e) => setPublishTime(e.target.value)} />
            </div>
            <div className="mt-4">
              <Select 
                label="Status" 
                options={[
                  {label: 'Draft', value: 'draft'}, 
                  {label: 'Scheduled', value: 'scheduled'},
                  {label: 'Published', value: 'published'},
                  {label: 'Inactive', value: 'inactive'}
                ]} 
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
              />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn bg-gray-200 text-gray-800" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : (editingId ? 'Update Notes' : 'Save & Publish')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Notes;
