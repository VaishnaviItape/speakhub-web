import React, { useState, useEffect } from 'react';
import { Plus, MessageCircle, Calendar, Clock, Printer, CreditCard, Sparkles } from 'lucide-react';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import type { FeeTransaction, User, Course } from '../../types/models';
import { validatePositiveNumber } from '../../utils/validation';
import '../../components/ui/TableStyles.css';
import './Fees.css';
import ReceiptTemplate from './ReceiptTemplate';
import { useAuth } from '../../contexts/AuthContext';

interface StudentFeeRecord {
  documentId?: string;
  studentId: string;
  studentName: string;
  courseId: string;
  courseName: string;
  monthlyFee: number;
  joiningDate?: string;
  joiningDateRaw?: string;
  joiningDay?: number;
  lastPaymentDate?: Date;
  lastPaidMonth?: string;
  currentDueDate?: string;
  currentDueDateRaw?: string;
  nextDueDate?: string;
  nextDueDateRaw?: string;
}

const Fees: React.FC = () => {
  const { user } = useAuth();
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Data State
  const [students, setStudents] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [feeRecords, setFeeRecords] = useState<StudentFeeRecord[]>([]);

  // Month names constant
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Generate Month Options (Previous, Current, Next Year)
  const generateMonthOptions = () => {
    const currentYear = new Date().getFullYear();
    const options: { label: string; value: string }[] = [
      { label: 'Select Billing Month', value: '' }
    ];

    for (let y = currentYear - 1; y <= currentYear + 1; y++) {
      for (const m of monthNames) {
        const val = `${m} ${y}`;
        options.push({ label: val, value: val });
      }
    }
    return options;
  };

  const currentMonthDefault = `${monthNames[new Date().getMonth()]} ${new Date().getFullYear()}`;

  // Payment Form State
  const [paymentStudentId, setPaymentStudentId] = useState('');
  const [numberOfMonths, setNumberOfMonths] = useState<number>(1);
  const [amountPaid, setAmountPaid] = useState('');
  const [discount, setDiscount] = useState('0');
  const [lateFee, setLateFee] = useState('0');
  const [academicYear, setAcademicYear] = useState('2026-27');
  const [billingPeriod, setBillingPeriod] = useState(currentMonthDefault);
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'UPI' | 'Bank Transfer' | 'Online Gateway'>('Cash');
  const [transactionNumber, setTransactionNumber] = useState('');
  const [remarks, setRemarks] = useState('');
  const [calculatedDueDate, setCalculatedDueDate] = useState<string>('');
  const [customNextDueDate, setCustomNextDueDate] = useState<string>('');
  const [periodCoverageText, setPeriodCoverageText] = useState<string>('');

  // Receipt State
  const [printedTransaction, setPrintedTransaction] = useState<FeeTransaction | null>(null);
  
  useEffect(() => {
    fetchData();
  }, []);

  const formatJoiningDateDisplay = (joiningDateVal: any): { display: string; raw: string; day: number } => {
    if (!joiningDateVal) {
      return { display: '01 Jan 2026', raw: '2026-01-01', day: 1 };
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
      return { display: '01 Jan 2026', raw: '2026-01-01', day: 1 };
    }

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    const display = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const raw = `${year}-${month}-${day}`;
    return { display, raw, day: d.getDate() };
  };

  // Helper to calculate target due date preserving student's joining day-of-month
  const calculateNextDueFromBillingPeriod = (
    startMonthStr: string,
    monthsCount: number,
    dayOfMonth: number = 1
  ): { display: string; iso: string } => {
    if (!startMonthStr) {
      return { display: '01 Oct 2026', iso: '2026-10-01' };
    }
    const parts = startMonthStr.trim().split(' ');
    const monthIdx = monthNames.indexOf(parts[0]);
    const year = parseInt(parts[1], 10) || new Date().getFullYear();

    if (monthIdx === -1) {
      return { display: '01 Oct 2026', iso: '2026-10-01' };
    }

    // Next due month is starting billing month + monthsCount
    // e.g. Jul (6) + 2 months = Sep (8)
    const targetMonthTotal = monthIdx + monthsCount;
    const targetYear = year + Math.floor(targetMonthTotal / 12);
    const targetMonth = targetMonthTotal % 12;

    // Clamp day to max days of target month (e.g. 31 in Feb -> 28)
    const temp = new Date(targetYear, targetMonth, 1);
    const maxDays = new Date(temp.getFullYear(), temp.getMonth() + 1, 0).getDate();
    const targetDay = Math.min(dayOfMonth || 1, maxDays);

    const target = new Date(targetYear, targetMonth, targetDay);

    const yStr = target.getFullYear();
    const mStr = String(target.getMonth() + 1).padStart(2, '0');
    const dStr = String(target.getDate()).padStart(2, '0');

    const display = target.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const iso = `${yStr}-${mStr}-${dStr}`;

    return { display, iso };
  };

  // Helper to calculate period coverage text (e.g., "Aug 2026 — Sep 2026 (2 Months)")
  const getPeriodCoverageLabel = (startMonthStr: string, count: number): string => {
    if (!startMonthStr) return '';
    const parts = startMonthStr.trim().split(' ');
    if (parts.length < 2) return `${startMonthStr} (${count} ${count === 1 ? 'Month' : 'Months'})`;
    
    const startMonthIdx = monthNames.indexOf(parts[0]);
    const startYear = parseInt(parts[1], 10);
    if (startMonthIdx === -1 || isNaN(startYear)) {
      return `${startMonthStr} (${count} ${count === 1 ? 'Month' : 'Months'})`;
    }
    if (count <= 1) {
      return `${parts[0]} ${startYear} (1 Month)`;
    }
    
    const endMonthTotal = startMonthIdx + count - 1;
    const endYear = startYear + Math.floor(endMonthTotal / 12);
    const endMonthName = monthNames[endMonthTotal % 12];
    return `${parts[0]} ${startYear} — ${endMonthName} ${endYear} (${count} Months)`;
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const uSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student'), where('status', '==', 'active')));
      const usersList = uSnap.docs.map(d => ({ documentId: d.id, ...d.data() } as User));
      setStudents(usersList);

      const cSnap = await getDocs(collection(db, 'courses'));
      const coursesList = cSnap.docs.map(d => ({ documentId: d.id, ...d.data() } as Course));
      setCourses(coursesList);

      const tSnap = await getDocs(collection(db, 'fee_transactions'));
      const transactions = tSnap.docs.map(d => d.data() as FeeTransaction);

      const records: StudentFeeRecord[] = usersList.map(student => {
        const courseId = student.courseIds?.[0] || '';
        const course = coursesList.find(c => c.documentId === courseId);
        
        // Find latest transaction for this student
        const studentTx = transactions
          .filter(t => t.studentId === student.documentId)
          .sort((a, b) => {
            const dA = (a.paymentDate as any)?.seconds || 0;
            const dB = (b.paymentDate as any)?.seconds || 0;
            return dB - dA;
          });

        const lastTx = studentTx[0];
        const jInfo = formatJoiningDateDisplay(student.joiningDate || (student as any).createdAt);

        // Student's current due date: if previous payments exist, it is lastTx.nextDueDate.
        // Otherwise it is their joining date.
        let curDueDisplay = jInfo.display;
        let curDueRaw = jInfo.raw;

        if (lastTx?.nextDueDate) {
          const formattedLastNext = formatJoiningDateDisplay(lastTx.nextDueDate);
          curDueDisplay = formattedLastNext.display;
          curDueRaw = formattedLastNext.raw;
        }

        return {
          studentId: student.documentId!,
          studentName: student.name || student.email || 'Student',
          documentId: student.documentId,
          courseId: courseId,
          courseName: course?.courseName || 'Unassigned',
          monthlyFee: course?.monthlyFee || 0,
          joiningDate: jInfo.display,
          joiningDateRaw: jInfo.raw,
          joiningDay: jInfo.day,
          lastPaymentDate: lastTx?.paymentDate ? new Date((lastTx.paymentDate as any)?.seconds * 1000) : undefined,
          lastPaidMonth: lastTx?.billingPeriod,
          currentDueDate: curDueDisplay,
          currentDueDateRaw: curDueRaw,
          nextDueDate: curDueDisplay,
          nextDueDateRaw: curDueRaw
        };
      });

      setFeeRecords(records);

    } catch (e) {
      console.error("Error fetching fee data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-calculate Fee Amount, Starting Billing Month, Coverage Text, and Next Due Date
  useEffect(() => {
    if (paymentStudentId) {
      const record = feeRecords.find(r => r.studentId === paymentStudentId);
      if (record) {
        // Base course fee calculation
        const totalCalculatedAmt = (record.monthlyFee || 0) * numberOfMonths;
        setAmountPaid(totalCalculatedAmt.toString());

        // Coverage text
        const startMonth = billingPeriod || currentMonthDefault;
        const coverage = getPeriodCoverageLabel(startMonth, numberOfMonths);
        setPeriodCoverageText(coverage);

        // Calculate next due date: starting billing month + numberOfMonths
        // (e.g. Jul 2026 + 2 months = Sep 2026)
        const due = calculateNextDueFromBillingPeriod(startMonth, numberOfMonths, record.joiningDay || 1);
        setCalculatedDueDate(due.display);
        setCustomNextDueDate(due.iso);
      }
    }
  }, [paymentStudentId, numberOfMonths, billingPeriod, feeRecords]);

  // Open modal with pre-configured student info
  const handleOpenPaymentModal = (record: StudentFeeRecord) => {
    setPaymentStudentId(record.studentId);
    setNumberOfMonths(1);
    setDiscount('0');
    setLateFee('0');
    setRemarks('');

    // Pre-select billing month according to currentDueDate
    if (record.currentDueDateRaw) {
      const d = new Date(record.currentDueDateRaw);
      if (!isNaN(d.getTime())) {
        const mStr = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
        setBillingPeriod(mStr);
      }
    } else {
      setBillingPeriod(currentMonthDefault);
    }

    setIsPaymentModalOpen(true);
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    const amtVal = validatePositiveNumber(amountPaid, 'Amount Paid');
    if (!amtVal.isValid) {
      alert(amtVal.error);
      return;
    }

    if (!billingPeriod) {
      alert("Please select a billing month.");
      return;
    }

    setIsSaving(true);
    try {
      const record = feeRecords.find(r => r.studentId === paymentStudentId);
      if (!record) {
        setIsSaving(false);
        return;
      }

      const amt = Number(amountPaid);
      const disc = Math.max(0, Number(discount) || 0);
      const lf = Math.max(0, Number(lateFee) || 0);
      const netPaid = Math.max(0, amt - disc + lf);
      
      const computedDue = calculateNextDueFromBillingPeriod(billingPeriod, numberOfMonths, record.joiningDay || 1).iso;
      const finalNextDueDate = customNextDueDate || computedDue;
      const coverage = periodCoverageText || `${billingPeriod} (${numberOfMonths} ${numberOfMonths === 1 ? 'Month' : 'Months'})`;

      const newTransaction: Partial<FeeTransaction> = {
        studentId: record.studentId,
        courseId: record.courseId,
        academicYear,
        billingPeriod: coverage,
        monthsCount: numberOfMonths,
        joiningDate: record.joiningDate || '01 Jan 2026',
        nextDueDate: finalNextDueDate,
        paymentDate: serverTimestamp() as any,
        amountPaid: netPaid,
        discount: disc,
        lateFee: lf,
        paymentMode,
        transactionNumber,
        remarks: remarks || `Fee for ${numberOfMonths} month(s) (${coverage})`,
        receivedBy: user?.name || 'Admin',
        receiptNumber: 'REC-' + new Date().getFullYear() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
        status: 'PAID',
        createdAt: serverTimestamp() as any
      };

      await addDoc(collection(db, 'fee_transactions'), newTransaction);

      setIsPaymentModalOpen(false);
      setAmountPaid('');
      setDiscount('0');
      setLateFee('0');
      setTransactionNumber('');
      setRemarks('');
      setNumberOfMonths(1);
      
      // Auto trigger receipt printing with complete transaction metadata
      setPrintedTransaction({ 
        ...newTransaction, 
        paymentDate: new Date(),
        studentName: record.studentName,
        courseName: record.courseName,
        perMonthFee: record.monthlyFee
      } as any);

      setTimeout(() => {
        window.print();
        setPrintedTransaction(null);
      }, 500);

      await fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to record payment");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrintReceiptForStudent = async (row: StudentFeeRecord) => {
    try {
      const tSnap = await getDocs(query(collection(db, 'fee_transactions'), where('studentId', '==', row.studentId)));
      if (!tSnap.empty) {
        const txs = tSnap.docs.map(d => d.data() as FeeTransaction);
        txs.sort((a, b) => ((b.paymentDate as any)?.seconds || 0) - ((a.paymentDate as any)?.seconds || 0));
        setPrintedTransaction({
          ...txs[0],
          studentName: row.studentName,
          courseName: row.courseName,
          perMonthFee: row.monthlyFee
        } as any);
      } else {
        setPrintedTransaction({
          receiptNumber: 'REC-' + new Date().getFullYear() + '-DRAFT',
          studentId: row.studentId,
          courseId: row.courseId,
          studentName: row.studentName,
          courseName: row.courseName,
          academicYear: '2026-27',
          billingPeriod: row.lastPaidMonth || 'Monthly Fee',
          paymentDate: new Date(),
          amountPaid: row.monthlyFee,
          perMonthFee: row.monthlyFee,
          paymentMode: 'Cash',
          receivedBy: user?.name || 'Admin',
          nextDueDate: row.currentDueDate || '01 Oct 2026',
          status: 'PAID'
        } as any);
      }

      setTimeout(() => {
        window.print();
        setPrintedTransaction(null);
      }, 400);
    } catch (e) {
      console.error("Print receipt error:", e);
    }
  };

  const openWhatsApp = (phone: string | undefined, name: string | undefined, monthlyFee: number, dueDate?: string) => {
    if (!phone) {
      alert("No phone number registered for this student.");
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const phoneWithCode = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    
    const msg = `Dear Parents / Guardians, Students / Learners,\n\nThis is to inform you that the Spoken English / Abacus class FEE of ₹${monthlyFee || 800} for ${name || 'Student'} is to be paid on or before ${dueDate || 'due date'}.\n\nFee to be paid to:\n\nGoogle Pay:\nSpeak Hub Academy\n9970964742\n\nOR\n\nPhonePe:\n9970964742\nSpeak Hub Academy\n\nOR\n\nBank details:\nBank Name: State Bank Of India\nA/c No: 41871708652\nIFSC Code: SBIN0011701\nName: Speak Hub Academy\n\nThank you,\nSpeak Hub Academy`;
    
    window.open(`https://wa.me/${phoneWithCode}?text=${encodeURIComponent(msg)}`, 'speakhub_whatsapp');
  };

  const selectedRecord = feeRecords.find(r => r.studentId === paymentStudentId);

  // Financial preview calculation
  const totalBaseFee = Number(amountPaid) || 0;
  const numDiscount = Math.max(0, Number(discount) || 0);
  const numLateFee = Math.max(0, Number(lateFee) || 0);
  const netPayable = Math.max(0, totalBaseFee - numDiscount + numLateFee);

  const columns: Column<StudentFeeRecord>[] = [
    {
      key: 'studentName',
      header: 'Student Name',
      render: (row) => (
        <div className="flex flex-col py-1 gap-1">
          <span className="font-bold text-slate-900 dark:text-white text-sm block leading-tight">{row.studentName}</span>
          <span className="text-xs text-slate-500 font-medium block">Joined: {row.joiningDate || '01 Jan 2026'}</span>
        </div>
      )
    },
    {
      key: 'courseName',
      header: 'Assigned Course',
      render: (row) => (
        <div className="flex flex-col py-1 gap-1">
          <span className="font-semibold text-blue-800 dark:text-blue-400 text-sm block leading-tight">{row.courseName}</span>
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 block">₹{row.monthlyFee} / month</span>
        </div>
      )
    },
    {
      key: 'lastPayment',
      header: 'Last Payment',
      render: (row) => (
        <div>
          {row.lastPaymentDate ? (
            <>
              <div className="font-bold text-gray-700 dark:text-gray-300 text-xs">{row.lastPaidMonth}</div>
              <div className="text-xs text-gray-500">Paid on: {row.lastPaymentDate.toLocaleDateString('en-GB')}</div>
            </>
          ) : (
            <span className="text-gray-400 italic text-xs">No payments recorded</span>
          )}
        </div>
      )
    },
    {
      key: 'currentDueDate',
      header: 'Current Due Date',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2.5 py-1 rounded-lg w-fit">
          <Calendar size={13} />
          {row.currentDueDate || row.joiningDate || '01 Mar 2026'}
        </div>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => {
        const student = students.find(s => s.documentId === row.studentId);
        const phone = student?.phone || student?.mobile;
        return (
          <div className="flex gap-2 items-center flex-wrap">
            <button 
              className="btn btn-primary" 
              style={{padding: '5px 10px', fontSize: '12px', borderRadius: '8px'}} 
              onClick={() => handleOpenPaymentModal(row)}
            >
              Pay Fee
            </button>
            <button 
              className="btn bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold" 
              style={{padding: '5px 10px', fontSize: '12px', borderRadius: '8px', border: '1px solid #cbd5e1'}} 
              onClick={() => handlePrintReceiptForStudent(row)}
            >
              Receipt
            </button>
            <button 
              className="btn btn-outline" 
              style={{padding: '5px 10px', fontSize: '12px', color: '#16a34a', borderColor: '#16a34a', borderRadius: '8px'}} 
              onClick={() => openWhatsApp(phone, student?.name, row.monthlyFee, row.currentDueDate)}
            >
              <MessageCircle size={14} className="mr-1 inline" /> WhatsApp
            </button>
          </div>
        );
      }
    }
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Fee Collection</h1>
          <div className="breadcrumbs">
            <span>Fees</span> <span className="separator">/</span> <span className="current">Monthly Collection</span>
          </div>
        </div>
        <button 
          className="btn btn-primary flex items-center gap-2" 
          onClick={() => { 
            if(feeRecords.length > 0) { 
              handleOpenPaymentModal(feeRecords[0]);
            } 
          }}
        >
          <Plus size={16} /> Record Payment
        </button>
      </div>

      <DataTable 
        title="Student Fee Roster" 
        data={feeRecords} 
        columns={columns} 
        onRefresh={fetchData}
        searchPlaceholder="Search student name or course..."
        isLoading={isLoading}
      />

      {/* Record Payment Modal */}
      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Record Fee Collection">
        <form onSubmit={handleRecordPayment} className="modal-form" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          
          <Select 
            label="Select Student" 
            options={feeRecords.map(r => ({
              label: `${r.studentName} (${r.courseName} - ₹${r.monthlyFee}/mo | Due: ${r.currentDueDate})`, 
              value: r.studentId
            }))} 
            value={paymentStudentId}
            onChange={(e) => {
              const rec = feeRecords.find(r => r.studentId === e.target.value);
              if (rec) handleOpenPaymentModal(rec);
            }}
            required
          />

          {/* Student Info & Status Banner */}
          {selectedRecord && (
            <div className="fee-modal-student-card">
              <div className="fee-student-meta-item">
                <Calendar size={15} color="var(--primary, #e11d48)" />
                <span>Joining Date: <strong>{selectedRecord.joiningDate || '01 Jan 2026'}</strong></span>
              </div>
              <div className="fee-student-meta-item">
                <Clock size={15} color="#d97706" />
                <span>Current Due Date: <strong style={{ color: '#d97706' }}>{selectedRecord.currentDueDate}</strong></span>
              </div>
              <div className="fee-student-meta-pill">
                <CreditCard size={14} />
                <span>Course Fee: ₹{selectedRecord.monthlyFee} / mo</span>
              </div>
            </div>
          )}

          {/* Months & Starting Period */}
          <div className="fee-modal-grid-2">
            <Select 
              label="Fee For How Many Months? *" 
              options={[
                { label: '1 Month', value: '1' },
                { label: '2 Months (Bi-Monthly)', value: '2' },
                { label: '3 Months (Quarterly)', value: '3' },
                { label: '4 Months', value: '4' },
                { label: '5 Months', value: '5' },
                { label: '6 Months (Half-Yearly)', value: '6' },
                { label: '12 Months (Yearly Advance)', value: '12' }
              ]} 
              value={numberOfMonths.toString()}
              onChange={(e) => setNumberOfMonths(Math.max(1, Number(e.target.value) || 1))}
              required
            />

            <Select 
              label="Starting Billing Month *" 
              options={generateMonthOptions()} 
              value={billingPeriod} 
              onChange={(e) => setBillingPeriod(e.target.value)} 
              required 
            />
          </div>

          {/* Coverage Summary Pill */}
          {periodCoverageText && (
            <div className="fee-coverage-pill">
              <Sparkles size={14} className="text-rose-500" />
              <span>Period Covered: <strong>{periodCoverageText}</strong></span>
            </div>
          )}

          {/* Dynamic Next Due Date Calculation & Custom Override */}
          {selectedRecord && (
            <div className="fee-due-date-banner">
              <div className="fee-due-date-left">
                <span className="fee-due-date-label">
                  <Clock size={16} /> 
                  <span>Calculated Next Due Date (after {numberOfMonths} {numberOfMonths === 1 ? 'month' : 'months'}):</span>
                </span>
                <span className="fee-due-date-badge">
                  {calculatedDueDate}
                </span>
              </div>
              
              <div className="fee-due-date-right">
                <label className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block mb-1">
                  Custom Next Due Date (Optional Override):
                </label>
                <input 
                  type="date" 
                  className="fee-custom-date-input"
                  value={customNextDueDate}
                  onChange={(e) => setCustomNextDueDate(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Amounts Breakdown */}
          <div className="fee-modal-grid-3">
            <Input 
              label={`Total Fee (₹) (${numberOfMonths} ${numberOfMonths === 1 ? 'month' : 'months'}) *`} 
              type="number" 
              min="0"
              value={amountPaid} 
              onChange={(e) => setAmountPaid(Math.max(0, Number(e.target.value) || 0).toString())} 
              required 
            />
            <Input 
              label="Discount (₹)" 
              type="number" 
              min="0"
              value={discount} 
              onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0).toString())} 
            />
            <Input 
              label="Late Fee (₹)" 
              type="number" 
              min="0"
              value={lateFee} 
              onChange={(e) => setLateFee(Math.max(0, Number(e.target.value) || 0).toString())} 
            />
          </div>

          {/* Net Payable Summary Bar */}
          <div className="fee-net-summary-bar">
            <div className="fee-net-summary-item">
              <span className="fee-net-label">Base Fee:</span>
              <span className="fee-net-val">₹{totalBaseFee}</span>
            </div>
            {numDiscount > 0 && (
              <div className="fee-net-summary-item">
                <span className="fee-net-label">Discount:</span>
                <span className="fee-net-val text-emerald-600">-₹{numDiscount}</span>
              </div>
            )}
            {numLateFee > 0 && (
              <div className="fee-net-summary-item">
                <span className="fee-net-label">Late Fee:</span>
                <span className="fee-net-val text-amber-600">+₹{numLateFee}</span>
              </div>
            )}
            <div className="fee-net-summary-item fee-net-total">
              <span className="fee-net-label">Net Amount Received:</span>
              <span className="fee-net-total-val">₹{netPayable}</span>
            </div>
          </div>

          {/* Payment Mode & Academic Year */}
          <div className="fee-modal-grid-2">
            <Select 
              label="Payment Mode *" 
              options={[
                { label: 'Cash', value: 'Cash' }, 
                { label: 'UPI (Google Pay / PhonePe / Paytm)', value: 'UPI' }, 
                { label: 'Bank Transfer (NEFT / IMPS)', value: 'Bank Transfer' },
                { label: 'Online Gateway', value: 'Online Gateway' }
              ]} 
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value as any)}
              required
            />
            <Input 
              label="Academic Year *" 
              value={academicYear} 
              onChange={(e) => setAcademicYear(e.target.value)} 
              required 
            />
          </div>

          <div className="fee-modal-grid-2">
            <Input 
              label="Transaction / Reference Number" 
              placeholder="e.g. UPI Ref / UTR / Cheque No."
              value={transactionNumber} 
              onChange={(e) => setTransactionNumber(e.target.value)} 
            />
            <Input 
              label="Remarks / Notes (Optional)" 
              placeholder="e.g. Paid in full for 2 months"
              value={remarks} 
              onChange={(e) => setRemarks(e.target.value)} 
            />
          </div>

          <div className="modal-form-footer">
            <button type="button" className="btn-modal-cancel" onClick={() => setIsPaymentModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-modal-primary" disabled={isSaving}>
              <Printer size={18} />
              {isSaving ? "Recording Payment..." : `Record Payment (₹${netPayable}) & Print Receipt`}
            </button>
          </div>
        </form>
      </Modal>

      {printedTransaction && (
        <ReceiptTemplate 
          transaction={printedTransaction} 
          student={students.find(s => s.documentId === printedTransaction.studentId)!}
          plan={{ planName: `Monthly Fee (${printedTransaction.monthsCount || 1} Months)` }}
          course={courses.find(c => c.documentId === printedTransaction.courseId)! || { courseName: 'Course' }}
        />
      )}
    </div>
  );
};

export default Fees;
