import React, { useState, useEffect } from 'react';
import { Plus, MessageCircle } from 'lucide-react';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import type { FeeTransaction, User, Course } from '../../types/models';
import { validatePositiveNumber } from '../../utils/validation';
import '../../components/ui/TableStyles.css';
import ReceiptTemplate from './ReceiptTemplate';

interface StudentFeeRecord {
  studentId: string;
  studentName: string;
  courseId: string;
  courseName: string;
  monthlyFee: number;
  lastPaymentDate?: Date;
  lastPaidMonth?: string;
}

const Fees: React.FC = () => {
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Data State
  const [students, setStudents] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [feeRecords, setFeeRecords] = useState<StudentFeeRecord[]>([]);

  // Payment Form
  const [paymentStudentId, setPaymentStudentId] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [discount, setDiscount] = useState('0');
  const [lateFee, setLateFee] = useState('0');
  const [academicYear, setAcademicYear] = useState('2026-27');
  const [billingPeriod, setBillingPeriod] = useState('');
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'UPI' | 'Bank Transfer' | 'Online Gateway'>('Cash');
  const [transactionNumber, setTransactionNumber] = useState('');

  // Receipt State
  const [printedTransaction, setPrintedTransaction] = useState<FeeTransaction | null>(null);
  
  useEffect(() => {
    fetchData();
  }, []);

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

        return {
          studentId: student.documentId!,
          studentName: student.name || student.email,
          courseId: courseId,
          courseName: course?.courseName || 'Unassigned',
          monthlyFee: course?.monthlyFee || 0,
          lastPaymentDate: lastTx?.paymentDate ? new Date(lastTx.paymentDate.seconds * 1000) : undefined,
          lastPaidMonth: lastTx?.billingPeriod
        };
      });

      setFeeRecords(records);

    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-fill amount when student is selected
  useEffect(() => {
    if (paymentStudentId) {
      const record = feeRecords.find(r => r.studentId === paymentStudentId);
      if (record) {
        setAmountPaid(record.monthlyFee.toString());
      }
    }
  }, [paymentStudentId, feeRecords]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    const amtVal = validatePositiveNumber(amountPaid, 'Amount Paid');
    if (!amtVal.isValid) {
      alert(amtVal.error);
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
      const disc = Number(discount);
      const lf = Number(lateFee);
      
      const newTransaction: Partial<FeeTransaction> = {
        studentId: record.studentId,
        courseId: record.courseId,
        academicYear,
        billingPeriod,
        paymentDate: serverTimestamp() as any,
        amountPaid: amt,
        discount: disc,
        lateFee: lf,
        paymentMode,
        transactionNumber,
        receivedBy: 'Admin',
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
      setBillingPeriod('');
      
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

  const openWhatsApp = (phone: string | undefined, name: string | undefined, monthlyFee: number) => {
    if(!phone) { alert("No phone number registered for this student."); return; }
    const msg = `Hello ${name || 'Student'},\n\nYour monthly fee of ₹${monthlyFee} is due. Please complete your payment using this link: https://speakhub.com/pay \n\nThank you,\nSpeak Hub Academy`;
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const columns: Column<StudentFeeRecord>[] = [
    {
      key: 'studentName',
      header: 'Student Name',
      render: (row) => <span className="font-bold text-gray-800">{row.studentName}</span>
    },
    {
      key: 'courseName',
      header: 'Assigned Course',
      render: (row) => (
        <span className="font-medium text-blue-800">{row.courseName}</span>
      )
    },
    {
      key: 'monthlyFee',
      header: 'Monthly Fee',
      render: (row) => (
        <div className="text-sm font-bold text-green-700">₹{row.monthlyFee} / month</div>
      )
    },
    {
      key: 'lastPayment',
      header: 'Last Payment',
      render: (row) => (
        <div>
          {row.lastPaymentDate ? (
            <>
              <div className="font-bold text-gray-700">{row.lastPaidMonth}</div>
              <div className="text-xs text-gray-500">Paid on: {row.lastPaymentDate.toLocaleDateString()}</div>
            </>
          ) : (
            <span className="text-gray-400 italic">No payments yet</span>
          )}
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
          <div className="flex gap-2 items-center">
            <button className="btn btn-primary" style={{padding: '4px 8px', fontSize: '12px'}} onClick={() => { setPaymentStudentId(row.studentId); setIsPaymentModalOpen(true); }}>
              Pay Monthly Fee
            </button>
            <button className="btn btn-outline" style={{padding: '4px 8px', fontSize: '12px', color: '#16a34a', borderColor: '#16a34a'}} onClick={() => openWhatsApp(phone, student?.name, row.monthlyFee)}>
              <MessageCircle size={14} className="mr-1" /> WhatsApp
            </button>
          </div>
        )
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
        <button className="btn btn-primary" onClick={() => { if(feeRecords.length>0) { setPaymentStudentId(feeRecords[0].studentId); setIsPaymentModalOpen(true); } }}>
          <Plus size={16} /> Record Payment
        </button>
      </div>

      <DataTable 
        title="Student Monthly Fees" 
        data={feeRecords} 
        columns={columns} 
        searchPlaceholder="Search students..."
        isLoading={isLoading}
      />

      {/* Record Payment Modal */}
      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Record Monthly Fee">
        <form onSubmit={handleRecordPayment} className="modal-form">
          <Select 
            label="Select Student" 
            options={feeRecords.map(r => ({label: `${r.studentName} (${r.courseName})`, value: r.studentId}))} 
            value={paymentStudentId}
            onChange={(e) => setPaymentStudentId(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-4 mt-4">
            <Input label="Academic Year" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} required />
            <Input label="Billing Month (e.g., Aug 2026)" value={billingPeriod} onChange={(e) => setBillingPeriod(e.target.value)} required />
          </div>

          <div className="grid grid-cols-3 gap-4 mt-4">
            <Input label="Amount Paid (₹)" type="number" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} required />
            <Input label="Discount (₹)" type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            <Input label="Late Fee (₹)" type="number" value={lateFee} onChange={(e) => setLateFee(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <Select 
              label="Payment Mode" 
              options={[{label: 'Cash', value: 'Cash'}, {label: 'UPI', value: 'UPI'}, {label: 'Bank Transfer', value: 'Bank Transfer'}]} 
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value as any)}
              required
            />
            <Input label="Transaction Number (Optional)" value={transactionNumber} onChange={(e) => setTransactionNumber(e.target.value)} />
          </div>

          <div className="modal-actions mt-6">
            <button type="submit" className="btn btn-success" disabled={isSaving}>
              {isSaving ? "Processing..." : "Record Payment & Print Receipt"}
            </button>
          </div>
        </form>
      </Modal>

      {printedTransaction && (
        <ReceiptTemplate 
          transaction={printedTransaction} 
          student={students.find(s => s.documentId === printedTransaction.studentId)!}
          plan={{planName: 'Monthly Fee'}}
          course={courses.find(c => c.documentId === printedTransaction.courseId)! || {courseName: 'Course'}}
        />
      )}
    </div>
  );
};

export default Fees;
