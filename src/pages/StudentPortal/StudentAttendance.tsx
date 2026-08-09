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
    <div className="page-container p-6 bg-gray-50/50 min-h-screen">
      {/* Title */}
      <div className="page-header mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">My Attendance Record</h1>
          <div className="breadcrumbs mt-2">
            <span>Student Portal</span> <span className="separator">/</span> <span className="current font-semibold text-indigo-600">Attendance</span>
          </div>
        </div>
      </div>

      {/* Premium Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 rounded-3xl shadow-xl shadow-indigo-200 flex items-center gap-5 text-white transform transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
          <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md border border-white/10">
            <Award size={32} className="text-white" />
          </div>
          <div>
            <div className="text-xs text-indigo-100 font-bold tracking-wider uppercase mb-1">Attendance Rate</div>
            <div className="text-4xl font-extrabold">{attendanceRate}%</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 rounded-3xl shadow-xl shadow-teal-200 flex items-center gap-5 text-white transform transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
          <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md border border-white/10">
            <CheckCircle2 size={32} className="text-white" />
          </div>
          <div>
            <div className="text-xs text-emerald-100 font-bold tracking-wider uppercase mb-1">Total Present</div>
            <div className="text-4xl font-extrabold">{presentCount}</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-rose-500 to-red-600 p-6 rounded-3xl shadow-xl shadow-rose-200 flex items-center gap-5 text-white transform transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
          <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md border border-white/10">
            <XCircle size={32} className="text-white" />
          </div>
          <div>
            <div className="text-xs text-rose-100 font-bold tracking-wider uppercase mb-1">Total Absent</div>
            <div className="text-4xl font-extrabold">{absentCount}</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-orange-500 p-6 rounded-3xl shadow-xl shadow-amber-200 flex items-center gap-5 text-white transform transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
          <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-md border border-white/10">
            <Clock size={32} className="text-white" />
          </div>
          <div>
            <div className="text-xs text-amber-100 font-bold tracking-wider uppercase mb-1">Late / Leave</div>
            <div className="text-4xl font-extrabold">{lateCount}</div>
          </div>
        </div>
      </div>

      {/* Attendance History Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl shadow-gray-200/50 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-lg flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <Calendar size={20} />
            </div>
            Attendance History
          </h3>
          <span className="px-4 py-1.5 bg-gray-100 text-gray-600 font-bold text-xs rounded-full">Total {logs.length} Records</span>
        </div>

        {isLoading ? (
          <div className="p-16 text-center text-gray-500">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            Loading your attendance records...
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center text-gray-500 flex flex-col items-center">
             <Calendar size={48} className="text-gray-300 mb-4" />
             <p className="text-lg font-medium">No attendance records found yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-gray-100 text-xs text-gray-400 font-extrabold uppercase tracking-widest">
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-6">Batch</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Remarks</th>
                  <th className="py-4 px-6">Marked By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm">
                {logs.map((log) => (
                  <tr key={log.documentId} className="hover:bg-indigo-50/30 transition-colors group">
                    <td className="py-4 px-6 font-bold text-gray-800">
                      {new Date(log.date).toLocaleDateString('en-GB', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="py-4 px-6 font-medium text-gray-600">{log.batchName || 'General Batch'}</td>
                    <td className="py-4 px-6">
                      {log.status === 'present' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 size={14} /> Present
                        </span>
                      )}
                      {log.status === 'absent' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          <XCircle size={14} /> Absent
                        </span>
                      )}
                      {log.status === 'late' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          <Clock size={14} /> Late
                        </span>
                      )}
                      {log.status === 'leave' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                          <UserCheck size={14} /> Leave
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-xs text-gray-500 italic">{log.remarks || '-'}</td>
                    <td className="py-4 px-6 text-xs text-gray-800 font-semibold">{log.markedBy || 'Teacher'}</td>
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
