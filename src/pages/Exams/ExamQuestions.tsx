import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, ArrowLeft } from 'lucide-react';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import type { ExamQuestion } from '../../types/models';
import '../../components/ui/TableStyles.css';

const ExamQuestions: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [questionType, setQuestionType] = useState<'MCQ' | 'TrueFalse' | 'FillBlank'>('MCQ');
  const [question, setQuestion] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');
  const [optionD, setOptionD] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('A');
  const [marks, setMarks] = useState('');

  // Data
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);

  useEffect(() => {
    if (examId) fetchQuestions();
  }, [examId]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (questionType === 'MCQ' && !['A', 'B', 'C', 'D'].includes(correctAnswer)) {
      alert("Correct Answer for MCQ must be A, B, C, or D.");
      return;
    }
    if (questionType === 'TrueFalse' && !['True', 'False'].includes(correctAnswer)) {
      alert("Correct Answer for True/False must be True or False.");
      return;
    }

    const qData: any = {
      examId,
      question,
      questionType,
      correctAnswer,
      marks: Number(marks)
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
    setMarks('');
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

  const columns: Column<ExamQuestion>[] = [
    {
      key: 'question',
      header: 'Question',
      render: (row) => (
        <div>
          <div className="font-medium">{row.question}</div>
          <div className="text-xs text-blue-600 font-bold mt-1">{row.questionType}</div>
          {row.questionType === 'MCQ' && (
            <div className="text-xs text-[var(--text-muted)] mt-1">
              A: {row.optionA} | B: {row.optionB} | C: {row.optionC} | D: {row.optionD}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'correctAnswer',
      header: 'Correct Answer',
      render: (row) => <span className="font-bold text-green-600">{row.correctAnswer}</span>
    },
    {
      key: 'marks',
      header: 'Marks',
      render: (row) => `${row.marks} marks`
    }
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <button 
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            onClick={() => navigate('/exams')}
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="page-title">Manage Questions</h1>
            <div className="breadcrumbs">
              <span>Dashboard</span> <span className="separator">/</span> 
              <span>Exams</span> <span className="separator">/</span>
              <span className="current">Questions</span>
            </div>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setIsModalOpen(true); }}>
          <Plus size={16} />
          Add Question
        </button>
      </div>

      <DataTable 
        title="Question Bank" 
        data={questions} 
        columns={columns} 
        onEdit={handleEdit}
        onDelete={handleDelete}
        searchPlaceholder="Search questions..."
        isLoading={isLoading}
      />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Edit Question" : "Add Question"}>
        <form onSubmit={handleSubmit} className="modal-form" style={{maxHeight: '70vh', overflowY: 'auto', paddingRight: '10px'}}>
          <Select 
            label="Question Type" 
            options={[
              {label: 'Multiple Choice (MCQ)', value: 'MCQ'},
              {label: 'True / False', value: 'TrueFalse'},
              {label: 'Fill in the Blank', value: 'FillBlank'}
            ]} 
            value={questionType}
            onChange={(e) => {
              setQuestionType(e.target.value as any);
              if (e.target.value === 'MCQ') setCorrectAnswer('A');
              if (e.target.value === 'TrueFalse') setCorrectAnswer('True');
              if (e.target.value === 'FillBlank') setCorrectAnswer('');
            }}
            required
          />

          <Input 
            label="Question Text" 
            placeholder="Enter the question..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            required 
          />
          
          {questionType === 'MCQ' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Option A" value={optionA} onChange={(e) => setOptionA(e.target.value)} required />
                <Input label="Option B" value={optionB} onChange={(e) => setOptionB(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <Input label="Option C" value={optionC} onChange={(e) => setOptionC(e.target.value)} required />
                <Input label="Option D" value={optionD} onChange={(e) => setOptionD(e.target.value)} required />
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-4 mt-4 bg-gray-50 p-4 rounded-lg">
            {questionType === 'MCQ' && (
              <Select 
                label="Correct Answer" 
                options={[
                  {label: 'Option A', value: 'A'}, {label: 'Option B', value: 'B'},
                  {label: 'Option C', value: 'C'}, {label: 'Option D', value: 'D'}
                ]} 
                value={correctAnswer}
                onChange={(e) => setCorrectAnswer(e.target.value)}
                required
              />
            )}
            
            {questionType === 'TrueFalse' && (
              <Select 
                label="Correct Answer" 
                options={[
                  {label: 'True', value: 'True'}, 
                  {label: 'False', value: 'False'}
                ]} 
                value={correctAnswer}
                onChange={(e) => setCorrectAnswer(e.target.value)}
                required
              />
            )}

            {questionType === 'FillBlank' && (
              <Input 
                label="Correct Answer (Exact Match)" 
                placeholder="e.g. 42"
                value={correctAnswer}
                onChange={(e) => setCorrectAnswer(e.target.value)}
                required
              />
            )}

            <Input 
              type="number"
              label="Marks" 
              value={marks}
              onChange={(e) => setMarks(e.target.value)}
              required
            />
          </div>
          
          <div className="modal-actions mt-4">
            <button type="submit" className="btn btn-success">Save Question</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ExamQuestions;
