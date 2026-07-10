import React, { useState, useEffect } from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import { db } from '../../config/firebase';
import { collection, query, getDocs, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, where } from 'firebase/firestore';
import { sendEmail } from '../../utils/emailService';
import type { Exam } from '../../types/models';
import '../../components/ui/TableStyles.css';

const Exams: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [subjectId, setSubjectId] = useState('');
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

  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, 'exams'));
      const snapshot = await getDocs(q);
      const list: Exam[] = [];
      snapshot.forEach(docSnap => {
        list.push({ documentId: docSnap.id, ...docSnap.data() } as Exam);
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
      const usersQ = query(collection(db, 'users'), where('batchIds', 'array-contains', exam.batchId), where('status', '==', 'active'));
      const usersSnap = await getDocs(usersQ);
      
      usersSnap.forEach(userDoc => {
        const userData = userDoc.data();
        if (userData.email) {
          sendEmail(
            userData.email,
            `New Exam Available: ${exam.title}`,
            `Hello ${userData.name},\n\nA new exam "${exam.title}" has been published and is scheduled from ${new Date(exam.startDate as any).toLocaleString()} to ${new Date(exam.endDate as any).toLocaleString()}.\n\nPlease ensure you log in to the mobile app and complete it before the deadline.\n\nBest of luck,\nSpeak Hub Academy`
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

    const examData: any = {
      courseId, batchId, subjectId, title, chapter, description, instructions, examType,
      duration: Number(duration),
      totalMarks: Number(totalMarks),
      passingMarks: Number(passingMarks),
      numberOfQuestions: Number(numberOfQuestions),
      marksPerQuestion: Number(marksPerQuestion),
      negativeMarking, shuffleQuestions, shuffleOptions, allowReview, showResultImmediately,
      maxViolationsAllowed: Number(maxViolationsAllowed),
      maxViolationDuration: Number(maxViolationDuration),
      violationAction,
      status,
      startDate: startDate ? new Date(startDate).toISOString() : null,
      endDate: endDate ? new Date(endDate).toISOString() : null,
    };

    try {
      if (editingId) {
        const oldExam = exams.find(e => e.documentId === editingId);
        await updateDoc(doc(db, 'exams', editingId), examData);
        if (oldExam && oldExam.status !== 'published' && status === 'published') {
          await handlePublishEmail(examData as Exam);
        }
      } else {
        const docRef = await addDoc(collection(db, 'exams'), {
          ...examData,
          createdAt: serverTimestamp()
        });
        if (status === 'published') {
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
    setCourseId(''); setBatchId(''); setSubjectId(''); setTitle('');
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
    setSubjectId(exam.subjectId || '');
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
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,16);
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
          <span className="font-medium">{row.title}</span>
          <div className="text-xs text-blue-600 font-bold mt-1">{row.examType}</div>
        </div>
      )
    },
    {
      key: 'courseInfo',
      header: 'Target',
      render: (row) => (
        <div>
          <div className="text-sm font-medium">{row.batchId || 'All Batches'}</div>
          <div className="text-xs text-[var(--text-muted)]">{row.subjectId || 'Any Subject'}</div>
        </div>
      )
    },
    {
      key: 'schedule',
      header: 'Schedule',
      render: (row) => (
        <div className="text-xs">
          {row.startDate ? new Date(row.startDate as any).toLocaleDateString() : 'Unscheduled'}<br/>
          {row.duration} mins
        </div>
      )
    },
    {
      key: 'marks',
      header: 'Marks',
      render: (row) => (
        <div>
          <span className="text-green-600 font-bold">{row.passingMarks}</span>
          <span className="text-[var(--text-muted)] mx-1">/</span>
          <span className="text-[var(--text-main)] font-bold">{row.totalMarks}</span>
        </div>
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        let sc = 'pending';
        if(row.status === 'published' || row.status === 'completed') sc = 'active';
        if(row.status === 'cancelled') sc = 'inactive';
        
        return (
          <button className={`dt-badge ${sc}`}>
            {row.status ? row.status.charAt(0).toUpperCase() + row.status.slice(1) : 'Draft'} <ChevronDown size={14} />
          </button>
        )
      }
    },
    {
      key: 'actions',
      header: 'Manage',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <a href={`/exams/${row.documentId}/questions`} className="text-blue-600 hover:underline text-sm font-medium">
            Questions
          </a>
          {(row.status === 'published' || row.status === 'completed') && (
            <a href={`/exams/${row.documentId}/results`} className="text-green-600 hover:underline text-sm font-medium">
              Results
            </a>
          )}
        </div>
      )
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
        <form onSubmit={handleSubmit} className="modal-form" style={{maxHeight: '70vh', overflowY: 'auto', paddingRight: '10px'}}>
          <Input label="Exam Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          
          <div className="grid grid-cols-3 gap-4">
            <Select label="Course" options={[{label: 'Select Course', value: ''}, {label: 'Spoken English', value: 'Course1'}]} value={courseId} onChange={(e) => setCourseId(e.target.value)} />
            <Select label="Batch" options={[{label: 'Select Batch', value: ''}, {label: 'Morning Batch A', value: 'Batch1'}]} value={batchId} onChange={(e) => setBatchId(e.target.value)} />
            <Select label="Subject" options={[{label: 'Select Subject', value: ''}, {label: 'Grammar', value: 'Subject1'}]} value={subjectId} onChange={(e) => setSubjectId(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4 mt-2">
            <Input label="Chapter/Topic (Optional)" value={chapter} onChange={(e) => setChapter(e.target.value)} />
            <Select label="Exam Type" options={[
              {label: 'MCQ', value: 'MCQ'}, {label: 'Reading', value: 'Reading'}, {label: 'Speaking', value: 'Speaking'}, {label: 'Abacus', value: 'Abacus'}
            ]} value={examType} onChange={(e) => setExamType(e.target.value as any)} required />
          </div>

          <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Input label="Instructions for Students" value={instructions} onChange={(e) => setInstructions(e.target.value)} />

          <div className="grid grid-cols-3 gap-4 mt-2">
            <Input type="number" label="Duration (Mins)" value={duration} onChange={(e) => setDuration(e.target.value)} required />
            <Input type="number" label="Total Marks" value={totalMarks} onChange={(e) => setTotalMarks(e.target.value)} required />
            <Input type="number" label="Passing Marks" value={passingMarks} onChange={(e) => setPassingMarks(e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-4 mt-2">
            <Input type="number" label="Number of Questions" value={numberOfQuestions} onChange={(e) => setNumberOfQuestions(e.target.value)} required />
            <Input type="number" label="Marks Per Question" value={marksPerQuestion} onChange={(e) => setMarksPerQuestion(e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4 mb-4 p-4 bg-gray-50 rounded-lg">
            <label className="flex items-center space-x-2">
              <input type="checkbox" checked={negativeMarking} onChange={(e) => setNegativeMarking(e.target.checked)} />
              <span className="text-sm">Negative Marking</span>
            </label>
            <label className="flex items-center space-x-2">
              <input type="checkbox" checked={shuffleQuestions} onChange={(e) => setShuffleQuestions(e.target.checked)} />
              <span className="text-sm">Shuffle Questions</span>
            </label>
            <label className="flex items-center space-x-2">
              <input type="checkbox" checked={shuffleOptions} onChange={(e) => setShuffleOptions(e.target.checked)} />
              <span className="text-sm">Shuffle Options</span>
            </label>
            <label className="flex items-center space-x-2">
              <input type="checkbox" checked={allowReview} onChange={(e) => setAllowReview(e.target.checked)} />
              <span className="text-sm">Allow Reviewing Answers</span>
            </label>
            <label className="flex items-center space-x-2">
              <input type="checkbox" checked={showResultImmediately} onChange={(e) => setShowResultImmediately(e.target.checked)} />
              <span className="text-sm">Show Result Immediately</span>
            </label>
          </div>

          <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-100">
            <h3 className="text-sm font-bold text-red-800 mb-2">Anti-Cheat / Full-Screen Mode</h3>
            <div className="grid grid-cols-3 gap-4">
              <Input type="number" label="Max App Exits Allowed" value={maxViolationsAllowed} onChange={(e) => setMaxViolationsAllowed(e.target.value)} required />
              <Input type="number" label="Max Time Away (Sec)" value={maxViolationDuration} onChange={(e) => setMaxViolationDuration(e.target.value)} required />
              <Select 
                label="Action on Violation" 
                options={[
                  {label: 'Auto Submit Exam', value: 'AutoSubmit'}, 
                  {label: 'Lock Exam', value: 'Lock'},
                  {label: 'Mark as Suspicious', value: 'MarkSuspicious'}
                ]} 
                value={violationAction}
                onChange={(e) => setViolationAction(e.target.value as any)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <Input type="datetime-local" label="Start Date & Time" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <Input type="datetime-local" label="End Date & Time" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>

          <Select 
            label="Status" 
            options={[
              {label: 'Draft', value: 'draft'}, 
              {label: 'Scheduled', value: 'scheduled'},
              {label: 'Published', value: 'published'},
              {label: 'Completed', value: 'completed'},
              {label: 'Cancelled', value: 'cancelled'}
            ]} 
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
          />
          
          <div className="modal-actions mt-4">
            <button type="submit" className="btn btn-success">Save Exam</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Exams;
