import React, { useState, useEffect } from 'react';
import { Plus, CheckSquare, Edit, Trash2, Calendar, FileText, Upload, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import { db } from '../../config/firebase';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, serverTimestamp } from 'firebase/firestore';
import { uploadFile } from '../../utils/storageService';
import type { Homework, Batch } from '../../types/models';
import MarkdownRenderer from '../../components/common/MarkdownRenderer';
import '../../components/ui/TableStyles.css';
import './Homework.css';
import { sendNotificationToBatch } from '../../services/pushNotificationService';

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
  const [editorTab, setEditorTab] = useState<'write' | 'preview'>('write');
  const [previewModalHw, setPreviewModalHw] = useState<Homework | null>(null);

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
        // Dispatch real-time mobile push notifications to all enrolled students
        await sendNotificationToBatch(batchId || 'all', {
          title: `📚 New Homework: ${title.trim()}`,
          body: `Homework assignment "${title.trim()}" has been added. Due date: ${dueDate || 'Check app'}`,
          type: 'HOMEWORK',
          channelId: 'study',
          data: {
            screen: '/(app)/homework',
            type: 'HOMEWORK',
            batchId: batchId || 'all',
          },
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
          <div className="hw-date-badge">
            <Calendar size={13} />
            <span>{dStr}</span>
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
          <div className="hw-title-block">
            <span className="hw-title-text">{row.title}</span>
            <span className="hw-batch-text">Batch: {bName}</span>
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
            className="hw-content-badge pdf-attachment"
          >
            <FileText size={13} />
            <span>View PDF / File</span>
          </a>
        ) : (
          <span className="hw-content-badge text-instructions">
            <span>✍️ Text Instructions</span>
          </span>
        )
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span className={`hw-status-badge ${
          row.status === 'published' 
            ? 'published' 
            : (row.status === 'scheduled' ? 'scheduled' : 'draft')
        }`}>
          <span className="hw-status-dot" />
          <span>{row.status === 'published' ? 'Published' : (row.status === 'scheduled' ? 'Scheduled' : 'Draft')}</span>
        </span>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="hw-actions-group">
          <button 
            type="button"
            className="hw-btn-submissions" 
            onClick={() => navigate(`/homework/${row.documentId}/review`)}
            title="Review student submissions"
          >
            <CheckSquare size={14}/>
            <span>Submissions</span>
          </button>
          <button 
            type="button"
            className="hw-action-btn preview" 
            onClick={() => setPreviewModalHw(row)}
            title="Preview Worksheet"
          >
            <Eye size={16}/>
          </button>
          <button 
            type="button"
            className="hw-action-btn edit" 
            onClick={() => handleEdit(row)}
            title="Edit Homework"
          >
            <Edit size={16}/>
          </button>
          <button 
            type="button"
            className="hw-action-btn delete" 
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main, #334155)' }}>
                  Homework Instructions &amp; Questions <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setEditorTab('write')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      border: 'none',
                      backgroundColor: editorTab === 'write' ? '#ffffff' : 'transparent',
                      color: editorTab === 'write' ? '#0f172a' : '#64748b',
                      boxShadow: editorTab === 'write' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                      cursor: 'pointer'
                    }}
                  >
                    ✏️ Edit (ChatGPT Text)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorTab('preview')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      border: 'none',
                      backgroundColor: editorTab === 'preview' ? '#ffffff' : 'transparent',
                      color: editorTab === 'preview' ? '#e11d48' : '#64748b',
                      boxShadow: editorTab === 'preview' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Eye size={12} /> Live Preview
                  </button>
                </div>
              </div>

              {editorTab === 'write' ? (
                <div>
                  <textarea 
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '12px',
                      backgroundColor: 'var(--bg-main, #ffffff)',
                      color: 'var(--text-main, #0f172a)',
                      fontSize: '0.875rem',
                      minHeight: '160px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                      lineHeight: 1.5
                    }}
                    placeholder="Paste or type homework with ChatGPT headings (#, ##), bold (**), questions (1., 2.), and parts (Part A, Part B)..."
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    required={contentType === 'text'}
                  />
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px', display: 'block' }}>
                    💡 Supports full Markdown: headings (#, ##), bold (**text**), italics (*text*), numbered lists, blanks (_____) and rules.
                  </span>
                </div>
              ) : (
                <div style={{
                  padding: '1rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  backgroundColor: '#ffffff',
                  minHeight: '160px',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {instructions.trim() ? (
                    <MarkdownRenderer content={instructions} />
                  ) : (
                    <p style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.85rem', margin: '1rem 0', textAlign: 'center' }}>
                      No instructions typed yet. Switch to "Edit" tab to enter homework text.
                    </p>
                  )}
                </div>
              )}
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

      {/* Full Worksheet Viewer Modal */}
      <Modal 
        isOpen={!!previewModalHw} 
        onClose={() => setPreviewModalHw(null)} 
        title={previewModalHw?.title || 'Homework Worksheet'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '75vh', overflowY: 'auto', paddingRight: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target Batch</span>
              <p style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                {batches.find(b => b.documentId === previewModalHw?.batchId)?.batchName || previewModalHw?.batchId || 'All Batches'}
              </p>
            </div>
            {previewModalHw?.attachmentUrl && (
              <a 
                href={previewModalHw.attachmentUrl} 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold hover:bg-rose-100"
              >
                <FileText size={14} /> View Attached PDF
              </a>
            )}
          </div>

          <div style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <MarkdownRenderer content={previewModalHw?.instructions || previewModalHw?.description || 'No text instructions available.'} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button 
              type="button" 
              className="btn btn-primary"
              onClick={() => setPreviewModalHw(null)}
            >
              Close Worksheet
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default HomeworkPage;
