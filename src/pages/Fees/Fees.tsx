import React, { useState, useEffect } from 'react';
import { Plus, MessageCircle, Calendar, Clock, DollarSign } from 'lucide-react';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import type { FeeTransaction, User, Course } from '../../types/models';
import { validatePositiveNumber } from '../../utils/validation';
import '../../components/ui/TableStyles.css';
import ReceiptTemplate from './ReceiptTemplate';
import { useAuth } from '../../contexts/AuthContext';

interface StudentFeeRecord {
  studentId: string;
  studentName: string;
  courseId: string;
  courseName: string;
  monthlyFee: number;
  joiningDate?: string;
  joiningDateRaw?: string;
  lastPaymentDate?: Date;
  lastPaidMonth?: string;
  nextDueDate?: string;
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

  // Generate Month Options (Previous, Current, Next Year)
  const generateMonthOptions = () => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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

  const currentMonthDefault = `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][new Date().getMonth()]} ${new Date().getFullYear()}`;

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
  const [calculatedDueDate, setCalculatedDueDate] = useState<string>('');

  // Receipt State
  const [printedTransaction, setPrintedTransaction] = useState<FeeTransaction | null>(null);
  
  useEffect(() => {
    fetchData();
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
    
    // Add months to base date (joining date or last payment date)
    const target = new Date(base.getFullYear(), base.getMonth() + monthsToAdd, base.getDate());
    
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const day = String(target.getDate()).padStart(2, '0');

    const display = target.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const iso = `${year}-${month}-${day}`;
    return { display, iso };
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
            const dA = a.paymentDate?.seconds || 0;
            const dB = b.paymentDate?.seconds || 0;
            return dB - dA;
          });

        const lastTx = studentTx[0];
        const jInfo = formatJoiningDateDisplay(student.joiningDate || (student as any).createdAt);

        // Calculate Next Due Date from last payment or joining date
        const baseDate = lastTx?.nextDueDate || jInfo.raw;
        const computedNextDue = calculateNextDueDateString(baseDate, 1).display;

        return {
          studentId: student.documentId!,
          studentName: student.name || student.email || 'Student',
          courseId: courseId,
          courseName: course?.courseName || 'Unassigned',
          monthlyFee: course?.monthlyFee || 0,
          joiningDate: jInfo.display,
          joiningDateRaw: jInfo.raw,
          lastPaymentDate: lastTx?.paymentDate ? new Date(lastTx.paymentDate.seconds * 1000) : undefined,
          lastPaidMonth: lastTx?.billingPeriod,
          nextDueDate: lastTx?.nextDueDate ? formatJoiningDateDisplay(lastTx.nextDueDate).display : computedNextDue
        };
      });

      setFeeRecords(records);

    } catch (e) {
      console.error("Error fetching fee data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-calculate Fee Amount and Next Due Date based on Course Fee and Number of Months
  useEffect(() => {
    if (paymentStudentId) {
      const record = feeRecords.find(r => r.studentId === paymentStudentId);
      if (record) {
        const totalCalculatedAmt = record.monthlyFee * numberOfMonths;
        setAmountPaid(totalCalculatedAmt.toString());

        const baseDate = record.joiningDateRaw || '2026-01-01';
        const due = calculateNextDueDateString(baseDate, numberOfMonths);
        setCalculatedDueDate(due.display);
      }
    }
  }, [paymentStudentId, numberOfMonths, feeRecords]);

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
      
      const baseDate = record.joiningDateRaw || '2026-01-01';
      const isoDueDate = calculateNextDueDateString(baseDate, numberOfMonths).iso;

      const newTransaction: Partial<FeeTransaction> = {
        studentId: record.studentId,
        courseId: record.courseId,
        academicYear,
        billingPeriod: `${billingPeriod} (${numberOfMonths} ${numberOfMonths === 1 ? 'Month' : 'Months'})`,
        monthsCount: numberOfMonths,
        joiningDate: record.joiningDate || '01 Jan 2026',
        nextDueDate: isoDueDate,
        paymentDate: serverTimestamp() as any,
        amountPaid: amt,
        discount: disc,
        lateFee: lf,
        paymentMode,
        transactionNumber,
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
      setNumberOfMonths(1);
      
      // Auto trigger receipt printing
      setPrintedTransaction({ ...newTransaction, paymentDate: new Date() } as FeeTransaction);
      setTimeout(() => {
        window.print();
        setPrintedTransaction(null);
      }, 500);

      fetchData();
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
        txs.sort((a, b) => (b.paymentDate?.seconds || 0) - (a.paymentDate?.seconds || 0));
        setPrintedTransaction(txs[0]);
      } else {
        setPrintedTransaction({
          receiptNumber: 'REC-' + new Date().getFullYear() + '-DRAFT',
          studentId: row.studentId,
          courseId: row.courseId,
          academicYear: '2026-27',
          billingPeriod: row.lastPaidMonth || 'Monthly Fee',
          paymentDate: new Date(),
          amountPaid: row.monthlyFee,
          paymentMode: 'Cash',
          receivedBy: user?.name || 'Admin',
          nextDueDate: row.nextDueDate || '01 Oct 2026',
          status: 'PAID'
        } as FeeTransaction);
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
    const msg = `Hello ${name || 'Student'},\n\nYour course fee of ₹${monthlyFee} is due on ${dueDate || 'upcoming due date'}. Please complete your payment using this link: https://speakhub.com/pay \n\nThank you,\nSpeak Hub Academy`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const selectedRecord = feeRecords.find(r => r.studentId === paymentStudentId);

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
              <div className="font-bold text-gray-700 dark:text-gray-300">{row.lastPaidMonth}</div>
              <div className="text-xs text-gray-500">Paid on: {row.lastPaymentDate.toLocaleDateString()}</div>
            </>
          ) : (
            <span className="text-gray-400 italic text-xs">No payments recorded</span>
          )}
        </div>
      )
    },
    {
      key: 'nextDueDate',
      header: 'Next Due Date',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2.5 py-1 rounded-lg w-fit">
          <Calendar size={13} />
          {row.nextDueDate || '01 Mar 2026'}
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
              onClick={() => { 
                setPaymentStudentId(row.studentId); 
                setNumberOfMonths(1);
                setIsPaymentModalOpen(true); 
              }}
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
              onClick={() => openWhatsApp(phone, student?.name, row.monthlyFee, row.nextDueDate)}
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
              setPaymentStudentId(feeRecords[0].studentId); 
              setNumberOfMonths(1);
              setIsPaymentModalOpen(true); 
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
        searchPlaceholder="Search student name or course..."
        isLoading={isLoading}
      />

      {/* Record Payment Modal */}
      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Record Monthly Fee">
        <form onSubmit={handleRecordPayment} className="modal-form space-y-4">
          
          <Select 
            label="Select Student *" 
            options={feeRecords.map(r => ({label: `${r.studentName} (${r.courseName} - ₹${r.monthlyFee}/mo)`, value: r.studentId}))} 
            value={paymentStudentId}
            onChange={(e) => setPaymentStudentId(e.target.value)}
            required
          />

          {/* Student Info Card */}
          {selectedRecord && (
            <div className="bg-slate-50 dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                <span>📅 <strong>Joining Date:</strong> {selectedRecord.joiningDate || '01 Jan 2026'}</span>
                <span>💰 <strong>Course Fee:</strong> ₹{selectedRecord.monthlyFee} / month</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Select 
              label="Fee For How Many Months? *" 
              options={[
                { label: '1 Month', value: '1' },
                { label: '2 Months', value: '2' },
                { label: '3 Months (Quarterly)', value: '3' },
                { label: '4 Months', value: '4' },
                { label: '5 Months', value: '5' },
                { label: '6 Months (Half-Yearly)', value: '6' },
                { label: '12 Months (Yearly)', value: '12' }
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

          {/* Dynamic Next Due Date Calculation Banner */}
          {selectedRecord && calculatedDueDate && (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs flex items-center justify-between">
              <span className="text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-1.5">
                <Clock size={15} /> Calculated Next Due Date (after {numberOfMonths} {numberOfMonths === 1 ? 'month' : 'months'}):
              </span>
              <span className="text-emerald-900 dark:text-emerald-200 font-extrabold text-sm bg-white dark:bg-slate-900 px-3 py-1 rounded-lg border border-emerald-300 dark:border-emerald-700 shadow-sm">
                {calculatedDueDate}
              </span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <Input 
              label={`Total Fee Amount (₹) (${numberOfMonths} ${numberOfMonths === 1 ? 'month' : 'months'}) *`} 
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

          <div className="grid grid-cols-2 gap-4">
            <Select 
              label="Payment Mode *" 
              options={[
                { label: 'Cash', value: 'Cash' }, 
                { label: 'UPI', value: 'UPI' }, 
                { label: 'Bank Transfer', value: 'Bank Transfer' }
              ]} 
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value as any)}
              required
            />
            <Input 
              label="Academic Year" 
              value={academicYear} 
              onChange={(e) => setAcademicYear(e.target.value)} 
              required 
            />
          </div>

          <Input 
            label="Transaction / Reference Number (Optional)" 
            value={transactionNumber} 
            onChange={(e) => setTransactionNumber(e.target.value)} 
          />

          <div className="modal-actions mt-6">
            <button type="submit" className="btn btn-success font-bold" disabled={isSaving}>
              {isSaving ? "Processing Payment..." : `Record Payment (₹${amountPaid}) & Print Receipt`}
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
