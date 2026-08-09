import React, { useState, useEffect } from 'react';
import { Plus, CheckSquare, Edit, Trash2, Calendar, FileText, Link, Upload, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import { db } from '../../config/firebase';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, serverTimestamp } from 'firebase/firestore';
import { uploadFile } from '../../utils/storageService';
import type { Homework, Batch, Course } from '../../types/models';
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
  const [title, setTitle] = useState('');
  const [contentType, setContentType] = useState<'text' | 'pdf'>('text');
  const [instructions, setInstructions] = useState('');
  const [pdfLink, setPdfLink] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'published' | 'draft'>('published');

  useEffect(() => {
    fetchBatches();
    fetchHomeworks();
  }, []);

  const fetchBatches = async () => {
    try {
      const bSnap = await getDocs(query(collection(db, 'batches'), where('status', '==', 'active')));
      const activeBatches = bSnap.docs.map(d => ({ documentId: d.id, ...d.data() } as Batch));
      setBatches(activeBatches);
      if (activeBatches.length > 0 && activeBatches[0].documentId) {
        setBatchId(activeBatches[0].documentId);
      }
    } catch (e) {
      console.error("Error fetching batches:", e);
    }
  };

  const fetchHomeworks = async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(collection(db, 'homeworks'));
      const hwList = snap.docs.map(d => ({ documentId: d.id, ...d.data() } as Homework));
      hwList.sort((a, b) => {
        const dA = a.dueDate ? (a.dueDate instanceof Date ? a.dueDate.getTime() : (a.dueDate as any)?.seconds * 1000) : 0;
        const dB = b.dueDate ? (b.dueDate instanceof Date ? b.dueDate.getTime() : (b.dueDate as any)?.seconds * 1000) : 0;
        return dB - dA;
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
    if (batches.length > 0 && batches[0].documentId) {
      setBatchId(batches[0].documentId);
    }
    setDueDate(new Date().toISOString().split('T')[0]);
    setTitle('');
    setContentType('text');
    setInstructions('');
    setPdfLink('');
    setFile(null);
    setStatus('published');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!batchId) {
      alert("Please select a target batch.");
      return;
    }

    if (!title.trim()) {
      alert("Please enter a homework title.");
      return;
    }

    setIsSubmitting(true);
    try {
      let finalAttachmentUrl = pdfLink.trim();

      // If user uploaded a file, upload to storage
      if (file) {
        finalAttachmentUrl = await uploadFile(file, 'homework_attachments');
      }

      const selectedBatch = batches.find(b => b.documentId === batchId);

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
        publishDate: serverTimestamp() as any,
        status: status === 'published' ? 'published' : 'draft',
        createdAt: serverTimestamp() as any
      };

      if (editingId) {
        await updateDoc(doc(db, 'homeworks', editingId), hwData);
      } else {
        await addDoc(collection(db, 'homeworks'), hwData);
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
    setBatchId(hw.batchId || '');
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
    setStatus(hw.status === 'published' ? 'published' : 'draft');
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
            : 'bg-slate-100 text-slate-700 border-slate-200'
        }`}>
          {row.status === 'published' ? '🟢 Published' : '⚪ Draft'}
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
        searchPlaceholder="Search homework title or batch..."
        isLoading={isLoading}
      />

      {/* Simplified Assign Homework Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Edit Homework" : "Assign Homework"}>
        <form onSubmit={handleSubmit} className="modal-form space-y-4">
          
          <div className="grid grid-cols-2 gap-4">
            <Select 
              label="Target Batch *" 
              options={batches.map(b => ({ label: b.batchName, value: b.documentId! }))} 
              value={batchId} 
              onChange={(e) => setBatchId(e.target.value)} 
              required 
            />

            <Input 
              label="Select Due Date *" 
              type="date" 
              value={dueDate} 
              onChange={(e) => setDueDate(e.target.value)} 
              required 
            />
          </div>

          <Input 
            label="Homework Title / Topic *" 
            placeholder="e.g. Present Tense Practice Worksheet" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            required 
          />

          {/* Format Choice: Text Instructions OR PDF / File */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Homework Content Type *
            </label>
            <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-white cursor-pointer">
                <input 
                  type="radio" 
                  name="contentType" 
                  checked={contentType === 'text'} 
                  onChange={() => setContentType('text')}
                  className="accent-indigo-600" 
                />
                ✍️ Text Instructions
              </label>

              <label className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-white cursor-pointer">
                <input 
                  type="radio" 
                  name="contentType" 
                  checked={contentType === 'pdf'} 
                  onChange={() => setContentType('pdf')}
                  className="accent-indigo-600" 
                />
                📄 PDF / Document Attachment Link
              </label>
            </div>
          </div>

          {contentType === 'text' ? (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Homework Instructions & Questions *
              </label>
              <textarea 
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm min-h-[100px]"
                placeholder="Type the homework tasks or questions for the students..."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                required={contentType === 'text'}
              />
            </div>
          ) : (
            <div className="space-y-3 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
              <Input 
                label="Direct PDF Link / URL" 
                placeholder="https://drive.google.com/file/d/sample.pdf or file link" 
                value={pdfLink} 
                onChange={(e) => setPdfLink(e.target.value)} 
              />

              <div className="text-center py-2">
                <span className="text-xs text-slate-400 font-bold uppercase">— OR Upload PDF File —</span>
              </div>

              <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 p-4 rounded-xl text-center bg-white dark:bg-slate-950">
                <Upload className="mx-auto text-indigo-600 mb-1" size={24} />
                <input 
                  type="file" 
                  accept=".pdf,.doc,.docx,image/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)} 
                  className="w-full text-xs text-slate-500 cursor-pointer" 
                />
                <p className="text-xs text-slate-400 mt-1">Upload PDF or worksheet file</p>
              </div>
            </div>
          )}

          <Select 
            label="Publish Status *" 
            options={[
              { label: '🟢 Published (Visible to Students)', value: 'published' },
              { label: '⚪ Save as Draft', value: 'draft' }
            ]} 
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            required
          />

          <div className="modal-actions mt-6">
            <button 
              type="button" 
              className="btn bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold" 
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </button>

            <button 
              type="submit" 
              className="btn btn-success font-bold flex items-center gap-2" 
              disabled={isSubmitting}
            >
              {isSubmitting ? "Assigning..." : (editingId ? "Update Assignment" : "Assign Homework")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default HomeworkPage;
