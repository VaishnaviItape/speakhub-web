import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle2, XCircle, Clock, UserCheck, Award } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import '../../components/ui/TableStyles.css';

interface AttendanceLog {
  documentId: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'leave';
  batchName?: string;
  remarks?: string;
  markedBy?: string;
}

const StudentAttendance: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.id) fetchStudentAttendance();
  }, [user]);

  const fetchStudentAttendance = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      // Query attendance collection for this studentId
      const q = query(collection(db, 'attendance'), where('studentId', '==', user.id));
      const snapshot = await getDocs(q);

      const batchNamesMap: { [batchId: string]: string } = {};

      const list: AttendanceLog[] = [];
      for (const d of snapshot.docs) {
        const data = d.data();
        let bName = batchNamesMap[data.batchId];

        if (!bName && data.batchId) {
          try {
            const bSnap = await getDoc(doc(db, 'batches', data.batchId));
            if (bSnap.exists()) {
              bName = bSnap.data().batchName || '';
              batchNamesMap[data.batchId] = bName;
            }
          } catch (e) {}
        }

        list.push({
          documentId: d.id,
          date: data.date,
          status: data.status || 'present',
          batchName: bName || data.batchId,
          remarks: data.remarks || '',
          markedBy: data.markedBy || ''
        });
      }

      // Sort logs by date descending
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setLogs(list);
    } catch (error) {
      console.error("Error fetching student attendance:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const presentCount = logs.filter(l => l.status === 'present').length;
  const absentCount = logs.filter(l => l.status === 'absent').length;
  const lateCount = logs.filter(l => l.status === 'late' || l.status === 'leave').length;
  const totalCount = logs.length;
  const attendanceRate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 100;

  return (
    <div className="page-container">
      {/* Title */}
      <div className="page-header mb-4">
        <div>
          <h1 className="page-title">My Attendance Record</h1>
          <div className="breadcrumbs">
            <span>Student Portal</span> <span className="separator">/</span> <span className="current">Attendance</span>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-5 rounded-xl border border-purple-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-100 text-purple-700 rounded-xl">
            <Award size={28} />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Attendance Rate</div>
            <div className="text-2xl font-bold text-purple-900">{attendanceRate}%</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-green-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-green-100 text-green-700 rounded-xl">
            <CheckCircle2 size={28} />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Total Days Present</div>
            <div className="text-2xl font-bold text-green-700">{presentCount}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-red-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-red-100 text-red-700 rounded-xl">
            <XCircle size={28} />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Total Days Absent</div>
            <div className="text-2xl font-bold text-red-700">{absentCount}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-amber-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-100 text-amber-700 rounded-xl">
            <Clock size={28} />
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">Late / Leave Days</div>
            <div className="text-2xl font-bold text-amber-700">{lateCount}</div>
          </div>
        </div>
      </div>

      {/* Attendance History Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
            <Calendar size={18} className="text-indigo-600" /> Attendance History
          </h3>
          <span className="text-xs font-semibold text-gray-500">Total {logs.length} Records</span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
            Loading your attendance records...
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No attendance records found yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200 text-xs text-gray-700 font-bold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Batch</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Remarks</th>
                  <th className="py-3.5 px-4">Marked By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {logs.map((log) => (
                  <tr key={log.documentId} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-gray-900">
                      {new Date(log.date).toLocaleDateString('en-GB', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-gray-700">{log.batchName || 'General Batch'}</td>
                    <td className="py-3.5 px-4">
                      {log.status === 'present' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
                          <CheckCircle2 size={14} /> Present
                        </span>
                      )}
                      {log.status === 'absent' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                          <XCircle size={14} /> Absent
                        </span>
                      )}
                      {log.status === 'late' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          <Clock size={14} /> Late
                        </span>
                      )}
                      {log.status === 'leave' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                          <UserCheck size={14} /> Leave
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-gray-600">{log.remarks || '-'}</td>
                    <td className="py-3.5 px-4 text-xs text-gray-500 font-medium">{log.markedBy || 'Teacher'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentAttendance;
