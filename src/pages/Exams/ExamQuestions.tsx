import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, ArrowLeft } from 'lucide-react';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import type { ExamQuestion } from '../../types/models';
import '../../components/ui/TableStyles.css';

const ExamQuestions: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form State
  const [question, setQuestion] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');
  const [optionD, setOptionD] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [marks, setMarks] = useState('');

  // Dummy Data
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuestions([
        { 
          documentId: '1', 
          examId: examId || 'unknown',
          question: 'What is the past tense of "Go"?',
          optionA: 'Went',
          optionB: 'Gone',
          optionC: 'Going',
          optionD: 'Goes',
          correctAnswer: 'A',
          marks: 2
        }
      ]);
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [examId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newQ: ExamQuestion = {
      documentId: Math.random().toString(36).substr(2, 9),
      examId: examId || 'unknown',
      question,
      optionA,
      optionB,
      optionC,
      optionD,
      correctAnswer,
      marks: Number(marks)
    };
    setQuestions([...questions, newQ]);
    setIsModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setQuestion('');
    setOptionA('');
    setOptionB('');
    setOptionC('');
    setOptionD('');
    setCorrectAnswer('A');
    setMarks('');
  };

  const handleEdit = (q: ExamQuestion) => {
    setQuestion(q.question);
    setOptionA(q.optionA);
    setOptionB(q.optionB);
    setOptionC(q.optionC);
    setOptionD(q.optionD);
    setCorrectAnswer(q.correctAnswer);
    setMarks(q.marks.toString());
    setIsModalOpen(true);
  };

  const handleDelete = (q: ExamQuestion) => {
    setQuestions(questions.filter(item => item.documentId !== q.documentId));
  };

  const columns: Column<ExamQuestion>[] = [
    {
      key: 'question',
      header: 'Question',
      render: (row) => (
        <div>
          <div className="font-medium">{row.question}</div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            A: {row.optionA} | B: {row.optionB} | C: {row.optionC} | D: {row.optionD}
          </div>
        </div>
      )
    },
    {
      key: 'correctAnswer',
      header: 'Correct Option',
      render: (row) => <span className="font-bold text-green-600">Option {row.correctAnswer}</span>
    },
    {
      key: 'marks',
      header: 'Marks'
    }
  ];

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div className="flex items-center gap-4">
          <button 
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            onClick={() => navigate('/exams')}
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="page-title">Exam Questions (MCQ)</h1>
            <div className="breadcrumbs">
              <span>Dashboard</span> <span className="separator">/</span> 
              <span>Exams</span> <span className="separator">/</span>
              <span className="current">Questions</span>
            </div>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} />
          Add Question
        </button>
      </div>

      <DataTable 
        title="MCQ Bank" 
        data={questions} 
        columns={columns} 
        onEdit={handleEdit}
        onDelete={handleDelete}
        searchPlaceholder="Search questions..."
        isLoading={isLoading}
      />

      {/* Add Question Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add MCQ Question">
        <form onSubmit={handleSubmit} className="modal-form">
          <Input 
            label="Question" 
            placeholder="Enter the question text..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            required 
          />
          
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Option A" 
              value={optionA}
              onChange={(e) => setOptionA(e.target.value)}
              required
            />
            <Input 
              label="Option B" 
              value={optionB}
              onChange={(e) => setOptionB(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Option C" 
              value={optionC}
              onChange={(e) => setOptionC(e.target.value)}
              required
            />
            <Input 
              label="Option D" 
              value={optionD}
              onChange={(e) => setOptionD(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select 
              label="Correct Answer" 
              options={[
                {label: 'Option A', value: 'A'},
                {label: 'Option B', value: 'B'},
                {label: 'Option C', value: 'C'},
                {label: 'Option D', value: 'D'}
              ]} 
              value={correctAnswer}
              onChange={(e) => setCorrectAnswer(e.target.value as 'A'|'B'|'C'|'D')}
              required
            />
            <Input 
              type="number"
              label="Marks for this question" 
              value={marks}
              onChange={(e) => setMarks(e.target.value)}
              required
            />
          </div>
          
          <div className="modal-actions">
            <button type="submit" className="btn btn-success">Save Question</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ExamQuestions;
