import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, FileText, Download, Edit } from 'lucide-react';
import DataTable, { type Column } from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import Input from '../../components/forms/Input';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import type { Homework, HomeworkSubmission } from '../../types/models';

const HomeworkReview: React.FC = () => {
  const { homeworkId } = useParams<{ homeworkId: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  
  const [homework, setHomework] = useState<Homework | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]); 
  const [stats, setStats] = useState({ assigned: 0, submitted: 0, pending: 0, late: 0, reviewed: 0 });

  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [marks, setMarks] = useState<number | ''>('');
  const [teacherComments, setTeacherComments] = useState('');
  const [correctionNotes, setCorrectionNotes] = useState('');

  useEffect(() => {
    if (homeworkId) fetchData();
  }, [homeworkId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const hwDoc = await getDoc(doc(db, 'homeworks', homeworkId!));
      if (!hwDoc.exists()) return;
      const hwData = { documentId: hwDoc.id, ...hwDoc.data() } as Homework;
      setHomework(hwData);

      const sQuery = query(collection(db, 'users'), where('batchIds', 'array-contains', hwData.batchId), where('status', '==', 'active'));
      const sSnap = await getDocs(sQuery);
      const studentList = sSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const subQuery = query(collection(db, 'homework_submissions'), where('homeworkId', '==', homeworkId));
      const subSnap = await getDocs(subQuery);
      const subList = subSnap.docs.map(d => ({ documentId: d.id, ...d.data() } as HomeworkSubmission));

      const merged: any[] = [];
      let pending = 0, submitted = 0, late = 0, reviewed = 0;

      studentList.forEach(student => {
        const sub = subList.find(s => s.studentId === student.id);
        if (sub) {
          merged.push({ ...student, submission: sub });
          if (sub.submissionStatus === 'reviewed') reviewed++;
          else if (sub.submissionStatus === 'late') late++;
          else submitted++;
        } else {
          merged.push({ ...student, submission: null });
          pending++;
        }
      });

      setSubmissions(merged);
      setStats({ assigned: studentList.length, submitted, pending, late, reviewed });

    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenReview = (row: any) => {
    setSelectedSub(row);
    setMarks(row.submission?.marks || '');
    setTeacherComments(row.submission?.teacherComments || '');
    setCorrectionNotes(row.submission?.correctionNotes || '');
    setIsReviewOpen(true);
  };

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSub?.submission?.documentId) return;

    try {
      const subRef = doc(db, 'homework_submissions', selectedSub.submission.documentId);
      await updateDoc(subRef, {
        marks: Number(marks),
        teacherComments,
        correctionNotes,
        submissionStatus: 'reviewed'
      });
      setIsReviewOpen(false);
      fetchData(); // Refresh data
    } catch (e) {
      console.error("Error saving review", e);
      alert("Error saving review.");
    }
  };

  const getMediaType = (url: string) => {
    if (!url) return 'document';
    const cleanUrl = url.split('?')[0].toLowerCase();
    if (cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.mov') || cleanUrl.endsWith('.avi')) return 'video';
    if (cleanUrl.endsWith('.mp3') || cleanUrl.endsWith('.wav') || cleanUrl.endsWith('.aac') || cleanUrl.endsWith('.m4a') || cleanUrl.endsWith('.m4v')) return 'audio'; // Wait, m4v is video, let's keep it simple.
    // Let's do a more robust check on the original name
    if (cleanUrl.includes('.mp4') || cleanUrl.includes('.mov') || cleanUrl.includes('.avi')) return 'video';
    if (cleanUrl.includes('.mp3') || cleanUrl.includes('.wav') || cleanUrl.includes('.aac') || cleanUrl.includes('.m4a')) return 'audio';
    return 'document';
  };

  const renderAttachment = (url: string, label: string) => {
    const type = getMediaType(url);
    return (
      <div className="mb-4 w-full" key={url}>
        <div className="text-sm text-gray-500 font-bold mb-1">{label}:</div>
        {type === 'video' ? (
          <video controls className="w-full max-w-md rounded border border-gray-300">
            <source src={url} />
            Your browser does not support the video tag.
          </video>
        ) : type === 'audio' ? (
          <audio controls className="w-full max-w-md">
            <source src={url} />
            Your browser does not support the audio element.
          </audio>
        ) : (
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-3 py-2 rounded border border-blue-200 hover:bg-blue-100">
            <Download size={14} /> Download File
          </a>
        )}
      </div>
    );
  };

  const columns: Column<any>[] = [
    { key: 'name', header: 'Student Name', render: (row) => <span className="font-medium">{row.name}</span> },
    { 
      key: 'status', 
      header: 'Status', 
      render: (row) => {
        const status = row.submission?.submissionStatus || 'pending';
        let badgeClass = 'bg-gray-100 text-gray-800';
        if (status === 'submitted') badgeClass = 'bg-blue-100 text-blue-800';
        if (status === 'reviewed') badgeClass = 'bg-green-100 text-green-800';
        if (status === 'late' || status === 'overdue') badgeClass = 'bg-red-100 text-red-800';
        return <span className={`px-2 py-1 rounded text-xs font-bold ${badgeClass}`}>{status.toUpperCase()}</span>;
      }
    },
    { 
      key: 'submittedAt', 
      header: 'Submission Time', 
      render: (row) => row.submission ? new Date(row.submission.submittedAt?.toDate?.() || row.submission.submittedAt).toLocaleString() : '-' 
    },
    { 
      key: 'marks', 
      header: 'Marks', 
      render: (row) => row.submission?.marks !== undefined ? <span className="font-bold">{row.submission.marks} / {homework?.maximumMarks}</span> : '-' 
    },
    {
      key: 'actions',
      header: 'Review Action',
      render: (row) => row.submission ? (
        <button className="text-blue-600 hover:text-blue-800 flex items-center gap-1 font-bold text-sm" onClick={() => handleOpenReview(row)}>
          <Edit size={16} /> Evaluate
        </button>
      ) : <span className="text-gray-400 italic text-sm">Not Submitted</span>
    }
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-gray-100 rounded-full" onClick={() => navigate('/homework')}>
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="page-title">Review Submissions</h1>
            <div className="breadcrumbs">
              <span>Homework</span> <span className="separator">/</span> <span className="current">{homework?.title || 'Loading...'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center">
          <div className="text-sm text-gray-500 mb-1">Total Assigned</div>
          <div className="text-2xl font-bold text-gray-800">{stats.assigned}</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center">
          <div className="text-sm text-gray-500 mb-1">Pending</div>
          <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center">
          <div className="text-sm text-gray-500 mb-1">Submitted</div>
          <div className="text-2xl font-bold text-blue-600">{stats.submitted}</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center">
          <div className="text-sm text-gray-500 mb-1">Late Submissions</div>
          <div className="text-2xl font-bold text-red-600">{stats.late}</div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 text-center bg-green-50">
          <div className="text-sm text-green-700 mb-1">Reviewed</div>
          <div className="text-2xl font-bold text-green-800">{stats.reviewed}</div>
        </div>
      </div>

      <DataTable 
        title="Student Submissions" 
        data={submissions} 
        columns={columns} 
        searchPlaceholder="Search student..."
        isLoading={isLoading}
      />

      {/* Evaluate Modal */}
      <Modal isOpen={isReviewOpen} onClose={() => setIsReviewOpen(false)} title={`Evaluate: ${selectedSub?.name}`}>
        <form onSubmit={handleSaveReview} className="modal-form" style={{maxHeight: '75vh', overflowY: 'auto', paddingRight: '10px'}}>
          
          <div className="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-200">
            <h4 className="font-bold text-gray-800 mb-4 border-b pb-2">Student's Work</h4>
            
            {selectedSub?.submission?.textAnswer && (
              <div className="mb-4">
                <span className="text-sm text-gray-500 font-bold">Text Answer:</span>
                <div className="mt-1 p-3 bg-white border border-gray-300 rounded text-gray-800 whitespace-pre-wrap">
                  {selectedSub.submission.textAnswer}
                </div>
              </div>
            )}

            {(selectedSub?.submission?.submissionUrl || (selectedSub?.submission?.multipleAttachments?.length > 0)) ? (
              <div className="mb-4">
                <span className="text-sm text-gray-500 font-bold block mb-2">Attachments:</span>
                <div className="flex flex-col gap-4">
                  {selectedSub?.submission?.submissionUrl && renderAttachment(selectedSub.submission.submissionUrl, 'Main Submission')}
                  {selectedSub?.submission?.multipleAttachments?.map((url: string, i: number) => renderAttachment(url, `Attachment ${i+1}`))}
                </div>
              </div>
            ) : null}

            {selectedSub?.submission?.remarks && (
              <div>
                <span className="text-sm text-gray-500 font-bold">Student Remarks:</span>
                <p className="mt-1 text-sm italic text-gray-600">"{selectedSub.submission.remarks}"</p>
              </div>
            )}
          </div>

          <div className="bg-green-50 p-4 rounded-lg mb-4 border border-green-200">
            <h4 className="font-bold text-green-800 mb-4 border-b border-green-200 pb-2">Teacher Evaluation</h4>
            
            <div className="w-1/3 mb-4">
              <Input 
                label={`Marks (out of ${homework?.maximumMarks})`} 
                type="number" 
                max={homework?.maximumMarks}
                value={marks.toString()} 
                onChange={(e) => setMarks(Number(e.target.value))} 
                required 
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Correction Notes</label>
              <textarea 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg min-h-[80px]"
                placeholder="List specific mistakes or corrections..."
                value={correctionNotes}
                onChange={(e) => setCorrectionNotes(e.target.value)}
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">General Feedback & Comments</label>
              <textarea 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg min-h-[80px]"
                placeholder="Overall encouragement or feedback..."
                value={teacherComments}
                onChange={(e) => setTeacherComments(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn bg-gray-200 text-gray-800" onClick={() => setIsReviewOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary flex items-center gap-2">
              <CheckCircle size={16} /> Save & Mark Reviewed
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
};

export default HomeworkReview;
