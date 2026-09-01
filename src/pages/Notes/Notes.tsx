import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, BookOpen, Layers, Link as LinkIcon, Calendar as CalendarIcon } from 'lucide-react';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import { db } from '../../config/firebase';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, serverTimestamp } from 'firebase/firestore';
import { uploadFile } from '../../utils/storageService';
import { sendEmail } from '../../utils/emailService';
import type { Note, Course, Batch, User } from '../../types/models';
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
  const [teachers, setTeachers] = useState<User[]>([]);

  // Form State
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');
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
      const now = Date.now();
      const notesList = snap.docs.map(d => {
        const data = d.data() as Note;
        let nStatus = (data.status || 'draft').toLowerCase();

        // Automatically change status from scheduled to published when scheduled time is reached
        if (nStatus === 'scheduled') {
          let publishDateTime: Date | null = null;
          const rawPDate = data.publishDate as any;
          const pTimeStr = data.publishTime || '';

          if (rawPDate) {
            if (typeof rawPDate.toDate === 'function') {
              publishDateTime = rawPDate.toDate();
            } else if (rawPDate instanceof Date) {
              publishDateTime = new Date(rawPDate.getTime());
            } else if (typeof rawPDate.seconds === 'number') {
              publishDateTime = new Date(rawPDate.seconds * 1000);
            } else if (typeof rawPDate === 'string') {
              if (rawPDate.includes('T')) {
                publishDateTime = new Date(rawPDate);
              } else if (rawPDate.includes('-')) {
                const parts = rawPDate.split('-').map(Number);
                if (parts.length === 3) {
                  const y = parts[0] > 1000 ? parts[0] : parts[2];
                  const m = parts[1];
                  const d = parts[0] > 1000 ? parts[2] : parts[0];
                  publishDateTime = new Date(y, (m || 1) - 1, d || 1);
                } else {
                  publishDateTime = new Date(rawPDate);
                }
              } else {
                publishDateTime = new Date(rawPDate);
              }
            }
          }

          if (publishDateTime && !isNaN(publishDateTime.getTime()) && pTimeStr && pTimeStr.includes(':')) {
            const [hh, mm] = pTimeStr.split(':').map(Number);
            publishDateTime.setHours(hh || 0, mm || 0, 0, 0);
          }

          if (publishDateTime && !isNaN(publishDateTime.getTime()) && publishDateTime.getTime() <= now) {
            nStatus = 'published';
            updateDoc(doc(db, 'notes', d.id), { status: 'published' }).catch(console.error);
          }
        }

        return { documentId: d.id, ...data, status: nStatus as any } as Note;
      });
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
      // 1. Create in-app mobile push notification in Firestore
      await addDoc(collection(db, 'notifications'), {
        title: `📚 New Study Notes: ${noteTitle}`,
        message: `New study notes on "${topic || noteTitle}" have been uploaded for your batch.`,
        type: 'notes',
        batchId: targetBatchId || 'all',
        courseId: courseId || '',
        route: '/(app)/notes',
        actionLabel: 'Read Notes',
        createdAt: serverTimestamp(),
      });

      // 2. Send email notification
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
      } else if (editingId) {
        const existing = notes.find(n => n.documentId === editingId);
        finalFileUrl = existing?.fileUrl || referenceLink || '';
      } else {
        finalFileUrl = referenceLink || '';
      }

      let fullPublishDate: Date = new Date();
      if (publishDate) {
        const [hh, mm] = (publishTime || '00:00').split(':');
        const [yyyy, m, d] = publishDate.split('-').map(Number);
        fullPublishDate = new Date(yyyy, (m || 1) - 1, d || 1, Number(hh) || 0, Number(mm) || 0, 0);
      }

      const noteData: Partial<Note> = {
        courseId, batchId, teacherId, topic, partChapter, title, description,
        fileUrl: finalFileUrl,
        externalVideoLink, youtubeLink, referenceLink,
        publishDate: fullPublishDate,
        publishTime: publishTime || '00:00',
        status
      };

      if (editingId) {
        await updateDoc(doc(db, 'notes', editingId), noteData);
      } else {
        noteData.createdAt = serverTimestamp() as any;
        await addDoc(collection(db, 'notes'), noteData);
      }

      if (status === 'published' && (!editingId || true)) { // notify if published
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
    setCourseId(''); setBatchId(''); setTeacherId('');
    setTopic(''); setPartChapter(''); setTitle(''); setDescription('');
    setUploadMode('file'); setFile(null);
    setExternalVideoLink(''); setYoutubeLink(''); setReferenceLink('');
    setPublishDate(''); setPublishTime(''); setStatus('draft');
  };

  const handleEdit = (note: Note) => {
    setEditingId(note.documentId!);
    setCourseId(note.courseId || '');
    setBatchId(note.batchId || '');
    setTeacherId(note.teacherId || '');
    setTopic(note.topic || '');
    setPartChapter(note.partChapter || '');
    setTitle(note.title || '');
    setDescription(note.description || '');
    setUploadMode(note.fileUrl ? 'file' : 'link');
    setFile(null);
    setExternalVideoLink(note.externalVideoLink || '');
    setYoutubeLink(note.youtubeLink || '');
    setReferenceLink(note.referenceLink || note.fileUrl || (note as any).documentLink || (note as any).driveLink || '');
    
    // Bind publish date and time properly
    let pDateStr = '';
    let pTimeStr = note.publishTime || (note as any).time || '';
    const rawPDate = note.publishDate as any;
    if (rawPDate) {
      let d: Date | null = null;
      if (typeof rawPDate?.toDate === 'function') {
        d = rawPDate.toDate();
      } else if (rawPDate instanceof Date) {
        d = rawPDate;
      } else if (typeof rawPDate?.seconds === 'number') {
        d = new Date(rawPDate.seconds * 1000);
      } else if (typeof rawPDate === 'string') {
        d = new Date(rawPDate);
      }

      if (d && !isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        pDateStr = `${yyyy}-${mm}-${dd}`;
        if (!pTimeStr) {
          const hh = String(d.getHours()).padStart(2, '0');
          const min = String(d.getMinutes()).padStart(2, '0');
          pTimeStr = `${hh}:${min}`;
        }
      }
    }
    setPublishDate(pDateStr);
    setPublishTime(pTimeStr);

    // Normalize status (draft, scheduled, published, inactive)
    const rawStatus = (note.status || 'draft').toLowerCase();
    if (rawStatus === 'published' || rawStatus === 'scheduled' || rawStatus === 'inactive' || rawStatus === 'draft') {
      setStatus(rawStatus as any);
    } else {
      setStatus('draft');
    }

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
        return (
          <div>
            <div className="font-medium text-sm">{cName}</div>
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
          {row.fileUrl && <a href={row.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 bg-blue-50 px-2 py-1 rounded text-xs font-medium">File</a>}
          {row.referenceLink && <a href={row.referenceLink} target="_blank" rel="noreferrer" className="text-indigo-600 bg-indigo-50 px-2 py-1 rounded text-xs font-medium">Drive/Doc</a>}
          {row.youtubeLink && <a href={row.youtubeLink} target="_blank" rel="noreferrer" className="text-red-600 bg-red-50 px-2 py-1 rounded text-xs font-medium">YouTube</a>}
          {row.externalVideoLink && <a href={row.externalVideoLink} target="_blank" rel="noreferrer" className="text-purple-600 bg-purple-50 px-2 py-1 rounded text-xs font-medium">Video</a>}
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
        <form onSubmit={handleSubmit} className="modal-form" style={{ maxHeight: '75vh', overflowY: 'auto', paddingRight: '6px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Section 1: Target Assignment */}
          <div style={{ backgroundColor: 'var(--bg-main, #f8fafc)', padding: '1rem', borderRadius: '14px', border: '1px solid var(--border-color, #e2e8f0)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.85rem', color: 'var(--primary, #e11d48)', fontWeight: '800', fontSize: '0.875rem' }}>
              <BookOpen size={16} />
              <span>Target Assignment</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              <Select label="Course" options={[{label: 'Select Course', value: ''}, ...courses.map(c => ({label: c.courseName, value: c.documentId!}))]} value={courseId} onChange={(e) => setCourseId(e.target.value)} required />
              <Select label="Batch" options={[{label: 'Select Batch', value: ''}, ...batches.map(b => ({label: b.batchName, value: b.documentId!}))]} value={batchId} onChange={(e) => setBatchId(e.target.value)} required />
              <Select label="Teacher" options={[{label: 'Select Teacher', value: ''}, ...teachers.map(t => ({label: t.name!, value: t.documentId!}))]} value={teacherId} onChange={(e) => setTeacherId(e.target.value)} required />
            </div>
          </div>

          {/* Section 2: Content Hierarchy */}
          <div style={{ backgroundColor: 'var(--bg-main, #f8fafc)', padding: '1rem', borderRadius: '14px', border: '1px solid var(--border-color, #e2e8f0)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.85rem', color: '#6366f1', fontWeight: '800', fontSize: '0.875rem' }}>
              <Layers size={16} />
              <span>Content Hierarchy &amp; Info</span>
            </div>
            <Input label="Title" placeholder="e.g. Chapter 1: Grammar Rules" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
              <Input label="Topic" placeholder="e.g. Algebra" value={topic} onChange={(e) => setTopic(e.target.value)} />
              <Input label="Part / Chapter" placeholder="e.g. Chapter 4" value={partChapter} onChange={(e) => setPartChapter(e.target.value)} />
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <Input label="Description" placeholder="Briefly describe the contents..." value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>

          {/* Section 3: Media & Attachments */}
          <div style={{ backgroundColor: 'var(--bg-main, #f8fafc)', padding: '1rem', borderRadius: '14px', border: '1px solid var(--border-color, #e2e8f0)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.85rem', color: '#f59e0b', fontWeight: '800', fontSize: '0.875rem' }}>
              <LinkIcon size={16} />
              <span>Media &amp; Attachments</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <Input label="Google Drive / Document Link" placeholder="https://docs.google.com/..." value={referenceLink} onChange={(e) => setReferenceLink(e.target.value)} required />
              <Input label="YouTube Link (Optional)" placeholder="https://youtube.com/..." value={youtubeLink} onChange={(e) => setYoutubeLink(e.target.value)} />
              <Input label="External Video Link (Optional)" placeholder="https://vimeo.com/..." value={externalVideoLink} onChange={(e) => setExternalVideoLink(e.target.value)} />
            </div>
          </div>

          {/* Section 4: Publishing & Status */}
          <div style={{ backgroundColor: 'var(--bg-main, #f8fafc)', padding: '1rem', borderRadius: '14px', border: '1px solid var(--border-color, #e2e8f0)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.85rem', color: '#10b981', fontWeight: '800', fontSize: '0.875rem' }}>
              <CalendarIcon size={16} />
              <span>Publishing &amp; Status</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Input label="Publish Date" type="date" value={publishDate} onChange={(e) => setPublishDate(e.target.value)} />
              <Input label="Publish Time" type="time" value={publishTime} onChange={(e) => setPublishTime(e.target.value)} />
            </div>
            <div style={{ marginTop: '0.75rem' }}>
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

          <div className="modal-actions" style={{ marginTop: '0.5rem' }}>
            <button type="button" className="btn" style={{ backgroundColor: '#e2e8f0', color: '#334155' }} onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ fontWeight: '800' }}>
              {isSubmitting ? 'Saving...' : (editingId ? 'Update Notes' : 'Save & Publish Notes')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Notes;
