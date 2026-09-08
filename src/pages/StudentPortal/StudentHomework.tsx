import React, { useState, useEffect } from 'react';
import { FileText, Calendar, MessageCircle, ExternalLink } from 'lucide-react';
import { db } from '../../config/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import MarkdownRenderer from '../../components/common/MarkdownRenderer';
import './StudentPortal.css';

const StudentHomework: React.FC = () => {
  const { user } = useAuth();
  const [homeworkList, setHomeworkList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.id) fetchHomework();
  }, [user]);

  const fetchHomework = async () => {
    setIsLoading(true);
    try {
      const userSnap = await getDoc(doc(db, 'users', user!.id));
      if (userSnap.exists()) {
        const uData = userSnap.data();
        const batchIds = uData.batchIds || (uData.batchId ? [uData.batchId] : ['all']);
        
        const hwSnap = await getDocs(collection(db, 'homeworks'));
        const list: any[] = [];
        hwSnap.forEach(d => {
          const data = d.data();
          if (data.status === 'draft') return;
          const isAssigned = !data.batchId || data.batchId === 'all' || batchIds.includes(data.batchId);
          if (isAssigned) {
            let due = 'Flexible';
            if (data.dueDate) {
              const date = data.dueDate.toDate ? data.dueDate.toDate() : new Date(data.dueDate);
              due = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            }
            list.push({
              id: d.id,
              ...data,
              due
            });
          }
        });
        
        setHomeworkList(list);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOnWhatsApp = (hw: any) => {
    const studentName = user?.name || 'Student';
    const msg = `*Speak Hub Academy - Homework Submission*\n\n` +
      `👤 *Student Name:* ${studentName}\n` +
      `📚 *Topic:* ${hw.title}\n` +
      `📅 *Due Date:* ${hw.due}\n\n` +
      `_Hello Teacher, I have completed my homework. Please check my attached voice recording / photos / notes!_`;

    const rawPhone = hw.whatsappNumber || hw.teacherPhone || '9970964742';
    const cleanPhone = String(rawPhone).replace(/[^0-9]/g, '');
    const phoneWithCode = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    window.open(`https://wa.me/${phoneWithCode}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="sp-container">
      <div className="sp-header">
        <h1 className="sp-greeting">My Homework</h1>
        <p className="sp-subtitle">View and complete your assigned practice worksheets and homework.</p>
      </div>

      <div className="sp-section mt-4">
        {isLoading ? (
          <p className="text-gray-500 text-center py-8">Loading homework...</p>
        ) : homeworkList.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-xl shadow-sm border border-gray-100">
            <FileText size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">No homework assigned yet.</p>
          </div>
        ) : (
          homeworkList.map((hw) => (
            <div key={hw.id} className="sp-card hw-card mb-6 p-6 bg-white rounded-2xl border border-gray-200 shadow-sm">
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                    <FileText size={24}/>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{hw.title}</h3>
                    <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                      <Calendar size={13} /> Due: <span className="font-semibold text-slate-700">{hw.due}</span>
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleSendOnWhatsApp(hw)}
                  className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  <MessageCircle size={15} /> Submit on WhatsApp
                </button>
              </div>

              {/* Formatted Markdown Content */}
              <div className="mt-4 pt-2">
                <MarkdownRenderer content={hw.instructions || hw.description || 'No instructions provided.'} />
              </div>

              {/* Attachments if any */}
              {hw.attachmentUrl && (
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2">
                  <a
                    href={hw.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold hover:bg-rose-100"
                  >
                    <FileText size={14} /> Open Worksheet PDF <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default StudentHomework;
