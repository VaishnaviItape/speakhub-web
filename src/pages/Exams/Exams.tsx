import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ShieldAlert, Settings2 } from 'lucide-react';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import { db } from '../../config/firebase';
import { collection, query, getDocs, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, where } from 'firebase/firestore';
import { sendEmail } from '../../utils/emailService';
import { formatIndianDateTime, formatIndianScheduleRange } from '../../utils/dateTime';
import type { Exam, Course, Batch } from '../../types/models';
import '../../components/ui/TableStyles.css';

const Exams: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [title, setTitle] = useState('');
  const [chapter, setChapter] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [examType, setExamType] = useState<'MCQ' | 'Reading' | 'Speaking' | 'Abacus'>('MCQ');

  const [duration, setDuration] = useState('');
  const [totalMarks, setTotalMarks] = useState('');
  const [passingMarks, setPassingMarks] = useState('');
  const [numberOfQuestions, setNumberOfQuestions] = useState('');
  const [marksPerQuestion, setMarksPerQuestion] = useState('');

  const [negativeMarking, setNegativeMarking] = useState(false);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);
  const [allowReview, setAllowReview] = useState(true);
  const [showResultImmediately, setShowResultImmediately] = useState(true);

  // Anti-Cheat State
  const [maxViolationsAllowed, setMaxViolationsAllowed] = useState('3');
  const [maxViolationDuration, setMaxViolationDuration] = useState('30');
  const [violationAction, setViolationAction] = useState<'AutoSubmit' | 'Lock' | 'MarkSuspicious'>('AutoSubmit');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<'draft' | 'scheduled' | 'published' | 'completed' | 'cancelled'>('draft');

  // Data
  const [exams, setExams] = useState<Exam[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  useEffect(() => {
    fetchExams();
    fetchFormData();
  }, []);

  const fetchFormData = async () => {
    try {
      const cSnap = await getDocs(collection(db, 'courses'));
      setCourses(cSnap.docs.map(d => ({ documentId: d.id, ...d.data() } as Course)));
      const bSnap = await getDocs(collection(db, 'batches'));
      setBatches(bSnap.docs.map(d => ({ documentId: d.id, ...d.data() } as Batch)));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchExams = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, 'exams'));
      const snapshot = await getDocs(q);
      const now = Date.now();
      const list: Exam[] = [];

      snapshot.forEach(docSnap => {
        const data = docSnap.data() as Exam;
        let examStatus = (data.status || 'draft').toLowerCase();

        // Automatically change status from scheduled to published when scheduled startDate arrives
        if (examStatus === 'scheduled') {
          let startDateTime: Date | null = null;
          const rawStart = data.startDate as any;

          if (rawStart) {
            if (typeof rawStart.toDate === 'function') {
              startDateTime = rawStart.toDate();
            } else if (rawStart instanceof Date) {
              startDateTime = new Date(rawStart.getTime());
            } else if (typeof rawStart.seconds === 'number') {
              startDateTime = new Date(rawStart.seconds * 1000);
            } else if (typeof rawStart === 'string') {
              startDateTime = new Date(rawStart);
            }
          }

          if (startDateTime && !isNaN(startDateTime.getTime()) && startDateTime.getTime() <= now) {
            examStatus = 'published';
            updateDoc(doc(db, 'exams', docSnap.id), { status: 'published' }).catch(console.error);
          }
        }

        list.push({ documentId: docSnap.id, ...data, status: examStatus as any });
      });

      setExams(list);
    } catch (error) {
      console.error('Error fetching exams:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublishEmail = async (exam: Exam) => {
    // Notify all active students in the batch
    if (!exam.batchId) return;
    try {
      // 1. Create in-app mobile push notification in Firestore
      await addDoc(collection(db, 'notifications'), {
        title: `📝 New Exam: ${exam.title}`,
        message: `A new exam "${exam.title}" has been published for your batch. Complete it before the deadline!`,
        type: 'exam',
        batchId: exam.batchId || 'all',
        courseId: exam.courseId || '',
        route: '/(app)/exams',
        actionLabel: 'Take Exam',
        createdAt: serverTimestamp(),
      });

      // 2. Send email to active students
      const usersQ = query(collection(db, 'users'), where('batchIds', 'array-contains', exam.batchId), where('status', '==', 'active'));
      const usersSnap = await getDocs(usersQ);

      const startFormatted = formatIndianDateTime(exam.startDate);
      const endFormatted = formatIndianDateTime(exam.endDate);

      usersSnap.forEach(userDoc => {
        const userData = userDoc.data();
        if (userData.email) {
          sendEmail(
            userData.email,
            `New Exam Available: ${exam.title}`,
            `Hello ${userData.name},\n\nA new exam "${exam.title}" has been published and is scheduled from ${startFormatted} to ${endFormatted} (Indian Standard Time).\n\nPlease ensure you log in to the Speak Hub mobile app and complete it before the deadline.\n\nBest of luck,\nSpeak Hub Academy`
          );
        }
      });
    } catch (error) {
      console.error("Error sending push notifications/emails:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Status validation
    if ((status === 'scheduled' || status === 'published') && (!startDate || !endDate)) {
      alert("Please provide Start and End Dates for Scheduled/Published exams.");
      return;
    }

    const qCount = Number(numberOfQuestions) || 0;
    let finalStatus = status;

    // Strict questions check before publishing
    if ((status === 'published' || status === 'scheduled') && qCount <= 0 && !editingId) {
      alert("Note: This exam currently has 0 questions assigned. It will be saved as 'Draft'. Please click 'Upload MCQ Questions' after creating to add questions before publishing to students.");
      finalStatus = 'draft';
    }

    const examData: any = {
      courseId, batchId, title, chapter, description, instructions, examType,
      duration: Number(duration),
      totalMarks: Number(totalMarks),
      passingMarks: Number(passingMarks),
      numberOfQuestions: qCount,
      marksPerQuestion: Number(marksPerQuestion),
      negativeMarking, shuffleQuestions, shuffleOptions, allowReview, showResultImmediately,
      maxViolationsAllowed: Number(maxViolationsAllowed),
      maxViolationDuration: Number(maxViolationDuration),
      violationAction,
      status: finalStatus,
      startDate: startDate ? new Date(startDate).toISOString() : null,
      endDate: endDate ? new Date(endDate).toISOString() : null,
    };

    try {
      if (editingId) {
        const oldExam = exams.find(e => e.documentId === editingId);
        await updateDoc(doc(db, 'exams', editingId), examData);
        if (oldExam && oldExam.status !== 'published' && finalStatus === 'published') {
          await handlePublishEmail(examData as Exam);
        }
      } else {
        const docRef = await addDoc(collection(db, 'exams'), {
          ...examData,
          createdAt: serverTimestamp()
        });
        if (finalStatus === 'published') {
          await handlePublishEmail({ documentId: docRef.id, ...examData } as Exam);
        }
      }
      fetchExams();
      setIsModalOpen(false);
      resetForm();
    } catch (error: any) {
      alert('Error saving exam: ' + error.message);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setCourseId(''); setBatchId('all'); setTitle('');
    setChapter(''); setDescription(''); setInstructions(''); setExamType('MCQ');
    setDuration(''); setTotalMarks(''); setPassingMarks('');
    setNumberOfQuestions(''); setMarksPerQuestion('');
    setNegativeMarking(false); setShuffleQuestions(false); setShuffleOptions(false);
    setAllowReview(true); setShowResultImmediately(true);
    setMaxViolationsAllowed('3'); setMaxViolationDuration('30'); setViolationAction('AutoSubmit');
    setStartDate(''); setEndDate(''); setStatus('draft');
  };

  const handleEdit = (exam: Exam) => {
    setEditingId(exam.documentId!);
    setCourseId(exam.courseId || '');
    setBatchId(exam.batchId || '');
    setTitle(exam.title || '');
    setChapter(exam.chapter || '');
    setDescription(exam.description || '');
    setInstructions(exam.instructions || '');
    setExamType(exam.examType || 'MCQ');
    setDuration(exam.duration?.toString() || '');
    setTotalMarks(exam.totalMarks?.toString() || '');
    setPassingMarks(exam.passingMarks?.toString() || '');
    setNumberOfQuestions(exam.numberOfQuestions?.toString() || '');
    setMarksPerQuestion(exam.marksPerQuestion?.toString() || '');
    setNegativeMarking(exam.negativeMarking || false);
    setShuffleQuestions(exam.shuffleQuestions || false);
    setShuffleOptions(exam.shuffleOptions || false);
    setAllowReview(exam.allowReview !== false);
    setShowResultImmediately(exam.showResultImmediately !== false);

    setMaxViolationsAllowed(exam.maxViolationsAllowed?.toString() || '3');
    setMaxViolationDuration(exam.maxViolationDuration?.toString() || '30');
    setViolationAction(exam.violationAction || 'AutoSubmit');

    // Formatting date for datetime-local input
    const formatDt = (dt: any) => {
      if (!dt) return '';
      const d = new Date(dt);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    };

    setStartDate(formatDt(exam.startDate));
    setEndDate(formatDt(exam.endDate));
    setStatus(exam.status || 'draft');
    setIsModalOpen(true);
  };

  const handleDelete = async (exam: Exam) => {
    if (confirm("Are you sure you want to delete this exam?")) {
      try {
        await deleteDoc(doc(db, 'exams', exam.documentId!));
        fetchExams();
      } catch (e: any) {
        alert("Failed to delete: " + e.message);
      }
    }
  };

  const columns: Column<Exam>[] = [
    {
      key: 'title',
      header: 'Exam Title',
      render: (row) => (
        <div>
          <span className="font-semibold text-gray-900">{row.title}</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">{row.examType}</span>
            {row.chapter && <span className="text-xs text-gray-500 font-medium">Ch: {row.chapter}</span>}
          </div>
        </div>
      )
    },
    {
      key: 'courseInfo',
      header: 'Target Batch',
      render: (row) => {
        const cName = courses.find(c => c.documentId === row.courseId)?.courseName || row.courseId || 'All Courses';
        const bName = batches.find(b => b.documentId === row.batchId)?.batchName || row.batchId || 'All Batches';
        return (
          <div className="text-xs">
            <div className="font-semibold text-gray-800">{bName}</div>
            <div className="text-gray-500">{cName}</div>
          </div>
        );
      }
    },
    // {
    //   key: 'questionsCount',
    //   header: 'Questions Assigned',
    //   render: (row) => {
    //     const count = Number(row.numberOfQuestions) || 0;
    //     return (
    //       <div className="flex flex-col gap-1">
    //         <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
    //           count > 0 ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
    //         }`}>
    //           {count > 0 ? `${count} Questions` : '0 Qs (Pending)'}
    //         </span>
    //         {count === 0 && (
    //           <span className="text-[10px] text-amber-600 font-medium">Upload Qs to publish</span>
    //         )}
    //       </div>
    //     );
    //   }
    // },
    {
      key: 'schedule',
      header: 'Schedule (Indian AM/PM)',
      render: (row) => (
        <div className="text-xs space-y-0.5">
          <div className="font-semibold text-gray-900">
            {formatIndianScheduleRange(row.startDate, row.endDate)}
          </div>
          <div className="text-gray-500 font-medium">⏱️ {row.duration} mins</div>
        </div>
      )
    },
    {
      key: 'marks',
      header: 'Marks',
      render: (row) => (
        <div className="text-xs">
          <span className="text-green-600 font-bold">{row.passingMarks}</span>
          <span className="text-gray-400 mx-1">/</span>
          <span className="text-gray-900 font-bold">{row.totalMarks}</span>
          <div className="text-[11px] text-gray-500 mt-0.5">Pass / Total</div>
        </div>
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const count = Number(row.numberOfQuestions) || 0;
        if (count === 0 && (row.status === 'published' || row.status === 'scheduled')) {
          return (
            <span className="dt-badge pending">
              Pending Questions
            </span>
          );
        }
        let sc = 'pending';
        if (row.status === 'published' || row.status === 'completed') sc = 'active';
        if (row.status === 'cancelled') sc = 'inactive';

        return (
          <span className={`dt-badge ${sc}`}>
            {row.status ? row.status.charAt(0).toUpperCase() + row.status.slice(1) : 'Draft'}
          </span>
        );
      }
    },
    {
      key: 'actions',
      header: 'Manage',
      render: (row) => {
        const qCount = Number(row.numberOfQuestions) || 0;
        return (
          <div className="flex flex-col gap-1.5 min-w-[155px]">
            <Link
              to={`/exams/${row.documentId}/questions`}
              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 hover:border-indigo-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-between group"
              title="Manage & Upload MCQ Questions"
            >
              <span className="flex items-center gap-1.5">
                <FileQuestion size={14} className="text-indigo-600 group-hover:scale-110 transition-transform" />
                <span>MCQ Questions</span>
              </span>
              <span className="bg-indigo-200 text-indigo-800 text-[11px] font-extrabold px-2 py-0.5 rounded-full">
                {qCount}
              </span>
            </Link>
            {(row.status === 'published' || row.status === 'completed') && (
              <Link
                to={`/exams/${row.documentId}/results`}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 px-3 py-1 rounded-lg text-xs font-bold text-center transition-colors border border-emerald-200 flex items-center justify-center gap-1.5"
              >
                <BarChart2 size={13} className="text-emerald-600" />
                <span>View Results</span>
              </Link>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Exam Management</h1>
          <div className="breadcrumbs">
            <span>Dashboard</span> <span className="separator">/</span> <span className="current">Exams</span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setIsModalOpen(true); }}>
          <Plus size={16} />
          Create Exam
        </button>
      </div>

      <DataTable
        title="All Exams"
        data={exams}
        columns={columns}
        onEdit={handleEdit}
        onDelete={handleDelete}
        searchPlaceholder="Search exams..."
        isLoading={isLoading}
      />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Edit Exam" : "Create New Exam"}>
        <form onSubmit={handleSubmit} className="modal-form" style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '10px' }}>
          <Input label="Exam Title" value={title} onChange={(e) => setTitle(e.target.value)} required />

          <div className="grid grid-cols-2 gap-4">
            <Select label="Course" options={courses.map(c => ({ label: c.courseName, value: c.documentId! }))} value={courseId} onChange={(e) => setCourseId(e.target.value)} required />
            <Select label="Batch" options={[{ label: 'All Batches', value: 'all' }, ...batches.map(b => ({ label: b.batchName, value: b.documentId! }))]} value={batchId} onChange={(e) => setBatchId(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4 mt-2">
            <Input label="Chapter/Topic (Optional)" value={chapter} onChange={(e) => setChapter(e.target.value)} />
            <Select label="Exam Type" options={[
              { label: 'MCQ', value: 'MCQ' }, { label: 'Reading', value: 'Reading' }, { label: 'Speaking', value: 'Speaking' }, { label: 'Abacus', value: 'Abacus' }
            ]} value={examType} onChange={(e) => setExamType(e.target.value as any)} required />
          </div>

          <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Input label="Instructions for Students" value={instructions} onChange={(e) => setInstructions(e.target.value)} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
            <Input type="number" min="0" label="Duration (Mins)" value={duration} onChange={(e) => setDuration(e.target.value)} required />
            <Input type="number" min="0" label="Total Marks" value={totalMarks} onChange={(e) => setTotalMarks(e.target.value)} required />
            <Input type="number" min="0" label="Passing Marks" value={passingMarks} onChange={(e) => setPassingMarks(e.target.value)} required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
            <Input type="number" min="0" label="Number of Questions" value={numberOfQuestions} onChange={(e) => setNumberOfQuestions(e.target.value)} required />
            <Input type="number" min="0" label="Marks Per Question" value={marksPerQuestion} onChange={(e) => setMarksPerQuestion(e.target.value)} required />
          </div>

          {/* Exam Rules & Options Pill Grid */}
          <div style={{ backgroundColor: 'var(--bg-main, #f8fafc)', padding: '1rem', borderRadius: '14px', border: '1px solid var(--border-color, #e2e8f0)', marginTop: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem', color: '#6366f1', fontWeight: 800, fontSize: '0.875rem' }}>
              <Settings2 size={16} />
              <span>Exam Rules &amp; Experience</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.825rem', fontWeight: 600, padding: '8px 12px', backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                <input type="checkbox" checked={negativeMarking} onChange={(e) => setNegativeMarking(e.target.checked)} style={{ accentColor: 'var(--primary, #e11d48)' }} />
                <span>Negative Marking</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.825rem', fontWeight: 600, padding: '8px 12px', backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                <input type="checkbox" checked={shuffleQuestions} onChange={(e) => setShuffleQuestions(e.target.checked)} style={{ accentColor: 'var(--primary, #e11d48)' }} />
                <span>Shuffle Questions</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.825rem', fontWeight: 600, padding: '8px 12px', backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                <input type="checkbox" checked={shuffleOptions} onChange={(e) => setShuffleOptions(e.target.checked)} style={{ accentColor: 'var(--primary, #e11d48)' }} />
                <span>Shuffle Options</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.825rem', fontWeight: 600, padding: '8px 12px', backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                <input type="checkbox" checked={allowReview} onChange={(e) => setAllowReview(e.target.checked)} style={{ accentColor: 'var(--primary, #e11d48)' }} />
                <span>Allow Reviewing Answers</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.825rem', fontWeight: 600, padding: '8px 12px', backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', cursor: 'pointer', gridColumn: 'span 2' }}>
                <input type="checkbox" checked={showResultImmediately} onChange={(e) => setShowResultImmediately(e.target.checked)} style={{ accentColor: 'var(--primary, #e11d48)' }} />
                <span>Show Result Immediately after Submission</span>
              </label>
            </div>
          </div>

          {/* Anti-Cheat / Full-Screen Mode Card */}
          <div style={{ backgroundColor: '#fff5f5', padding: '1rem', borderRadius: '14px', border: '1px solid #fed7d7', marginTop: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem', color: '#c53030', fontWeight: 800, fontSize: '0.875rem' }}>
              <ShieldAlert size={16} />
              <span>Anti-Cheat &amp; Violation Security</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <Input type="number" min="0" label="Max App Exits Allowed" value={maxViolationsAllowed} onChange={(e) => setMaxViolationsAllowed(e.target.value)} required />
              <Input type="number" min="0" label="Max Time Away (Sec)" value={maxViolationDuration} onChange={(e) => setMaxViolationDuration(e.target.value)} required />
            </div>
            <Select
              label="Action on Violation"
              options={[
                { label: 'Auto Submit Exam', value: 'AutoSubmit' },
                { label: 'Lock Exam', value: 'Lock' },
                { label: 'Mark as Suspicious', value: 'MarkSuspicious' }
              ]}
              value={violationAction}
              onChange={(e) => setViolationAction(e.target.value as any)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
            <Input type="datetime-local" label="Start Date & Time" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <Input type="datetime-local" label="End Date & Time" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>

          <div style={{ marginTop: '0.75rem' }}>
            <Select
              label="Status"
              options={[
                { label: 'Draft', value: 'draft' },
                { label: 'Scheduled', value: 'scheduled' },
                { label: 'Published', value: 'published' },
                { label: 'Completed', value: 'completed' },
                { label: 'Cancelled', value: 'cancelled' }
              ]}
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
            />
          </div>

          <div className="modal-actions" style={{ marginTop: '0.75rem' }}>
            <button type="button" className="btn" style={{ backgroundColor: '#e2e8f0', color: '#334155' }} onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" style={{ fontWeight: 800 }}>Save &amp; Configure Exam</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Exams;
