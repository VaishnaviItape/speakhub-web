import React, { useState, useEffect } from 'react';
import { Plus, ChevronDown, UserPlus, MessageCircle, FileText } from 'lucide-react';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import type { FeePlan, StudentFeePlan, FeeTransaction, User, Course } from '../../types/models';
import '../../components/ui/TableStyles.css';
import ReceiptTemplate from './ReceiptTemplate';

const Fees: React.FC = () => {
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Data State
  const [students, setStudents] = useState<User[]>([]);
  const [feePlans, setFeePlans] = useState<FeePlan[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [studentPlans, setStudentPlans] = useState<(StudentFeePlan & { studentName?: string, planName?: string, totalPlanFee?: number })[]>([]);

  // Assign Plan Form
  const [assignStudentId, setAssignStudentId] = useState('');
  const [assignCourseId, setAssignCourseId] = useState('');
  const [assignPlanId, setAssignPlanId] = useState('');
  const [billingFrequency, setBillingFrequency] = useState<'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly'>('Monthly');
  const [paymentStartDate, setPaymentStartDate] = useState('');

  // Payment Form
  const [paymentPlanId, setPaymentPlanId] = useState('');
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
      const uSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
      const usersList = uSnap.docs.map(d => ({ documentId: d.id, ...d.data() } as User));
      setStudents(usersList);

      const pSnap = await getDocs(collection(db, 'fee_plans'));
      const plansList = pSnap.docs.map(d => ({ documentId: d.id, ...d.data() } as FeePlan));
      setFeePlans(plansList);

      const cSnap = await getDocs(collection(db, 'courses'));
      setCourses(cSnap.docs.map(d => ({ documentId: d.id, ...d.data() } as Course)));

      const spSnap = await getDocs(collection(db, 'student_fee_plans'));
      const spList = spSnap.docs.map(d => {
        const data = d.data() as StudentFeePlan;
        const student = usersList.find(u => u.documentId === data.studentId);
        const plan = plansList.find(p => p.documentId === data.feePlanId);
        return {
          documentId: d.id,
          ...data,
          studentName: student?.name,
          planName: plan?.planName,
          totalPlanFee: plan?.totalFee
        };
      });
      setStudentPlans(spList);

    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const plan = feePlans.find(p => p.documentId === assignPlanId);
      if (!plan) return;

      const newPlan: Partial<StudentFeePlan> = {
        studentId: assignStudentId,
        courseId: assignCourseId,
        batchId: '', // Would map to student's batch normally
        feePlanId: assignPlanId,
        billingFrequency,
        paymentStartDate: new Date(paymentStartDate) as any,
        nextDueDate: new Date(paymentStartDate) as any,
        totalPaid: 0,
        status: 'active',
        createdAt: serverTimestamp() as any
      };

      await addDoc(collection(db, 'student_fee_plans'), newPlan);
      
      // Remove Demo Lock if exists
      const userRef = doc(db, 'users', assignStudentId);
      await updateDoc(userRef, { isDemoMode: false });

      setIsAssignModalOpen(false);
      setAssignStudentId('');
      setAssignCourseId('');
      setAssignPlanId('');
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to assign plan");
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const sp = studentPlans.find(p => p.documentId === paymentPlanId);
      if (!sp) return;

      const amt = Number(amountPaid);
      const disc = Number(discount);
      const lf = Number(lateFee);
      
      const newTransaction: Partial<FeeTransaction> = {
        studentId: sp.studentId,
        studentFeePlanId: sp.documentId,
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

      // Update StudentFeePlan
      let nextDue = sp.nextDueDate instanceof Date ? new Date(sp.nextDueDate) : new Date((sp.nextDueDate as any).seconds * 1000);
      if (sp.billingFrequency === 'Monthly') nextDue.setMonth(nextDue.getMonth() + 1);
      else if (sp.billingFrequency === 'Quarterly') nextDue.setMonth(nextDue.getMonth() + 3);
      else if (sp.billingFrequency === 'Half-Yearly') nextDue.setMonth(nextDue.getMonth() + 6);
      else if (sp.billingFrequency === 'Yearly') nextDue.setFullYear(nextDue.getFullYear() + 1);

      const totalFee = feePlans.find(f => f.documentId === sp.feePlanId)?.totalFee || 0;
      const newPaid = (sp.totalPaid || 0) + amt;
      newTransaction.remainingBalance = Math.max(0, totalFee - newPaid);
      newTransaction.nextDueDate = nextDue;

      await addDoc(collection(db, 'fee_transactions'), newTransaction);

      await updateDoc(doc(db, 'student_fee_plans', sp.documentId!), {
        totalPaid: newPaid,
        nextDueDate: nextDue
      });

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
    }
  };

  const openWhatsApp = (phone: string | undefined, name: string | undefined, amountDue: number) => {
    if(!phone) { alert("No phone number registered for this student."); return; }
    const msg = `Hello ${name || 'Student'},\n\nYour fee of ₹${amountDue} is due. Please complete your payment using this link: https://speakhub.com/pay \n\nThank you,\nSpeak Hub Academy`;
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const columns: Column<any>[] = [
    {
      key: 'studentName',
      header: 'Student Name',
      render: (row) => <span className="font-bold text-gray-800">{row.studentName || 'Unknown'}</span>
    },
    {
      key: 'planName',
      header: 'Assigned Plan',
      render: (row) => (
        <div>
          <div className="font-medium text-blue-800">{row.planName}</div>
          <div className="text-xs text-gray-500">{row.billingFrequency} Billing</div>
        </div>
      )
    },
    {
      key: 'totalFee',
      header: 'Amount',
      render: (row) => {
        const remaining = (row.totalPlanFee || 0) - (row.totalPaid || 0);
        return (
          <div>
            <div className="text-sm font-bold">Total: ₹{row.totalPlanFee || 0}</div>
            <div className="text-xs font-bold text-green-600">Paid: ₹{row.totalPaid || 0}</div>
            <div className="text-xs font-bold text-red-600">Remaining: ₹{remaining}</div>
          </div>
        )
      }
    },
    {
      key: 'nextDueDate',
      header: 'Next Due Date',
      render: (row) => {
        const d = row.nextDueDate?.toDate ? row.nextDueDate.toDate() : new Date(row.nextDueDate);
        const isOverdue = d < new Date();
        return <span className={`font-bold ${isOverdue ? 'text-red-600' : 'text-gray-700'}`}>{d.toLocaleDateString()}</span>;
      }
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => {
        const student = students.find(s => s.documentId === row.studentId);
        const phone = student?.phone || student?.mobile;
        return (
          <div className="flex gap-2 items-center">
            <button className="btn btn-primary" style={{padding: '4px 8px', fontSize: '12px'}} onClick={() => { setPaymentPlanId(row.documentId); setIsPaymentModalOpen(true); }}>
              Pay
            </button>
            <button className="btn btn-outline" style={{padding: '4px 8px', fontSize: '12px', color: '#16a34a', borderColor: '#16a34a'}} onClick={() => openWhatsApp(phone, student?.name, (row.totalPlanFee || 0) - (row.totalPaid || 0))}>
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
          <h1 className="page-title">Fee Collection & Tracking</h1>
          <div className="breadcrumbs">
            <span>Fees</span> <span className="separator">/</span> <span className="current">Collection</span>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="btn btn-outline" onClick={() => setIsAssignModalOpen(true)}>
            <UserPlus size={16} /> Assign Plan
          </button>
          <button className="btn btn-primary" onClick={() => { if(studentPlans.length>0) { setPaymentPlanId(studentPlans[0].documentId!); setIsPaymentModalOpen(true); } }}>
            <Plus size={16} /> Record Payment
          </button>
        </div>
      </div>

      <DataTable 
        title="Student Fee Plans" 
        data={studentPlans} 
        columns={columns} 
        searchPlaceholder="Search students..."
        isLoading={isLoading}
      />

      {/* Assign Plan Modal */}
      <Modal isOpen={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)} title="Assign Fee Plan to Student">
        <form onSubmit={handleAssignPlan} className="modal-form">
          <div className="bg-blue-50 p-4 rounded-lg mb-4 border border-blue-100">
            <p className="text-sm text-blue-800 font-medium mb-4">Assigning a fee plan will automatically revoke the student's Demo restriction and mark them as fully Admitted.</p>
            <Select 
              label="Select Student" 
              options={[{label: 'Choose Student', value: ''}, ...students.map(s => ({label: s.name || s.email, value: s.documentId!}))]} 
              value={assignStudentId}
              onChange={(e) => setAssignStudentId(e.target.value)}
              required
            />
            <Select 
              label="Select Course" 
              options={[{label: 'Choose Course', value: ''}, ...courses.map(c => ({label: c.courseName, value: c.documentId!}))]} 
              value={assignCourseId}
              onChange={(e) => setAssignCourseId(e.target.value)}
              required
            />
            <Select 
              label="Select Fee Plan" 
              options={[{label: 'Choose Plan', value: ''}, ...feePlans.filter(f => f.courseId === assignCourseId).map(p => ({label: `${p.planName} (Total: ₹${p.totalFee})`, value: p.documentId!}))]} 
              value={assignPlanId}
              onChange={(e) => setAssignPlanId(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
             <Select 
              label="Billing Frequency" 
              options={[{label: 'Monthly', value: 'Monthly'}, {label: 'Quarterly', value: 'Quarterly'}, {label: 'Half-Yearly', value: 'Half-Yearly'}, {label: 'Yearly', value: 'Yearly'}]} 
              value={billingFrequency}
              onChange={(e) => setBillingFrequency(e.target.value as any)}
              required
            />
            <Input label="Payment Start Date" type="date" value={paymentStartDate} onChange={(e) => setPaymentStartDate(e.target.value)} required />
          </div>

          <div className="modal-actions mt-6">
            <button type="submit" className="btn btn-primary">Admit & Assign Plan</button>
          </div>
        </form>
      </Modal>

      {/* Record Payment Modal */}
      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Record Payment">
        <form onSubmit={handleRecordPayment} className="modal-form">
          <Select 
            label="Student Plan" 
            options={studentPlans.map(sp => ({label: `${sp.studentName} - ${sp.planName}`, value: sp.documentId!}))} 
            value={paymentPlanId}
            onChange={(e) => setPaymentPlanId(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-4 mt-4">
            <Input label="Academic Year" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} required />
            <Input label="Billing Period (e.g., Aug 2026)" value={billingPeriod} onChange={(e) => setBillingPeriod(e.target.value)} required />
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
            <button type="submit" className="btn btn-success">Record Payment & Print Receipt</button>
          </div>
        </form>
      </Modal>

      {printedTransaction && (
        <ReceiptTemplate 
          transaction={printedTransaction} 
          student={students.find(s => s.documentId === printedTransaction.studentId)!}
          plan={feePlans.find(p => p.documentId === printedTransaction.studentFeePlanId)! || {planName: studentPlans.find(sp => sp.documentId === printedTransaction.studentFeePlanId)?.planName}}
          course={courses.find(c => c.documentId === studentPlans.find(sp => sp.documentId === printedTransaction.studentFeePlanId)?.courseId)! || {courseName: 'Course'}}
        />
      )}
    </div>
  );
};

export default Fees;
