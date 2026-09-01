import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, ArrowLeft, Upload, FileText, Download, Trash2, CheckCircle2, HelpCircle, Clock, Send, Calendar } from 'lucide-react';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, getDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { formatIndianScheduleRange } from '../../utils/dateTime';
import type { ExamQuestion, Exam } from '../../types/models';
import '../../components/ui/TableStyles.css';
import './ExamQuestions.css';

const ExamQuestions: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  
  // Exam Info
  const [exam, setExam] = useState<Exam | null>(null);
  const [courseName, setCourseName] = useState('');
  const [batchName, setBatchName] = useState('');

  // Modals State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Single Question Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [questionType, setQuestionType] = useState<'MCQ' | 'TrueFalse' | 'FillBlank'>('MCQ');
  const [question, setQuestion] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');
  const [optionD, setOptionD] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('A');
  const [, setMarks] = useState('1');
  const [explanation, setExplanation] = useState('');

  // Bulk CSV Upload State
  const [, setCsvFile] = useState<File | null>(null);
  const [parsedCsvQuestions, setParsedCsvQuestions] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Bulk Paste State
  const [pastedText, setPastedText] = useState('');
  const [parsedPasteQuestions, setParsedPasteQuestions] = useState<any[]>([]);

  // Questions Data
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);

  useEffect(() => {
    if (examId) {
      fetchExamDetails();
      fetchQuestions();
    }
  }, [examId]);

  const fetchExamDetails = async () => {
    if (!examId) return;
    try {
      const examSnap = await getDoc(doc(db, 'exams', examId));
      if (examSnap.exists()) {
        const data = { documentId: examSnap.id, ...examSnap.data() } as Exam;
        setExam(data);

        // Fetch Course Name
        if (data.courseId) {
          const cSnap = await getDoc(doc(db, 'courses', data.courseId));
          if (cSnap.exists()) setCourseName(cSnap.data().courseName || '');
        }

        // Fetch Batch Name
        if (data.batchId) {
          const bSnap = await getDoc(doc(db, 'batches', data.batchId));
          if (bSnap.exists()) setBatchName(bSnap.data().batchName || '');
        }
      }
    } catch (e) {
      console.error("Error fetching exam details:", e);
    }
  };

  const fetchQuestions = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, 'exam_questions'), where('examId', '==', examId));
      const snapshot = await getDocs(q);
      const list: ExamQuestion[] = [];
      snapshot.forEach(docSnap => {
        list.push({ documentId: docSnap.id, ...docSnap.data() } as ExamQuestion);
      });
      setQuestions(list);

      // Auto-sync question count to parent exam document in Firestore
      if (examId) {
        const updates: any = {
          numberOfQuestions: list.length,
        };
        if (list.length === 0 && exam?.status === 'published') {
          updates.status = 'draft';
        }
        await updateDoc(doc(db, 'exams', examId), updates);
        setExam(prev => prev ? ({ ...prev, ...updates }) : null);
      }
    } catch (error) {
      console.error('Error fetching questions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublishNow = async () => {
    if (!examId || !exam) return;
    if (questions.length === 0) {
      alert("Cannot publish exam: Please upload or add at least 1 question first.");
      return;
    }
    if (!exam.startDate || !exam.endDate) {
      alert("Please set Start Date and End Date for the exam in Exam Management before publishing.");
      return;
    }
    try {
      await updateDoc(doc(db, 'exams', examId), {
        status: 'published',
        numberOfQuestions: questions.length
      });
      setExam(prev => prev ? ({ ...prev, status: 'published', numberOfQuestions: questions.length }) : null);
      alert("Exam published successfully! Students in the assigned batch will now be able to view and take this exam on the mobile app.");
    } catch (e: any) {
      alert("Failed to publish exam: " + e.message);
    }
  };

  // Single Question Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (questionType === 'MCQ' && !['A', 'B', 'C', 'D'].includes(correctAnswer)) {
      alert("Correct Answer for MCQ must be A, B, C, or D.");
      return;
    }

    const qData: any = {
      examId,
      question,
      questionType,
      correctAnswer,
      marks: Number(exam?.marksPerQuestion) || 1,
      explanation
    };

    if (questionType === 'MCQ') {
      qData.optionA = optionA;
      qData.optionB = optionB;
      qData.optionC = optionC;
      qData.optionD = optionD;
    }

    try {
      if (editingId) {
        await updateDoc(doc(db, 'exam_questions', editingId), qData);
      } else {
        await addDoc(collection(db, 'exam_questions'), qData);
      }
      fetchQuestions();
      setIsModalOpen(false);
      resetForm();
    } catch (error: any) {
      alert('Error saving question: ' + error.message);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setQuestionType('MCQ');
    setQuestion('');
    setOptionA('');
    setOptionB('');
    setOptionC('');
    setOptionD('');
    setCorrectAnswer('A');
    setMarks('1');
    setExplanation('');
  };

  const handleEdit = (q: ExamQuestion) => {
    setEditingId(q.documentId!);
    setQuestionType(q.questionType || 'MCQ');
    setQuestion(q.question);
    setOptionA(q.optionA || '');
    setOptionB(q.optionB || '');
    setOptionC(q.optionC || '');
    setOptionD(q.optionD || '');
    setCorrectAnswer(q.correctAnswer);
    setMarks(q.marks.toString());
    setExplanation((q as any).explanation || '');
    setIsModalOpen(true);
  };

  const handleDelete = async (q: ExamQuestion) => {
    if (!q.documentId) return;
    if (window.confirm('Are you sure you want to delete this question?')) {
      try {
        await deleteDoc(doc(db, 'exam_questions', q.documentId));
        fetchQuestions();
      } catch (error) {
        alert('Failed to delete question');
      }
    }
  };

  const handleClearAllQuestions = async () => {
    if (questions.length === 0) return;
    if (window.confirm(`Are you sure you want to delete ALL ${questions.length} questions for this exam? This action cannot be undone.`)) {
      setIsLoading(true);
      try {
        const batch = writeBatch(db);
        questions.forEach(q => {
          if (q.documentId) {
            batch.delete(doc(db, 'exam_questions', q.documentId));
          }
        });
        await batch.commit();
        fetchQuestions();
      } catch (error: any) {
        alert("Failed to clear questions: " + error.message);
        setIsLoading(false);
      }
    }
  };

  const handleExportCsv = () => {
    if (questions.length === 0) {
      alert("No questions to export.");
      return;
    }
    const headers = "Question,Option A,Option B,Option C,Option D,Correct Answer (A/B/C/D),Marks,Explanation\n";
    const rows = questions.map(q => {
      const clean = (str?: string) => `"${(str || '').replace(/"/g, '""')}"`;
      return [
        clean(q.question),
        clean(q.optionA),
        clean(q.optionB),
        clean(q.optionC),
        clean(q.optionD),
        q.correctAnswer,
        q.marks,
        clean((q as any).explanation)
      ].join(',');
    }).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${exam?.title ? exam.title.replace(/[^a-zA-Z0-9]/g, '_') : 'Exam'}_Questions.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadCsvTemplate = () => {
    const csvContent = "Question,Option A,Option B,Option C,Option D,Correct Answer (A/B/C/D),Marks,Explanation\n" +
      "\"What is the past tense of 'Go'?\",\"Went\",\"Gone\",\"Going\",\"Goes\",\"A\",1,\"Went is the simple past tense of go.\"\n" +
      "\"Choose the correct article: He is ___ honest man.\",\"a\",\"an\",\"the\",\"none\",\"B\",1,\"Use 'an' before vowel sounds like honest.\"\n" +
      "\"Identify the noun in the sentence: 'She reads a book daily.'\",\"Reads\",\"Daily\",\"Book\",\"She\",\"C\",1,\"Book is a common object noun.\"";

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', "MCQ_Upload_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        parseCsvContent(text);
      }
    };
    reader.readAsText(file);
  };

  const parseCsvContent = (csvText: string) => {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length <= 1) {
      alert("The uploaded CSV file is empty or missing data rows.");
      return;
    }

    const parsed: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const row = parseCsvRow(lines[i]);
      if (row.length >= 6) {
        const questionText = row[0]?.trim();
        const optA = row[1]?.trim();
        const optB = row[2]?.trim();
        const optC = row[3]?.trim() || '';
        const optD = row[4]?.trim() || '';
        const correctAns = (row[5]?.trim() || 'A').toUpperCase();
        const marksVal = Number(row[6]) || Number(exam?.marksPerQuestion) || 1;
        const expText = row[7]?.trim() || '';

        if (questionText && optA && optB) {
          parsed.push({
            examId,
            question: questionText,
            questionType: 'MCQ',
            optionA: optA,
            optionB: optB,
            optionC: optC,
            optionD: optD,
            correctAnswer: ['A', 'B', 'C', 'D'].includes(correctAns) ? correctAns : 'A',
            marks: marksVal,
            explanation: expText
          });
        }
      }
    }
    setParsedCsvQuestions(parsed);
  };

  const parseCsvRow = (text: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (inQuotes && text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  const handleBatchUploadCsv = async () => {
    if (parsedCsvQuestions.length === 0) {
      alert("No valid MCQ questions found in the CSV file.");
      return;
    }
    setIsUploading(true);
    try {
      for (const q of parsedCsvQuestions) {
        await addDoc(collection(db, 'exam_questions'), q);
      }
      alert(`Successfully uploaded ${parsedCsvQuestions.length} MCQ questions!`);
      fetchQuestions();
      setIsCsvModalOpen(false);
      setCsvFile(null);
      setParsedCsvQuestions([]);
    } catch (e: any) {
      alert("Failed to upload questions: " + e.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Parse Bulk Text Paste
  const handleParseTextPaste = () => {
    if (!pastedText.trim()) {
      setParsedPasteQuestions([]);
      return;
    }

    const blocks = pastedText.split(/(?=Q:|Question:|\n\d+\.)/i);
    const parsedList: any[] = [];

    for (const block of blocks) {
      if (!block.trim()) continue;

      const qMatch = block.match(/(?:Q:|Question:|\d+\.)\s*(.*?)(?=\n[A-D]\:|\nANS:|\nCorrect:|$)/is);
      const aMatch = block.match(/(?:A:|Option A:)\s*(.*?)(?=\n[B-D]\:|\nANS:|\nCorrect:|$)/i);
      const bMatch = block.match(/(?:B:|Option B:)\s*(.*?)(?=\n[C-D]\:|\nANS:|\nCorrect:|$)/i);
      const cMatch = block.match(/(?:C:|Option C:)\s*(.*?)(?=\n[D]\:|\nANS:|\nCorrect:|$)/i);
      const dMatch = block.match(/(?:D:|Option D:)\s*(.*?)(?=\nANS:|\nCorrect:|$)/i);
      const ansMatch = block.match(/(?:ANS:|Answer:|Correct:)\s*([A-D])/i);
      const expMatch = block.match(/(?:EXP:|Explanation:)\s*(.*)/i);

      const questionText = qMatch ? qMatch[1].trim() : '';
      const optA = aMatch ? aMatch[1].trim() : '';
      const optB = bMatch ? bMatch[1].trim() : '';
      const optC = cMatch ? cMatch[1].trim() : '';
      const optD = dMatch ? dMatch[1].trim() : '';
      const ans = ansMatch ? ansMatch[1].toUpperCase().trim() : 'A';

      const expText = expMatch ? expMatch[1].trim() : '';

      if (questionText && optA && optB) {
        parsedList.push({
          examId,
          question: questionText,
          questionType: 'MCQ',
          optionA: optA,
          optionB: optB,
          optionC: optC,
          optionD: optD,
          correctAnswer: ['A','B','C','D'].includes(ans) ? ans : 'A',
          marks: Number(exam?.marksPerQuestion) || 1,
          explanation: expText
        });
      }
    }
    setParsedPasteQuestions(parsedList);
  };

  // Upload Parsed Pasted Text Questions
  const handleBatchUploadPaste = async () => {
    if (parsedPasteQuestions.length === 0) {
      alert("No valid MCQ questions parsed from the pasted text.");
      return;
    }
    setIsUploading(true);
    try {
      for (const q of parsedPasteQuestions) {
        await addDoc(collection(db, 'exam_questions'), q);
      }
      alert(`Successfully uploaded ${parsedPasteQuestions.length} MCQ questions!`);
      fetchQuestions();
      setIsPasteModalOpen(false);
      setPastedText('');
      setParsedPasteQuestions([]);
    } catch (e: any) {
      alert("Failed to upload questions: " + e.message);
    } finally {
      setIsUploading(false);
    }
  };

  const columns: Column<ExamQuestion>[] = [
    {
      key: 'question',
      header: 'Question & Options',
      render: (row) => (
        <div style={{ maxWidth: '520px' }}>
          <div className="font-bold text-gray-900 mb-2 leading-relaxed">{row.question}</div>
          {row.questionType === 'MCQ' && (
            <div className="mcq-options-grid">
              <div className={`mcq-option-pill ${row.correctAnswer === 'A' ? 'correct' : ''}`}>
                <strong className="mr-1">A:</strong> {row.optionA}
              </div>
              <div className={`mcq-option-pill ${row.correctAnswer === 'B' ? 'correct' : ''}`}>
                <strong className="mr-1">B:</strong> {row.optionB}
              </div>
              <div className={`mcq-option-pill ${row.correctAnswer === 'C' ? 'correct' : ''}`}>
                <strong className="mr-1">C:</strong> {row.optionC}
              </div>
              <div className={`mcq-option-pill ${row.correctAnswer === 'D' ? 'correct' : ''}`}>
                <strong className="mr-1">D:</strong> {row.optionD}
              </div>
            </div>
          )}
          {(row as any).explanation && (
            <div className="text-xs text-purple-700 mt-2 italic flex items-center gap-1.5 bg-purple-50 p-2 rounded-lg border border-purple-100">
              <HelpCircle size={13} className="text-purple-600 shrink-0" />
              <span>{(row as any).explanation}</span>
            </div>
          )}
        </div>
      )
    },
    {
      key: 'correctAnswer',
      header: 'Correct Answer',
      render: (row) => (
        <span className="mcq-ans-badge">
          <CheckCircle2 size={13} className="mr-1" /> Option {row.correctAnswer}
        </span>
      )
    },
    {
      key: 'marks',
      header: 'Marks',
      render: (row) => (
        <span className="font-bold text-gray-800 bg-gray-100 px-3 py-1 rounded-full text-xs border border-gray-200">
          {row.marks} mark{row.marks > 1 ? 's' : ''}
        </span>
      )
    }
  ];

  const totalQuestionMarks = questions.reduce((sum, q) => sum + (q.marks || 0), 0);
  const targetCount = exam?.numberOfQuestions || 0;
  const targetMarks = exam?.totalMarks || 0;

  return (
    <div className="page-container exam-questions-page">
      {/* Top Navigation & Title */}
      <div className="page-header flex justify-between items-center w-full mb-5">
        <div className="flex items-center gap-4">
          <button 
            className="p-2.5 hover:bg-gray-100 rounded-xl transition-all bg-white shadow-sm border border-gray-200 cursor-pointer"
            onClick={() => navigate('/exams')}
            title="Back to Exams"
          >
            <ArrowLeft size={18} className="text-gray-700" />
          </button>
          <div>
            <h1 className="page-title text-2xl font-black text-gray-900">Manage MCQ Questions</h1>
            <div className="breadcrumbs mt-0.5">
              <span>Dashboard</span> <span className="separator">/</span> 
              <span>Exams</span> <span className="separator">/</span>
              <span className="current font-semibold text-rose-600">{exam?.title || 'Exam Questions'}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="exam-header-actions">
          <button 
            className="btn-csv-upload"
            onClick={() => setIsCsvModalOpen(true)}
          >
            <Upload size={16} /> Bulk CSV Upload
          </button>
          <button 
            className="btn-paste-questions"
            onClick={() => setIsPasteModalOpen(true)}
          >
            <FileText size={16} /> Paste Questions
          </button>
          <button 
            className="btn-add-mcq"
            onClick={() => { resetForm(); setIsModalOpen(true); }}
          >
            <Plus size={16} /> Add Single MCQ
          </button>
        </div>
      </div>

      {/* Exam Details Header Banner */}
      {exam && (
        <div className="mb-6 flex flex-col gap-4">
          <div className="exam-info-card">
            <div>
              <div className="exam-badges-row">
                <span className="badge-exam-type">
                  {exam.examType || 'MCQ'} Exam
                </span>
                {batchName && (
                  <span className="badge-batch-name">
                    Batch: {batchName}
                  </span>
                )}
                {courseName && (
                  <span className="badge-course-name">
                    Course: {courseName}
                  </span>
                )}
                <span className={`badge-status-pill ${
                  exam.status === 'published' ? 'badge-status-published' : 'badge-status-draft'
                }`}>
                  <span className="status-dot"></span>
                  Status: {exam.status ? exam.status.toUpperCase() : 'DRAFT'}
                </span>
              </div>
              <h2 className="exam-main-title">{exam.title}</h2>
              <div className="exam-meta-details">
                <span className="exam-schedule-chip">
                  <Calendar size={14} className="text-indigo-600" /> 
                  Schedule: {formatIndianScheduleRange(exam.startDate, exam.endDate)}
                </span>
                {exam.chapter && <span>• Chapter: <strong>{exam.chapter}</strong></span>}
              </div>
            </div>

            {/* Publishing Status & Action */}
            <div className="exam-publish-action">
              {exam.status !== 'published' ? (
                <button
                  onClick={handlePublishNow}
                  className="btn-publish-app"
                  title="Publish exam so students can view and take it on the mobile app"
                >
                  <Send size={15} /> Publish to Mobile App
                </button>
              ) : (
                <div className="published-status-badge">
                  <CheckCircle2 size={16} className="text-emerald-600" /> Published & Live on Mobile
                </div>
              )}
              {questions.length === 0 && (
                <span className="text-xs text-amber-700 font-semibold mt-1">Add questions to publish</span>
              )}
            </div>
          </div>

          {/* Stats Cards Grid */}
          <div className="exam-stats-grid">
            <div className="stat-metric-card stat-card-blue">
              <div>
                <div className="stat-info-title">Uploaded Questions</div>
                <div className="stat-info-val">
                  {questions.length} <span className="stat-info-val-sub">/ {targetCount || '∞'}</span>
                </div>
              </div>
              <div className="stat-glass-icon"><HelpCircle size={26} /></div>
            </div>

            <div className="stat-metric-card stat-card-emerald">
              <div>
                <div className="stat-info-title">Total Marks</div>
                <div className="stat-info-val">
                  {totalQuestionMarks} <span className="stat-info-val-sub">/ {targetMarks || '∞'}</span>
                </div>
              </div>
              <div className="stat-glass-icon"><CheckCircle2 size={26} /></div>
            </div>

            <div className="stat-metric-card stat-card-amber">
              <div>
                <div className="stat-info-title">Duration</div>
                <div className="stat-info-val">{exam.duration || 0} <span className="stat-info-val-sub">Mins</span></div>
              </div>
              <div className="stat-glass-icon"><Clock size={26} /></div>
            </div>
          </div>
        </div>
      )}

      {/* Extra Bank Actions Toolbar */}
      <div className="flex justify-between items-center mb-3">
        <div className="text-sm font-bold text-gray-800 flex items-center gap-2">
          Question Bank <span className="bg-gray-200 text-gray-700 text-xs px-2.5 py-0.5 rounded-full font-bold">{questions.length} questions</span>
        </div>
        <div className="flex gap-2">
          {questions.length > 0 && (
            <>
              <button 
                onClick={handleExportCsv}
                className="text-xs text-gray-700 hover:text-gray-900 border border-gray-300 bg-white hover:bg-gray-50 px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 font-bold transition-all shadow-sm cursor-pointer"
              >
                <Download size={14} /> Export CSV
              </button>
              <button 
                onClick={handleClearAllQuestions}
                className="text-xs text-red-600 hover:text-red-800 border border-red-200 bg-red-50 hover:bg-red-100 px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 font-bold transition-all shadow-sm cursor-pointer"
              >
                <Trash2 size={14} /> Clear All
              </button>
            </>
          )}
        </div>
      </div>

      {/* Questions Data Table */}
      <DataTable 
        title="Question List" 
        data={questions} 
        columns={columns} 
        onEdit={handleEdit}
        onDelete={handleDelete}
        searchPlaceholder="Search questions..."
        isLoading={isLoading}
      />

      {/* Modal 1: Single Question Manual Form */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Edit MCQ Question" : "Add MCQ Question"}>
        <form onSubmit={handleSubmit} className="modal-form" style={{maxHeight: '70vh', overflowY: 'auto', paddingRight: '10px'}}>
          <Input 
            label="Question Text *" 
            placeholder="e.g. What is the past tense of run?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            required 
          />
          
          <div className="grid grid-cols-2 gap-4 mt-2">
            <Input label="Option A *" value={optionA} onChange={(e) => setOptionA(e.target.value)} required placeholder="Option A text" />
            <Input label="Option B *" value={optionB} onChange={(e) => setOptionB(e.target.value)} required placeholder="Option B text" />
          </div>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <Input label="Option C *" value={optionC} onChange={(e) => setOptionC(e.target.value)} required placeholder="Option C text" />
            <Input label="Option D *" value={optionD} onChange={(e) => setOptionD(e.target.value)} required placeholder="Option D text" />
          </div>

          <div className="mt-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <Select 
              label="Correct Answer *" 
              options={[
                {label: 'Option A', value: 'A'}, {label: 'Option B', value: 'B'},
                {label: 'Option C', value: 'C'}, {label: 'Option D', value: 'D'}
              ]} 
              value={correctAnswer}
              onChange={(e) => setCorrectAnswer(e.target.value)}
              required
            />
          </div>

          <div className="mt-3">
            <Input 
              label="Explanation / Solution Hint (Optional)" 
              placeholder="e.g. Ran is the past tense form of run."
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
            />
          </div>
          
          <div className="modal-actions mt-4">
            <button type="submit" className="btn btn-success">Save Question</button>
          </div>
        </form>
      </Modal>

      {/* Modal 2: Bulk CSV Upload */}
      <Modal isOpen={isCsvModalOpen} onClose={() => { setIsCsvModalOpen(false); setParsedCsvQuestions([]); setCsvFile(null); }} title="Bulk CSV Question Upload">
        <div style={{maxHeight: '75vh', overflowY: 'auto', paddingRight: '5px'}}>
          <div className="flex justify-between items-center bg-green-50 p-4 rounded-lg border border-green-200 mb-4">
            <div>
              <h4 className="font-bold text-green-900 text-sm">Download CSV Format Template</h4>
              <p className="text-xs text-green-700">Use this template in Excel to format your MCQ questions.</p>
            </div>
            <button 
              onClick={handleDownloadCsvTemplate}
              className="btn bg-green-600 text-white hover:bg-green-700 text-xs flex items-center gap-1 font-bold"
            >
              <Download size={14} /> Download Template
            </button>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Select CSV File</label>
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleCsvFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
          </div>

          {parsedCsvQuestions.length > 0 && (
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-sm text-green-700 flex items-center gap-1">
                  <CheckCircle2 size={16} /> Parsed {parsedCsvQuestions.length} Questions Ready for Upload
                </span>
              </div>
              <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg text-xs">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-bold text-gray-700">Q#</th>
                      <th className="px-3 py-2 text-left font-bold text-gray-700">Question</th>
                      <th className="px-3 py-2 text-left font-bold text-gray-700">Ans</th>
                      <th className="px-3 py-2 text-left font-bold text-gray-700">Marks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {parsedCsvQuestions.map((q, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 font-bold text-gray-500">{idx + 1}</td>
                        <td className="px-3 py-2">{q.question}</td>
                        <td className="px-3 py-2 font-bold text-green-600">Option {q.correctAnswer}</td>
                        <td className="px-3 py-2">{q.marks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex justify-end">
                <button 
                  onClick={handleBatchUploadCsv}
                  disabled={isUploading}
                  className="btn bg-green-600 text-white hover:bg-green-700 font-bold px-5 py-2"
                >
                  {isUploading ? 'Uploading...' : `Upload All ${parsedCsvQuestions.length} Questions`}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal 3: Bulk Text Paste Upload */}
      <Modal isOpen={isPasteModalOpen} onClose={() => { setIsPasteModalOpen(false); setParsedPasteQuestions([]); setPastedText(''); }} title="Paste MCQ Questions">
        <div style={{maxHeight: '75vh', overflowY: 'auto', paddingRight: '5px'}}>
          <div className="bg-purple-50 p-3 rounded-lg border border-purple-200 mb-3 text-xs text-purple-900">
            <h4 className="font-bold text-purple-900 mb-1">Standard Paste Format Example:</h4>
            <pre className="bg-white p-2 rounded border border-purple-200 font-mono text-[11px] text-gray-800">
{`Q: What is the past tense of run?
A: Running
B: Ran
C: Runs
D: Runned
ANS: B
MARKS: 1`}
            </pre>
          </div>

          <div className="mb-3">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Paste Formatted Questions Below</label>
            <textarea
              rows={8}
              className="w-full p-3 border border-gray-300 rounded-lg text-xs font-mono focus:ring-purple-500 focus:border-purple-500"
              placeholder="Paste questions in Q: / A: / B: / C: / D: / ANS: format..."
              value={pastedText}
              onChange={(e) => {
                setPastedText(e.target.value);
              }}
            />
          </div>

          <div className="flex justify-between items-center mb-3">
            <button 
              onClick={handleParseTextPaste}
              className="btn bg-purple-600 text-white hover:bg-purple-700 text-xs font-bold"
            >
              Parse Questions Text
            </button>

            {parsedPasteQuestions.length > 0 && (
              <span className="text-xs font-bold text-green-700">
                Found {parsedPasteQuestions.length} Valid Questions!
              </span>
            )}
          </div>

          {parsedPasteQuestions.length > 0 && (
            <div>
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg text-xs">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-bold text-gray-700">Q#</th>
                      <th className="px-3 py-2 text-left font-bold text-gray-700">Question</th>
                      <th className="px-3 py-2 text-left font-bold text-gray-700">Ans</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {parsedPasteQuestions.map((q, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2 font-bold text-gray-500">{idx + 1}</td>
                        <td className="px-3 py-2">{q.question}</td>
                        <td className="px-3 py-2 font-bold text-green-600">Option {q.correctAnswer}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex justify-end">
                <button 
                  onClick={handleBatchUploadPaste}
                  disabled={isUploading}
                  className="btn bg-purple-600 text-white hover:bg-purple-700 font-bold px-5 py-2"
                >
                  {isUploading ? 'Uploading...' : `Upload All ${parsedPasteQuestions.length} Questions`}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default ExamQuestions;
