import React, { useState, useEffect } from 'react';
import { Plus, MessageCircle, Calendar, Clock, Printer, CreditCard, Sparkles, Edit2, Bell, CheckCircle2 } from 'lucide-react';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { FeeTransaction, User, Course, Batch } from '../../types/models';
import { validatePositiveNumber } from '../../utils/validation';
import '../../components/ui/TableStyles.css';
import './Fees.css';
import ReceiptModal from './ReceiptModal';
import { useAuth } from '../../contexts/AuthContext';
import { sendFeeDueNotification } from '../../services/pushNotificationService';

interface StudentFeeRecord {
  documentId?: string;
  studentId: string;
  studentName: string;
  courseId: string;
  courseName: string;
  batchId?: string;
  batchName?: string;
  monthlyFee: number;
  joiningDate?: string;
  joiningDateRaw?: string;
  joiningDay?: number;
  lastPaymentDate?: Date;
  lastPaidMonth?: string;
  currentDueDate?: string;
  currentDueDateRaw?: string;
  currentDueDay?: number;
  nextDueDate?: string;
  nextDueDateRaw?: string;
  createdAt?: any;
}

const Fees: React.FC = () => {
  const { user } = useAuth();
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Data State
  const [students, setStudents] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('all');
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
  const [feeDurationOption, setFeeDurationOption] = useState<string>('1');
  const [isNoDues, setIsNoDues] = useState<boolean>(false);
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
  const [isEditingCurrentDueDate, setIsEditingCurrentDueDate] = useState<boolean>(false);
  const [currentDueDateEditVal, setCurrentDueDateEditVal] = useState<string>('');

  // Receipt Modal State
  const [receiptModalTx, setReceiptModalTx] = useState<FeeTransaction | null>(null);
  const [receiptModalStudent, setReceiptModalStudent] = useState<any>(null);
  const [receiptModalCourse, setReceiptModalCourse] = useState<any>(null);
  
  useEffect(() => {
    fetchData();
  }, []);

  const formatJoiningDateDisplay = (joiningDateVal: any): { display: string; raw: string; day: number } => {
    if (!joiningDateVal) {
      return { display: '01 Jan 2026', raw: '2026-01-01', day: 1 };
    }
    if (typeof joiningDateVal === 'string' && (joiningDateVal.toUpperCase() === 'NO_DUES' || joiningDateVal.toLowerCase() === 'no dues')) {
      return { display: 'No Dues', raw: 'NO_DUES', day: 0 };
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
      const isTeacher = user?.role === 'teacher';

      // 1. Fetch Batches (including inactive to identify inactive-batch students)
      const bSnap = await getDocs(collection(db, 'batches'));
      const allBatches = bSnap.docs.map(d => ({ documentId: d.id, ...d.data() } as Batch));
      const activeBatches = allBatches.filter(b => b.status === 'active' || !b.status);

      let visibleBatches = activeBatches;
      let teacherBatchIds = new Set<string>();

      if (isTeacher) {
        visibleBatches = activeBatches.filter(b => 
          b.teacherId === user?.id || 
          b.teacherId === user?.email ||
          (user as any)?.batchIds?.includes(b.documentId)
        );
        teacherBatchIds = new Set(visibleBatches.map(b => b.documentId!).filter(Boolean));
      }
      setBatches(visibleBatches);

      // 2. Fetch Active Students (Exclude students belonging to inactive/completed batches)
      const uSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student'), where('status', '==', 'active')));
      let usersList = uSnap.docs.map(d => ({ documentId: d.id, ...d.data() } as User));

      usersList = usersList.filter(s => {
        const rawBatchId = s.batchIds?.[0] || (s as any).batchId || '';
        if (rawBatchId) {
          const matchedBatch = allBatches.find(b => b.documentId === rawBatchId);
          if (matchedBatch && matchedBatch.status && matchedBatch.status !== 'active') {
            return false;
          }
        }
        return true;
      });

      // IF TEACHER: strictly display only students assigned to their batch(es)
      if (isTeacher) {
        usersList = usersList.filter(s => {
          const sBatches = s.batchIds || ((s as any).batchId ? [(s as any).batchId] : []);
          return sBatches.some((bId: string) => teacherBatchIds.has(bId));
        });
      }
      setStudents(usersList);

      const cSnap = await getDocs(collection(db, 'courses'));
      const coursesList = cSnap.docs.map(d => ({ documentId: d.id, ...d.data() } as Course));
      setCourses(coursesList);

      const tSnap = await getDocs(collection(db, 'fee_transactions'));
      const transactions = tSnap.docs.map(d => d.data() as FeeTransaction);

      const records: StudentFeeRecord[] = usersList.map(student => {
        const courseId = student.courseIds?.[0] || '';
        const course = coursesList.find(c => c.documentId === courseId);
        
        const rawBatchId = student.batchIds?.[0] || (student as any).batchId || '';
        const matchedBatch = allBatches.find(b => b.documentId === rawBatchId);
        const batchName = matchedBatch?.batchName || 'General';

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

        let curDueDisplay = jInfo.display;
        let curDueRaw = jInfo.raw;
        let curDueDay = jInfo.day;

        if ((student as any).feeDueDate) {
          const formattedFeeDue = formatJoiningDateDisplay((student as any).feeDueDate);
          curDueDisplay = formattedFeeDue.display;
          curDueRaw = formattedFeeDue.raw;
          curDueDay = formattedFeeDue.day;
        } else if (lastTx?.nextDueDate) {
          const formattedLastNext = formatJoiningDateDisplay(lastTx.nextDueDate);
          curDueDisplay = formattedLastNext.display;
          curDueRaw = formattedLastNext.raw;
          curDueDay = formattedLastNext.day;
        }

        return {
          studentId: student.documentId!,
          studentName: student.name || student.email || 'Student',
          documentId: student.documentId,
          courseId: courseId,
          courseName: course?.courseName || 'Unassigned',
          batchId: rawBatchId,
          batchName: batchName,
          monthlyFee: course?.monthlyFee || 0,
          joiningDate: jInfo.display,
          joiningDateRaw: jInfo.raw,
          joiningDay: jInfo.day,
          lastPaymentDate: lastTx?.paymentDate ? new Date((lastTx.paymentDate as any)?.seconds * 1000) : undefined,
          lastPaidMonth: lastTx?.billingPeriod,
          currentDueDate: curDueDisplay,
          currentDueDateRaw: curDueRaw,
          currentDueDay: curDueDay,
          nextDueDate: curDueDisplay,
          nextDueDateRaw: curDueRaw,
          createdAt: student.createdAt || student.joiningDate || jInfo.raw || (lastTx?.paymentDate ? new Date((lastTx.paymentDate as any)?.seconds * 1000) : undefined)
        };
      });

      setFeeRecords(records);

    } catch (e) {
      console.error("Error fetching fee data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick update/save of student's Current Due Date to Firestore & local state
  const handleSaveCurrentDueDate = async (studentId: string, newDateIso: string) => {
    if (!newDateIso) {
      alert("Please select a valid date or enter 'NO_DUES'.");
      return;
    }
    const isSettingNoDues = newDateIso.toUpperCase().trim() === 'NO_DUES' || newDateIso.toLowerCase().trim() === 'no dues';
    try {
      await updateDoc(doc(db, 'users', studentId), {
        feeDueDate: isSettingNoDues ? 'NO_DUES' : newDateIso
      });

      if (isSettingNoDues) {
        setFeeRecords(prev => prev.map(r => {
          if (r.studentId === studentId) {
            return {
              ...r,
              currentDueDate: 'No Dues',
              currentDueDateRaw: 'NO_DUES',
              currentDueDay: 0,
              nextDueDate: 'No Dues',
              nextDueDateRaw: 'NO_DUES'
            };
          }
          return r;
        }));
        setIsEditingCurrentDueDate(false);
        return;
      }

      const parts = newDateIso.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        const dateObj = new Date(y, m - 1, d);
        const display = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const mStr = `${monthNames[m - 1]} ${y}`;

        setFeeRecords(prev => prev.map(r => {
          if (r.studentId === studentId) {
            return {
              ...r,
              currentDueDate: display,
              currentDueDateRaw: newDateIso,
              currentDueDay: d,
              nextDueDate: display,
              nextDueDateRaw: newDateIso
            };
          }
          return r;
        }));

        setBillingPeriod(mStr);
        setIsEditingCurrentDueDate(false);
      }
    } catch (e) {
      console.error('Failed to update due date:', e);
      alert('Failed to save new due date');
    }
  };

  const handleDurationOptionChange = (val: string) => {
    setFeeDurationOption(val);
    if (val === 'one_time') {
      setIsNoDues(true);
      setNumberOfMonths(0);
      setAmountPaid('4000');
    } else {
      const mNum = Math.max(1, parseInt(val, 10) || 1);
      setNumberOfMonths(mNum);
      setIsNoDues(false);
    }
  };

  // Auto-calculate Fee Amount, Starting Billing Month, Coverage Text, and Next Due Date
  useEffect(() => {
    if (paymentStudentId) {
      const record = feeRecords.find(r => r.studentId === paymentStudentId);
      if (record) {
        if (feeDurationOption === 'one_time') {
          setNumberOfMonths(0);
          setAmountPaid(prev => (!prev || prev === '0' || prev === String(record.monthlyFee) ? '4000' : prev));
          const startMonth = billingPeriod || currentMonthDefault;
          setPeriodCoverageText(`One-Time Fee (${startMonth})`);

          if (isNoDues) {
            setCalculatedDueDate('No Dues');
            setCustomNextDueDate('NO_DUES');
          } else {
            const dueDay = record.currentDueDay || record.joiningDay || 1;
            const due = calculateNextDueFromBillingPeriod(startMonth, 1, dueDay);
            setCalculatedDueDate(due.display);
            setCustomNextDueDate(due.iso);
          }
        } else {
          const monthsNum = Math.max(1, parseInt(feeDurationOption, 10) || 1);
          setNumberOfMonths(monthsNum);
          const totalCalculatedAmt = (record.monthlyFee || 0) * monthsNum;
          setAmountPaid(totalCalculatedAmt.toString());

          const startMonth = billingPeriod || currentMonthDefault;
          const coverage = getPeriodCoverageLabel(startMonth, monthsNum);
          setPeriodCoverageText(coverage);

          if (isNoDues) {
            setCalculatedDueDate('No Dues');
            setCustomNextDueDate('NO_DUES');
          } else {
            const dueDay = record.currentDueDay || record.joiningDay || 1;
            const due = calculateNextDueFromBillingPeriod(startMonth, monthsNum, dueDay);
            setCalculatedDueDate(due.display);
            setCustomNextDueDate(due.iso);
          }
        }
      }
    }
  }, [paymentStudentId, feeDurationOption, isNoDues, billingPeriod, feeRecords]);

  // Handle user manual override of Next Due Date
  const handleCustomDueDateChange = (newIsoDate: string) => {
    setCustomNextDueDate(newIsoDate);
    if (newIsoDate) {
      const parts = newIsoDate.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        if (!isNaN(d.getTime())) {
          const display = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
          setCalculatedDueDate(display);
        }
      }
    }
  };

  // Open modal with pre-configured student info
  const handleOpenPaymentModal = (record: StudentFeeRecord) => {
    setPaymentStudentId(record.studentId);
    setFeeDurationOption('1');
    setNumberOfMonths(1);
    setDiscount('0');
    setLateFee('0');
    setRemarks('');
    setIsEditingCurrentDueDate(false);
    setCurrentDueDateEditVal(record.currentDueDateRaw === 'NO_DUES' ? '' : (record.currentDueDateRaw || ''));

    const alreadyNoDues = record.currentDueDateRaw === 'NO_DUES' || record.currentDueDate === 'No Dues';
    setIsNoDues(alreadyNoDues);

    // Pre-select billing month according to currentDueDate
    if (record.currentDueDateRaw && record.currentDueDateRaw !== 'NO_DUES') {
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
      
      const isOneTimeFee = feeDurationOption === 'one_time';
      const dueDay = record.currentDueDay || record.joiningDay || 1;
      const computedDue = calculateNextDueFromBillingPeriod(billingPeriod, Math.max(1, numberOfMonths), dueDay).iso;
      const finalNextDueDate = isNoDues ? 'NO_DUES' : (customNextDueDate || computedDue);
      const coverage = isOneTimeFee
        ? `One-Time Fee (Offline / Full Batch)`
        : (periodCoverageText || `${billingPeriod} (${numberOfMonths} ${numberOfMonths === 1 ? 'Month' : 'Months'})`);

      const defaultRemarks = isOneTimeFee
        ? `One-Time Fee (Offline Batch) - ₹${netPaid}${isNoDues ? ' [Full Fee Paid - No Dues]' : ''}`
        : `Fee for ${numberOfMonths} month(s) (${coverage})${isNoDues ? ' [Full Fee Paid - No Dues]' : ''}`;

      const newTransaction: Partial<FeeTransaction> = {
        studentId: record.studentId,
        courseId: record.courseId,
        academicYear,
        billingPeriod: coverage,
        monthsCount: isOneTimeFee ? 0 : numberOfMonths,
        joiningDate: record.joiningDate || '01 Jan 2026',
        nextDueDate: finalNextDueDate,
        paymentDate: serverTimestamp() as any,
        amountPaid: netPaid,
        discount: disc,
        lateFee: lf,
        paymentMode,
        transactionNumber,
        remarks: remarks || defaultRemarks,
        receivedBy: user?.name || 'Admin',
        receiptNumber: 'REC-' + new Date().getFullYear() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
        status: 'PAID',
        createdAt: serverTimestamp() as any
      };

      await addDoc(collection(db, 'fee_transactions'), newTransaction);

      // Synchronize student's feeDueDate in Firestore users collection
      await updateDoc(doc(db, 'users', record.studentId), {
        feeDueDate: finalNextDueDate
      });

      setIsPaymentModalOpen(false);
      setAmountPaid('');
      setDiscount('0');
      setLateFee('0');
      setTransactionNumber('');
      setRemarks('');
      setFeeDurationOption('1');
      setNumberOfMonths(1);
      setIsNoDues(false);
      
      // Open interactive official fee receipt modal immediately with complete transaction metadata
      const recordedTx: FeeTransaction = { 
        ...newTransaction, 
        paymentDate: new Date(),
        studentName: record.studentName,
        courseName: record.courseName,
        perMonthFee: isOneTimeFee ? netPaid : record.monthlyFee
      } as any;

      const studentObj = students.find(s => s.documentId === record.studentId) || { name: record.studentName };
      const courseObj = courses.find(c => c.documentId === record.courseId) || { courseName: record.courseName };

      setReceiptModalTx(recordedTx);
      setReceiptModalStudent(studentObj);
      setReceiptModalCourse(courseObj);

      await fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to record payment");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenReceiptForStudent = async (row: StudentFeeRecord) => {
    try {
      const studentObj = students.find(s => s.documentId === row.studentId) || { name: row.studentName, phone: row.studentId };
      const courseObj = courses.find(c => c.documentId === row.courseId) || { courseName: row.courseName };

      const tSnap = await getDocs(query(collection(db, 'fee_transactions'), where('studentId', '==', row.studentId)));
      if (!tSnap.empty) {
        const txs = tSnap.docs.map(d => d.data() as FeeTransaction);
        txs.sort((a, b) => ((b.paymentDate as any)?.seconds || 0) - ((a.paymentDate as any)?.seconds || 0));
        setReceiptModalTx({
          ...txs[0],
          studentName: row.studentName,
          courseName: row.courseName,
          perMonthFee: row.monthlyFee
        } as any);
      } else {
        setReceiptModalTx({
          receiptNumber: 'REC-' + new Date().getFullYear() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
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
          nextDueDate: row.currentDueDate || 'No Dues',
          status: 'PAID'
        } as any);
      }

      setReceiptModalStudent(studentObj);
      setReceiptModalCourse(courseObj);
    } catch (e) {
      console.error("Open receipt error:", e);
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

  const handleSendPushFeeReminder = async (row: StudentFeeRecord) => {
    if (row.currentDueDate === 'No Dues' || row.currentDueDateRaw === 'NO_DUES') {
      alert(`${row.studentName} has No Dues (Full Fee Paid). No reminder needed.`);
      return;
    }
    const res = await sendFeeDueNotification({
      studentId: row.studentId,
      studentName: row.studentName,
      monthlyFee: row.monthlyFee,
      dueDate: row.currentDueDate || 'due date',
      force: true,
    });
    alert(res.message);
  };

  const handleNotifyAllDueStudents = async () => {
    let sentCount = 0;
    for (const row of feeRecords) {
      if (row.currentDueDate === 'No Dues' || row.currentDueDateRaw === 'NO_DUES') {
        continue;
      }
      const res = await sendFeeDueNotification({
        studentId: row.studentId,
        studentName: row.studentName,
        monthlyFee: row.monthlyFee,
        dueDate: row.currentDueDate || 'due date',
        force: false,
      });
      if (res.success) {
        sentCount++;
      }
    }
    if (sentCount > 0) {
      alert(`Sent ${sentCount} Fee Due push notification(s) to students' mobile notification bar.`);
    } else {
      alert("All eligible students have already received their fee notification for today, or have No Dues.");
    }
  };

  const columns: Column<StudentFeeRecord>[] = [
    {
      key: 'studentName',
      header: 'Student Name',
      render: (row) => (
        <div className="flex flex-col py-1 gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-900 dark:text-white text-sm block leading-tight">{row.studentName}</span>
            {row.batchName && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                {row.batchName}
              </span>
            )}
          </div>
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
      render: (row) => {
        const isStudentNoDues = row.currentDueDate === 'No Dues' || row.currentDueDateRaw === 'NO_DUES';
        return (
          <div className="flex items-center gap-1.5">
            {isStudentNoDues ? (
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-lg w-fit">
                <CheckCircle2 size={13} className="text-emerald-600" />
                No Dues (Full Paid)
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2.5 py-1 rounded-lg w-fit">
                <Calendar size={13} />
                {row.currentDueDate || row.joiningDate || '01 Mar 2026'}
              </div>
            )}
            <button
              type="button"
              className="fee-edit-due-date-btn"
              title="Edit Current Due Date (or enter NO_DUES)"
              onClick={() => {
                const input = prompt(`Edit Current Due Date for ${row.studentName} (YYYY-MM-DD or enter 'NO_DUES'):`, row.currentDueDateRaw || '');
                if (input && input.trim()) {
                  handleSaveCurrentDueDate(row.studentId, input.trim());
                }
              }}
            >
              <Edit2 size={12} />
            </button>
          </div>
        );
      }
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
              onClick={() => handleOpenReceiptForStudent(row)}
              title="View, Print & WhatsApp Share Fee Receipt"
            >
              <Printer size={13} className="mr-1 inline" /> Receipt
            </button>
            <button 
              className="btn btn-outline" 
              style={{padding: '5px 10px', fontSize: '12px', color: '#16a34a', borderColor: '#16a34a', borderRadius: '8px'}} 
              onClick={() => openWhatsApp(phone, student?.name, row.monthlyFee, row.currentDueDate)}
            >
              <MessageCircle size={14} className="mr-1 inline" /> WhatsApp
            </button>
            <button 
              className="btn bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold border border-rose-200" 
              style={{padding: '5px 10px', fontSize: '12px', borderRadius: '8px'}} 
              title="Send Push Notification to Student Mobile"
              onClick={() => handleSendPushFeeReminder(row)}
            >
              <Bell size={13} className="mr-1 inline" /> Push Alert
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
        <div className="flex items-center gap-2 flex-wrap">
          <button 
            className="btn bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold border border-amber-300 flex items-center gap-1.5"
            onClick={handleNotifyAllDueStudents}
          >
            <Bell size={15} /> Notify All Due Students
          </button>
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
      </div>

      {/* Batch Filter & Teacher Mode Badge */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Filter by Batch:</label>
          <select
            className="px-3 py-1.5 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500"
            value={selectedBatchFilter}
            onChange={(e) => setSelectedBatchFilter(e.target.value)}
          >
            <option value="all">All Batches ({feeRecords.length} Students)</option>
            {batches.map(b => (
              <option key={b.documentId} value={b.documentId}>
                {b.batchName} ({feeRecords.filter(r => r.batchId === b.documentId).length} Students)
              </option>
            ))}
          </select>
        </div>

        {user?.role === 'teacher' && (
          <div className="text-xs font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5">
            <span>👨‍🏫 Teacher Mode: Showing assigned students for your batch(es)</span>
          </div>
        )}
      </div>

      <DataTable 
        title={user?.role === 'teacher' ? "My Batch Students - Fee Dues" : "Student Fee Roster"} 
        data={feeRecords.filter(r => selectedBatchFilter === 'all' || r.batchId === selectedBatchFilter)} 
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
              <div className="fee-student-meta-item" style={{ flexWrap: 'wrap' }}>
                <Clock size={15} color="#d97706" />
                {!isEditingCurrentDueDate ? (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span>Current Due Date: <strong style={{ color: selectedRecord.currentDueDateRaw === 'NO_DUES' || selectedRecord.currentDueDate === 'No Dues' ? '#16a34a' : '#d97706' }}>{selectedRecord.currentDueDate}</strong></span>
                    <button
                      type="button"
                      className="fee-edit-due-date-btn"
                      title="Edit Current Due Date"
                      onClick={() => {
                        setIsEditingCurrentDueDate(true);
                        setCurrentDueDateEditVal(selectedRecord.currentDueDateRaw === 'NO_DUES' ? '' : (selectedRecord.currentDueDateRaw || ''));
                      }}
                    >
                      <Edit2 size={13} />
                    </button>
                  </div>
                ) : (
                  <div className="fee-inline-due-edit">
                    <input 
                      type="date"
                      value={currentDueDateEditVal}
                      onChange={(e) => setCurrentDueDateEditVal(e.target.value)}
                    />
                    <button
                      type="button"
                      className="fee-inline-due-save-btn"
                      onClick={() => handleSaveCurrentDueDate(selectedRecord.studentId, currentDueDateEditVal)}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="fee-inline-nodues-btn"
                      title="Mark student as No Dues"
                      onClick={() => handleSaveCurrentDueDate(selectedRecord.studentId, 'NO_DUES')}
                    >
                      ✓ No Dues
                    </button>
                    <button
                      type="button"
                      className="fee-inline-due-cancel-btn"
                      onClick={() => setIsEditingCurrentDueDate(false)}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
              <div className="fee-student-meta-pill">
                <CreditCard size={14} />
                <span>Course Fee: ₹{selectedRecord.monthlyFee} / mo</span>
              </div>
            </div>
          )}

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
                { label: '12 Months (Yearly Advance)', value: '12' },
                { label: 'One-Time Fee (Offline Batch / Full Course - e.g. ₹4000)', value: 'one_time' }
              ]} 
              value={feeDurationOption}
              onChange={(e) => handleDurationOptionChange(e.target.value)}
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

          {/* No Dues Option Checkbox */}
          <div className="fee-nodues-box">
            <label className="fee-nodues-checkbox-label">
              <input 
                type="checkbox" 
                checked={isNoDues}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsNoDues(checked);
                  if (checked) {
                    setCalculatedDueDate('No Dues');
                    setCustomNextDueDate('NO_DUES');
                  } else {
                    const startMonth = billingPeriod || currentMonthDefault;
                    const dueDay = selectedRecord?.currentDueDay || selectedRecord?.joiningDay || 1;
                    const mCount = feeDurationOption === 'one_time' ? 1 : numberOfMonths;
                    const due = calculateNextDueFromBillingPeriod(startMonth, mCount, dueDay);
                    setCalculatedDueDate(due.display);
                    setCustomNextDueDate(due.iso);
                  }
                }}
                className="fee-nodues-checkbox"
              />
              <div className="fee-nodues-text-wrap">
                <span className="fee-nodues-title">
                  <CheckCircle2 size={16} className={isNoDues ? "text-emerald-600 inline mr-1" : "text-gray-400 inline mr-1"} />
                  No Dues (Full Fee Paid)
                </span>
                <span className="fee-nodues-desc">
                  Check this option if the student has paid the full fee and has no further upcoming dues.
                </span>
              </div>
            </label>
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
            <div className={`fee-due-date-banner ${isNoDues ? 'is-no-dues' : ''}`}>
              <div className="fee-due-date-left">
                <span className="fee-due-date-label">
                  <Clock size={16} /> 
                  <span>
                    {isNoDues 
                      ? 'Payment Status / Next Due Date:' 
                      : `Calculated Next Due Date (after ${numberOfMonths} ${numberOfMonths === 1 ? 'month' : 'months'}):`}
                  </span>
                </span>
                <span className={`fee-due-date-badge ${isNoDues ? 'no-dues' : ''}`}>
                  {isNoDues ? '✓ No Dues (Full Fee Paid)' : calculatedDueDate}
                </span>
              </div>
              
              {!isNoDues && (
                <div className="fee-due-date-right">
                  <label className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block mb-1">
                    Custom Next Due Date (Optional Override):
                  </label>
                  <input 
                    type="date" 
                    className="fee-custom-date-input"
                    value={customNextDueDate === 'NO_DUES' ? '' : customNextDueDate}
                    onChange={(e) => handleCustomDueDateChange(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          {/* Amounts Breakdown */}
          <div className="fee-modal-grid-3">
            <Input 
              label={`Total Fee (₹) (${feeDurationOption === 'one_time' ? 'One-Time Fee' : `${numberOfMonths} ${numberOfMonths === 1 ? 'month' : 'months'}`}) *`} 
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

      <ReceiptModal 
        isOpen={Boolean(receiptModalTx)}
        onClose={() => setReceiptModalTx(null)}
        transaction={receiptModalTx} 
        student={receiptModalStudent || (receiptModalTx ? students.find(s => s.documentId === receiptModalTx.studentId) : null)}
        course={receiptModalCourse || (receiptModalTx ? courses.find(c => c.documentId === receiptModalTx.courseId) : null)}
        plan={{ planName: (receiptModalTx?.monthsCount === 0 || receiptModalTx?.billingPeriod?.includes('One-Time')) ? 'One-Time Fee (Offline / Full Course)' : `Monthly Fee (${receiptModalTx?.monthsCount || 1} Months)` }}
      />
    </div>
  );
};

export default Fees;
