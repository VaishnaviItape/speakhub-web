import React, { useState, useEffect } from 'react';
import { FileText, Calendar, CheckCircle } from 'lucide-react';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
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
        const batchIds = uData.batchIds || [];
        
        if (batchIds.length > 0) {
          const hwQ = query(
            collection(db, 'homework'), 
            where('batchId', 'in', batchIds)
          );
          const hwSnap = await getDocs(hwQ);
          const list: any[] = [];
          hwSnap.forEach(d => {
            const data = d.data();
            let due = 'No Due Date';
            if (data.dueDate) {
               const date = data.dueDate.toDate ? data.dueDate.toDate() : new Date(data.dueDate);
               due = date.toLocaleDateString();
            }
            list.push({
              id: d.id,
              ...data,
              due
            });
          });
          
          setHomeworkList(list);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="sp-container">
      <div className="sp-header">
        <h1 className="sp-greeting">My Homework</h1>
        <p className="sp-subtitle">View your assigned homework.</p>
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
            <div key={hw.id} className="sp-card hw-card mb-4">
              <div className="hw-icon"><FileText size={24} className="text-blue-600"/></div>
              <div className="hw-info">
                <h4 className="text-lg font-bold text-[#2b3674]">{hw.title}</h4>
                <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                  <Calendar size={14} /> Due: <span className="font-semibold">{hw.due}</span>
                </p>
                {hw.topic && (
                  <p className="text-xs bg-blue-50 text-blue-600 inline-block px-2 py-1 rounded mt-2 font-medium">
                    {hw.topic}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default StudentHomework;
