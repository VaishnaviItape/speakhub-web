import React, { useState, useEffect } from 'react';
import { Plus, MessageCircle, Calendar, Clock, Printer, Edit2, Bell, CheckCircle2 } from 'lucide-react';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs, getDoc, addDoc, doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { FeeTransaction, User, Course, Batch } from '../../types/models';
import { validatePositiveNumber } from '../../utils/validation';
import '../../components/ui/TableStyles.css';
import './Fees.css';
import ReceiptModal from './ReceiptModal';
import { useAuth } from '../../contexts/AuthContext';
import { sendFeeDueNotification } from '../../services/pushNotificationService';
import { parseDate, formatDDMMYYYY, formatYYYYMMDD } from '../../utils/dateTime';

interface StudentFeeRecord {
  documentId?: string;
  studentId: string;
  studentName: string;
  courseId: string;
  courseName: string;
  batchId?: string;
  batchName?: string;
  monthlyFee: number;
  isOffline?: boolean;
  originalCourseFee?: number;
  courseDiscount?: number;
  agreedCourseFee?: number;
  offlineOneTimeFee?: number;
  totalPaid?: number;
  remainingBalance?: number;
  installmentsCount?: number;
  installmentsPaidCount?: number;
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
  const [paymentCourseId, setPaymentCourseId] = useState('');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [fullCourseDiscount, setFullCourseDiscount] = useState('0');
  const [customCourseFee, setCustomCourseFee] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [discount, setDiscount] = useState('0');
  const academicYear = '2026-27';
  const [billingPeriod, setBillingPeriod] = useState(currentMonthDefault);
  const [monthsCount, setMonthsCount] = useState<number>(1);
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'UPI' | 'Bank Transfer' | 'Online Gateway'>('Cash');
  const [transactionNumber, setTransactionNumber] = useState('');
  const [remarks, setRemarks] = useState('');
  const [customNextDueDate, setCustomNextDueDate] = useState<string>('');

  // Receipt Modal State
  const [receiptModalTx, setReceiptModalTx] = useState<FeeTransaction | null>(null);
  const [receiptModalStudent, setReceiptModalStudent] = useState<any>(null);
  const [receiptModalCourse, setReceiptModalCourse] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const formatJoiningDateDisplay = (joiningDateVal: any): { display: string; raw: string; day: number } => {
    if (!joiningDateVal) {
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      return { display: `${dd}-${mm}-${yyyy}`, raw: `${yyyy}-${mm}-${dd}`, day: today.getDate() };
    }
    if (typeof joiningDateVal === 'string' && (joiningDateVal.toUpperCase() === 'NO_DUES' || joiningDateVal.toLowerCase() === 'no dues')) {
      return { display: 'No Dues', raw: 'NO_DUES', day: 0 };
    }
    const d = parseDate(joiningDateVal);
    if (!d || isNaN(d.getTime())) {
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      return { display: `${dd}-${mm}-${yyyy}`, raw: `${yyyy}-${mm}-${dd}`, day: today.getDate() };
    }

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    const display = `${day}-${month}-${year}`;
    const raw = `${year}-${month}-${day}`;
    return { display, raw, day: d.getDate() };
  };

  // Helper to calculate target due date preserving student's joining day-of-month (formats display as dd-mm-yyyy)
  const calculateNextDueFromBillingPeriod = (
    startMonthStr: string,
    monthsCount: number,
    dayOfMonth: number = 1
  ): { display: string; iso: string } => {
    const today = new Date();
    if (!startMonthStr) {
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      return { display: `${d}-${m}-${y}`, iso: `${y}-${m}-${d}` };
    }
    const parts = startMonthStr.trim().split(' ');
    const monthIdx = monthNames.indexOf(parts[0]);
    const year = parseInt(parts[1], 10) || today.getFullYear();

    if (monthIdx === -1) {
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      return { display: `${d}-${m}-${y}`, iso: `${y}-${m}-${d}` };
    }

    // Next due month is starting billing month + monthsCount
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

    const display = `${dStr}-${mStr}-${yStr}`;
    const iso = `${yStr}-${mStr}-${dStr}`;

    return { display, iso };
  };

  // Helper to calculate clean billing period range for receipts (e.g. "Nov 2026 to Dec 2026 (2 Months Fee)")
  const getBillingPeriodCoverage = (startMonthStr: string, count: number): string => {
    if (count <= 1) {
      return `${startMonthStr || currentMonthDefault} (1 Month Fee)`;
    }
    const parts = (startMonthStr || currentMonthDefault).trim().split(' ');
    const startIdx = monthNames.indexOf(parts[0]);
    const startYear = parseInt(parts[1], 10) || new Date().getFullYear();
    if (startIdx === -1) {
      return `${startMonthStr} (${count} Months Fee)`;
    }
    const endMonthTotal = startIdx + count - 1;
    const endYear = startYear + Math.floor(endMonthTotal / 12);
    const endMonthName = monthNames[endMonthTotal % 12];
    return `${parts[0]} ${startYear} to ${endMonthName} ${endYear} (${count} Months Fee)`;
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
        const teacherAssignedBatchIds = new Set<string>((user as any)?.batchIds || []);
        if (user?.id) {
          try {
            const userDocSnap = await getDoc(doc(db, 'users', user.id));
            if (userDocSnap.exists()) {
              const uData = userDocSnap.data();
              (uData.batchIds || []).forEach((id: string) => teacherAssignedBatchIds.add(id));
            }
          } catch (e) { }
        }

        visibleBatches = activeBatches.filter(b => {
          const bId = b.documentId || '';
          return (
            teacherAssignedBatchIds.has(bId) ||
            b.teacherId === user?.id ||
            (user?.uid && b.teacherId === user.uid) ||
            b.teacherId === user?.email ||
            (Array.isArray((b as any).teacherIds) && (
              (b as any).teacherIds.includes(user?.id) ||
              (user?.uid && (b as any).teacherIds.includes(user.uid)) ||
              (b as any).teacherIds.includes(user?.email)
            ))
          );
        });
        teacherBatchIds = new Set(visibleBatches.map(b => b.documentId!).filter(Boolean));
        teacherAssignedBatchIds.forEach(id => teacherBatchIds.add(id));
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

        const isTxNoDues = lastTx?.nextDueDate && typeof lastTx.nextDueDate === 'string' &&
          (lastTx.nextDueDate.toUpperCase() === 'NO_DUES' || lastTx.nextDueDate.toLowerCase() === 'no dues');
        const isStudentExplicitNoDues = (student as any).feeDueDate && typeof (student as any).feeDueDate === 'string' &&
          ((student as any).feeDueDate.toUpperCase() === 'NO_DUES' || (student as any).feeDueDate.toLowerCase() === 'no dues');

        const isOffline = course?.mode === 'offline' || course?.modeBadge?.toLowerCase().includes('offline');
        const baseCourseFee = isOffline ? (course?.offlineOneTimeFee || 4000) : (course?.monthlyFee || 0);

        // Retrieve student's saved full course discount and agreed course fee
        const studentCourseDiscount = (student as any).courseDiscount !== undefined
          ? Number((student as any).courseDiscount)
          : (lastTx?.courseDiscount !== undefined ? Number(lastTx.courseDiscount) : 0);

        const studentAgreedFee = (student as any).agreedCourseFee !== undefined
          ? Number((student as any).agreedCourseFee)
          : (lastTx?.totalCourseFee !== undefined && isOffline ? Number(lastTx.totalCourseFee) : (baseCourseFee > 0 ? Math.max(0, baseCourseFee - studentCourseDiscount) : 0));

        const offlineTarget = isOffline ? (studentAgreedFee > 0 ? studentAgreedFee : baseCourseFee) : 0;
        const totalPaidByStudent = studentTx.reduce((sum, t) => sum + (Number(t.amountPaid) || 0), 0);
        const hasPaidFullOffline = isOffline && totalPaidByStudent >= offlineTarget && offlineTarget > 0;
        const remainingOffline = isOffline ? Math.max(0, offlineTarget - totalPaidByStudent) : 0;
        const paidInstCount = studentTx.length;

        if (isStudentExplicitNoDues || hasPaidFullOffline) {
          curDueDisplay = 'No Dues';
          curDueRaw = 'NO_DUES';
          curDueDay = 0;
        } else if ((student as any).feeDueDate) {
          const formattedFeeDue = formatJoiningDateDisplay((student as any).feeDueDate);
          curDueDisplay = formattedFeeDue.display;
          curDueRaw = formattedFeeDue.raw;
          curDueDay = formattedFeeDue.day;
        } else if (isTxNoDues) {
          curDueDisplay = 'No Dues';
          curDueRaw = 'NO_DUES';
          curDueDay = 0;
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
          monthlyFee: isOffline ? offlineTarget : (course?.monthlyFee || 0),
          isOffline: isOffline,
          originalCourseFee: baseCourseFee,
          courseDiscount: studentCourseDiscount,
          agreedCourseFee: studentAgreedFee,
          offlineOneTimeFee: offlineTarget,
          totalPaid: totalPaidByStudent,
          remainingBalance: remainingOffline,
          installmentsCount: course?.installmentsCount || 2,
          installmentsPaidCount: paidInstCount,
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
  const handleSaveCurrentDueDate = async (studentId: string, newDateVal: string) => {
    if (!newDateVal || !newDateVal.trim()) {
      alert("Please select or enter a valid date (DD-MM-YYYY) or enter 'NO_DUES'.");
      return;
    }
    const trimmed = newDateVal.trim();
    const isSettingNoDues = trimmed.toUpperCase() === 'NO_DUES' || trimmed.toLowerCase() === 'no dues';
    try {
      if (isSettingNoDues) {
        // Explicitly fire update query to Firestore users collection
        await updateDoc(doc(db, 'users', studentId), {
          feeDueDate: 'NO_DUES',
          updatedAt: serverTimestamp()
        });

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
        alert("Due date updated to No Dues successfully!");
        return;
      }

      const parsedDate = parseDate(trimmed);
      if (!parsedDate || isNaN(parsedDate.getTime())) {
        alert("Please enter a valid date in DD-MM-YYYY format (e.g. 15-11-2026).");
        return;
      }

      const dStr = String(parsedDate.getDate()).padStart(2, '0');
      const mStr = String(parsedDate.getMonth() + 1).padStart(2, '0');
      const yStr = String(parsedDate.getFullYear());

      const ddMmYyyy = `${dStr}-${mStr}-${yStr}`;
      const yyyyMmDd = `${yStr}-${mStr}-${dStr}`;

      // FIRE THE UPDATE QUERY to Firestore users collection
      await updateDoc(doc(db, 'users', studentId), {
        feeDueDate: ddMmYyyy,
        updatedAt: serverTimestamp()
      });

      // Update local state with exact dd-mm-yyyy date without forcefully changing it
      setFeeRecords(prev => prev.map(r => {
        if (r.studentId === studentId) {
          return {
            ...r,
            currentDueDate: ddMmYyyy,
            currentDueDateRaw: yyyyMmDd,
            currentDueDay: parsedDate.getDate(),
            nextDueDate: ddMmYyyy,
            nextDueDateRaw: yyyyMmDd
          };
        }
        return r;
      }));

      alert(`Due date updated to ${ddMmYyyy} successfully!`);
    } catch (e: any) {
      console.error("Error updating due date:", e);
      alert("Failed to update due date: " + (e?.message || 'Unknown error'));
    }
  };

  const handleCourseChange = (newCourseId: string) => {
    setPaymentCourseId(newCourseId);
    const selectedC = courses.find(c => c.documentId === newCourseId);
    const isOff = selectedC?.mode === 'offline' || selectedC?.modeBadge?.toLowerCase().includes('offline');
    const baseFee = isOff ? (selectedC?.offlineOneTimeFee || 4000) : (selectedC?.monthlyFee || 800);
    setCustomCourseFee(baseFee.toString());

    const record = feeRecords.find(r => r.studentId === paymentStudentId);
    const discountVal = Math.max(0, Number(fullCourseDiscount) || 0);
    const netFullFee = Math.max(0, baseFee - discountVal);
    const totalPaid = record?.totalPaid || 0;
    const remaining = Math.max(0, netFullFee - totalPaid);

    if (isOff) {
      if (remaining === 0 && totalPaid > 0) {
        setAmountPaid('0');
        setCustomNextDueDate('NO_DUES');
      } else if (remaining > 0) {
        setAmountPaid(remaining.toString());
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        setCustomNextDueDate(formatYYYYMMDD(nextMonth));
      } else {
        const count = selectedC?.installmentsCount || 2;
        const defaultInst = count > 1 ? Math.round(netFullFee / count) : netFullFee;
        setAmountPaid(defaultInst.toString());
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        setCustomNextDueDate(formatYYYYMMDD(nextMonth));
      }
    } else {
      const unit = selectedC?.monthlyFee || 800;
      setCustomCourseFee(unit.toString());
      const disc = Number(discount) || 0;
      setAmountPaid(Math.max(0, (unit * (monthsCount || 1)) - disc).toString());
      const dueDay = record?.currentDueDay || record?.joiningDay || 1;
      const computedNextDue = calculateNextDueFromBillingPeriod(billingPeriod || currentMonthDefault, monthsCount || 1, dueDay);
      setCustomNextDueDate(computedNextDue.iso);
    }
  };

  // Handle user manual override of Next Due Date
  const handleCustomDueDateChange = (newIsoDate: string) => {
    setCustomNextDueDate(newIsoDate);
  };

  // Handlers for Multi-Month Online Fee Selection
  const handleMonthsCountChange = (newCount: number) => {
    const count = Math.max(1, newCount || 1);
    setMonthsCount(count);

    const record = feeRecords.find(r => r.studentId === paymentStudentId);
    const course = courses.find(c => c.documentId === paymentCourseId) || (record ? courses.find(c => c.documentId === record.courseId) : undefined);
    const unitFee = Number(customCourseFee) || course?.monthlyFee || record?.monthlyFee || 800;
    const disc = Number(discount) || 0;
    const newAmount = Math.max(0, (unitFee * count) - disc);
    setAmountPaid(newAmount.toString());

    const dueDay = record?.currentDueDay || record?.joiningDay || 1;
    const computedNextDue = calculateNextDueFromBillingPeriod(billingPeriod || currentMonthDefault, count, dueDay);
    setCustomNextDueDate(computedNextDue.iso);
  };

  const handleBillingMonthChange = (newMonth: string) => {
    setBillingPeriod(newMonth);
    const record = feeRecords.find(r => r.studentId === paymentStudentId);
    const dueDay = record?.currentDueDay || record?.joiningDay || 1;
    const computedNextDue = calculateNextDueFromBillingPeriod(newMonth, monthsCount || 1, dueDay);
    setCustomNextDueDate(computedNextDue.iso);
  };

  const handleOnlineDiscountChange = (newDiscountStr: string) => {
    setDiscount(newDiscountStr);
    const record = feeRecords.find(r => r.studentId === paymentStudentId);
    const course = courses.find(c => c.documentId === paymentCourseId) || (record ? courses.find(c => c.documentId === record.courseId) : undefined);
    const unitFee = Number(customCourseFee) || course?.monthlyFee || record?.monthlyFee || 800;
    const disc = Number(newDiscountStr) || 0;
    const newAmount = Math.max(0, (unitFee * (monthsCount || 1)) - disc);
    setAmountPaid(newAmount.toString());
  };

  // Open modal with pre-configured student info
  const handleOpenPaymentModal = (record: StudentFeeRecord, courseIdOverride?: string) => {
    setPaymentStudentId(record.studentId);
    setStudentSearchQuery('');

    const targetCourseId = courseIdOverride || record.courseId || courses[0]?.documentId || '';
    setPaymentCourseId(targetCourseId);

    const course = courses.find(c => c.documentId === targetCourseId) || courses.find(c => c.documentId === record.courseId);
    const isOffline = course?.mode === 'offline' || course?.modeBadge?.toLowerCase().includes('offline') || record.isOffline;

    const studentUser = students.find(s => s.documentId === record.studentId);
    const savedDiscount = (studentUser as any)?.courseDiscount !== undefined
      ? Number((studentUser as any).courseDiscount)
      : (record.courseDiscount || 0);

    const initialDiscount = savedDiscount > 0 ? savedDiscount.toString() : '0';
    setFullCourseDiscount(initialDiscount);

    const baseFee = isOffline ? (course?.offlineOneTimeFee || record.originalCourseFee || record.offlineOneTimeFee || 4000) : (course?.monthlyFee || 800);
    setCustomCourseFee(baseFee.toString());

    setDiscount('0');
    setRemarks('');
    setMonthsCount(1);

    const netFullFee = Math.max(0, baseFee - Number(initialDiscount));
    const totalPaid = record.totalPaid || 0;
    const remaining = Math.max(0, netFullFee - totalPaid);

    if (isOffline) {
      if (remaining === 0 && totalPaid > 0) {
        setAmountPaid('0');
        setCustomNextDueDate('NO_DUES');
      } else if (remaining > 0) {
        setAmountPaid(remaining.toString());
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        setCustomNextDueDate(formatYYYYMMDD(nextMonth));
      } else {
        const instCount = course?.installmentsCount || record.installmentsCount || 2;
        const defaultAmt = instCount > 1 ? Math.round(netFullFee / instCount) : netFullFee;
        setAmountPaid(defaultAmt.toString());
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        setCustomNextDueDate(formatYYYYMMDD(nextMonth));
      }
    } else {
      const mFee = (record.monthlyFee && record.monthlyFee > 0) ? record.monthlyFee : (course?.monthlyFee || 800);
      setCustomCourseFee(mFee.toString());
      setAmountPaid(mFee.toString());
      const dueDay = record.currentDueDay || record.joiningDay || 1;
      let initialBilling = currentMonthDefault;
      if (record.currentDueDateRaw && record.currentDueDateRaw !== 'NO_DUES') {
        const d = new Date(record.currentDueDateRaw);
        if (!isNaN(d.getTime())) {
          initialBilling = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
        }
      }
      setBillingPeriod(initialBilling);
      const computedNextDue = calculateNextDueFromBillingPeriod(initialBilling, 1, dueDay);
      setCustomNextDueDate(computedNextDue.iso);
    }

    if (isOffline) {
      if (record.currentDueDateRaw && record.currentDueDateRaw !== 'NO_DUES') {
        const d = new Date(record.currentDueDateRaw);
        if (!isNaN(d.getTime())) {
          const mStr = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
          setBillingPeriod(mStr);
        }
      } else {
        setBillingPeriod(currentMonthDefault);
      }
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

    const record = feeRecords.find(r => r.studentId === paymentStudentId);
    if (!record) {
      alert("Please select a student.");
      return;
    }

    const course = courses.find(c => c.documentId === paymentCourseId) || courses.find(c => c.documentId === record.courseId);
    const isOfflineCourse = course?.mode === 'offline' || course?.modeBadge?.toLowerCase().includes('offline') || record.isOffline;

    if (!isOfflineCourse && !billingPeriod) {
      alert("Please select a billing month.");
      return;
    }

    setIsSaving(true);
    try {
      const amt = Number(amountPaid) || 0;
      const baseFee = isOfflineCourse
        ? (Number(customCourseFee) || course?.offlineOneTimeFee || record.originalCourseFee || record.offlineOneTimeFee || 4000)
        : (Number(customCourseFee) || course?.monthlyFee || record.monthlyFee || 800);

      // Discount amount (strictly flat ₹ amount, not percentage!)
      const courseDisc = isOfflineCourse
        ? Math.max(0, Number(fullCourseDiscount) || 0)
        : Math.max(0, Number(discount) || 0);

      const netFullCourseFee = Math.max(0, baseFee - courseDisc);
      const totalPaidBefore = record.totalPaid || 0;
      const totalPaidSoFar = isOfflineCourse ? (totalPaidBefore + amt) : amt;
      const remainingAfter = isOfflineCourse ? Math.max(0, netFullCourseFee - totalPaidSoFar) : 0;
      const willBeNoDues = isOfflineCourse ? (remainingAfter === 0) : (customNextDueDate === 'NO_DUES' || remainingAfter === 0);

      let finalNextDueDate: string;
      if (willBeNoDues) {
        finalNextDueDate = 'NO_DUES';
      } else if (customNextDueDate && customNextDueDate !== 'NO_DUES') {
        finalNextDueDate = formatDDMMYYYY(customNextDueDate) || customNextDueDate;
      } else {
        const dueDay = record.currentDueDay || record.joiningDay || 1;
        const computedDue = calculateNextDueFromBillingPeriod(billingPeriod || currentMonthDefault, isOfflineCourse ? 1 : (monthsCount || 1), dueDay);
        finalNextDueDate = computedDue.display;
      }

      let coverage = '';
      if (isOfflineCourse) {
        if (remainingAfter === 0) {
          coverage = totalPaidBefore > 0
            ? 'Offline Course Fee (Final Payment - No Dues)'
            : `Offline Full Course Fee (₹${netFullCourseFee.toLocaleString('en-IN')}${courseDisc > 0 ? ` after ₹${courseDisc} discount` : ''} - No Dues)`;
        } else {
          coverage = `Offline Course Fee (Paid: ₹${amt}, Pending: ₹${remainingAfter})`;
        }
      } else {
        coverage = getBillingPeriodCoverage(billingPeriod || currentMonthDefault, monthsCount || 1);
      }

      let defaultRemarks = remarks;
      if (!defaultRemarks) {
        if (isOfflineCourse) {
          if (remainingAfter === 0) {
            defaultRemarks = `Offline Course Fee - ₹${amt} [Full Fee Paid - No Dues]${courseDisc > 0 ? ` (₹${courseDisc} Discount Applied)` : ''}`;
          } else {
            defaultRemarks = `Offline Course Fee - ₹${amt} (Pending Balance: ₹${remainingAfter})${courseDisc > 0 ? ` [Net Fee: ₹${netFullCourseFee} after ₹${courseDisc} discount]` : ''}`;
          }
        } else {
          const count = monthsCount || 1;
          defaultRemarks = count > 1
            ? `${count} Months Fee - ₹${amt}${willBeNoDues ? ' [No Dues]' : ''}`
            : `Monthly Fee - ₹${amt}${willBeNoDues ? ' [No Dues]' : ''}`;
        }
      }

      const unitMonthly = !isOfflineCourse
        ? (Number(customCourseFee) || course?.monthlyFee || record.monthlyFee || (monthsCount > 0 ? Math.round((amt + courseDisc) / monthsCount) : amt))
        : baseFee;

      const newTransaction: Record<string, any> = {
        studentId: record.studentId,
        courseId: paymentCourseId || record.courseId || '',
        courseName: course?.courseName || record.courseName || 'Course',
        academicYear,
        billingPeriod: coverage,
        monthsCount: isOfflineCourse ? 0 : (monthsCount || 1),
        joiningDate: formatDDMMYYYY(record.joiningDate) || formatDDMMYYYY(new Date()),
        nextDueDate: finalNextDueDate,
        paymentDate: serverTimestamp(),
        amountPaid: amt,
        discount: courseDisc,
        lateFee: 0,
        paymentMode,
        transactionNumber: transactionNumber || '',
        remarks: remarks || defaultRemarks,
        receivedBy: user?.name || 'Admin',
        receiptNumber: 'REC-' + new Date().getFullYear() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
        status: 'PAID',
        remainingBalance: isOfflineCourse ? remainingAfter : 0,
        isOffline: Boolean(isOfflineCourse),
        perMonthFee: unitMonthly,
        createdAt: serverTimestamp()
      };

      if (isOfflineCourse) {
        newTransaction.totalCourseFee = netFullCourseFee;
        newTransaction.originalCourseFee = baseFee;
        newTransaction.courseDiscount = courseDisc;
        newTransaction.totalPaidSoFar = totalPaidSoFar;
      }

      // Defensive cleaning: never send undefined to Firestore
      Object.keys(newTransaction).forEach(k => {
        if (newTransaction[k] === undefined) {
          delete newTransaction[k];
        }
      });

      const docRef = await addDoc(collection(db, 'fee_transactions'), newTransaction);

      // Synchronize student in Firestore users collection
      const userUpdatePayload: any = {
        feeDueDate: finalNextDueDate
      };
      if (isOfflineCourse) {
        userUpdatePayload.courseDiscount = courseDisc;
        userUpdatePayload.agreedCourseFee = netFullCourseFee;
        userUpdatePayload.originalCourseFee = baseFee;
      }
      const existingUserCourses = (students.find(s => s.documentId === record.studentId)?.courseIds || []);
      if (paymentCourseId && !existingUserCourses.includes(paymentCourseId)) {
        userUpdatePayload.courseIds = [paymentCourseId, ...existingUserCourses];
      }

      await setDoc(doc(db, 'users', record.studentId), userUpdatePayload, { merge: true });

      setIsPaymentModalOpen(false);
      setAmountPaid('');
      setDiscount('0');
      setTransactionNumber('');
      setRemarks('');
      setMonthsCount(1);

      // Open interactive official fee receipt modal immediately with complete transaction metadata
      const recordedTx: FeeTransaction = {
        id: docRef.id,
        ...newTransaction,
        paymentDate: new Date(),
        studentName: record.studentName,
        courseName: course?.courseName || record.courseName,
      } as unknown as FeeTransaction;

      const studentObj = students.find(s => s.documentId === record.studentId) || { name: record.studentName };
      const courseObj = course || courses.find(c => c.documentId === record.courseId) || { courseName: record.courseName };

      setReceiptModalTx(recordedTx);
      setReceiptModalStudent(studentObj);
      setReceiptModalCourse(courseObj);

      await fetchData();
    } catch (err: any) {
      console.error("Payment save failed:", err);
      alert(`Failed to record payment: ${err?.message || "Unknown error occurred while saving."}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenReceiptForStudent = async (row: StudentFeeRecord) => {
    try {
      const studentObj = students.find(s => s.documentId === row.studentId) || { name: row.studentName, phone: row.studentId };
      const courseObj = courses.find(c => c.documentId === row.courseId) || { courseName: row.courseName };

      const tSnap = await getDocs(query(collection(db, 'fee_transactions'), where('studentId', '==', row.studentId)));
      const isOff = row.isOffline || (courseObj as any).mode === 'offline' || (courseObj as any).modeBadge?.toLowerCase().includes('offline');
      const offFee = isOff ? ((courseObj as any).offlineOneTimeFee || row.offlineOneTimeFee || 4000) : 0;

      if (!tSnap.empty) {
        const txs = tSnap.docs.map(d => d.data() as FeeTransaction);
        txs.sort((a, b) => ((b.paymentDate as any)?.seconds || 0) - ((a.paymentDate as any)?.seconds || 0));
        const lastTx = txs[0];
        const totalPaid = txs.reduce((sum, t) => sum + (Number(t.amountPaid) || 0), 0);
        const rem = isOff ? (lastTx.remainingBalance !== undefined ? lastTx.remainingBalance : Math.max(0, offFee - totalPaid)) : 0;

        setReceiptModalTx({
          ...lastTx,
          studentName: row.studentName,
          courseName: row.courseName,
          totalCourseFee: isOff ? offFee : undefined,
          remainingBalance: rem,
          perMonthFee: isOff ? offFee : (lastTx.perMonthFee || row.monthlyFee),
          isOffline: isOff
        } as any);
      } else {
        setReceiptModalTx({
          receiptNumber: 'REC-' + new Date().getFullYear() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
          studentId: row.studentId,
          courseId: row.courseId,
          studentName: row.studentName,
          courseName: row.courseName,
          academicYear: '2026-27',
          billingPeriod: row.lastPaidMonth || (isOff ? 'Offline Course Fee' : 'Monthly Fee'),
          paymentDate: new Date(),
          amountPaid: isOff ? offFee : row.monthlyFee,
          totalCourseFee: isOff ? offFee : undefined,
          remainingBalance: 0,
          perMonthFee: isOff ? offFee : row.monthlyFee,
          isOffline: isOff,
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
    if (dueDate === 'No Dues' || dueDate === 'NO_DUES') {
      alert(`${name || 'Student'} has No Dues (Full course fee completed). No fee reminder needed.`);
      return;
    }
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
  const activeCourse = courses.find(c => c.documentId === paymentCourseId) || courses.find(c => c.documentId === selectedRecord?.courseId);
  const isOfflineActive = activeCourse?.mode === 'offline' || activeCourse?.modeBadge?.toLowerCase().includes('offline') || selectedRecord?.isOffline;

  // Filtered fee records for student selection search
  const filteredFeeRecords = feeRecords.filter(r => {
    if (!studentSearchQuery.trim()) return true;
    const q = studentSearchQuery.toLowerCase().trim();
    return (
      r.studentName.toLowerCase().includes(q) ||
      r.courseName.toLowerCase().includes(q) ||
      r.studentId.toLowerCase().includes(q)
    );
  });

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
          <span className="text-xs text-slate-500 font-medium block">Joined: {formatDDMMYYYY(row.joiningDate) || '01-01-2026'}</span>
        </div>
      )
    },
    {
      key: 'courseName',
      header: 'Assigned Course',
      render: (row) => {
        const c = courses.find(item => item.documentId === row.courseId);
        const isOff = c?.mode === 'offline' || c?.modeBadge?.toLowerCase().includes('offline');
        return (
          <div className="flex flex-col py-1 gap-1">
            <span className="font-semibold text-blue-800 dark:text-blue-400 text-sm block leading-tight">{row.courseName}</span>
            {isOff ? (
              <div>
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400 block">
                  ₹{(row.offlineOneTimeFee || c?.offlineOneTimeFee || 4000).toLocaleString('en-IN')} (Offline)
                  {row.courseDiscount && row.courseDiscount > 0 ? (
                    <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                      -₹{row.courseDiscount} Off
                    </span>
                  ) : null}
                </span>
                {row.courseDiscount && row.courseDiscount > 0 && row.originalCourseFee ? (
                  <span className="text-[10px] text-slate-400 line-through block">
                    Base: ₹{row.originalCourseFee.toLocaleString('en-IN')}
                  </span>
                ) : null}
                {row.totalPaid !== undefined && row.totalPaid > 0 ? (
                  <div className="mt-0.5">
                    {row.remainingBalance === 0 ? (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        ✓ Paid in Full (₹{row.totalPaid})
                      </span>
                    ) : (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300">
                        Paid: ₹{row.totalPaid} | Due: ₹{row.remainingBalance}
                      </span>
                    )}
                  </div>
                ) : (
                  c?.hasInstallments !== false && (
                    <span className="text-[11px] text-slate-500 block">
                      {row.installmentsCount || c?.installmentsCount || 2} inst × ₹{Math.round((row.offlineOneTimeFee || c?.offlineOneTimeFee || 4000) / (row.installmentsCount || c?.installmentsCount || 2)).toLocaleString('en-IN')}
                    </span>
                  )
                )}
              </div>
            ) : (
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 block">₹{row.monthlyFee} / month</span>
            )}
          </div>
        );
      }
    },
    {
      key: 'lastPayment',
      header: 'Last Payment',
      render: (row) => (
        <div>
          {row.lastPaymentDate ? (
            <>
              <div className="font-bold text-gray-700 dark:text-gray-300 text-xs">{row.lastPaidMonth}</div>
              <div className="text-xs text-gray-500">Paid on: {formatDDMMYYYY(row.lastPaymentDate)}</div>
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
          <div className="flex items-center gap-1.5 flex-wrap">
            {isStudentNoDues ? (
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 px-2.5 py-1 rounded-lg w-fit shadow-2xs">
                <CheckCircle2 size={13} className="text-emerald-600" />
                No Dues (Full Paid)
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2.5 py-1 rounded-lg w-fit">
                <Calendar size={13} />
                {row.currentDueDate || formatDDMMYYYY(row.joiningDate) || '01-01-2026'}
              </div>
            )}
            <button
              type="button"
              className="fee-edit-due-date-btn"
              title={isStudentNoDues ? "Change Due Date" : "Edit Due Date (DD-MM-YYYY)"}
              onClick={() => {
                const defaultDate = isStudentNoDues
                  ? ''
                  : (row.currentDueDate && row.currentDueDate !== 'No Dues'
                      ? (formatDDMMYYYY(row.currentDueDate) || row.currentDueDate)
                      : (row.currentDueDateRaw && row.currentDueDateRaw !== 'NO_DUES'
                          ? formatDDMMYYYY(row.currentDueDateRaw)
                          : formatDDMMYYYY(new Date())));

                const input = window.prompt(
                  `Edit Due Date for ${row.studentName} (DD-MM-YYYY or enter 'NO_DUES'):`,
                  defaultDate || ''
                );

                if (input !== null && input.trim() !== '') {
                  handleSaveCurrentDueDate(row.studentId, input.trim());
                }
              }}
            >
              <Edit2 size={12} />
            </button>
            {!isStudentNoDues && (
              <button
                type="button"
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded cursor-pointer transition-all"
                title="Mark this student as No Dues (All Fees Paid)"
                onClick={() => {
                  if (window.confirm(`Mark ${row.studentName} as No Dues (All fees completed)?`)) {
                    handleSaveCurrentDueDate(row.studentId, 'NO_DUES');
                  }
                }}
              >
                ✓ Mark No Dues
              </button>
            )}
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
        const isStudentNoDues = row.currentDueDate === 'No Dues' || row.currentDueDateRaw === 'NO_DUES';
        return (
          <div className="flex gap-2 items-center flex-wrap">
            {isStudentNoDues ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 px-3 py-1.5 rounded-lg">
                <CheckCircle2 size={14} className="text-emerald-600" />
                No Dues (Paid)
              </span>
            ) : (
              <button
                className="btn btn-primary"
                style={{ padding: '5px 10px', fontSize: '12px', borderRadius: '8px' }}
                onClick={() => handleOpenPaymentModal(row)}
              >
                Pay Fee
              </button>
            )}
            <button
              className="btn bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
              style={{ padding: '5px 10px', fontSize: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              onClick={() => handleOpenReceiptForStudent(row)}
              title="View, Print & WhatsApp Share Fee Receipt"
            >
              <Printer size={13} className="mr-1 inline" /> Receipt
            </button>
            {!isStudentNoDues && (
              <>
                <button
                  className="btn btn-outline"
                  style={{ padding: '5px 10px', fontSize: '12px', color: '#16a34a', borderColor: '#16a34a', borderRadius: '8px' }}
                  onClick={() => openWhatsApp(phone, student?.name, (row.remainingBalance && row.remainingBalance > 0 ? row.remainingBalance : row.monthlyFee), row.currentDueDate)}
                >
                  <MessageCircle size={14} className="mr-1 inline" /> WhatsApp
                </button>
                <button
                  className="btn bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold border border-rose-200"
                  style={{ padding: '5px 10px', fontSize: '12px', borderRadius: '8px' }}
                  title="Send Push Notification to Student Mobile"
                  onClick={() => handleSendPushFeeReminder(row)}
                >
                  <Bell size={13} className="mr-1 inline" /> Push Alert
                </button>
              </>
            )}
            {isStudentNoDues && (
              <button
                type="button"
                className="text-[11px] text-slate-500 hover:text-slate-800 hover:underline px-1 py-0.5 cursor-pointer"
                onClick={() => handleOpenPaymentModal(row)}
                title="Add extra payment or adjust fee"
              >
                + Extra Pay
              </button>
            )}
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
              if (feeRecords.length > 0) {
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

          {/* 1. Student Name Selection with Quick Filter */}
          <div className="fee-search-box">
            <input
              type="text"
              className="fee-search-input"
              placeholder="🔍 Filter student name or phone..."
              value={studentSearchQuery}
              onChange={(e) => setStudentSearchQuery(e.target.value)}
            />
          </div>

          <Select
            label="1. Student Name *"
            options={filteredFeeRecords.map(r => ({
              label: `${r.studentName} (${r.courseName} | Due: ${r.currentDueDate})`,
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
            <div className="fee-modal-student-card" style={{ padding: '0.65rem 1rem', marginBottom: '0.25rem' }}>
              <div className="fee-student-meta-item">
                <span>Student: <strong>{selectedRecord.studentName}</strong></span>
                <span style={{ color: '#94a3b8' }}>•</span>
                <span>Batch: <strong>{selectedRecord.batchName || 'General'}</strong></span>
                <span style={{ color: '#94a3b8' }}>•</span>
                <span>Joined: <strong>{formatDDMMYYYY(selectedRecord.joiningDate) || '01-01-2026'}</strong></span>
              </div>
              <div className="fee-student-meta-item">
                <span className="fee-course-fee-pill" style={{ fontSize: '11px', padding: '2px 8px' }}>
                  {isOfflineActive ? 'Offline Batch' : 'Online Course'}
                </span>
                {(selectedRecord.currentDueDateRaw === 'NO_DUES' || selectedRecord.currentDueDate === 'No Dues') && (
                  <span className="fee-due-date-badge no-dues" style={{ fontSize: '11px', padding: '2px 8px' }}>
                    ✓ No Dues
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Select Course */}
          <Select
            label="Course *"
            options={courses.map(c => {
              const isOff = c.mode === 'offline' || c.modeBadge?.toLowerCase().includes('offline');
              const feeStr = isOff ? `Offline - ₹${(c.offlineOneTimeFee || 4000).toLocaleString('en-IN')}` : `Online - ₹${c.monthlyFee || 800}/mo`;
              return {
                label: `${c.courseName} (${feeStr})`,
                value: c.documentId!
              };
            })}
            value={paymentCourseId}
            onChange={(e) => handleCourseChange(e.target.value)}
            required
          />

          {/* =========================================================
              OFFLINE BATCH FEE COLLECTION (SIMPLIFIED & CLEAN)
              Fields: Total Fees, Discount Amount (in ₹ Amount, Not %), Fee Paid, Pending Fee
              ========================================================= */}
          {isOfflineActive ? (
            <>
              {/* Row 1: Total Fees & Discount Amount (Flat Amount in ₹, Not %) */}
              <div className="fee-modal-grid-2" style={{ margin: 0 }}>
                <Input
                  label="Total Fees (₹) *"
                  type="number"
                  min="0"
                  placeholder="e.g. 4000"
                  value={customCourseFee}
                  onChange={(e) => setCustomCourseFee(Math.max(0, Number(e.target.value) || 0).toString())}
                  required
                />
                <div>
                  <Input
                    label="Discount Amount (₹) [Amount in ₹, Not %]"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={fullCourseDiscount}
                    onChange={(e) => setFullCourseDiscount(Math.max(0, Number(e.target.value) || 0).toString())}
                  />
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '2px' }}>
                    Flat discount in Rupees (₹) applied directly to total fees
                  </span>
                </div>
              </div>

              {/* Row 2: Fee Paid (Amount Paying Now) */}
              <div className="fee-modal-grid-2" style={{ margin: 0, alignItems: 'flex-start' }}>
                <Input
                  label="Fee Paid (Amount Paying Now) (₹) *"
                  type="number"
                  min="0"
                  placeholder="e.g. 2000"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(Math.max(0, Number(e.target.value) || 0).toString())}
                  required
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '2px' }}>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Quick Settle Presets
                  </label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {(() => {
                      const base = Math.max(0, Number(customCourseFee) || 0);
                      const disc = Math.max(0, Number(fullCourseDiscount) || 0);
                      const net = Math.max(0, base - disc);
                      const prevPaid = selectedRecord?.totalPaid || 0;
                      const remainingBefore = Math.max(0, net - prevPaid);
                      return (
                        <>
                          <button
                            type="button"
                            className="fee-quick-pill"
                            style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 700 }}
                            onClick={() => setAmountPaid(remainingBefore.toString())}
                          >
                            Pay Full Balance (₹{remainingBefore.toLocaleString('en-IN')})
                          </button>
                          {remainingBefore > 0 && (
                            <button
                              type="button"
                              className="fee-quick-pill"
                              style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 700 }}
                              onClick={() => setAmountPaid(Math.round(remainingBefore / 2).toString())}
                            >
                              Pay Half (₹{Math.round(remainingBefore / 2).toLocaleString('en-IN')})
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Real-Time Fee Summary: Total Fees, Discount Amount, Fee Paid, Pending Fee */}
              {(() => {
                const base = Math.max(0, Number(customCourseFee) || 0);
                const disc = Math.max(0, Number(fullCourseDiscount) || 0);
                const net = Math.max(0, base - disc);
                const prevPaid = selectedRecord?.totalPaid || 0;
                const payingNow = Math.max(0, Number(amountPaid) || 0);
                const totalPaidCombined = prevPaid + payingNow;
                const pendingFee = Math.max(0, net - totalPaidCombined);

                return (
                  <div className="fee-offline-summary-card">
                    <div className="fee-calc-tile">
                      <div className="fee-calc-tile-label">Total Fees</div>
                      <div className="fee-calc-tile-val">₹{base.toLocaleString('en-IN')}</div>
                    </div>
                    <div className="fee-calc-tile">
                      <div className="fee-calc-tile-label">Discount Amount</div>
                      <div className="fee-calc-tile-val text-rose-600">
                        {disc > 0 ? `-₹${disc.toLocaleString('en-IN')}` : '₹0'}
                      </div>
                    </div>
                    <div className="fee-calc-tile">
                      <div className="fee-calc-tile-label">Fee Paid (Now)</div>
                      <div className="fee-calc-tile-val text-blue-600">
                        ₹{payingNow.toLocaleString('en-IN')}
                        {prevPaid > 0 && (
                          <span style={{ fontSize: '10px', display: 'block', color: '#64748b', fontWeight: 600 }}>
                            (Prev: ₹{prevPaid.toLocaleString('en-IN')})
                          </span>
                        )}
                      </div>
                    </div>
                    <div
                      className={`fee-calc-tile ${pendingFee === 0 ? 'highlight' : ''}`}
                      style={{
                        border: pendingFee > 0 ? '1.5px solid #f59e0b' : undefined,
                        backgroundColor: pendingFee > 0 ? '#fffbeb' : undefined
                      }}
                    >
                      <div
                        className="fee-calc-tile-label"
                        style={{ color: pendingFee === 0 ? '#059669' : '#b45309', fontWeight: 700 }}
                      >
                        Pending Fee
                      </div>
                      <div
                        className="fee-calc-tile-val"
                        style={{ color: pendingFee === 0 ? '#059669' : '#d97706', fontSize: '1rem' }}
                      >
                        {pendingFee === 0 ? '✓ ₹0 (No Dues)' : `₹${pendingFee.toLocaleString('en-IN')}`}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Next Due Date Section */}
              {(() => {
                const base = Math.max(0, Number(customCourseFee) || 0);
                const disc = Math.max(0, Number(fullCourseDiscount) || 0);
                const net = Math.max(0, base - disc);
                const prevPaid = selectedRecord?.totalPaid || 0;
                const payingNow = Math.max(0, Number(amountPaid) || 0);
                const pendingFee = Math.max(0, net - (prevPaid + payingNow));

                if (pendingFee === 0) {
                  return (
                    <div className="fee-nodues-box" style={{ margin: 0, padding: '0.65rem 1rem' }}>
                      <div className="fee-nodues-title">
                        <CheckCircle2 size={16} color="#059669" />
                        <span>Full Fee Completed — Student has No Dues</span>
                      </div>
                      <span className="fee-nodues-desc">
                        Net course fee of ₹{net.toLocaleString('en-IN')} is completely paid. No upcoming dues.
                      </span>
                    </div>
                  );
                }

                return (
                  <div className="fee-due-date-banner" style={{ margin: 0, padding: '0.75rem 1rem' }}>
                    <div className="fee-due-date-left">
                      <span className="fee-due-date-label">
                        <Clock size={16} color="#d97706" />
                        <span>Next Due Date for Pending Fee (₹{pendingFee.toLocaleString('en-IN')}):</span>
                      </span>
                      <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                        Expected date for collecting the remaining balance.
                      </span>
                    </div>
                    <input
                      type="date"
                      className="fee-custom-date-input"
                      value={customNextDueDate === 'NO_DUES' ? '' : customNextDueDate}
                      onChange={(e) => handleCustomDueDateChange(e.target.value)}
                      required
                    />
                  </div>
                );
              })()}
            </>
          ) : (
            /* =========================================================
               ONLINE BATCH FEE COLLECTION (MULTI-MONTH SUPPORT)
               ========================================================= */
            <>
              {/* Duration / Number of Months Selection */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(225, 29, 72, 0.04) 0%, rgba(244, 63, 94, 0.08) 100%)',
                border: '1px solid rgba(225, 29, 72, 0.2)',
                borderRadius: '10px',
                padding: '12px 14px',
                marginBottom: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#9f1239', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Fee Duration (Months)
                  </span>
                  <span style={{ fontSize: '11px', color: '#be123c', fontWeight: 600 }}>
                    Base Monthly Fee: ₹{Number(customCourseFee) || 800}/mo
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {[1, 2, 3, 6].map((count) => {
                    const isSelected = monthsCount === count;
                    return (
                      <button
                        key={count}
                        type="button"
                        onClick={() => handleMonthsCountChange(count)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: isSelected ? 700 : 500,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          border: isSelected ? '1.5px solid #E11D48' : '1px solid #e2e8f0',
                          backgroundColor: isSelected ? '#E11D48' : '#ffffff',
                          color: isSelected ? '#ffffff' : '#334155',
                          boxShadow: isSelected ? '0 2px 4px rgba(225, 29, 72, 0.25)' : 'none'
                        }}
                      >
                        {count === 1 ? '1 Month' : `${count} Months`}
                      </button>
                    );
                  })}

                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Custom:</span>
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={monthsCount}
                      onChange={(e) => handleMonthsCountChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      style={{
                        width: '60px',
                        padding: '5px 8px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        fontWeight: 600,
                        textAlign: 'center',
                        color: '#0f172a'
                      }}
                    />
                    <span style={{ fontSize: '12px', color: '#64748b' }}>mo</span>
                  </div>
                </div>

                {/* Period Coverage Preview */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '6px',
                  borderTop: '1px dashed rgba(225, 29, 72, 0.2)',
                  fontSize: '12px'
                }}>
                  <span style={{ color: '#475569', fontWeight: 600 }}>
                    Coverage: <strong style={{ color: '#0f172a' }}>{getBillingPeriodCoverage(billingPeriod || currentMonthDefault, monthsCount || 1)}</strong>
                  </span>
                  <span style={{ color: '#059669', fontWeight: 700 }}>
                    Total: ₹{((Number(customCourseFee) || 800) * (monthsCount || 1)) - (Number(discount) || 0)}
                  </span>
                </div>
              </div>

              <div className="fee-modal-grid-2" style={{ margin: 0 }}>
                <Input
                  label="Total Amount Paid (₹) *"
                  type="number"
                  min="0"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(Math.max(0, Number(e.target.value) || 0).toString())}
                  required
                />
                <Input
                  label="Discount / Concession (₹)"
                  type="number"
                  min="0"
                  value={discount}
                  onChange={(e) => handleOnlineDiscountChange(Math.max(0, Number(e.target.value) || 0).toString())}
                />
              </div>

              <div className="fee-modal-grid-2" style={{ margin: 0 }}>
                <Select
                  label="Starting Billing Month *"
                  options={generateMonthOptions()}
                  value={billingPeriod}
                  onChange={(e) => handleBillingMonthChange(e.target.value)}
                  required
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Next Due Date
                  </label>
                  <input
                    type="date"
                    className="fee-custom-date-input"
                    value={customNextDueDate === 'NO_DUES' ? '' : customNextDueDate}
                    onChange={(e) => handleCustomDueDateChange(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {/* Payment Mode & Reference / Remarks */}
          <div className="fee-modal-grid-2" style={{ margin: 0 }}>
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
            {paymentMode !== 'Cash' ? (
              <Input
                label="Transaction / Reference Number"
                placeholder="e.g. UPI Ref / UTR / Cheque No."
                value={transactionNumber}
                onChange={(e) => setTransactionNumber(e.target.value)}
              />
            ) : (
              <Input
                label="Remarks / Notes (Optional)"
                placeholder="e.g. Paid in cash"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            )}
          </div>

          {paymentMode !== 'Cash' && (
            <Input
              label="Remarks / Notes (Optional)"
              placeholder="e.g. First installment paid"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          )}

          <div className="modal-form-footer">
            <button type="button" className="btn-modal-cancel" onClick={() => setIsPaymentModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-modal-primary" disabled={isSaving}>
              <Printer size={18} />
              {isSaving ? "Recording Payment..." : `Record Payment (₹${(Number(amountPaid) || 0).toLocaleString('en-IN')}) & Print Receipt`}
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
        plan={{ planName: (receiptModalTx?.monthsCount === 0 || receiptModalTx?.billingPeriod?.includes('One-Time') || receiptModalTx?.billingPeriod?.includes('Course Fee')) ? 'Course Fee (Offline / Full Course)' : `Monthly Fee (${receiptModalTx?.monthsCount || 1} Months)` }}
      />
    </div>
  );
};

export default Fees;
