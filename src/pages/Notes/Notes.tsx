import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit, Trash2, BookOpen, Layers, Link as LinkIcon, 
  Calendar as CalendarIcon, CheckCircle2, XCircle, Copy, 
  Sparkles
} from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'table' | 'batch_manager'>('table');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Data State
  const [notes, setNotes] = useState<Note[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);

  // Batch Manager State
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('all');
  const [copySourceBatchId, setCopySourceBatchId] = useState<string>('');
  const [togglingNoteId, setTogglingNoteId] = useState<string | null>(null);

  // Form State
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [isAllBatches, setIsAllBatches] = useState(false);
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
      const courseList = cSnap.docs.map(d => ({ documentId: d.id, ...d.data() } as Course));
      setCourses(courseList);

      const bSnap = await getDocs(collection(db, 'batches'));
      const batchList = bSnap.docs.map(d => ({ documentId: d.id, ...d.data() } as Batch));
      setBatches(batchList);
      if (batchList.length > 0 && !selectedBatchId) {
        setSelectedBatchId(batchList[0].documentId!);
      }

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
         const total = batchCounts[n.batchId || ''] || 0;
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

  const handleNotifyStudents = async (targetBatchIds: string[], noteTitle: string) => {
    try {
      for (const tBatchId of targetBatchIds) {
        if (!tBatchId) continue;
        await addDoc(collection(db, 'notifications'), {
          title: `📚 New Study Notes: ${noteTitle}`,
          message: `New study notes on "${topic || noteTitle}" have been uploaded for your batch.`,
          type: 'notes',
          batchId: tBatchId || 'all',
          courseId: courseId || '',
          route: '/(app)/notes',
          actionLabel: 'Read Notes',
          createdAt: serverTimestamp(),
        });

        if (tBatchId !== 'all') {
          const q = query(collection(db, 'users'), where('batchIds', 'array-contains', tBatchId), where('status', '==', 'active'));
          const snap = await getDocs(q);
          snap.forEach(userDoc => {
            const student = userDoc.data();
            sendEmail(
              student.email,
              `New Study Notes Available: ${noteTitle}`,
              `Hello ${student.name},\n\nNew study notes titled "${noteTitle}" have been published to your batch.\nPlease check your student dashboard.\n\nThanks,\nSpeak Hub Academy`
            );
          });
        }
      }
    } catch (e) {
      console.error("Failed to notify students", e);
    }
  };

  // Helper to check if a note is currently enabled for a given batch
  const isNoteEnabledForBatch = (note: Note, bId: string): boolean => {
    if (!bId) return false;
    if (note.batchVisibility && note.batchVisibility[bId] !== undefined) {
      return Boolean(note.batchVisibility[bId]);
    }
    if (Array.isArray(note.batchIds) && note.batchIds.length > 0) {
      return note.batchIds.includes(bId) || note.batchIds.includes('all');
    }
    if (note.batchId) {
      return note.batchId === bId || note.batchId === 'all';
    }
    return true; // default enabled if not batch restricted
  };

  // Toggle single note visibility for a specific batch
  const handleToggleNoteVisibility = async (note: Note, bId: string) => {
    if (!note.documentId || !bId) return;
    setTogglingNoteId(note.documentId);
    try {
      const currentVal = isNoteEnabledForBatch(note, bId);
      const newVal = !currentVal;

      const currentVisibility = note.batchVisibility || {};
      const updatedVisibility = { ...currentVisibility, [bId]: newVal };

      let currentBatchIds: string[] = Array.isArray(note.batchIds)
        ? [...note.batchIds]
        : (note.batchId ? [note.batchId] : []);

      if (newVal) {
        if (!currentBatchIds.includes(bId)) currentBatchIds.push(bId);
      } else {
        currentBatchIds = currentBatchIds.filter(id => id !== bId);
      }

      await updateDoc(doc(db, 'notes', note.documentId), {
        batchVisibility: updatedVisibility,
        batchIds: currentBatchIds,
        batchId: currentBatchIds[0] || bId,
      });

      setNotes(prev => prev.map(n => {
        if (n.documentId === note.documentId) {
          return {
            ...n,
            batchVisibility: updatedVisibility,
            batchIds: currentBatchIds,
            batchId: currentBatchIds[0] || bId,
          };
        }
        return n;
      }));
    } catch (e) {
      console.error("Error updating note batch visibility:", e);
      alert("Failed to update visibility toggle.");
    } finally {
      setTogglingNoteId(null);
    }
  };

  // Bulk enable or disable all notes for selected batch
  const handleBulkSetBatchVisibility = async (enableAll: boolean) => {
    if (!selectedBatchId) return;
    const batchObj = batches.find(b => b.documentId === selectedBatchId);
    const confirmMsg = enableAll
      ? `Are you sure you want to ENABLE all notes for ${batchObj?.batchName || 'this batch'}?`
      : `Are you sure you want to DISABLE all notes for ${batchObj?.batchName || 'this batch'}?`;
    
    if (!confirm(confirmMsg)) return;

    setIsLoading(true);
    try {
      for (const note of notes) {
        if (!note.documentId) continue;
        const currentVisibility = note.batchVisibility || {};
        const updatedVisibility = { ...currentVisibility, [selectedBatchId]: enableAll };
        
        let currentBatchIds: string[] = Array.isArray(note.batchIds)
          ? [...note.batchIds]
          : (note.batchId ? [note.batchId] : []);

        if (enableAll) {
          if (!currentBatchIds.includes(selectedBatchId)) currentBatchIds.push(selectedBatchId);
        } else {
          currentBatchIds = currentBatchIds.filter(id => id !== selectedBatchId);
        }

        await updateDoc(doc(db, 'notes', note.documentId), {
          batchVisibility: updatedVisibility,
          batchIds: currentBatchIds,
          batchId: currentBatchIds[0] || selectedBatchId,
        });
      }
      await fetchNotes();
    } catch (e) {
      console.error("Bulk visibility update failed:", e);
      alert("Bulk update failed.");
    } finally {
      setIsLoading(false);
    }
  };

  // Copy/Assign all active notes from Source Batch to Target Batch
  const handleCopyNotesFromBatch = async () => {
    if (!copySourceBatchId || !selectedBatchId) {
      alert("Please select both source and target batch.");
      return;
    }
    if (copySourceBatchId === selectedBatchId) {
      alert("Source and target batch cannot be the same.");
      return;
    }

    setIsSubmitting(true);
    try {
      let copiedCount = 0;
      for (const note of notes) {
        if (!note.documentId) continue;
        const isSourceEnabled = isNoteEnabledForBatch(note, copySourceBatchId);
        if (isSourceEnabled) {
          const currentVisibility = note.batchVisibility || {};
          const updatedVisibility = { ...currentVisibility, [selectedBatchId]: true };
          
          let currentBatchIds: string[] = Array.isArray(note.batchIds)
            ? [...note.batchIds]
            : (note.batchId ? [note.batchId] : []);

          if (!currentBatchIds.includes(selectedBatchId)) {
            currentBatchIds.push(selectedBatchId);
          }

          await updateDoc(doc(db, 'notes', note.documentId), {
            batchVisibility: updatedVisibility,
            batchIds: currentBatchIds,
          });
          copiedCount++;
        }
      }

      alert(`✅ Successfully assigned ${copiedCount} notes to ${batches.find(b => b.documentId === selectedBatchId)?.batchName}!`);
      setIsCopyModalOpen(false);
      await fetchNotes();
    } catch (e) {
      console.error("Failed to copy batch notes:", e);
      alert("Error assigning notes to batch.");
    } finally {
      setIsSubmitting(false);
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

      const assignedBatchList = isAllBatches ? ['all'] : (selectedBatchIds.length > 0 ? selectedBatchIds : [batchId].filter(Boolean));
      const primaryBatch = assignedBatchList[0] || batchId || '';

      const visibilityObj: Record<string, boolean> = {};
      assignedBatchList.forEach(bId => {
        visibilityObj[bId] = true;
      });

      const noteData: Partial<Note> = {
        courseId,
        batchId: primaryBatch,
        batchIds: assignedBatchList,
        batchVisibility: visibilityObj,
        teacherId, 
        topic, 
        partChapter, 
        title, 
        description,
        fileUrl: finalFileUrl,
        externalVideoLink, 
        youtubeLink, 
        referenceLink,
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

      if (status === 'published') {
        handleNotifyStudents(assignedBatchList, title);
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
    setCourseId(''); 
    setBatchId(''); 
    setSelectedBatchIds([]);
    setIsAllBatches(false);
    setTeacherId('');
    setTopic(''); 
    setPartChapter(''); 
    setTitle(''); 
    setDescription('');
    setUploadMode('file'); 
    setFile(null);
    setExternalVideoLink(''); 
    setYoutubeLink(''); 
    setReferenceLink('');
    setPublishDate(''); 
    setPublishTime(''); 
    setStatus('draft');
  };

  const handleEdit = (note: Note) => {
    setEditingId(note.documentId!);
    setCourseId(note.courseId || '');
    setBatchId(note.batchId || '');
    
    const assigned = Array.isArray(note.batchIds) && note.batchIds.length > 0
      ? note.batchIds
      : (note.batchId ? [note.batchId] : []);
    
    setSelectedBatchIds(assigned);
    setIsAllBatches(assigned.includes('all'));
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

  // Group notes by Topic for the Batch Manager View
  const filteredNotesByCourse = selectedCourseFilter === 'all' 
    ? notes 
    : notes.filter(n => n.courseId === selectedCourseFilter);

  const groupedNotesByTopic = filteredNotesByCourse.reduce((acc: Record<string, Note[]>, note) => {
    const topicKey = note.topic?.trim() || 'General Topics';
    if (!acc[topicKey]) {
      acc[topicKey] = [];
    }
    acc[topicKey].push(note);
    return acc;
  }, {});

  const totalBatchNotes = filteredNotesByCourse.length;
  const enabledBatchNotes = filteredNotesByCourse.filter(n => isNoteEnabledForBatch(n, selectedBatchId)).length;
  const disabledBatchNotes = totalBatchNotes - enabledBatchNotes;

  const columns: Column<Note>[] = [
    {
      key: 'title',
      header: 'Title & Details',
      render: (row) => (
        <div>
          <div className="font-medium text-gray-900">{row.title}</div>
          <div className="text-xs text-gray-500 truncate max-w-[220px]" title={row.description}>
            <span className="font-semibold text-indigo-600">{row.topic || 'General'}</span> {row.partChapter ? `• ${row.partChapter}` : ''}
          </div>
        </div>
      )
    },
    {
      key: 'courseInfo',
      header: 'Assigned Batches',
      render: (row) => {
        const cName = courses.find(c => c.documentId === row.courseId)?.courseName || row.courseId;
        const bIds = Array.isArray(row.batchIds) && row.batchIds.length > 0 
          ? row.batchIds 
          : (row.batchId ? [row.batchId] : []);
        
        const isAll = bIds.includes('all');
        const assignedBatchNames = isAll 
          ? ['All Batches'] 
          : bIds.map(bId => batches.find(b => b.documentId === bId)?.batchName || bId).filter(Boolean);

        return (
          <div>
            <div className="font-medium text-xs text-gray-800">{cName}</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {assignedBatchNames.slice(0, 2).map((b, i) => (
                <span key={i} className="text-[11px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full border border-blue-200">
                  {b}
                </span>
              ))}
              {assignedBatchNames.length > 2 && (
                <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-bold">
                  +{assignedBatchNames.length - 2} more
                </span>
              )}
            </div>
          </div>
        );
      }
    },
    {
      key: 'content',
      header: 'Content',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
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
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${row.status === 'published' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-gray-100 text-gray-700'}`}>
          {row.status?.toUpperCase()}
        </span>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex gap-2">
          <button className="text-blue-600 hover:bg-blue-50 p-1.5 rounded transition" title="Edit Note" onClick={() => handleEdit(row)}><Edit size={16}/></button>
          <button className="text-red-600 hover:bg-red-50 p-1.5 rounded transition" title="Delete Note" onClick={() => handleDelete(row)}><Trash2 size={16}/></button>
        </div>
      )
    }
  ];

  return (
    <div className="page-container" style={{ paddingBottom: '3rem' }}>
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Study Notes</span>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', padding: '3px 8px', borderRadius: '12px', backgroundColor: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}>
              Multi-Batch Manager
            </span>
          </h1>
          <div className="breadcrumbs">
            <span>Dashboard</span> <span className="separator">/</span> <span className="current">Notes</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-primary" onClick={() => { resetForm(); setIsModalOpen(true); }}>
            <Plus size={16} /> Upload Notes
          </button>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '2px' }}>
        <button
          onClick={() => setActiveTab('table')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            fontWeight: activeTab === 'table' ? '800' : '600',
            fontSize: '0.9rem',
            color: activeTab === 'table' ? '#e11d48' : '#64748b',
            borderBottom: activeTab === 'table' ? '3px solid #e11d48' : '3px solid transparent',
            background: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s',
            marginBottom: '-4px'
          }}
        >
          <Layers size={17} />
          <span>All Notes Database</span>
        </button>

        <button
          onClick={() => setActiveTab('batch_manager')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            fontWeight: activeTab === 'batch_manager' ? '800' : '600',
            fontSize: '0.9rem',
            color: activeTab === 'batch_manager' ? '#e11d48' : '#64748b',
            borderBottom: activeTab === 'batch_manager' ? '3px solid #e11d48' : '3px solid transparent',
            background: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s',
            marginBottom: '-4px'
          }}
        >
          <Sparkles size={17} />
          <span>Batch Notes &amp; Visibility Toggle Manager</span>
        </button>
      </div>

      {/* Tab 1: Standard Table View */}
      {activeTab === 'table' && (
        <DataTable 
          title="Notes Master Repository" 
          data={notes} 
          columns={columns} 
          onRefresh={fetchNotes}
          searchPlaceholder="Search notes by title, topic, part..."
          isLoading={isLoading}
        />
      )}

      {/* Tab 2: Batch Visibility & Assignment Manager View */}
      {activeTab === 'batch_manager' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Controls Banner */}
          <div style={{ 
            backgroundColor: '#ffffff', 
            borderRadius: '16px', 
            padding: '1.25rem', 
            border: '1px solid #e2e8f0', 
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
              
              {/* Batch & Course Pickers */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', flex: '1' }}>
                <div style={{ minWidth: '220px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#475569', marginBottom: '4px' }}>
                    Select Target Batch:
                  </label>
                  <select
                    value={selectedBatchId}
                    onChange={(e) => setSelectedBatchId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      border: '2px solid #cbd5e1',
                      fontWeight: '700',
                      fontSize: '0.9rem',
                      color: '#0f172a',
                      backgroundColor: '#f8fafc'
                    }}
                  >
                    {batches.map(b => (
                      <option key={b.documentId} value={b.documentId}>
                        {b.batchName} ({courses.find(c => c.documentId === b.courseId)?.courseName || 'Course'})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ minWidth: '180px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#475569', marginBottom: '4px' }}>
                    Filter by Course:
                  </label>
                  <select
                    value={selectedCourseFilter}
                    onChange={(e) => setSelectedCourseFilter(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      fontWeight: '600',
                      fontSize: '0.85rem',
                      color: '#334155',
                      backgroundColor: '#ffffff'
                    }}
                  >
                    <option value="all">All Courses</option>
                    {courses.map(c => (
                      <option key={c.documentId} value={c.documentId}>{c.courseName}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick Actions Buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleBulkSetBatchVisibility(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#ECFDF5',
                    color: '#059669',
                    border: '1px solid #A7F3D0',
                    padding: '8px 14px',
                    borderRadius: '10px',
                    fontWeight: '700',
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  <CheckCircle2 size={15} />
                  <span>Enable All for Batch</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleBulkSetBatchVisibility(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#FEF2F2',
                    color: '#DC2626',
                    border: '1px solid #FECACA',
                    padding: '8px 14px',
                    borderRadius: '10px',
                    fontWeight: '700',
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  <XCircle size={15} />
                  <span>Disable All for Batch</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCopySourceBatchId(batches.find(b => b.documentId !== selectedBatchId)?.documentId || '');
                    setIsCopyModalOpen(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#EEF2FF',
                    color: '#4F46E5',
                    border: '1px solid #C7D2FE',
                    padding: '8px 14px',
                    borderRadius: '10px',
                    fontWeight: '700',
                    fontSize: '0.82rem',
                    cursor: 'pointer'
                  }}
                >
                  <Copy size={15} />
                  <span>Assign/Copy from Batch</span>
                </button>
              </div>
            </div>

            {/* Batch Status Bar */}
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              alignItems: 'center', 
              gap: '12px', 
              paddingTop: '0.75rem', 
              borderTop: '1px solid #f1f5f9',
              fontSize: '0.85rem'
            }}>
              <span style={{ color: '#64748b' }}>
                Batch: <strong style={{ color: '#0f172a' }}>{batches.find(b => b.documentId === selectedBatchId)?.batchName || 'Selected Batch'}</strong>
              </span>
              <span style={{ color: '#cbd5e1' }}>•</span>
              <span style={{ color: '#059669', fontWeight: '700' }}>
                Enabled: {enabledBatchNotes} notes
              </span>
              <span style={{ color: '#cbd5e1' }}>•</span>
              <span style={{ color: '#dc2626', fontWeight: '700' }}>
                Hidden: {disabledBatchNotes} notes
              </span>
              <span style={{ color: '#cbd5e1' }}>•</span>
              <span style={{ color: '#64748b' }}>
                Total Available: {totalBatchNotes} notes
              </span>
            </div>
          </div>

          {/* Grouped Topics & Notes List */}
          {Object.keys(groupedNotesByTopic).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', color: '#64748b' }}>
              <BookOpen size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ fontWeight: '600' }}>No notes found for the selected course filter.</p>
              <button className="btn btn-primary" style={{ marginTop: '12px' }} onClick={() => { resetForm(); setIsModalOpen(true); }}>
                <Plus size={16} /> Upload First Note
              </button>
            </div>
          ) : (
            Object.entries(groupedNotesByTopic).map(([topicName, topicNotes]) => {
              const topicEnabledCount = topicNotes.filter(n => isNoteEnabledForBatch(n, selectedBatchId)).length;
              const isTopicFullyEnabled = topicEnabledCount === topicNotes.length;

              return (
                <div 
                  key={topicName}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    overflow: 'hidden',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
                  }}
                >
                  {/* Topic Header */}
                  <div style={{
                    padding: '1rem 1.25rem',
                    backgroundColor: '#f8fafc',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: isTopicFullyEnabled ? '#10B981' : (topicEnabledCount > 0 ? '#F59E0B' : '#94A3B8') }} />
                      <h3 style={{ fontSize: '1rem', fontWeight: '800', color: '#1e293b', margin: 0 }}>
                        {topicName}
                      </h3>
                      <span style={{ fontSize: '0.75rem', fontWeight: '700', padding: '2px 8px', borderRadius: '12px', backgroundColor: '#EEF2FF', color: '#4F46E5' }}>
                        {topicNotes.length} Parts / Notes
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: '700', color: topicEnabledCount > 0 ? '#059669' : '#64748b' }}>
                        {topicEnabledCount}/{topicNotes.length} Active in Batch
                      </span>
                    </div>
                  </div>

                  {/* Notes in Topic */}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {topicNotes.map((note) => {
                      const isEnabled = isNoteEnabledForBatch(note, selectedBatchId);
                      const isToggling = togglingNoteId === note.documentId;

                      return (
                        <div 
                          key={note.documentId}
                          style={{
                            padding: '1rem 1.25rem',
                            display: 'flex',
                            flexWrap: 'wrap',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '1rem',
                            borderBottom: '1px solid #f1f5f9',
                            backgroundColor: isEnabled ? '#ffffff' : '#fafafa',
                            transition: 'all 0.15s'
                          }}
                        >
                          {/* Note Info */}
                          <div style={{ flex: '1', minWidth: '240px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              {note.partChapter && (
                                <span style={{
                                  fontSize: '0.72rem',
                                  fontWeight: '800',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  backgroundColor: '#F3E8FF',
                                  color: '#7E22CE'
                                }}>
                                  {note.partChapter}
                                </span>
                              )}
                              <h4 style={{ 
                                fontSize: '0.92rem', 
                                fontWeight: '700', 
                                color: isEnabled ? '#0f172a' : '#64748b', 
                                margin: 0 
                              }}>
                                {note.title}
                              </h4>
                            </div>

                            {note.description && (
                              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '2px 0 6px', maxWidth: '650px' }}>
                                {note.description}
                              </p>
                            )}

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', fontSize: '0.75rem' }}>
                              {note.fileUrl && (
                                <a href={note.fileUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: '600', textDecoration: 'none' }}>
                                  📄 PDF Attachment
                                </a>
                              )}
                              {note.referenceLink && (
                                <a href={note.referenceLink} target="_blank" rel="noreferrer" style={{ color: '#4f46e5', fontWeight: '600', textDecoration: 'none' }}>
                                  🔗 Drive Link
                                </a>
                              )}
                              {note.youtubeLink && (
                                <a href={note.youtubeLink} target="_blank" rel="noreferrer" style={{ color: '#dc2626', fontWeight: '600', textDecoration: 'none' }}>
                                  ▶️ Video Lesson
                                </a>
                              )}
                              <span style={{ color: '#94a3b8' }}>•</span>
                              <span style={{ color: note.status === 'published' ? '#059669' : '#d97706', fontWeight: '700' }}>
                                Status: {note.status?.toUpperCase()}
                              </span>
                            </div>
                          </div>

                          {/* Action / Toggle Switch */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ 
                                display: 'block', 
                                fontSize: '0.75rem', 
                                fontWeight: '800', 
                                color: isEnabled ? '#059669' : '#94a3b8' 
                              }}>
                                {isEnabled ? 'Visible to Batch' : 'Hidden from Batch'}
                              </span>
                              <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                                {isEnabled ? 'Students can read' : 'Students cannot see'}
                              </span>
                            </div>

                            {/* Interactive Toggle Switch */}
                            <button
                              type="button"
                              onClick={() => handleToggleNoteVisibility(note, selectedBatchId)}
                              disabled={isToggling}
                              style={{
                                width: '54px',
                                height: '28px',
                                borderRadius: '14px',
                                backgroundColor: isEnabled ? '#10B981' : '#CBD5E1',
                                border: 'none',
                                position: 'relative',
                                cursor: isToggling ? 'not-allowed' : 'pointer',
                                transition: 'background-color 0.2s',
                                padding: '2px',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                              title={isEnabled ? "Click to disable for this batch" : "Click to enable for this batch"}
                            >
                              <div style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                backgroundColor: '#ffffff',
                                transform: isEnabled ? 'translateX(26px)' : 'translateX(0px)',
                                transition: 'transform 0.2s',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                              }} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Modal 1: Upload / Edit Notes Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Edit Notes" : "Upload Study Notes"}>
        <form onSubmit={handleSubmit} className="modal-form" style={{ maxHeight: '75vh', overflowY: 'auto', paddingRight: '6px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Section 1: Target Assignment */}
          <div style={{ backgroundColor: 'var(--bg-main, #f8fafc)', padding: '1rem', borderRadius: '14px', border: '1px solid var(--border-color, #e2e8f0)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.85rem', color: 'var(--primary, #e11d48)', fontWeight: '800', fontSize: '0.875rem' }}>
              <BookOpen size={16} />
              <span>Target Assignment (Multi-Batch Support)</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Select label="Course" options={[{label: 'Select Course', value: ''}, ...courses.map(c => ({label: c.courseName, value: c.documentId!}))]} value={courseId} onChange={(e) => setCourseId(e.target.value)} required />
              <Select label="Teacher" options={[{label: 'Select Teacher', value: ''}, ...teachers.map(t => ({label: t.name!, value: t.documentId!}))]} value={teacherId} onChange={(e) => setTeacherId(e.target.value)} required />
            </div>

            {/* Target Batches Checkboxes */}
            <div style={{ marginTop: '0.85rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '800', color: '#334155', marginBottom: '6px' }}>
                Assign to Batches:
              </label>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: '700', color: '#2563eb', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={isAllBatches} 
                    onChange={(e) => {
                      setIsAllBatches(e.target.checked);
                      if (e.target.checked) {
                        setSelectedBatchIds(['all']);
                      } else {
                        setSelectedBatchIds([]);
                      }
                    }} 
                  />
                  <span>All Batches (Universal Note)</span>
                </label>
              </div>

              {!isAllBatches && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', maxHeight: '120px', overflowY: 'auto', padding: '6px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  {batches.map(b => {
                    const isChecked = selectedBatchIds.includes(b.documentId!);
                    return (
                      <label key={b.documentId} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#334155', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedBatchIds(prev => [...prev, b.documentId!]);
                              setBatchId(b.documentId!);
                            } else {
                              setSelectedBatchIds(prev => prev.filter(id => id !== b.documentId));
                            }
                          }}
                        />
                        <span style={{ fontWeight: isChecked ? '700' : '500' }}>{b.batchName}</span>
                      </label>
                    );
                  })}
                </div>
              )}
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
              <Input label="Topic Name" placeholder="e.g. Spoken English" value={topic} onChange={(e) => setTopic(e.target.value)} />
              <Input label="Part / Chapter" placeholder="e.g. Part 1 / Module 1" value={partChapter} onChange={(e) => setPartChapter(e.target.value)} />
            </div>
            <div style={{ marginTop: '0.75rem' }}>
              <Input label="Description" placeholder="Briefly describe the contents..." value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>

          {/* Section 3: Media & Attachments */}
          <div style={{ backgroundColor: 'var(--bg-main, #f8fafc)', padding: '1rem', borderRadius: '14px', border: '1px solid var(--border-color, #e2e8f0)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.85rem', color: '#f59e0b', fontWeight: '800', fontSize: '0.875rem' }}>
              <LinkIcon size={16} />
              <span>Media &amp; Google Drive Attachments</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <Input 
                  label="Google Drive / Document Link" 
                  placeholder="e.g. https://drive.google.com/file/d/.../view" 
                  value={referenceLink} 
                  onChange={(e) => setReferenceLink(e.target.value)} 
                  required 
                />
                <p style={{ fontSize: '0.75rem', color: '#4338ca', backgroundColor: '#eef2ff', padding: '6px 10px', borderRadius: '8px', marginTop: '6px', border: '1px solid #c7d2fe' }}>
                  💡 <strong>Google Drive Tip:</strong> Right-click file in Google Drive ➔ Share ➔ Set to "Anyone with the link can view" ➔ Copy link and paste here.
                </p>
              </div>
              <Input label="YouTube Video Lesson (Optional)" placeholder="https://youtube.com/..." value={youtubeLink} onChange={(e) => setYoutubeLink(e.target.value)} />
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

          <div className="modal-form-footer">
            <button type="button" className="btn-modal-cancel" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-modal-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : (editingId ? 'Update Notes' : 'Save & Publish Notes')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: Copy Notes From Batch Modal */}
      <Modal isOpen={isCopyModalOpen} onClose={() => setIsCopyModalOpen(false)} title="Assign Notes from Another Batch">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <p style={{ fontSize: '0.88rem', color: '#475569' }}>
            Instantly copy the complete notes and topic visibility configuration from a source batch to <strong>{batches.find(b => b.documentId === selectedBatchId)?.batchName}</strong> without re-uploading files.
          </p>

          <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#334155', marginBottom: '6px' }}>
              Select Source Batch (Copy From):
            </label>
            <select
              value={copySourceBatchId}
              onChange={(e) => setCopySourceBatchId(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontWeight: '700',
                fontSize: '0.9rem',
                color: '#0f172a'
              }}
            >
              {batches.filter(b => b.documentId !== selectedBatchId).map(b => (
                <option key={b.documentId} value={b.documentId}>
                  {b.batchName} ({courses.find(c => c.documentId === b.courseId)?.courseName || 'Course'})
                </option>
              ))}
            </select>
          </div>

          <div className="modal-form-footer">
            <button type="button" className="btn-modal-cancel" onClick={() => setIsCopyModalOpen(false)}>
              Cancel
            </button>
            <button 
              type="button" 
              className="btn-modal-primary" 
              onClick={handleCopyNotesFromBatch}
              disabled={isSubmitting || !copySourceBatchId}
            >
              {isSubmitting ? 'Assigning...' : 'Assign All Notes to Next Batch'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Notes;
