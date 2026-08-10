import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, ArrowLeft, Upload, FileText, Download, Trash2, CheckCircle2, HelpCircle, Clock } from 'lucide-react';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, getDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import type { ExamQuestion, Exam } from '../../types/models';
import '../../components/ui/TableStyles.css';

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
  const [marks, setMarks] = useState('1');
  const [explanation, setExplanation] = useState('');

  // Bulk CSV Upload State
  const [csvFile, setCsvFile] = useState<File | null>(null);
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
    } catch (error) {
      console.error('Error fetching questions:', error);
    } finally {
      setIsLoading(false);
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
    if (confirm("Delete this question?")) {
      try {
        await deleteDoc(doc(db, 'exam_questions', q.documentId!));
        fetchQuestions();
      } catch (e: any) {
        alert("Failed to delete: " + e.message);
      }
    }
  };

  const handleClearAllQuestions = async () => {
    if (!confirm(`Are you sure you want to delete all ${questions.length} questions for this exam?`)) return;
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
      alert("All questions deleted successfully.");
    } catch (e: any) {
      alert("Failed to clear questions: " + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  // CSV Template Download
  const handleDownloadCsvTemplate = () => {
    const csvHeader = "Question,Option A,Option B,Option C,Option D,Correct Answer,Marks,Explanation\n";
    const csvRows = [
      '"What is the past tense of run?","Running","Ran","Runs","Runned","B",1,"Ran is the past tense of run."',
      '"Which word is a noun?","Quickly","Happiness","Blue","Walk","B",1,"Happiness is a noun."',
      '"Choose the correct article: __ apple a day keeps the doctor away.","A","An","The","No article","B",1,"An is used before vowel sounds."'
    ].join('\n');

    const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `MCQ_Upload_Template_${exam?.title?.replace(/\s+/g, '_') || 'Exam'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Current Questions CSV
  const handleExportCsv = () => {
    if (questions.length === 0) {
      alert("No questions to export.");
      return;
    }
    const csvHeader = "Question,Option A,Option B,Option C,Option D,Correct Answer,Marks,Explanation\n";
    const csvRows = questions.map(q => {
      const escape = (str: string) => `"${(str || '').replace(/"/g, '""')}"`;
      return `${escape(q.question)},${escape(q.optionA || '')},${escape(q.optionB || '')},${escape(q.optionC || '')},${escape(q.optionD || '')},${escape(q.correctAnswer)},${q.marks},${escape((q as any).explanation || '')}`;
    }).join('\n');

    const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${exam?.title?.replace(/\s+/g, '_') || 'Exam'}_Questions.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle CSV File Selection & Parse
  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) {
        const parsed = parseCSVText(text);
        setParsedCsvQuestions(parsed);
      }
    };
    reader.readAsText(file);
  };

  const parseCSVText = (text: string) => {
    const lines = text.split(/\r\n|\n/);
    const results: any[] = [];
    if (lines.length <= 1) return results;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values: string[] = [];
      let insideQuote = false;
      let currentVal = '';

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          insideQuote = !insideQuote;
        } else if (char === ',' && !insideQuote) {
          values.push(currentVal.trim());
          currentVal = '';
        } else {
          currentVal += char;
        }
      }
      values.push(currentVal.trim());

      if (values.length >= 6) {
        const qText = values[0] || '';
        const optA = values[1] || '';
        const optB = values[2] || '';
        const optC = values[3] || '';
        const optD = values[4] || '';
        const rawAns = (values[5] || 'A').toUpperCase().trim();
        const ans = ['A','B','C','D'].includes(rawAns) ? rawAns : 'A';
        const m = Number(values[6]) || 1;
        const exp = values[7] || '';

        if (qText && optA && optB) {
          results.push({
            examId,
            question: qText,
            questionType: 'MCQ',
            optionA: optA,
            optionB: optB,
            optionC: optC,
            optionD: optD,
            correctAnswer: ans,
            marks: Number(exam?.marksPerQuestion) || 1,
            explanation: exp
          });
        }
      }
    }
    return results;
  };

  // Upload Parsed CSV Questions to Firestore
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
      const marksMatch = block.match(/(?:MARKS:|Marks:)\s*(\d+)/i);
      const expMatch = block.match(/(?:EXP:|Explanation:)\s*(.*)/i);

      const questionText = qMatch ? qMatch[1].trim() : '';
      const optA = aMatch ? aMatch[1].trim() : '';
      const optB = bMatch ? bMatch[1].trim() : '';
      const optC = cMatch ? cMatch[1].trim() : '';
      const optD = dMatch ? dMatch[1].trim() : '';
      const ans = ansMatch ? ansMatch[1].toUpperCase().trim() : 'A';
      const marksNum = marksMatch ? Number(marksMatch[1]) : 1;
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
        <div style={{ maxWidth: '500px' }}>
          <div className="font-semibold text-gray-900 mb-1">{row.question}</div>
          {row.questionType === 'MCQ' && (
            <div className="grid grid-cols-2 gap-1 text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-200">
              <span className={row.correctAnswer === 'A' ? 'font-bold text-green-700' : ''}>A: {row.optionA}</span>
              <span className={row.correctAnswer === 'B' ? 'font-bold text-green-700' : ''}>B: {row.optionB}</span>
              <span className={row.correctAnswer === 'C' ? 'font-bold text-green-700' : ''}>C: {row.optionC}</span>
              <span className={row.correctAnswer === 'D' ? 'font-bold text-green-700' : ''}>D: {row.optionD}</span>
            </div>
          )}
          {(row as any).explanation && (
            <div className="text-xs text-purple-700 mt-1 italic flex items-center gap-1">
              <HelpCircle size={12} /> {(row as any).explanation}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'correctAnswer',
      header: 'Correct Answer',
      render: (row) => (
        <span className="font-bold text-sm bg-green-100 text-green-800 px-2.5 py-1 rounded-full border border-green-200">
          Option {row.correctAnswer}
        </span>
      )
    },
    {
      key: 'marks',
      header: 'Marks',
      render: (row) => <span className="font-medium text-gray-800">{row.marks} mark{row.marks > 1 ? 's' : ''}</span>
    }
  ];

  const totalQuestionMarks = questions.reduce((sum, q) => sum + (q.marks || 0), 0);
  const targetCount = exam?.numberOfQuestions || 0;
  const targetMarks = exam?.totalMarks || 0;

  return (
    <div className="page-container">
      {/* Top Navigation & Title */}
      <div className="page-header flex justify-between items-center w-full mb-4">
        <div className="flex items-center gap-4">
          <button 
            className="p-2 hover:bg-gray-200 rounded-full transition-colors bg-white shadow-sm border border-gray-200"
            onClick={() => navigate('/exams')}
            title="Back to Exams"
          >
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <div>
            <h1 className="page-title">Manage MCQ Questions</h1>
            <div className="breadcrumbs">
              <span>Dashboard</span> <span className="separator">/</span> 
              <span>Exams</span> <span className="separator">/</span>
              <span className="current">{exam?.title || 'Exam Questions'}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          <button 
            className="btn bg-green-600 text-white hover:bg-green-700 flex items-center gap-1.5"
            onClick={() => setIsCsvModalOpen(true)}
          >
            <Upload size={16} /> Bulk CSV Upload
          </button>
          <button 
            className="btn bg-purple-600 text-white hover:bg-purple-700 flex items-center gap-1.5"
            onClick={() => setIsPasteModalOpen(true)}
          >
            <FileText size={16} /> Paste Questions
          </button>
          <button 
            className="btn btn-primary flex items-center gap-1.5"
            onClick={() => { resetForm(); setIsModalOpen(true); }}
          >
            <Plus size={16} /> Add Single MCQ
          </button>
        </div>
      </div>

      {/* Exam Details Header Banner */}
      {exam && (
        <div className="mb-6 flex flex-col gap-6">
          <div className="bg-white p-5 rounded-xl border border-indigo-100 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded">
                {exam.examType || 'MCQ'} Exam
              </span>
              {batchName && (
                <span className="text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded">
                  Batch: {batchName}
                </span>
              )}
              {courseName && (
                <span className="text-xs font-medium text-gray-500">
                  Course: {courseName}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-gray-800 mt-2">{exam.title}</h2>
            {exam.chapter && <p className="text-sm text-gray-600 mt-1">Chapter: {exam.chapter}</p>}
          </div>

          <div className="metric-cards-grid" style={{ marginBottom: 0 }}>
            <div className="metric-card indigo">
              <div className="metric-card-content">
                <div className="metric-card-title">Uploaded Questions</div>
                <div className="metric-card-value">
                  {questions.length} <span style={{fontSize: '20px', opacity: 0.7}}>/</span> {targetCount || '∞'}
                </div>
              </div>
              <div className="metric-card-icon"><HelpCircle /></div>
            </div>

            <div className="metric-card emerald">
              <div className="metric-card-content">
                <div className="metric-card-title">Total Marks</div>
                <div className="metric-card-value">
                  {totalQuestionMarks} <span style={{fontSize: '20px', opacity: 0.7}}>/</span> {targetMarks || '∞'}
                </div>
              </div>
              <div className="metric-card-icon"><CheckCircle2 /></div>
            </div>

            <div className="metric-card amber">
              <div className="metric-card-content">
                <div className="metric-card-title">Duration</div>
                <div className="metric-card-value">{exam.duration || 0} Mins</div>
              </div>
              <div className="metric-card-icon"><Clock /></div>
            </div>
          </div>
        </div>
      )}

      {/* Extra Bank Actions Toolbar */}
      <div className="flex justify-between items-center mb-3">
        <div className="text-sm font-semibold text-gray-700">
          Question Bank ({questions.length} questions)
        </div>
        <div className="flex gap-2">
          {questions.length > 0 && (
            <>
              <button 
                onClick={handleExportCsv}
                className="text-xs text-gray-600 hover:text-gray-900 border border-gray-300 bg-white px-3 py-1.5 rounded flex items-center gap-1 font-medium transition-colors"
              >
                <Download size={14} /> Export CSV
              </button>
              <button 
                onClick={handleClearAllQuestions}
                className="text-xs text-red-600 hover:text-red-800 border border-red-200 bg-red-50 px-3 py-1.5 rounded flex items-center gap-1 font-medium transition-colors"
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
