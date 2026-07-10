import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Eye, AlertTriangle } from 'lucide-react';
import DataTable, { type Column } from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs, doc, getDoc, writeBatch } from 'firebase/firestore';
import type { Exam, ExamAttempt, ExamQuestion } from '../../types/models';

const getGrade = (percentage: number) => {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  return 'Fail';
};

const ExamResults: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  
  const [exam, setExam] = useState<Exam | null>(null);
  const [attempts, setAttempts] = useState<any[]>([]); 
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  
  const [stats, setStats] = useState({
    totalEligible: 0, attempted: 0, highest: 0, lowest: 0, average: 0, passCount: 0, failCount: 0, topStudent: '-'
  });

  const [selectedAttempt, setSelectedAttempt] = useState<any>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  useEffect(() => {
    if (examId) fetchData();
  }, [examId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const examDoc = await getDoc(doc(db, 'exams', examId!));
      if (!examDoc.exists()) return;
      const examData = { documentId: examDoc.id, ...examDoc.data() } as Exam;
      setExam(examData);

      const qQuery = query(collection(db, 'exam_questions'), where('examId', '==', examId));
      const qSnap = await getDocs(qQuery);
      const qList: ExamQuestion[] = [];
      qSnap.forEach(d => qList.push({ documentId: d.id, ...d.data() } as ExamQuestion));
      setQuestions(qList);

      const aQuery = query(collection(db, 'exam_attempts'), where('examId', '==', examId));
      const aSnap = await getDocs(aQuery);
      const attemptList: ExamAttempt[] = [];
      aSnap.forEach(d => attemptList.push({ documentId: d.id, ...d.data() } as ExamAttempt));

      // Rank Generation Engine
      attemptList.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.percentage !== a.percentage) return b.percentage - a.percentage;
        if (a.timeUsed !== b.timeUsed) return a.timeUsed - b.timeUsed;
        const timeA = a.submittedAt ? new Date(a.submittedAt as any).getTime() : 0;
        const timeB = b.submittedAt ? new Date(b.submittedAt as any).getTime() : 0;
        return timeA - timeB;
      });

      const batch = writeBatch(db);
      let needsUpdate = false;

      attemptList.forEach((att, index) => {
        const newRank = index + 1;
        const newGrade = getGrade(att.percentage);
        if (att.rank !== newRank || att.grade !== newGrade) {
          att.rank = newRank;
          att.grade = newGrade;
          batch.update(doc(db, 'exam_attempts', att.documentId!), { rank: newRank, grade: newGrade });
          needsUpdate = true;
        }
      });

      if (needsUpdate) await batch.commit();

      const sQuery = query(collection(db, 'users'), where('batchIds', 'array-contains', examData.batchId), where('status', '==', 'active'));
      const sSnap = await getDocs(sQuery);
      const studentList: any[] = [];
      sSnap.forEach(d => studentList.push({ id: d.id, ...d.data() }));

      const merged: any[] = [];
      let pass = 0, fail = 0, high = 0, low = 999999, totalScore = 0;

      studentList.forEach(student => {
        const attempt = attemptList.find(a => a.studentId === student.id);
        if (attempt) {
          merged.push({ ...student, attempt });
          if (attempt.score >= examData.passingMarks) pass++; else fail++;
          if (attempt.score > high) high = attempt.score;
          if (attempt.score < low) low = attempt.score;
          totalScore += attempt.score;
        } else {
          merged.push({ ...student, attempt: null }); 
        }
      });

      // Tie breaker alphabetically for display if needed, but primary is rank
      merged.sort((a, b) => {
        if (a.attempt && !b.attempt) return -1;
        if (!a.attempt && b.attempt) return 1;
        if (a.attempt && b.attempt) return a.attempt.rank - b.attempt.rank;
        return a.name.localeCompare(b.name);
      });

      setAttempts(merged);
      setStats({
        totalEligible: studentList.length,
        attempted: attemptList.length,
        highest: attemptList.length ? high : 0,
        lowest: attemptList.length ? low : 0,
        average: attemptList.length ? Math.round(totalScore / attemptList.length) : 0,
        passCount: pass,
        failCount: fail,
        topStudent: attemptList.length > 0 ? merged[0].name : '-'
      });

    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const columns: Column<any>[] = [
    { key: 'rank', header: 'Rank', render: (row) => row.attempt ? <span className="font-bold text-blue-600">#{row.attempt.rank}</span> : '-' },
    { key: 'name', header: 'Student Name', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'marks', header: 'Marks', render: (row) => row.attempt ? `${row.attempt.score} / ${exam?.totalMarks}` : '-' },
    { key: 'grade', header: 'Grade', render: (row) => row.attempt ? <span className="font-bold">{row.attempt.grade}</span> : '-' },
    {
      key: 'security',
      header: 'Security Logs',
      render: (row) => {
        if (!row.attempt) return <span className="text-gray-400">N/A</span>;
        const att = row.attempt;
        if (att.isSuspicious) return <span className="text-red-600 font-bold flex items-center gap-1"><AlertTriangle size={14}/> Suspicious</span>;
        if (att.appSwitchCount > 0) return <span className="text-orange-600 font-bold">{att.appSwitchCount} Exits ({att.totalExitDuration}s)</span>;
        return <span className="text-green-600">Clean</span>;
      }
    },
    {
      key: 'result',
      header: 'Result',
      render: (row) => {
        if (!row.attempt) return <span className="text-gray-400 font-bold">ABSENT</span>;
        const isPass = row.attempt.score >= (exam?.passingMarks || 0);
        return isPass ? <span className="text-green-600 font-bold">PASS</span> : <span className="text-red-600 font-bold">FAIL</span>;
      }
    },
    {
      key: 'actions',
      header: 'Review',
      render: (row) => row.attempt ? (
        <button className="text-blue-600 hover:text-blue-800 flex items-center gap-1" onClick={() => { setSelectedAttempt(row); setIsReviewOpen(true); }}>
          <Eye size={16} /> View
        </button>
      ) : null
    }
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-gray-100 rounded-full" onClick={() => navigate('/exams')}>
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="page-title">Exam Results Analytics</h1>
            <div className="breadcrumbs">
              <span>Exams</span> <span className="separator">/</span> <span className="current">{exam?.title || 'Loading...'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500 mb-1">Participation</div>
          <div className="text-2xl font-bold text-gray-800">{stats.attempted} / {stats.totalEligible}</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500 mb-1">Average Score</div>
          <div className="text-2xl font-bold text-blue-600">{stats.average}</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500 mb-1">Highest / Lowest</div>
          <div className="text-2xl font-bold text-gray-800">{stats.highest} <span className="text-gray-400 text-lg">/</span> {stats.lowest}</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="text-sm text-gray-500 mb-1">Pass Rate</div>
          <div className="text-2xl font-bold text-green-600">
            {stats.attempted ? Math.round((stats.passCount / stats.attempted) * 100) : 0}%
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-yellow-200 bg-yellow-50">
          <div className="text-sm text-yellow-700 mb-1">Batch Topper</div>
          <div className="text-xl font-bold text-yellow-800 truncate">{stats.topStudent}</div>
        </div>
      </div>

      <DataTable 
        title="Student Submissions & Rankings" 
        data={attempts} 
        columns={columns} 
        searchPlaceholder="Search student..."
        isLoading={isLoading}
      />

      {/* Student Answer Sheet Modal */}
      <Modal isOpen={isReviewOpen} onClose={() => setIsReviewOpen(false)} title={`Answer Sheet: ${selectedAttempt?.name}`}>
        <div style={{maxHeight: '70vh', overflowY: 'auto', padding: '10px'}}>
          
          {selectedAttempt?.attempt?.isSuspicious && (
            <div className="mb-4 p-4 bg-red-100 text-red-800 border border-red-200 rounded-lg flex items-center gap-2 font-bold">
              <AlertTriangle /> WARNING: This attempt was flagged as suspicious.
              {selectedAttempt?.attempt?.autoSubmitReason && <span className="font-normal block text-sm mt-1">{selectedAttempt.attempt.autoSubmitReason}</span>}
            </div>
          )}

          <div className="mb-4 p-4 bg-gray-50 rounded-lg flex justify-between">
            <div>
              <span className="text-gray-500 text-sm">Score / Grade</span><br/>
              <span className="font-bold text-xl">{selectedAttempt?.attempt?.score} ({selectedAttempt?.attempt?.grade})</span>
            </div>
            <div>
              <span className="text-gray-500 text-sm">Rank</span><br/>
              <span className="font-bold text-xl text-blue-600">#{selectedAttempt?.attempt?.rank}</span>
            </div>
            <div>
              <span className="text-gray-500 text-sm">Time Taken</span><br/>
              <span className="font-bold text-xl text-blue-600">
                {Math.floor(selectedAttempt?.attempt?.timeUsed / 60)}m {selectedAttempt?.attempt?.timeUsed % 60}s
              </span>
            </div>
            <div>
              <span className="text-gray-500 text-sm">App Exits</span><br/>
              <span className={`font-bold text-xl ${selectedAttempt?.attempt?.appSwitchCount > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                {selectedAttempt?.attempt?.appSwitchCount || 0}
              </span>
            </div>
          </div>

          {questions.map((q, idx) => {
            const sAns = selectedAttempt?.attempt?.answers?.[q.documentId!];
            const isCorrect = sAns === q.correctAnswer;
            const isUnanswered = !sAns;
            
            return (
              <div key={q.documentId} className={`mb-4 p-4 border rounded-lg ${isCorrect ? 'border-green-200 bg-green-50' : isUnanswered ? 'border-gray-200 bg-gray-50' : 'border-red-200 bg-red-50'}`}>
                <div className="font-medium mb-2">Q{idx + 1}. {q.question}</div>
                <div className="flex justify-between text-sm">
                  <div className="w-1/2">
                    <span className="text-gray-500">Student Answer:</span><br/>
                    <span className={`font-bold ${isCorrect ? 'text-green-700' : isUnanswered ? 'text-gray-500' : 'text-red-700'}`}>
                      {isUnanswered ? 'Not Attempted' : sAns}
                    </span>
                  </div>
                  <div className="w-1/2">
                    <span className="text-gray-500">Correct Answer:</span><br/>
                    <span className="font-bold text-green-700">{q.correctAnswer}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Modal>
    </div>
  );
};

export default ExamResults;
