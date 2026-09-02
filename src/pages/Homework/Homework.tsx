import React, { useState, useEffect } from 'react';
import { Plus, CheckSquare, Edit, Trash2, Calendar, FileText, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import { db } from '../../config/firebase';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, serverTimestamp } from 'firebase/firestore';
import { uploadFile } from '../../utils/storageService';
import type { Homework, Batch } from '../../types/models';
import '../../components/ui/TableStyles.css';

const HomeworkPage: React.FC = () => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Data State
  const [homeworks, setHomeworks] = useState<Homework[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  // Simple Form State
  const [batchId, setBatchId] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [publishDate, setPublishDate] = useState('');
  const [publishTime, setPublishTime] = useState('');
  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState<'text' | 'pdf'>('text');
  const [instructions, setInstructions] = useState('');
  const [pdfLink, setPdfLink] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'published' | 'scheduled' | 'draft'>('published');

  useEffect(() => {
    fetchBatches();
    fetchHomeworks();
  }, []);

  const fetchBatches = async () => {
    try {
      const bSnap = await getDocs(query(collection(db, 'batches'), where('status', '==', 'active')));
      const activeBatches = bSnap.docs.map(d => ({ documentId: d.id, ...d.data() } as Batch));
      setBatches(activeBatches);
      setBatchId('all');
    } catch (e) {
      console.error("Error fetching batches:", e);
    }
  };

  const fetchHomeworks = async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, 'homeworks'));
      const now = Date.now();
      const hwList = snap.docs.map(d => {
        const data = d.data() as Homework;
        let hwStatus = (data.status || 'draft').toLowerCase();

        if (hwStatus === 'scheduled') {
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
              publishDateTime = new Date(rawPDate);
            }
          }

          if (publishDateTime && !isNaN(publishDateTime.getTime()) && pTimeStr && pTimeStr.includes(':')) {
            const [hh, mm] = pTimeStr.split(':').map(Number);
            publishDateTime.setHours(hh || 0, mm || 0, 0, 0);
          }

          if (publishDateTime && !isNaN(publishDateTime.getTime()) && publishDateTime.getTime() <= now) {
            hwStatus = 'published';
            updateDoc(doc(db, 'homeworks', d.id), { status: 'published' }).catch(console.error);
          }
        }

        return { documentId: d.id, ...data, status: hwStatus as any } as Homework;
      });
      setHomeworks(hwList);
    } catch (e) {
      console.error("Error fetching homeworks:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setBatchId('all');
    setDueDate(new Date().toISOString().split('T')[0]);
    setPublishDate('');
    setPublishTime('');
    setTitle('');
    setContentType('text');
    setInstructions('');
    setPdfLink('');
    setFile(null);
    setStatus('published');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert("Please enter a homework title.");
      return;
    }

    setIsSubmitting(true);
    try {
      let finalAttachmentUrl = contentType === 'pdf' ? pdfLink.trim() : '';

      // If user uploaded a file, upload to storage
      if (contentType === 'pdf' && file) {
        finalAttachmentUrl = await uploadFile(file, 'homework_attachments');
      }

      const selectedBatch = batches.find(b => b.documentId === batchId);

      let fullPublishDate = new Date();
      if (publishDate) {
        const [hh, mm] = (publishTime || '00:00').split(':');
        fullPublishDate = new Date(publishDate);
        fullPublishDate.setHours(Number(hh) || 0, Number(mm) || 0, 0, 0);
      }

      const hwData: Partial<Homework> = {
        batchId,
        courseId: selectedBatch?.courseId || '',
        title: title.trim(),
        instructions: instructions.trim(),
        description: instructions.trim(),
        attachmentUrl: finalAttachmentUrl,
        submissionType: contentType === 'pdf' ? ['PDF', 'Document'] : ['Text', 'Image'],
        dueDate: dueDate ? new Date(dueDate) : new Date(),
        dueTime: '23:59',
        publishDate: fullPublishDate,
        publishTime: publishTime || '00:00',
        status: status,
        createdAt: serverTimestamp() as any
      };

      if (editingId) {
        await updateDoc(doc(db, 'homeworks', editingId), hwData);
      } else {
        await addDoc(collection(db, 'homeworks'), hwData);
        // Create in-app mobile push notification in Firestore
        await addDoc(collection(db, 'notifications'), {
          title: `✍️ New Homework: ${title.trim()}`,
          message: `New homework assignment "${title.trim()}" has been assigned for your batch.`,
          type: 'homework',
          batchId: batchId || 'all',
          courseId: selectedBatch?.courseId || '',
          route: '/(app)/homework',
          actionLabel: 'View Homework',
          createdAt: serverTimestamp(),
        });
      }

      setIsModalOpen(false);
      resetForm();
      fetchHomeworks();
    } catch (e) {
      console.error("Error saving homework:", e);
      alert("Failed to save homework.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (hw: Homework) => {
    setEditingId(hw.documentId!);
    setBatchId(hw.batchId || 'all');
    setTitle(hw.title || '');
    setInstructions(hw.instructions || hw.description || '');
    setPdfLink(hw.attachmentUrl || '');
    setContentType(hw.attachmentUrl ? 'pdf' : 'text');
    
    let dDateStr = new Date().toISOString().split('T')[0];
    if (hw.dueDate) {
      if (hw.dueDate instanceof Date) {
        dDateStr = hw.dueDate.toISOString().split('T')[0];
      } else if ((hw.dueDate as any)?.seconds) {
        dDateStr = new Date((hw.dueDate as any).seconds * 1000).toISOString().split('T')[0];
      } else if (typeof hw.dueDate === 'string') {
        dDateStr = hw.dueDate;
      }
    }
    setDueDate(dDateStr);

    let pDateStr = '';
    const rawPDate = hw.publishDate as any;
    if (rawPDate) {
      if (rawPDate instanceof Date) {
        pDateStr = rawPDate.toISOString().split('T')[0];
      } else if (rawPDate.seconds) {
        pDateStr = new Date(rawPDate.seconds * 1000).toISOString().split('T')[0];
      } else if (typeof rawPDate === 'string') {
        pDateStr = rawPDate.split('T')[0];
      }
    }
    setPublishDate(pDateStr);
    setPublishTime((hw as any).publishTime || '');
    setStatus(hw.status === 'published' ? 'published' : (hw.status === 'scheduled' ? 'scheduled' : 'draft'));
    setIsModalOpen(true);
  };

  const handleDelete = async (hw: Homework) => {
    if (confirm(`Are you sure you want to delete "${hw.title}"?`)) {
      await deleteDoc(doc(db, 'homeworks', hw.documentId!));
      fetchHomeworks();
    }
  };

  const columns: Column<Homework>[] = [
    {
      key: 'dueDate',
      header: 'Assigned Date / Due',
      render: (row) => {
        let dStr = 'Today';
        if (row.dueDate) {
          if (row.dueDate instanceof Date) {
            dStr = row.dueDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
          } else if ((row.dueDate as any)?.seconds) {
            dStr = new Date((row.dueDate as any).seconds * 1000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
          } else if (typeof row.dueDate === 'string') {
            dStr = row.dueDate;
          }
        }
        return (
          <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg w-fit">
            <Calendar size={13} />
            {dStr}
          </div>
        );
      }
    },
    {
      key: 'title',
      header: 'Homework Title & Target Batch',
      render: (row) => {
        const bName = batches.find(b => b.documentId === row.batchId)?.batchName || row.batchId || 'All Batches';
        return (
          <div className="py-1">
            <span className="font-bold text-slate-900 dark:text-white text-sm block leading-tight">{row.title}</span>
            <span className="text-xs font-semibold text-indigo-600 block mt-0.5">Batch: {bName}</span>
          </div>
        );
      }
    },
    {
      key: 'type',
      header: 'Homework Content Type',
      render: (row) => (
        row.attachmentUrl ? (
          <a 
            href={row.attachmentUrl} 
            target="_blank" 
            rel="noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-all"
          >
            <FileText size={13} /> View PDF / File
          </a>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold">
            ✍️ Text Instructions
          </span>
        )
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
          row.status === 'published' 
            ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
            : (row.status === 'scheduled' ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-slate-100 text-slate-700 border-slate-200')
        }`}>
          {row.status === 'published' ? '🟢 Published' : (row.status === 'scheduled' ? '🟡 Scheduled' : '⚪ Draft')}
        </span>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex gap-2 items-center">
          <button 
            className="btn bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-sm" 
            onClick={() => navigate(`/homework/${row.documentId}/review`)}
          >
            <CheckSquare size={14}/> Submissions
          </button>
          <button 
            className="text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg border border-slate-200 transition-all cursor-pointer" 
            onClick={() => handleEdit(row)}
            title="Edit Homework"
          >
            <Edit size={16}/>
          </button>
          <button 
            className="text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg border border-rose-200 transition-all cursor-pointer" 
            onClick={() => handleDelete(row)}
            title="Delete Homework"
          >
            <Trash2 size={16}/>
          </button>
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
        <button 
          className="btn btn-primary flex items-center gap-2" 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
        >
          <Plus size={16} /> Assign Homework
        </button>
      </div>

      <DataTable 
        title="Homework Directory" 
        data={homeworks} 
        columns={columns} 
        onRefresh={fetchHomeworks}
        searchPlaceholder="Search homework title or batch..."
        isLoading={isLoading}
      />

      {/* Assign Homework Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Edit Homework" : "Assign Homework"}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '75vh', overflowY: 'auto', paddingRight: '6px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <Select 
              label="Target Batch" 
              options={[{ label: 'All Batches', value: 'all' }, ...batches.map(b => ({ label: b.batchName, value: b.documentId! }))]} 
              value={batchId} 
              onChange={(e) => setBatchId(e.target.value)} 
              required 
            />

            <Input 
              label="Select Due Date" 
              type="date" 
              value={dueDate} 
              onChange={(e) => setDueDate(e.target.value)} 
              required 
            />
          </div>

          <Input 
            label="Homework Title / Topic" 
            placeholder="e.g. Present Tense Practice Worksheet" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            required 
          />

          {/* Format Choice: Text Instructions OR PDF / File */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main, #334155)', marginBottom: '0.5rem' }}>
              Homework Content Format <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setContentType('text')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: contentType === 'text' ? '2px solid var(--primary, #e11d48)' : '1px solid #e2e8f0',
                  backgroundColor: contentType === 'text' ? '#fff1f2' : '#ffffff',
                  color: contentType === 'text' ? 'var(--primary, #e11d48)' : '#64748b',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <FileText size={16} />
                <span>Text Instructions</span>
              </button>

              <button
                type="button"
                onClick={() => setContentType('pdf')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: contentType === 'pdf' ? '2px solid var(--primary, #e11d48)' : '1px solid #e2e8f0',
                  backgroundColor: contentType === 'pdf' ? '#fff1f2' : '#ffffff',
                  color: contentType === 'pdf' ? 'var(--primary, #e11d48)' : '#64748b',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <Upload size={16} />
                <span>PDF / Document Attachment</span>
              </button>
            </div>
          </div>

          {contentType === 'text' ? (
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main, #334155)', marginBottom: '0.35rem' }}>
                Homework Instructions &amp; Questions <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <textarea 
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-main, #ffffff)',
                  color: 'var(--text-main, #0f172a)',
                  fontSize: '0.875rem',
                  minHeight: '120px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                placeholder="Type the homework tasks or questions for the students..."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                required={contentType === 'text'}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
              <Input 
                label="Direct PDF Link / URL" 
                placeholder="https://drive.google.com/file/d/sample.pdf or file link" 
                value={pdfLink} 
                onChange={(e) => setPdfLink(e.target.value)} 
              />

              <div style={{ textAlign: 'center', margin: '0.25rem 0' }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>— OR Upload PDF File —</span>
              </div>

              <div style={{ border: '2px dashed #cbd5e1', padding: '1rem', borderRadius: '12px', textAlign: 'center', backgroundColor: '#ffffff' }}>
                <Upload style={{ margin: '0 auto 0.35rem auto', color: 'var(--primary, #e11d48)' }} size={24} />
                <input 
                  type="file" 
                  accept=".pdf,.doc,.docx,image/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)} 
                  style={{ width: '100%', fontSize: '0.8rem', color: '#64748b', cursor: 'pointer' }}
                />
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.35rem' }}>Upload PDF or worksheet file</p>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
            <Input 
              label="Publish Date (Optional)" 
              type="date" 
              value={publishDate} 
              onChange={(e) => setPublishDate(e.target.value)} 
            />
            <Input 
              label="Publish Time (Optional)" 
              type="time" 
              value={publishTime} 
              onChange={(e) => setPublishTime(e.target.value)} 
            />
          </div>

          <Select 
            label="Publish Status" 
            options={[
              { label: '🟢 Published (Visible to Students)', value: 'published' },
              { label: '🟡 Scheduled (Auto-publish on Date & Time)', value: 'scheduled' },
              { label: '⚪ Save as Draft', value: 'draft' }
            ]} 
            value={status} 
            onChange={(e) => setStatus(e.target.value as any)} 
            required 
          />

          <div className="modal-form-footer">
            <button type="button" className="btn-modal-cancel" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-modal-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving Homework...' : (editingId ? 'Update Assignment' : 'Assign to Batch')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default HomeworkPage;
