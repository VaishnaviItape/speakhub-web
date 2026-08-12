import React, { useState, useEffect } from 'react';
import { 
  Download, 
  TrendingUp, 
  IndianRupee, 
  AlertCircle, 
  Search, 
  MessageCircle, 
  Calendar, 
  Printer, 
  CheckCircle2, 
  UserX,
  CreditCard,
  RefreshCw
} from 'lucide-react';
import { db } from '../../config/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import type { FeeTransaction, User, Course } from '../../types/models';
import '../../components/ui/TableStyles.css';

interface DefaulterRecord {
  studentId: string;
  studentName: string;
  phone?: string;
  courseName: string;
  monthlyFee: number;
  joiningDate?: string;
  lastPaidDate?: string;
  lastPaidMonth?: string;
  nextDueDate: string;
  status: 'overdue' | 'due_soon' | 'up_to_date';
  daysOverdue: number;
  pendingAmount: number;
}

interface ExpandedTransactionRecord extends FeeTransaction {
  studentName: string;
  courseName: string;
}

const FeeReports: React.FC = () => {
  const [activeReportTab, setActiveReportTab] = useState<'pending' | 'history'>('pending');
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dueFilter, setDueFilter] = useState<'all' | 'overdue' | 'this_month'>('all');

  // Analytics Metrics
  const [totalCollection, setTotalCollection] = useState(0);
  const [thisMonthCollection, setThisMonthCollection] = useState(0);
  const [totalPendingAmount, setTotalPendingAmount] = useState(0);
  const [defaulterCount, setDefaulterCount] = useState(0);

  // Lists
  const [defaulterList, setDefaulterList] = useState<DefaulterRecord[]>([]);
  const [transactionList, setTransactionList] = useState<ExpandedTransactionRecord[]>([]);

  useEffect(() => {
    fetchReportData();
  }, []);

  const formatJoiningDateDisplay = (joiningDateVal: any): { display: string; raw: string } => {
    if (!joiningDateVal) {
      return { display: '01 Jan 2026', raw: '2026-01-01' };
    }
    let d: Date;
    if (joiningDateVal.seconds) {
      d = new Date(joiningDateVal.seconds * 1000);
    } else if (typeof joiningDateVal === 'string') {
      d = new Date(joiningDateVal);
    } else if (joiningDateVal instanceof Date) {
      d = joiningDateVal;
    } else {
      d = new Date('2026-01-01');
    }

    if (isNaN(d.getTime())) {
      return { display: '01 Jan 2026', raw: '2026-01-01' };
    }

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    const display = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const raw = `${year}-${month}-${day}`;
    return { display, raw };
  };

  const calculateNextDueDateString = (baseDateStr: string, monthsToAdd: number): { display: string; iso: string } => {
    let base = new Date(baseDateStr);
    if (isNaN(base.getTime())) {
      base = new Date();
    }
    
    const target = new Date(base.getFullYear(), base.getMonth() + monthsToAdd, base.getDate());
    
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const day = String(target.getDate()).padStart(2, '0');

    const display = target.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const iso = `${year}-${month}-${day}`;
    return { display, iso };
  };

  const fetchReportData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Students
      const uSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student'), where('status', '==', 'active')));
      const usersList = uSnap.docs.map(d => ({ documentId: d.id, ...d.data() } as User));

      // 2. Fetch Courses
      const cSnap = await getDocs(collection(db, 'courses'));
      const coursesList = cSnap.docs.map(d => ({ documentId: d.id, ...d.data() } as Course));

      // 3. Fetch Transactions
      const transSnap = await getDocs(collection(db, 'fee_transactions'));
      const transactions = transSnap.docs.map(d => d.data() as FeeTransaction);

      let total = 0;
      let monthTotal = 0;
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      // Expanded Transactions list
      const expandedTxList: ExpandedTransactionRecord[] = [];

      transactions.forEach((d) => {
        total += d.amountPaid || 0;
        
        let pt: Date;
        if (d.paymentDate instanceof Date) {
          pt = d.paymentDate;
        } else if ((d.paymentDate as any)?.seconds) {
          pt = new Date((d.paymentDate as any).seconds * 1000);
        } else {
          pt = new Date();
        }

        if (pt.getMonth() === now.getMonth() && pt.getFullYear() === now.getFullYear()) {
          monthTotal += d.amountPaid || 0;
        }

        const student = usersList.find(u => u.documentId === d.studentId);
        const course = coursesList.find(c => c.documentId === d.courseId);

        expandedTxList.push({
          ...d,
          paymentDate: pt,
          studentName: student?.name || 'Student',
          courseName: course?.courseName || 'Course'
        });
      });

      expandedTxList.sort((a, b) => new Date(b.paymentDate as any).getTime() - new Date(a.paymentDate as any).getTime());
      setTransactionList(expandedTxList);
      setTotalCollection(total);
      setThisMonthCollection(monthTotal);

      // 4. Calculate Pending Dues per Student
      let totalPending = 0;
      let defaulters = 0;
      const defaulterRecords: DefaulterRecord[] = [];

      usersList.forEach(student => {
        const courseId = student.courseIds?.[0] || '';
        const course = coursesList.find(c => c.documentId === courseId);
        const monthlyFee = course?.monthlyFee || 0;

        // Student's transaction history
        const studentTx = transactions
          .filter(t => t.studentId === student.documentId)
          .sort((a, b) => {
            const dA = (a.paymentDate as any)?.seconds || 0;
            const dB = (b.paymentDate as any)?.seconds || 0;
            return dB - dA;
          });

        const lastTx = studentTx[0];
        const jInfo = formatJoiningDateDisplay(student.joiningDate || (student as any).createdAt);

        let nextDueIso = lastTx?.nextDueDate || calculateNextDueDateString(jInfo.raw, 1).iso;
        let nextDueDisplay = formatJoiningDateDisplay(nextDueIso).display;

        const dueDateObj = new Date(nextDueIso);
        const isOverdue = nextDueIso < todayStr;

        let status: 'overdue' | 'due_soon' | 'up_to_date' = 'up_to_date';
        let pendingAmt = 0;
        let daysOverdue = 0;

        if (isOverdue) {
          status = 'overdue';
          const diffTime = Math.abs(now.getTime() - dueDateObj.getTime());
          daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          // Estimate months pending
          const monthsOverdue = Math.max(1, (now.getFullYear() - dueDateObj.getFullYear()) * 12 + (now.getMonth() - dueDateObj.getMonth()) + 1);
          pendingAmt = (monthlyFee > 0 ? monthlyFee : 500) * monthsOverdue;
          
          totalPending += pendingAmt;
          defaulters++;
        } else {
          // Check if due within next 7 days
          const diffTime = dueDateObj.getTime() - now.getTime();
          const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (daysLeft <= 7) {
            status = 'due_soon';
            pendingAmt = monthlyFee;
            totalPending += pendingAmt;
          }
        }

        defaulterRecords.push({
          studentId: student.documentId!,
          studentName: student.name || student.email || 'Student',
          phone: student.phone || student.mobile || '',
          courseName: course?.courseName || 'Unassigned',
          monthlyFee: monthlyFee,
          joiningDate: jInfo.display,
          lastPaidDate: lastTx?.paymentDate ? new Date((lastTx.paymentDate as any).seconds * 1000).toLocaleDateString() : undefined,
          lastPaidMonth: lastTx?.billingPeriod,
          nextDueDate: nextDueDisplay,
          status,
          daysOverdue,
          pendingAmount: pendingAmt
        });
      });

      // Sort by status (overdue first) then pending amount
      defaulterRecords.sort((a, b) => {
        if (a.status === 'overdue' && b.status !== 'overdue') return -1;
        if (a.status !== 'overdue' && b.status === 'overdue') return 1;
        return b.pendingAmount - a.pendingAmount;
      });

      setDefaulterList(defaulterRecords);
      setTotalPendingAmount(totalPending);
      setDefaulterCount(defaulters);

    } catch (e) {
      console.error("Error fetching fee analytics", e);
    } finally {
      setIsLoading(false);
    }
  };

  const openWhatsAppReminder = (phone: string | undefined, name: string, amount: number, dueDate: string) => {
    if(!phone) { 
      alert("No phone number registered for this student."); 
      return; 
    }
    const msg = `Hello ${name},\n\nThis is a gentle reminder from Speak Hub Academy that your fee payment of ₹${amount} was due on ${dueDate}. Please clear your pending dues at the earliest.\n\nThank you!`;
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleExportCSV = () => {
    if (defaulterList.length === 0) {
      alert("No fee report data to export.");
      return;
    }

    const headers = ["Student Name", "Phone", "Course Name", "Monthly Fee", "Joining Date", "Last Paid Month", "Next Due Date", "Status", "Pending Dues (₹)"];
    const rows = filteredDefaulters.map(d => [
      `"${d.studentName.replace(/"/g, '""')}"`,
      `"${(d.phone || '').replace(/"/g, '""')}"`,
      `"${d.courseName.replace(/"/g, '""')}"`,
      d.monthlyFee,
      `"${d.joiningDate || ''}"`,
      `"${d.lastPaidMonth || 'No Payment'}"`,
      `"${d.nextDueDate}"`,
      `"${d.status.toUpperCase()}"`,
      d.pendingAmount
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Fee_Dues_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintReport = () => {
    window.print();
  };

  const filteredDefaulters = defaulterList.filter(item => {
    const matchesSearch = item.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.courseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (item.phone && item.phone.includes(searchQuery));
    if (dueFilter === 'overdue') return matchesSearch && item.status === 'overdue';
    if (dueFilter === 'this_month') return matchesSearch && (item.status === 'overdue' || item.status === 'due_soon');
    return matchesSearch;
  });

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header flex justify-between items-center w-full mb-4">
        <div>
          <h1 className="page-title">Fee Analytics & Dues Report</h1>
          <div className="breadcrumbs">
            <span>Finance</span> <span className="separator">/</span> <span className="current">Analytics Report</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            type="button" 
            onClick={fetchReportData} 
            className="btn bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-2 rounded-lg flex items-center gap-2 text-xs transition-all cursor-pointer"
          >
            <RefreshCw size={14} /> Refresh Data
          </button>

          <button 
            type="button" 
            onClick={handleExportCSV} 
            className="btn bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2 text-xs transition-all cursor-pointer shadow-sm"
          >
            <Download size={14} /> Export Dues CSV
          </button>

          <button 
            type="button" 
            onClick={handlePrintReport} 
            className="btn bg-slate-700 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2 text-xs transition-all cursor-pointer shadow-sm"
          >
            <Printer size={14} /> Print Report
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-slate-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
          Calculating fee collections and pending dues analytics...
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top 4 Analytics Overview Cards */}
          <div className="metric-cards-grid">
            {/* Card 1: Total Collections */}
            <div className="metric-card indigo">
              <div className="metric-card-content">
                <div className="metric-card-title">Total Collection</div>
                <div className="metric-card-value">₹{totalCollection.toLocaleString()}</div>
                <div className="metric-card-subtitle">All-time fee received</div>
              </div>
              <div className="metric-card-icon">
                <IndianRupee />
              </div>
            </div>

            {/* Card 2: This Month Collection */}
            <div className="metric-card emerald">
              <div className="metric-card-content">
                <div className="metric-card-title">This Month</div>
                <div className="metric-card-value">₹{thisMonthCollection.toLocaleString()}</div>
                <div className="metric-card-subtitle">Collected this month</div>
              </div>
              <div className="metric-card-icon">
                <TrendingUp />
              </div>
            </div>

            {/* Card 3: Total Pending Dues */}
            <div className="metric-card rose">
              <div className="metric-card-content">
                <div className="metric-card-title">Total Pending Dues</div>
                <div className="metric-card-value">₹{totalPendingAmount.toLocaleString()}</div>
                <div className="metric-card-subtitle">Uncollected fees</div>
              </div>
              <div className="metric-card-icon">
                <AlertCircle />
              </div>
            </div>

            {/* Card 4: Fee Defaulters Count */}
            <div className="metric-card amber">
              <div className="metric-card-content">
                <div className="metric-card-title">Overdue Students</div>
                <div className="metric-card-value">{defaulterCount} Students</div>
                <div className="metric-card-subtitle">Pending payment list</div>
              </div>
              <div className="metric-card-icon">
                <UserX />
              </div>
            </div>
          </div>

          {/* 2 Navigation Tabs: Pending Dues Sheet vs Payment History */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 w-fit">
            <button
              type="button"
              onClick={() => setActiveReportTab('pending')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeReportTab === 'pending'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-md border border-slate-200/60 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <AlertCircle size={16} />
              📋 Pending Dues & Defaulters Sheet ({defaulterList.filter(d => d.status === 'overdue').length})
            </button>

            <button
              type="button"
              onClick={() => setActiveReportTab('history')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeReportTab === 'history'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-md border border-slate-200/60 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CreditCard size={16} />
              💳 Payment History ({transactionList.length})
            </button>
          </div>

          {/* REPORT TAB 1: PENDING DUES & DEFAULTERS */}
          {activeReportTab === 'pending' ? (
            <div className="premium-table-container">
              {/* Header & Filter Controls */}
              <div className="premium-table-header">
                <div className="premium-title-wrapper">
                  <div className="premium-title-icon">
                    <AlertCircle size={20} />
                  </div>
                  <h3 className="premium-title">Pending Fee Dues Roster</h3>
                  <span className="text-xs bg-rose-100 text-rose-800 font-bold px-3 py-1 rounded-full border border-rose-200 shadow-sm">
                    ₹{filteredDefaulters.reduce((acc, curr) => acc + curr.pendingAmount, 0).toLocaleString()} Total Dues
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  {/* Status Filter Pills */}
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setDueFilter('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        dueFilter === 'all'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-300 hover:text-indigo-600'
                      }`}
                    >
                      All Students ({defaulterList.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => setDueFilter('overdue')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        dueFilter === 'overdue'
                          ? 'bg-rose-600 text-white shadow-sm'
                          : 'text-rose-700 dark:text-rose-400 hover:bg-rose-50'
                      }`}
                    >
                      Overdue Only ({defaulterList.filter(d => d.status === 'overdue').length})
                    </button>
                  </div>

                  {/* Search Bar */}
                  <div className="search-wrapper" style={{ minWidth: '220px' }}>
                    <Search className="search-icon" size={16} />
                    <input
                      type="text"
                      placeholder="Search student or course..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="premium-search-input"
                    />
                  </div>
                </div>
              </div>

              {filteredDefaulters.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-2" />
                  <p className="font-bold text-slate-800 dark:text-white">All Clear! No pending fee dues found.</p>
                  <p className="text-xs text-slate-500 mt-1">All active students are up-to-date with their fee payments.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="premium-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Student Name</th>
                        <th>Course Name</th>
                        <th>Joining Date</th>
                        <th>Last Paid</th>
                        <th>Next Due Date</th>
                        <th style={{ textAlign: 'center' }}>Due Status</th>
                        <th>Pending Dues</th>
                        <th style={{ textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDefaulters.map((item, idx) => (
                        <tr key={item.studentId}>
                          <td style={{ color: 'var(--text-light)', fontWeight: '600' }}>{idx + 1}</td>
                          <td>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-300 font-bold flex items-center justify-center text-xs shadow-sm border border-rose-200 dark:border-rose-800">
                                {item.studentName ? item.studentName.charAt(0).toUpperCase() : 'S'}
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 dark:text-white block">{item.studentName}</span>
                                {item.phone && <span className="text-xs text-slate-400 font-mono">{item.phone}</span>}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="font-semibold text-blue-800 dark:text-blue-400 block">{item.courseName}</span>
                            <span className="text-xs text-slate-500">₹{item.monthlyFee} / mo</span>
                          </td>
                          <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                            {item.joiningDate || '01 Jan 2026'}
                          </td>
                          <td>
                            {item.lastPaidMonth ? (
                              <div>
                                <span className="font-bold text-slate-700 dark:text-slate-300 block">{item.lastPaidMonth}</span>
                                <span className="text-xs text-slate-400">On {item.lastPaidDate}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">No payments yet</span>
                            )}
                          </td>
                          <td>
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                              <Calendar size={14} className="text-slate-400" />
                              {item.nextDueDate}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {item.status === 'overdue' ? (
                              <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800 shadow-sm inline-flex items-center gap-1">
                                🔴 Overdue ({item.daysOverdue} days)
                              </span>
                            ) : item.status === 'due_soon' ? (
                              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shadow-sm inline-flex items-center gap-1">
                                🟡 Due Soon
                              </span>
                            ) : (
                              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-sm inline-flex items-center gap-1">
                                🟢 Up To Date
                              </span>
                            )}
                          </td>
                          <td style={{ fontWeight: '800', color: item.pendingAmount > 0 ? '#dc2626' : '#16a34a' }}>
                            ₹{item.pendingAmount.toLocaleString()}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => openWhatsAppReminder(item.phone, item.studentName, item.pendingAmount || item.monthlyFee, item.nextDueDate)}
                              className="btn bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 font-bold px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 mx-auto text-xs transition-all cursor-pointer"
                            >
                              <MessageCircle size={14} /> Send WhatsApp Reminder
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* REPORT TAB 2: PAYMENT HISTORY TRANSACTIONS */
            <div className="premium-table-container">
              <div className="premium-table-header">
                <div className="premium-title-wrapper">
                  <div className="premium-title-icon">
                    <CreditCard size={20} />
                  </div>
                  <h3 className="premium-title">All Completed Transactions</h3>
                  <span className="text-xs bg-indigo-100 text-indigo-800 font-bold px-3 py-1 rounded-full border border-indigo-200 shadow-sm">
                    ₹{totalCollection.toLocaleString()} Total Collected
                  </span>
                </div>

                <div className="search-wrapper" style={{ minWidth: '220px' }}>
                  <Search className="search-icon" size={16} />
                  <input
                    type="text"
                    placeholder="Search receipt no or student..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="premium-search-input"
                  />
                </div>
              </div>

              {transactionList.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  No payment transactions recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="premium-table">
                    <thead>
                      <tr>
                        <th>Receipt No</th>
                        <th>Student Name</th>
                        <th>Course</th>
                        <th>Billing Month / Period</th>
                        <th>Payment Date</th>
                        <th>Mode</th>
                        <th>Amount Paid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactionList
                        .filter(t => t.receiptNumber?.toLowerCase().includes(searchQuery.toLowerCase()) || t.studentName.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map((t, idx) => (
                          <tr key={t.documentId || idx}>
                            <td className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                              {t.receiptNumber}
                            </td>
                            <td style={{ fontWeight: '700', color: 'var(--text-main)' }}>
                              {t.studentName}
                            </td>
                            <td style={{ color: 'var(--text-muted)' }}>
                              {t.courseName}
                            </td>
                            <td>
                              <span className="font-bold text-slate-700 dark:text-slate-300 text-xs">
                                {t.billingPeriod || 'Monthly Fee'}
                              </span>
                            </td>
                            <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              {t.paymentDate instanceof Date ? t.paymentDate.toLocaleDateString() : 'Today'}
                            </td>
                            <td>
                              <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                {t.paymentMode}
                              </span>
                            </td>
                            <td style={{ fontWeight: '800', color: '#16a34a' }}>
                              ₹{t.amountPaid.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FeeReports;
