import React, { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, Clock, Calendar, FileText } from 'lucide-react';

import { db } from '../../config/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import './StudentPortal.css';

const StudentExams: React.FC = () => {
  const { user } = useAuth();
  
  // State for exam listing
  const [examsList, setExamsList] = useState<any[]>([]);
  const [isLoadingExams, setIsLoadingExams] = useState(true);
  
  // State for selected exam flow
  const [selectedExam, setSelectedExam] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [examStarted, setExamStarted] = useState(false);
  const [examFinished, setExamFinished] = useState(false);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [score, setScore] = useState(0);
  const [totalMarks, setTotalMarks] = useState(0);

  useEffect(() => {
    if (user?.id) fetchExams();
  }, [user]);

  const fetchExams = async () => {
    setIsLoadingExams(true);
    try {
      const userSnap = await getDoc(doc(db, 'users', user!.id));
      if (userSnap.exists()) {
        const uData = userSnap.data();
        const batchIds = uData.batchIds || [];
        
        if (batchIds.length > 0) {
          const exSnap = await getDocs(collection(db, 'exams'));
          const list: any[] = [];
          exSnap.forEach(d => {
            const data = d.data();
            const exStatus = (data.status || 'draft').toLowerCase();
            if (exStatus === 'draft' || exStatus === 'inactive' || exStatus === 'cancelled') {
              return;
            }

            // Check toggle visibility
            let isExplicitlyDisabled = false;
            let isExplicitlyEnabled = false;
            if (data.batchVisibility && typeof data.batchVisibility === 'object') {
              for (const bId of batchIds) {
                if (data.batchVisibility[bId] === false) isExplicitlyDisabled = true;
                if (data.batchVisibility[bId] === true) isExplicitlyEnabled = true;
              }
            }

            if (isExplicitlyDisabled) return;

            const isBatchMatch = isExplicitlyEnabled ||
              !data.batchId ||
              data.batchId === 'all' ||
              batchIds.includes(data.batchId) ||
              (Array.isArray(data.batchIds) && (data.batchIds.includes('all') || data.batchIds.some((b: string) => batchIds.includes(b))));

            if (!isBatchMatch) return;

            let start = 'Unknown Date';
            if (data.startDate) {
               const date = data.startDate.toDate ? data.startDate.toDate() : new Date(data.startDate);
               start = date.toLocaleDateString();
            }
            list.push({
              id: d.id,
              ...data,
              start
            });
          });
          setExamsList(list);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingExams(false);
    }
  };

  const handleSelectExam = async (exam: any) => {
    setSelectedExam(exam);
    setIsLoadingQuestions(true);
    setExamStarted(false);
    setExamFinished(false);
    setSelectedAnswers({});
    setCurrentQuestionIdx(0);
    
    try {
      const qQuery = query(collection(db, 'exam_questions'), where('examId', '==', exam.id));
      const qSnap = await getDocs(qQuery);
      const qList: any[] = [];
      qSnap.forEach(d => {
        qList.push({ id: d.id, ...d.data() });
      });
      setQuestions(qList);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  const handleStart = () => {
    if (questions.length === 0) {
      alert("This exam has no questions yet.");
      return;
    }
    setExamStarted(true);
  };

  const handleSelectOption = (questionId: string, answer: string) => {
    setSelectedAnswers({
      ...selectedAnswers,
      [questionId]: answer
    });
  };

  const handleNext = () => {
    if (currentQuestionIdx < questions.length - 1) {
      setCurrentQuestionIdx(currentQuestionIdx + 1);
    } else {
      // Calculate score
      let earned = 0;
      let total = 0;
      questions.forEach(q => {
        total += (q.marks || 1);
        if (selectedAnswers[q.id] === q.correctAnswer) {
          earned += (q.marks || 1);
        }
      });
      setScore(earned);
      setTotalMarks(total);
      setExamFinished(true);
    }
  };

  // 1. Exam Finished View
  if (examFinished) {
    const percentage = totalMarks > 0 ? (score / totalMarks) * 100 : 0;
    const passed = percentage >= 40; // Assume 40% is passing
    return (
      <div className="sp-container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
        <h1 className="sp-greeting">Exam Submitted!</h1>
        <p className="sp-subtitle mt-2">Your answers for {selectedExam.title} have been recorded.</p>
        
        <div className="sp-card mt-6">
          <h2 className="text-xl font-bold text-[var(--text-main)]">Score: {score} / {totalMarks}</h2>
          <p className={`font-bold mt-1 ${passed ? 'text-green-600' : 'text-red-500'}`}>
            {passed ? 'Passed' : 'Needs Improvement'} ({percentage.toFixed(0)}%)
          </p>
        </div>

        <button 
          className="sp-btn-primary full-width mt-6"
          onClick={() => {
            setSelectedExam(null);
            setExamFinished(false);
            setExamStarted(false);
          }}
          style={{ background: '#4318ff', color: 'white' }}
        >
          Return to Exams
        </button>
      </div>
    );
  }

  // 2. Taking the Exam View
  if (examStarted) {
    const currentQ = questions[currentQuestionIdx];
    return (
      <div className="sp-container">
        <div className="sp-header">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-500">Q {currentQuestionIdx + 1}/{questions.length}</span>
          </div>
          <div className="flex items-center gap-1 text-red-500 font-bold">
            <Clock size={16} /> Time Running
          </div>
        </div>

        <div className="sp-card" style={{ padding: '2rem 1.5rem' }}>
          <h2 className="text-lg font-bold text-[var(--text-main)] mb-6">
            {currentQ.question}
          </h2>

          <div className="flex flex-col gap-3">
            {currentQ.questionType === 'MCQ' && ['A', 'B', 'C', 'D'].map(optKey => {
              const optVal = currentQ[`option${optKey}`];
              if (!optVal) return null;
              const isSelected = selectedAnswers[currentQ.id] === optKey;
              return (
                <button
                  key={optKey}
                  className="text-left p-4 rounded-xl border-2 transition-colors"
                  style={{
                    borderColor: isSelected ? '#4318ff' : '#e0e5f2',
                    backgroundColor: isSelected ? '#f4f7fe' : 'transparent',
                    color: isSelected ? '#4318ff' : 'inherit',
                    fontWeight: isSelected ? 'bold' : 'normal'
                  }}
                  onClick={() => handleSelectOption(currentQ.id, optKey)}
                >
                  <span className="mr-3 text-gray-400 font-bold">{optKey}</span>
                  {optVal}
                </button>
              );
            })}
            
            {currentQ.questionType === 'TrueFalse' && ['True', 'False'].map(opt => (
               <button
                 key={opt}
                 className="text-left p-4 rounded-xl border-2 transition-colors"
                 style={{
                   borderColor: selectedAnswers[currentQ.id] === opt ? '#4318ff' : '#e0e5f2',
                   backgroundColor: selectedAnswers[currentQ.id] === opt ? '#f4f7fe' : 'transparent',
                   color: selectedAnswers[currentQ.id] === opt ? '#4318ff' : 'inherit',
                   fontWeight: selectedAnswers[currentQ.id] === opt ? 'bold' : 'normal'
                 }}
                 onClick={() => handleSelectOption(currentQ.id, opt)}
               >
                 {opt}
               </button>
            ))}

            {currentQ.questionType === 'FillBlank' && (
              <input 
                type="text" 
                className="w-full border-2 border-[#e0e5f2] rounded-xl p-4 focus:border-[#4318ff] outline-none"
                placeholder="Type your answer here..."
                value={selectedAnswers[currentQ.id] || ''}
                onChange={(e) => handleSelectOption(currentQ.id, e.target.value)}
              />
            )}
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
            {currentQuestionIdx === questions.length - 1 ? 'Submit Exam' : 'Next'}
          </button>
        </div>
      </div>
    );
  }

  // 3. Exam Details/Start View
  if (selectedExam) {
    return (
      <div className="sp-container">
        <div className="sp-header">
          <div className="flex items-center gap-4">
            <button 
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              onClick={() => setSelectedExam(null)}
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
            <h1 className="sp-greeting">{selectedExam.title}</h1>
          </div>
        </div>

        <div className="sp-card">
          <h2 className="sp-section-title">Instructions</h2>
          <ul className="text-sm text-gray-600 space-y-2 mt-4 pl-4 list-disc">
            <li>Ensure you have a stable internet connection.</li>
            <li>Do not close the browser while taking the exam.</li>
            <li>Submit before the time runs out.</li>
          </ul>
          
          <div className="flex justify-between items-center mt-6 p-4 bg-gray-50 rounded-lg">
            <div>
              <span className="block text-xs text-gray-500">Status</span>
              <span className="font-bold text-green-600">Available</span>
            </div>
            <div>
              <span className="block text-xs text-gray-500">Questions Loaded</span>
              <span className="font-bold">{isLoadingQuestions ? '...' : questions.length} Qs</span>
            </div>
          </div>

          <button 
            className="sp-btn-primary full-width mt-6 disabled:opacity-50"
            style={{ background: '#4318ff', color: 'white' }}
            onClick={handleStart}
            disabled={isLoadingQuestions}
          >
            {isLoadingQuestions ? 'Loading Questions...' : 'Start Exam Now'}
          </button>
        </div>
      </div>
    );
  }

  // 4. Default: List of Exams
  return (
    <div className="sp-container">
      <div className="sp-header">
        <h1 className="sp-greeting">My Exams</h1>
        <p className="sp-subtitle">View and take your assigned exams.</p>
      </div>

      <div className="sp-section mt-4">
        {isLoadingExams ? (
          <p className="text-gray-500 text-center py-8">Loading exams...</p>
        ) : examsList.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-xl shadow-sm border border-gray-100">
            <FileText size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">No exams assigned to your batch yet.</p>
          </div>
        ) : (
          examsList.map(ex => (
            <div key={ex.id} className="sp-card hw-card mb-4 border-l-4 border-purple-500 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => handleSelectExam(ex)}>
              <div className="hw-icon"><Calendar size={24} className="text-purple-600"/></div>
              <div className="hw-info">
                <h4 className="text-lg font-bold text-[#2b3674]">{ex.title}</h4>
                <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                  Started: <span className="font-semibold">{ex.start}</span>
                </p>
                <p className="text-xs bg-purple-50 text-purple-600 inline-block px-2 py-1 rounded mt-2 font-medium">
                  {ex.examType} Exam
                </p>
              </div>
              <button className="sp-btn-outline sm shrink-0 text-purple-600 border-purple-600">Take Exam</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default StudentExams;
