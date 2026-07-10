import React, { useState } from 'react';
import { ArrowLeft, CheckCircle, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './StudentPortal.css';

// Mock Exam Question
interface Question {
  id: string;
  text: string;
  options: { id: string; text: string }[];
}

const StudentExams: React.FC = () => {
  const navigate = useNavigate();
  
  // State for exam flow
  const [examStarted, setExamStarted] = useState(false);
  const [examFinished, setExamFinished] = useState(false);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});

  // Mock jumbled questions
  const questions: Question[] = [
    {
      id: 'q1',
      text: 'What is the past tense of "Go"?',
      options: [
        { id: 'A', text: 'Went' },
        { id: 'B', text: 'Gone' },
        { id: 'C', text: 'Going' },
        { id: 'D', text: 'Goes' }
      ]
    },
    {
      id: 'q2',
      text: 'Which is a correct sentence?',
      options: [
        { id: 'A', text: 'He don\'t like apples.' },
        { id: 'B', text: 'He doesn\'t likes apples.' },
        { id: 'C', text: 'He doesn\'t like apples.' },
        { id: 'D', text: 'He not like apples.' }
      ]
    }
  ];

  const handleStart = () => {
    setExamStarted(true);
    // In a real app, here you would fetch questions and shuffle/jumble them based on a seed.
  };

  const handleSelectOption = (questionId: string, optionId: string) => {
    setSelectedAnswers({
      ...selectedAnswers,
      [questionId]: optionId
    });
  };

  const handleNext = () => {
    if (currentQuestionIdx < questions.length - 1) {
      setCurrentQuestionIdx(currentQuestionIdx + 1);
    } else {
      setExamFinished(true);
      // In a real app, submit the attempt to Firestore here
    }
  };

  if (examFinished) {
    return (
      <div className="sp-container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
        <h1 className="sp-greeting">Exam Submitted!</h1>
        <p className="sp-subtitle mt-2">Your answers have been recorded successfully.</p>
        
        <div className="sp-card mt-6">
          <h2 className="text-xl font-bold text-[var(--text-main)]">Score: 2 / 2</h2>
          <p className="text-green-600 font-bold mt-1">Pass (100%)</p>
        </div>

        <button 
          className="sp-btn-primary full-width mt-6"
          onClick={() => navigate('/student/dashboard')}
          style={{ background: '#4318ff', color: 'white' }}
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  if (examStarted) {
    const currentQ = questions[currentQuestionIdx];
    return (
      <div className="sp-container">
        <div className="sp-header">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-500">Q {currentQuestionIdx + 1}/{questions.length}</span>
          </div>
          <div className="flex items-center gap-1 text-red-500 font-bold">
            <Clock size={16} />
            59:42
          </div>
        </div>

        <div className="sp-card" style={{ padding: '2rem 1.5rem' }}>
          <h2 className="text-lg font-bold text-[var(--text-main)] mb-6">
            {currentQ.text}
          </h2>

          <div className="flex flex-col gap-3">
            {currentQ.options.map((opt) => (
              <button
                key={opt.id}
                className="text-left p-4 rounded-xl border-2 transition-colors"
                style={{
                  borderColor: selectedAnswers[currentQ.id] === opt.id ? '#4318ff' : '#e0e5f2',
                  backgroundColor: selectedAnswers[currentQ.id] === opt.id ? '#f4f7fe' : 'transparent',
                  color: selectedAnswers[currentQ.id] === opt.id ? '#4318ff' : 'inherit',
                  fontWeight: selectedAnswers[currentQ.id] === opt.id ? 'bold' : 'normal'
                }}
                onClick={() => handleSelectOption(currentQ.id, opt.id)}
              >
                <span className="mr-3 text-gray-400 font-bold">{opt.id}</span>
                {opt.text}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-4 mt-6">
          <button 
            className="sp-btn-outline flex-1"
            disabled={currentQuestionIdx === 0}
            onClick={() => setCurrentQuestionIdx(currentQuestionIdx - 1)}
          >
            Previous
          </button>
          <button 
            className="sp-btn-primary flex-1"
            style={{ background: '#4318ff', color: 'white' }}
            disabled={!selectedAnswers[currentQ.id]}
            onClick={handleNext}
          >
            {currentQuestionIdx === questions.length - 1 ? 'Submit Exam' : 'Next Question'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sp-container">
      <div className="sp-header">
        <div className="flex items-center gap-4">
          <button 
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <h1 className="sp-greeting">Mid-Term Assessment</h1>
        </div>
      </div>

      <div className="sp-card">
        <h2 className="sp-section-title">Instructions</h2>
        <ul className="text-sm text-gray-600 space-y-2 mt-4 pl-4 list-disc">
          <li>This exam contains 2 questions.</li>
          <li>Total time allowed is 60 minutes.</li>
          <li>Questions are presented in a jumbled sequence.</li>
          <li>Ensure you have a stable internet connection.</li>
        </ul>
        
        <div className="flex justify-between items-center mt-6 p-4 bg-gray-50 rounded-lg">
          <div>
            <span className="block text-xs text-gray-500">Passing Marks</span>
            <span className="font-bold text-green-600">40 / 100</span>
          </div>
          <div>
            <span className="block text-xs text-gray-500">Duration</span>
            <span className="font-bold">60 Mins</span>
          </div>
        </div>

        <button 
          className="sp-btn-primary full-width mt-6"
          style={{ background: '#4318ff', color: 'white' }}
          onClick={handleStart}
        >
          Start Exam Now
        </button>
      </div>
    </div>
  );
};

export default StudentExams;
