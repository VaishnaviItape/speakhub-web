import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, AlertTriangle, Users, Target, TrendingUp, CheckCircle, Award, RefreshCw } from 'lucide-react';
import DataTable, { type Column } from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs, doc, getDoc, writeBatch } from 'firebase/firestore';
import { formatIndianDateTime } from '../../utils/dateTime';
import { formatGoogleDriveImageUrl } from '../../utils/imageUrl';
import type { Exam, ExamAttempt, ExamQuestion } from '../../types/models';

const getGrade = (percentage: number) => {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  return 'Fail';
};

const cleanPhoneNumber = (phone: any): string => {
  if (!phone) return '';
  return String(phone).replace(/[^0-9]/g, '').slice(-10);
};

const ExamResults: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  
  const [exam, setExam] = useState<Exam | null>(null);
  const [batchName, setBatchName] = useState<string>('');
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
      if (!examId) return;

      // 1. Fetch Exam details
      const examDoc = await getDoc(doc(db, 'exams', examId));
      let examData: Exam | null = null;
      if (examDoc.exists()) {
        examData = { documentId: examDoc.id, ...examDoc.data() } as Exam;
      } else {
        // Fallback: search by documentId field or all exams
        const examSnap = await getDocs(collection(db, 'exams'));
        const found = examSnap.docs.find(d => d.id === examId);
        if (found) {
          examData = { documentId: found.id, ...found.data() } as Exam;
        }
      }

      if (!examData) {
        setIsLoading(false);
        return;
      }
      setExam(examData);

      // Fetch batch name for breadcrumb/title info
      if (examData.batchId && examData.batchId !== 'all') {
        getDoc(doc(db, 'batches', examData.batchId)).then(bDoc => {
          if (bDoc.exists()) {
            setBatchName(bDoc.data()?.batchName || '');
          }
        }).catch(() => {});
      }

      // 2. Fetch Questions
      const qList: ExamQuestion[] = [];
      try {
        const qQuery = query(collection(db, 'exam_questions'), where('examId', '==', examId));
        const qSnap = await getDocs(qQuery);
        qSnap.forEach(d => qList.push({ documentId: d.id, ...d.data() } as ExamQuestion));
      } catch (e) {
        console.warn('Error fetching exam_questions by query:', e);
      }

      // Fallback questions if not found by examId
      if (qList.length === 0) {
        const allQuestionsSnap = await getDocs(collection(db, 'exam_questions'));
        allQuestionsSnap.forEach(d => {
          const qd = d.data();
          if (qd.examId === examId || (examData?.title && qd.examTitle && qd.examTitle.trim().toLowerCase() === examData.title.trim().toLowerCase())) {
            qList.push({ documentId: d.id, ...qd } as ExamQuestion);
          }
        });
      }
      setQuestions(qList);

      // 3. Fetch Attempts (Submissions)
      const attemptMap = new Map<string, ExamAttempt>();
      
      // Query 1: Direct by examId
      try {
        const aQuery = query(collection(db, 'exam_attempts'), where('examId', '==', examId));
        const aSnap = await getDocs(aQuery);
        aSnap.forEach(d => {
          attemptMap.set(d.id, { documentId: d.id, ...d.data() } as ExamAttempt);
        });
      } catch (e) {
        console.warn('Error fetching direct exam_attempts:', e);
      }

      // Query 2: Fallback across all attempts to match by examId or examTitle
      if (attemptMap.size === 0) {
        const allAttemptsSnap = await getDocs(collection(db, 'exam_attempts'));
        allAttemptsSnap.forEach(d => {
          const ad = d.data();
          const matchesId = ad.examId === examId || ad.examId === examData?.documentId;
          const matchesTitle = examData?.title && ad.examTitle && ad.examTitle.trim().toLowerCase() === examData.title.trim().toLowerCase();
          if (matchesId || matchesTitle) {
            attemptMap.set(d.id, { documentId: d.id, ...ad } as ExamAttempt);
          }
        });
      }

      const attemptList: ExamAttempt[] = Array.from(attemptMap.values());

      // 4. Rank Generation Engine
      attemptList.sort((a, b) => {
        const scoreA = Number(a.score) || 0;
        const scoreB = Number(b.score) || 0;
        if (scoreB !== scoreA) return scoreB - scoreA;

        const pctA = Number(a.percentage) || 0;
        const pctB = Number(b.percentage) || 0;
        if (pctB !== pctA) return pctB - pctA;

        const timeA = Number(a.timeUsed) || 0;
        const timeB = Number(b.timeUsed) || 0;
        if (timeA !== timeB) return timeA - timeB;

        const dateA = a.submittedAt ? new Date(a.submittedAt as any).getTime() : 0;
        const dateB = b.submittedAt ? new Date(b.submittedAt as any).getTime() : 0;
        return dateA - dateB;
      });

      const batch = writeBatch(db);
      let needsBatchUpdate = false;

      attemptList.forEach((att, index) => {
        const newRank = index + 1;
        const calculatedPercentage = att.totalMarks 
          ? Math.round((Number(att.score || 0) / Number(att.totalMarks)) * 100)
          : (Number(att.percentage) || 0);
        const newGrade = getGrade(calculatedPercentage);

        if (att.rank !== newRank || att.grade !== newGrade) {
          att.rank = newRank;
          att.grade = newGrade;
          if (att.documentId) {
            batch.update(doc(db, 'exam_attempts', att.documentId), { rank: newRank, grade: newGrade });
            needsBatchUpdate = true;
          }
        }
      });

      if (needsBatchUpdate) {
        batch.commit().catch(err => console.warn('Could not update ranks in background:', err));
      }

      // 5. Fetch Eligible Students for the targeted batch(es)
      // Extract target batch IDs
      const targetBatchIds: string[] = [];
      if (examData.batchId) targetBatchIds.push(examData.batchId);
      if (Array.isArray(examData.batchIds)) {
        examData.batchIds.forEach(id => {
          if (id && !targetBatchIds.includes(id)) targetBatchIds.push(id);
        });
      }
      if (examData.batchVisibility && typeof examData.batchVisibility === 'object') {
        Object.entries(examData.batchVisibility).forEach(([bId, isEnabled]) => {
          if (isEnabled && !targetBatchIds.includes(bId)) targetBatchIds.push(bId);
        });
      }

      const isAllBatches = targetBatchIds.length === 0 || targetBatchIds.includes('all');

      // Fetch all student users from both 'users' and 'students' collections
      const studentsMap = new Map<string, any>();

      const processStudentDoc = (d: any) => {
        const data = d.data();
        const role = String(data.role || 'student').toLowerCase();
        if (role !== 'student' && role !== 'user') return;

        const status = String(data.status || 'active').toLowerCase();
        if (status === 'inactive' || status === 'archived' || status === 'deleted') return;

        // Check batch assignment
        const studentBatchIds: string[] = [];
        if (data.batchId) studentBatchIds.push(String(data.batchId));
        if (Array.isArray(data.batchIds)) {
          data.batchIds.forEach((b: any) => b && studentBatchIds.push(String(b)));
        }
        if (data.batch) studentBatchIds.push(String(data.batch));

        const isEligible = isAllBatches || studentBatchIds.some(b => targetBatchIds.includes(b));

        if (isEligible) {
          studentsMap.set(d.id, {
            id: d.id,
            documentId: d.id,
            uid: data.uid || d.id,
            name: data.name || data.studentName || `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Student',
            phone: data.phone || data.mobile || '',
            email: data.email || '',
            batchIds: studentBatchIds,
            batchName: data.batchName || '',
          });
        }
      };

      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        usersSnap.forEach(processStudentDoc);
      } catch (e) {
        console.warn('Error fetching users:', e);
      }

      try {
        const studSnap = await getDocs(collection(db, 'students'));
        studSnap.forEach(processStudentDoc);
      } catch {
        // 'students' collection is optional
      }

      const studentList = Array.from(studentsMap.values());

      // 6. Match Submissions with Students & Build Consolidated Data
      const isAttemptForStudent = (att: any, student: any) => {
        if (!att || !student) return false;
        if (att.studentId && (att.studentId === student.id || att.studentId === student.uid || att.studentId === student.documentId)) {
          return true;
        }
        const sPhone = cleanPhoneNumber(student.phone);
        const aPhone = cleanPhoneNumber(att.studentPhone);
        if (sPhone && aPhone && sPhone === aPhone) {
          return true;
        }
        if (att.studentName && student.name && att.studentName.trim().toLowerCase() === student.name.trim().toLowerCase()) {
          return true;
        }
        return false;
      };

      const matchedStudentIds = new Set<string>();
      const merged: any[] = [];
      let pass = 0, fail = 0, high = 0, low = 999999, totalScore = 0;

      // First, add all students who submitted an attempt (Guarantees no submission is missed!)
      attemptList.forEach((att) => {
        const student = studentList.find(s => isAttemptForStudent(att, s));
        if (student) {
          matchedStudentIds.add(student.id);
        }

        const scoreVal = Number(att.score) || 0;
        const passingMarksVal = Number(examData?.passingMarks) || 0;
        
        if (scoreVal >= passingMarksVal) pass++; else fail++;
        if (scoreVal > high) high = scoreVal;
        if (scoreVal < low) low = scoreVal;
        totalScore += scoreVal;

        merged.push({
          documentId: att.documentId || (att as any).id || student?.id,
          id: student?.id || att.studentId || att.documentId,
          name: student?.name || att.studentName || 'Student',
          phone: student?.phone || att.studentPhone || '',
          email: student?.email || '',
          attempt: att,
        });
      });

      // Second, add eligible students who did NOT attempt (marked as ABSENT)
      studentList.forEach(student => {
        if (!matchedStudentIds.has(student.id)) {
          merged.push({
            documentId: student.id,
            id: student.id,
            name: student.name,
            phone: student.phone,
            email: student.email,
            attempt: null,
          });
        }
      });

      // Sort: submitted attempts by rank (#1, #2...), then absent students alphabetically
      merged.sort((a, b) => {
        if (a.attempt && !b.attempt) return -1;
        if (!a.attempt && b.attempt) return 1;
        if (a.attempt && b.attempt) return (Number(a.attempt.rank) || 0) - (Number(b.attempt.rank) || 0);
        return (a.name || '').localeCompare(b.name || '');
      });

      const totalEligibleCount = Math.max(studentList.length, attemptList.length, merged.length);

      setAttempts(merged);
      setStats({
        totalEligible: totalEligibleCount,
        attempted: attemptList.length,
        highest: attemptList.length > 0 ? high : 0,
        lowest: attemptList.length > 0 && low !== 999999 ? low : 0,
        average: attemptList.length > 0 ? Math.round(totalScore / attemptList.length) : 0,
        passCount: pass,
        failCount: fail,
        topStudent: attemptList.length > 0 ? (merged[0]?.name || attemptList[0]?.studentName || '-') : '-'
      });

    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const columns: Column<any>[] = [
    { 
      key: 'rank', 
      header: 'Rank', 
      render: (row) => row.attempt ? (
        <span className="font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded text-sm">
          #{row.attempt.rank || 1}
        </span>
      ) : (
        <span className="text-gray-400 font-medium">-</span>
      ) 
    },
    { 
      key: 'name', 
      header: 'Student Name', 
      render: (row) => (
        <div>
          <div className="font-medium text-gray-900">{row.name}</div>
          {row.phone && <div className="text-xs text-gray-500">{row.phone}</div>}
        </div>
      ) 
    },
    { 
      key: 'marks', 
      header: 'Marks', 
      render: (row) => row.attempt ? (
        <span className="font-semibold text-gray-800">
          {row.attempt.score} <span className="text-gray-400 text-xs">/ {exam?.totalMarks || 50}</span>
        </span>
      ) : (
        <span className="text-gray-400">-</span>
      ) 
    },
    { 
      key: 'grade', 
      header: 'Grade', 
      render: (row) => row.attempt ? (
        <span className={`font-bold px-2 py-0.5 rounded text-xs ${
          row.attempt.grade === 'Fail' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
        }`}>
          {row.attempt.grade || 'Pass'}
        </span>
      ) : '-' 
    },
    {
      key: 'submittedAt',
      header: 'Submitted (Indian Time)',
      render: (row) => row.attempt?.submittedAt ? (
        <span className="text-xs text-gray-700 font-medium">
          {formatIndianDateTime(row.attempt.submittedAt)}
        </span>
      ) : (
        <span className="text-gray-400 text-xs">Not Submitted</span>
      )
    },
    {
      key: 'security',
      header: 'Security Logs',
      render: (row) => {
        if (!row.attempt) return <span className="text-gray-400">N/A</span>;
        const att = row.attempt;
        if (att.isSuspicious) return <span className="text-red-600 font-bold flex items-center gap-1 text-xs"><AlertTriangle size={14}/> Suspicious</span>;
        if (att.appSwitchCount > 0) return <span className="text-orange-600 font-semibold text-xs">{att.appSwitchCount} Exits ({att.totalExitDuration || 0}s)</span>;
        return <span className="text-green-600 font-medium text-xs">Clean</span>;
      }
    },
    {
      key: 'result',
      header: 'Result',
      render: (row) => {
        if (!row.attempt) return <span className="text-gray-400 font-bold text-xs bg-gray-100 px-2 py-1 rounded">ABSENT</span>;
        const isPass = Number(row.attempt.score) >= (Number(exam?.passingMarks) || 0);
        return isPass ? (
          <span className="text-green-700 bg-green-100 font-bold text-xs px-2 py-1 rounded">PASS</span>
        ) : (
          <span className="text-red-700 bg-red-100 font-bold text-xs px-2 py-1 rounded">FAIL</span>
        );
      }
    },
    {
      key: 'actions',
      header: 'Review',
      render: (row) => row.attempt ? (
        <button 
          className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-xs font-bold bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded transition" 
          onClick={() => { setSelectedAttempt(row); setIsReviewOpen(true); }}
        >
          <Eye size={15} /> View Sheet
        </button>
      ) : null
    }
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-gray-100 rounded-full transition" onClick={() => navigate('/exams')}>
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="page-title">Exam Results Analytics</h1>
            <div className="breadcrumbs">
              <span>Exams</span> <span className="separator">/</span> <span className="current">{exam?.title || 'Loading...'}</span>
              {batchName && <span className="text-gray-500 ml-2">({batchName})</span>}
            </div>
          </div>
        </div>
        <button 
          className="btn btn-secondary flex items-center gap-2"
          onClick={fetchData}
          disabled={isLoading}
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Analytics Cards */}
      <div className="metric-cards-grid">
        <div className="metric-card indigo">
          <div className="metric-card-content">
            <div className="metric-card-title">Participation</div>
            <div className="metric-card-value">{stats.attempted} / {stats.totalEligible}</div>
          </div>
          <div className="metric-card-icon"><Users /></div>
        </div>

        <div className="metric-card blue">
          <div className="metric-card-content">
            <div className="metric-card-title">Average Score</div>
            <div className="metric-card-value">{stats.average}</div>
          </div>
          <div className="metric-card-icon"><Target /></div>
        </div>

        <div className="metric-card rose">
          <div className="metric-card-content">
            <div className="metric-card-title">Highest / Lowest</div>
            <div className="metric-card-value">{stats.highest} <span style={{fontSize: '20px', opacity: 0.7}}>/</span> {stats.lowest}</div>
          </div>
          <div className="metric-card-icon"><TrendingUp /></div>
        </div>

        <div className="metric-card emerald">
          <div className="metric-card-content">
            <div className="metric-card-title">Pass Rate</div>
            <div className="metric-card-value">
              {stats.attempted ? Math.round((stats.passCount / stats.attempted) * 100) : 0}%
            </div>
          </div>
          <div className="metric-card-icon"><CheckCircle /></div>
        </div>

        <div className="metric-card amber">
          <div className="metric-card-content">
            <div className="metric-card-title">Batch Topper</div>
            <div className="metric-card-value" style={{fontSize: '24px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px'}} title={stats.topStudent || ''}>{stats.topStudent || '-'}</div>
          </div>
          <div className="metric-card-icon"><Award /></div>
        </div>
      </div>

      <DataTable 
        title="Student Submissions & Rankings" 
        data={attempts} 
        columns={columns} 
        searchPlaceholder="Search student..."
        isLoading={isLoading}
        onRefresh={fetchData}
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
                {Math.floor((selectedAttempt?.attempt?.timeUsed || 0) / 60)}m {(selectedAttempt?.attempt?.timeUsed || 0) % 60}s
              </span>
            </div>
            <div>
              <span className="text-gray-500 text-sm">App Exits</span><br/>
              <span className={`font-bold text-xl ${selectedAttempt?.attempt?.appSwitchCount > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                {selectedAttempt?.attempt?.appSwitchCount || 0}
              </span>
            </div>
          </div>

          {questions.length > 0 ? (
            questions.map((q, idx) => {
              const sAns = selectedAttempt?.attempt?.answers?.[q.documentId!];
              const isCorrect = sAns === q.correctAnswer;
              const isUnanswered = !sAns;
              
              return (
                <div key={q.documentId || idx} className={`mb-4 p-4 border rounded-lg ${isCorrect ? 'border-green-200 bg-green-50' : isUnanswered ? 'border-gray-200 bg-gray-50' : 'border-red-200 bg-red-50'}`}>
                  {q.imageUrl && (
                    <div className="mb-2">
                      <img 
                        src={formatGoogleDriveImageUrl(q.imageUrl)} 
                        alt="Question attachment" 
                        referrerPolicy="no-referrer"
                        className="w-20 h-20 object-contain rounded-md border border-gray-200 bg-white cursor-pointer"
                        onClick={() => window.open(formatGoogleDriveImageUrl(q.imageUrl), '_blank')}
                      />
                    </div>
                  )}
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
              );
            })
          ) : (
            <div className="text-center py-6 text-gray-500">
              No question details available for this exam.
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default ExamResults;
