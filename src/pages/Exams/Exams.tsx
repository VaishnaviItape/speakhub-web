import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, ShieldAlert, Settings2, FileQuestion, BarChart2, 
  Copy, Sparkles, Layers 
} from 'lucide-react';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import { db } from '../../config/firebase';
import { 
  collection, query, getDocs, addDoc, updateDoc, doc, deleteDoc, 
  serverTimestamp, where, writeBatch 
} from 'firebase/firestore';
import { sendEmail } from '../../utils/emailService';
import { formatIndianDateTime, formatIndianScheduleRange } from '../../utils/dateTime';
import type { Exam, Course, Batch } from '../../types/models';
import '../../components/ui/TableStyles.css';

const Exams: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'table' | 'batch_manager'>('table');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNextBatchModalOpen, setIsNextBatchModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [isAllBatches, setIsAllBatches] = useState(false);
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

  // Next Batch Scheduling Modal State
  const [sourceExamForNextBatch, setSourceExamForNextBatch] = useState<Exam | null>(null);
  const [nextBatchId, setNextBatchId] = useState<string>('');
  const [nextStartDate, setNextStartDate] = useState<string>('');
  const [nextEndDate, setNextEndDate] = useState<string>('');
  const [nextExamTitle, setNextExamTitle] = useState<string>('');

  // Batch Manager View State
  const [managerSelectedBatchId, setManagerSelectedBatchId] = useState<string>('');
  const [managerCourseFilter, setManagerCourseFilter] = useState<string>('all');
  const [togglingExamId, setTogglingExamId] = useState<string | null>(null);

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
      const batchList = bSnap.docs.map(d => ({ documentId: d.id, ...d.data() } as Batch));
      setBatches(batchList);
      if (batchList.length > 0 && !managerSelectedBatchId) {
        setManagerSelectedBatchId(batchList[0].documentId!);
      }
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

  const handlePublishEmail = async (exam: Exam, targetBatchIds: string[]) => {
    try {
      for (const tBatchId of targetBatchIds) {
        if (!tBatchId) continue;
        await addDoc(collection(db, 'notifications'), {
          title: `📝 New Exam: ${exam.title}`,
          message: `A new exam "${exam.title}" has been scheduled for your batch. Complete it before the deadline!`,
          type: 'exam',
          batchId: tBatchId || 'all',
          courseId: exam.courseId || '',
          route: '/(app)/exams',
          actionLabel: 'Take Exam',
          createdAt: serverTimestamp(),
        });

        if (tBatchId !== 'all') {
          const usersQ = query(collection(db, 'users'), where('batchIds', 'array-contains', tBatchId), where('status', '==', 'active'));
          const usersSnap = await getDocs(usersQ);
          const startFormatted = formatIndianDateTime(exam.startDate);
          const endFormatted = formatIndianDateTime(exam.endDate);

          usersSnap.forEach(userDoc => {
            const userData = userDoc.data();
            if (userData.email) {
              sendEmail(
                userData.email,
                `New Exam Available: ${exam.title}`,
                `Hello ${userData.name},\n\nA new exam "${exam.title}" has been scheduled from ${startFormatted} to ${endFormatted} (Indian Standard Time).\n\nPlease log in to the Speak Hub mobile app and complete it.\n\nBest of luck,\nSpeak Hub Academy`
              );
            }
          });
        }
      }
    } catch (error) {
      console.error("Error sending push notifications/emails:", error);
    }
  };

  // Helper: check if an exam is visible/active for a batch
  const isExamEnabledForBatch = (exam: Exam, bId: string): boolean => {
    if (!bId) return false;
    if (exam.batchVisibility && exam.batchVisibility[bId] !== undefined) {
      return Boolean(exam.batchVisibility[bId]);
    }
    if (Array.isArray(exam.batchIds) && exam.batchIds.length > 0) {
      return exam.batchIds.includes(bId) || exam.batchIds.includes('all');
    }
    if (exam.batchId) {
      return exam.batchId === bId || exam.batchId === 'all';
    }
    return true;
  };

  // Toggle Exam Visibility for a batch
  const handleToggleExamVisibility = async (exam: Exam, bId: string) => {
    if (!exam.documentId || !bId) return;
    setTogglingExamId(exam.documentId);
    try {
      const currentVal = isExamEnabledForBatch(exam, bId);
      const newVal = !currentVal;

      const currentVisibility = exam.batchVisibility || {};
      const updatedVisibility = { ...currentVisibility, [bId]: newVal };

      let currentBatchIds: string[] = Array.isArray(exam.batchIds)
        ? [...exam.batchIds]
        : (exam.batchId ? [exam.batchId] : []);

      if (newVal) {
        if (!currentBatchIds.includes(bId)) currentBatchIds.push(bId);
      } else {
        currentBatchIds = currentBatchIds.filter(id => id !== bId);
      }

      await updateDoc(doc(db, 'exams', exam.documentId), {
        batchVisibility: updatedVisibility,
        batchIds: currentBatchIds,
        batchId: currentBatchIds[0] || bId,
      });

      setExams(prev => prev.map(e => {
        if (e.documentId === exam.documentId) {
          return {
            ...e,
            batchVisibility: updatedVisibility,
            batchIds: currentBatchIds,
            batchId: currentBatchIds[0] || bId,
          };
        }
        return e;
      }));
    } catch (e) {
      console.error("Error updating exam batch visibility:", e);
      alert("Failed to update visibility toggle.");
    } finally {
      setTogglingExamId(null);
    }
  };

  const handleOpenNextBatchModal = (exam: Exam) => {
    setSourceExamForNextBatch(exam);
    setNextExamTitle(exam.title || '');
    
    // Choose first batch that is not currently the primary batch
    const candidateBatch = batches.find(b => b.documentId !== exam.batchId);
    setNextBatchId(candidateBatch ? candidateBatch.documentId! : '');

    // Default start date = tomorrow 10:00 AM, end date = tomorrow 6:00 PM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    
    setNextStartDate(`${yyyy}-${mm}-${dd}T10:00`);
    setNextEndDate(`${yyyy}-${mm}-${dd}T18:00`);
    setIsNextBatchModalOpen(true);
  };

  // Duplicate / Schedule Exam with all questions to the Next Batch
  const handleScheduleForNextBatch = async () => {
    if (!sourceExamForNextBatch || !nextBatchId) {
      alert("Please select a target batch.");
      return;
    }
    if (!nextStartDate || !nextEndDate) {
      alert("Please specify start and end dates.");
      return;
    }

    setIsSubmitting(true);
    try {
      const targetBatchObj = batches.find(b => b.documentId === nextBatchId);
      const targetCourseId = targetBatchObj?.courseId || sourceExamForNextBatch.courseId || '';

      // 1. Create duplicate exam doc
      const newExamData: any = {
        ...sourceExamForNextBatch,
        title: nextExamTitle || sourceExamForNextBatch.title,
        batchId: nextBatchId,
        batchIds: [nextBatchId],
        batchVisibility: { [nextBatchId]: true },
        courseId: targetCourseId,
        startDate: new Date(nextStartDate).toISOString(),
        endDate: new Date(nextEndDate).toISOString(),
        status: (Number(sourceExamForNextBatch.numberOfQuestions) || 0) > 0 ? 'scheduled' : 'draft',
        createdAt: serverTimestamp(),
      };
      delete newExamData.documentId;

      const newExamRef = await addDoc(collection(db, 'exams'), newExamData);

      // 2. Fetch and duplicate all MCQ questions linked to sourceExam
      const qSnap = await getDocs(query(collection(db, 'exam_questions'), where('examId', '==', sourceExamForNextBatch.documentId)));
      if (!qSnap.empty) {
        const batch = writeBatch(db);
        qSnap.forEach(qDoc => {
          const qData = qDoc.data();
          const newQRef = doc(collection(db, 'exam_questions'));
          batch.set(newQRef, {
            ...qData,
            examId: newExamRef.id,
            createdAt: serverTimestamp(),
          });
        });
        await batch.commit();
      }

      alert(`🎉 Success!\n\nExam "${nextExamTitle}" scheduled for batch "${targetBatchObj?.batchName}" with all ${qSnap.size} questions!`);
      setIsNextBatchModalOpen(false);
      fetchExams();
    } catch (e: any) {
      console.error("Error duplicating exam for next batch:", e);
      alert("Failed to schedule exam for next batch: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if ((status === 'scheduled' || status === 'published') && (!startDate || !endDate)) {
      alert("Please provide Start and End Dates for Scheduled/Published exams.");
      return;
    }

    const qCount = Number(numberOfQuestions) || 0;
    let finalStatus = status;

    if ((status === 'published' || status === 'scheduled') && qCount <= 0 && !editingId) {
      alert("Note: This exam currently has 0 questions assigned. It will be saved as 'Draft'. Please click 'Upload MCQ Questions' after creating to add questions before publishing to students.");
      finalStatus = 'draft';
    }

    const assignedBatchList = isAllBatches ? ['all'] : (selectedBatchIds.length > 0 ? selectedBatchIds : [batchId].filter(Boolean));
    const primaryBatch = assignedBatchList[0] || batchId || 'all';

    const visibilityObj: Record<string, boolean> = {};
    assignedBatchList.forEach(bId => {
      visibilityObj[bId] = true;
    });

    const examData: any = {
      courseId, 
      batchId: primaryBatch,
      batchIds: assignedBatchList,
      batchVisibility: visibilityObj,
      title, 
      chapter, 
      description, 
      instructions, 
      examType,
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
          await handlePublishEmail(examData as Exam, assignedBatchList);
        }
      } else {
        const docRef = await addDoc(collection(db, 'exams'), {
          ...examData,
          createdAt: serverTimestamp()
        });
        if (finalStatus === 'published') {
          await handlePublishEmail({ documentId: docRef.id, ...examData } as Exam, assignedBatchList);
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
    setCourseId(''); 
    setBatchId('all');
    setSelectedBatchIds([]);
    setIsAllBatches(false);
    setTitle('');
    setChapter(''); 
    setDescription(''); 
    setInstructions(''); 
    setExamType('MCQ');
    setDuration(''); 
    setTotalMarks(''); 
    setPassingMarks('');
    setNumberOfQuestions(''); 
    setMarksPerQuestion('');
    setNegativeMarking(false); 
    setShuffleQuestions(false); 
    setShuffleOptions(false);
    setAllowReview(true); 
    setShowResultImmediately(true);
    setMaxViolationsAllowed('3'); 
    setMaxViolationDuration('30'); 
    setViolationAction('AutoSubmit');
    setStartDate(''); 
    setEndDate(''); 
    setStatus('draft');
  };

  const handleEdit = (exam: Exam) => {
    setEditingId(exam.documentId!);
    setCourseId(exam.courseId || '');
    setBatchId(exam.batchId || '');

    const assigned = Array.isArray(exam.batchIds) && exam.batchIds.length > 0
      ? exam.batchIds
      : (exam.batchId ? [exam.batchId] : []);
    
    setSelectedBatchIds(assigned);
    setIsAllBatches(assigned.includes('all'));

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

  // Group exams for Batch Manager View
  const filteredExamsByCourse = managerCourseFilter === 'all'
    ? exams
    : exams.filter(e => e.courseId === managerCourseFilter);

  const totalBatchExams = filteredExamsByCourse.length;
  const enabledBatchExams = filteredExamsByCourse.filter(e => isExamEnabledForBatch(e, managerSelectedBatchId)).length;
  const disabledBatchExams = totalBatchExams - enabledBatchExams;

  const columns: Column<Exam>[] = [
    {
      key: 'title',
      header: 'Exam Title',
      render: (row) => (
        <div>
          <span className="font-semibold text-gray-900">{row.title}</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">{row.examType}</span>
            {row.chapter && <span className="text-xs text-gray-500 font-medium">Topic: {row.chapter}</span>}
          </div>
        </div>
      )
    },
    {
      key: 'courseInfo',
      header: 'Assigned Batches',
      render: (row) => {
        const cName = courses.find(c => c.documentId === row.courseId)?.courseName || row.courseId || 'All Courses';
        const bIds = Array.isArray(row.batchIds) && row.batchIds.length > 0 
          ? row.batchIds 
          : (row.batchId ? [row.batchId] : []);
        
        const isAll = bIds.includes('all');
        const assignedBatchNames = isAll 
          ? ['All Batches'] 
          : bIds.map(bId => batches.find(b => b.documentId === bId)?.batchName || bId).filter(Boolean);

        return (
          <div className="text-xs">
            <div className="font-semibold text-gray-800">{cName}</div>
            <div className="flex flex-wrap gap-1 mt-1">
              {assignedBatchNames.slice(0, 2).map((b, i) => (
                <span key={i} className="text-[11px] bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded-full border border-indigo-200">
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
      header: 'Actions',
      render: (row) => {
        const qCount = Number(row.numberOfQuestions) || 0;
        return (
          <div className="flex items-center gap-2">
            {/* 1. MCQ Questions Button with tooltip */}
            <Link
              to={`/exams/${row.documentId}/questions`}
              className="w-8 h-8 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:border-indigo-300"
              title={`MCQ Questions (${qCount} Questions Added)`}
            >
              <FileQuestion size={16} />
            </Link>

            {/* 2. Assign / Schedule Next Batch Button with tooltip */}
            <button
              type="button"
              onClick={() => handleOpenNextBatchModal(row)}
              className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:border-blue-300"
              title="Schedule Exam for Next Batch"
            >
              <Copy size={15} />
            </button>

            {/* 3. Results Button with tooltip */}
            <Link
              to={`/exams/${row.documentId}/results`}
              className="w-8 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:border-emerald-300"
              title="View Results & Student Submissions"
            >
              <BarChart2 size={16} />
            </Link>
          </div>
        );
      }
    }
  ];

  return (
    <div className="page-container" style={{ paddingBottom: '3rem' }}>
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Exam Management</span>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', padding: '3px 8px', borderRadius: '12px', backgroundColor: '#EEF2FF', color: '#4F46E5', border: '1px solid #C7D2FE' }}>
              Multi-Batch Scheduling
            </span>
          </h1>
          <div className="breadcrumbs">
            <span>Dashboard</span> <span className="separator">/</span> <span className="current">Exams</span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setIsModalOpen(true); }}>
          <Plus size={16} />
          Create Exam
        </button>
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
          <span>All Exams Database</span>
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
          <span>Batch Exam Visibility &amp; Toggle Manager</span>
        </button>
      </div>

      {/* Tab 1: All Exams Table */}
      {activeTab === 'table' && (
        <DataTable
          title="Master Exam Schedule"
          data={exams}
          columns={columns}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onRefresh={fetchExams}
          searchPlaceholder="Search exams..."
          isLoading={isLoading}
        />
      )}

      {/* Tab 2: Batch Exam Manager & Visibility */}
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
              
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', flex: '1' }}>
                <div style={{ minWidth: '220px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '800', color: '#475569', marginBottom: '4px' }}>
                    Select Target Batch:
                  </label>
                  <select
                    value={managerSelectedBatchId}
                    onChange={(e) => setManagerSelectedBatchId(e.target.value)}
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
                    value={managerCourseFilter}
                    onChange={(e) => setManagerCourseFilter(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      border: '2px solid #cbd5e1',
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

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => { resetForm(); setIsModalOpen(true); }}
                  style={{ fontSize: '0.85rem' }}
                >
                  <Plus size={15} /> Create Exam
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
                Batch: <strong style={{ color: '#0f172a' }}>{batches.find(b => b.documentId === managerSelectedBatchId)?.batchName || 'Selected Batch'}</strong>
              </span>
              <span style={{ color: '#cbd5e1' }}>•</span>
              <span style={{ color: '#059669', fontWeight: '700' }}>
                Active in Batch: {enabledBatchExams} exams
              </span>
              <span style={{ color: '#cbd5e1' }}>•</span>
              <span style={{ color: '#dc2626', fontWeight: '700' }}>
                Hidden: {disabledBatchExams} exams
              </span>
              <span style={{ color: '#cbd5e1' }}>•</span>
              <span style={{ color: '#64748b' }}>
                Total Available: {totalBatchExams} exams
              </span>
            </div>
          </div>

          {/* Exam Cards Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredExamsByCourse.map(exam => {
              const isEnabled = isExamEnabledForBatch(exam, managerSelectedBatchId);
              const isToggling = togglingExamId === exam.documentId;
              const qCount = Number(exam.numberOfQuestions) || 0;

              return (
                <div
                  key={exam.documentId}
                  style={{
                    backgroundColor: isEnabled ? '#ffffff' : '#fafafa',
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    padding: '1.25rem',
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
                  }}
                >
                  {/* Left: Exam Info */}
                  <div style={{ flex: '1', minWidth: '260px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: '800',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        backgroundColor: '#EEF2FF',
                        color: '#4F46E5'
                      }}>
                        {exam.examType || 'MCQ'}
                      </span>
                      {exam.chapter && (
                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: '800',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          backgroundColor: '#F3E8FF',
                          color: '#7E22CE'
                        }}>
                          {exam.chapter}
                        </span>
                      )}
                      <h4 style={{ 
                        fontSize: '1rem', 
                        fontWeight: '800', 
                        color: isEnabled ? '#0f172a' : '#64748b', 
                        margin: 0 
                      }}>
                        {exam.title}
                      </h4>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                      <span>⏱️ <strong>{exam.duration} mins</strong></span>
                      <span>•</span>
                      <span>🎯 <strong>{qCount} Questions</strong></span>
                      <span>•</span>
                      <span>🏆 Marks: <strong>{exam.passingMarks}/{exam.totalMarks}</strong></span>
                      <span>•</span>
                      <span>📅 Schedule: <strong>{formatIndianScheduleRange(exam.startDate, exam.endDate)}</strong></span>
                    </div>
                  </div>

                  {/* Right: Actions & Toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button
                      type="button"
                      onClick={() => handleOpenNextBatchModal(exam)}
                      className="btn"
                      style={{
                        backgroundColor: '#EFF6FF',
                        color: '#2563EB',
                        border: '1px solid #BFDBFE',
                        fontSize: '0.8rem',
                        padding: '6px 12px',
                        fontWeight: '700'
                      }}
                      title="Clone exam and schedule for next batch"
                    >
                      <Copy size={14} />
                      <span>Schedule for Next Batch</span>
                    </button>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ 
                        display: 'block', 
                        fontSize: '0.75rem', 
                        fontWeight: '800', 
                        color: isEnabled ? '#059669' : '#94a3b8' 
                      }}>
                        {isEnabled ? 'Active in Batch' : 'Hidden from Batch'}
                      </span>
                    </div>

                    {/* Toggle Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleExamVisibility(exam, managerSelectedBatchId)}
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
      )}

      {/* Modal 1: Create / Edit Exam Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Edit Exam" : "Create New Exam"}>
        <form onSubmit={handleSubmit} className="modal-form" style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '10px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          <div style={{ backgroundColor: 'var(--bg-main, #f8fafc)', padding: '1rem', borderRadius: '14px', border: '1px solid var(--border-color, #e2e8f0)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.85rem', color: 'var(--primary, #e11d48)', fontWeight: '800', fontSize: '0.875rem' }}>
              <Settings2 size={16} />
              <span>Exam Identification &amp; Target Batches</span>
            </div>
            
            <Input label="Exam Title" value={title} onChange={(e) => setTitle(e.target.value)} required />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
              <Select label="Course" options={courses.map(c => ({ label: c.courseName, value: c.documentId! }))} value={courseId} onChange={(e) => setCourseId(e.target.value)} required />
              <Select label="Exam Type" options={[
                { label: 'MCQ', value: 'MCQ' }, { label: 'Reading', value: 'Reading' }, { label: 'Speaking', value: 'Speaking' }, { label: 'Abacus', value: 'Abacus' }
              ]} value={examType} onChange={(e) => setExamType(e.target.value as any)} required />
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
                  <span>All Batches (Universal Exam)</span>
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

            <div style={{ marginTop: '0.75rem' }}>
              <Input label="Chapter/Topic (Optional)" placeholder="e.g. Tenses, Grammar" value={chapter} onChange={(e) => setChapter(e.target.value)} />
            </div>
          </div>

          <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Input label="Instructions for Students" value={instructions} onChange={(e) => setInstructions(e.target.value)} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <Input type="number" min="0" label="Duration (Mins)" value={duration} onChange={(e) => setDuration(e.target.value)} required />
            <Input type="number" min="0" label="Total Marks" value={totalMarks} onChange={(e) => setTotalMarks(e.target.value)} required />
            <Input type="number" min="0" label="Passing Marks" value={passingMarks} onChange={(e) => setPassingMarks(e.target.value)} required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <Input type="number" min="0" label="Number of Questions" value={numberOfQuestions} onChange={(e) => setNumberOfQuestions(e.target.value)} required />
            <Input type="number" min="0" label="Marks Per Question" value={marksPerQuestion} onChange={(e) => setMarksPerQuestion(e.target.value)} required />
          </div>

          {/* Exam Rules & Options */}
          <div style={{ backgroundColor: 'var(--bg-main, #f8fafc)', padding: '1rem', borderRadius: '14px', border: '1px solid var(--border-color, #e2e8f0)' }}>
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

          {/* Anti-Cheat */}
          <div style={{ backgroundColor: '#fff5f5', padding: '1rem', borderRadius: '14px', border: '1px solid #fed7d7' }}>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <Input type="datetime-local" label="Start Date & Time" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <Input type="datetime-local" label="End Date & Time" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>

          <div>
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

          <div className="modal-form-footer">
            <button type="button" className="btn-modal-cancel" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-modal-primary">
              {editingId ? 'Update Exam' : 'Save & Configure Exam'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: Schedule for Next Batch Modal */}
      <Modal isOpen={isNextBatchModalOpen} onClose={() => setIsNextBatchModalOpen(false)} title="Schedule Exam for Next Batch">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <p style={{ fontSize: '0.88rem', color: '#475569' }}>
            Schedule the identical exam and same questions for a new batch with custom start and end dates.
          </p>

          <Input 
            label="Exam Title for Next Batch" 
            value={nextExamTitle} 
            onChange={(e) => setNextExamTitle(e.target.value)} 
            required 
          />

          <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '800', color: '#334155', marginBottom: '6px' }}>
              Select Next Target Batch:
            </label>
            <select
              value={nextBatchId}
              onChange={(e) => setNextBatchId(e.target.value)}
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
              {batches.map(b => (
                <option key={b.documentId} value={b.documentId}>
                  {b.batchName} ({courses.find(c => c.documentId === b.courseId)?.courseName || 'Course'})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <Input 
              type="datetime-local" 
              label="New Start Date & Time" 
              value={nextStartDate} 
              onChange={(e) => setNextStartDate(e.target.value)} 
              required 
            />
            <Input 
              type="datetime-local" 
              label="New End Date & Time" 
              value={nextEndDate} 
              onChange={(e) => setNextEndDate(e.target.value)} 
              required 
            />
          </div>

          <div className="modal-form-footer">
            <button type="button" className="btn-modal-cancel" onClick={() => setIsNextBatchModalOpen(false)}>
              Cancel
            </button>
            <button 
              type="button" 
              className="btn-modal-primary" 
              onClick={handleScheduleForNextBatch}
              disabled={isSubmitting || !nextBatchId}
            >
              {isSubmitting ? 'Scheduling...' : 'Schedule Exam with Same Questions'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Exams;
