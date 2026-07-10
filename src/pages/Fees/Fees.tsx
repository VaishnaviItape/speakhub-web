import React, { useState, useEffect } from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import type { Fee } from '../../types/models';
import '../../components/ui/TableStyles.css';

const Fees: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form State
  const [studentId, setStudentId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [amount, setAmount] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<'paid' | 'pending' | 'overdue'>('pending');
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'Razorpay' | 'Cash'>('Cash');

  // Dummy Data
  const [fees, setFees] = useState<Fee[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFees([
        {
          documentId: '1',
          studentId: 'STU-001 (John Doe)',
          courseId: 'Course1',
          amount: 5000,
          paidAmount: 2000,
          dueDate: new Date('2026-07-15'),
          status: 'pending',
          paymentMethod: 'UPI',
          createdAt: new Date()
        }
      ]);
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newFee: Fee = {
      documentId: Math.random().toString(36).substr(2, 9),
      studentId,
      courseId,
      amount: Number(amount),
      paidAmount: Number(paidAmount),
      dueDate: new Date(dueDate),
      status,
      paymentMethod,
      createdAt: new Date()
    };
    setFees([...fees, newFee]);
    setIsModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setStudentId('');
    setCourseId('');
    setAmount('');
    setPaidAmount('');
    setDueDate('');
    setStatus('pending');
    setPaymentMethod('Cash');
  };

  const handleEdit = (fee: Fee) => {
    setStudentId(fee.studentId);
    setCourseId(fee.courseId);
    setAmount(fee.amount.toString());
    setPaidAmount(fee.paidAmount.toString());
    setDueDate(fee.dueDate instanceof Date ? fee.dueDate.toISOString().split('T')[0] : '');
    setStatus(fee.status);
    setPaymentMethod(fee.paymentMethod || 'Cash');
    setIsModalOpen(true);
  };

  const handleDelete = (fee: Fee) => {
    setFees(fees.filter(f => f.documentId !== fee.documentId));
  };

  const columns: Column<Fee>[] = [
    {
      key: 'studentId',
      header: 'Student',
      render: (row) => <span className="font-medium">{row.studentId}</span>
    },
    {
      key: 'courseId',
      header: 'Course'
    },
    {
      key: 'amount',
      header: 'Amount (Total/Paid)',
      render: (row) => (
        <div>
          <span className="text-gray-900 font-bold">₹{row.amount}</span>
          <br/>
          <span className="text-green-600 text-xs font-bold">Paid: ₹{row.paidAmount}</span>
        </div>
      )
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      render: (row) => (
        row.dueDate instanceof Date ? row.dueDate.toLocaleDateString() : 'Invalid Date'
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        let badgeClass = 'inactive'; // red (overdue)
        if (row.status === 'paid') badgeClass = 'active'; // green
        if (row.status === 'pending') badgeClass = 'pending'; // orange
        
        return (
          <button className={`dt-badge ${badgeClass}`}>
            {row.status.charAt(0).toUpperCase() + row.status.slice(1)} <ChevronDown size={14} />
          </button>
        );
      }
    }
  ];

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Fees Collection</h1>
          <div className="breadcrumbs">
            <span>Dashboard</span> <span className="separator">/</span> <span className="current">Fees</span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} />
          Record Payment
        </button>
      </div>

      <DataTable 
        title="Recent Fee Records" 
        data={fees} 
        columns={columns} 
        onEdit={handleEdit}
        onDelete={handleDelete}
        searchPlaceholder="Search students or courses..."
        isLoading={isLoading}
      />

      {/* Add Fee Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Record Fee Payment">
        <form onSubmit={handleSubmit} className="modal-form">
          <Select 
            label="Student" 
            options={[
              {label: 'Select Student', value: ''},
              {label: 'STU-001 (John Doe)', value: 'STU-001 (John Doe)'},
              {label: 'STU-002 (Jane Smith)', value: 'STU-002 (Jane Smith)'}
            ]} 
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            required
          />
          <Select 
            label="Course" 
            options={[
              {label: 'Select Course', value: ''},
              {label: 'Spoken English Basics', value: 'Course1'}, 
              {label: 'Advanced English', value: 'Course2'}
            ]} 
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            required
          />
          
          <div className="grid grid-cols-2 gap-4">
            <Input 
              type="number"
              label="Total Fee Amount" 
              placeholder="5000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required 
            />
            <Input 
              type="number"
              label="Amount Paid Now" 
              placeholder="2000"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              required 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select 
              label="Payment Method" 
              options={[
                {label: 'Cash', value: 'Cash'},
                {label: 'UPI', value: 'UPI'},
                {label: 'Razorpay', value: 'Razorpay'}
              ]} 
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as 'UPI'|'Razorpay'|'Cash')}
              required
            />
            <Input 
              type="date"
              label="Next Due Date" 
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </div>

          <Select 
            label="Status" 
            options={[
              {label: 'Pending', value: 'pending'}, 
              {label: 'Paid', value: 'paid'},
              {label: 'Overdue', value: 'overdue'}
            ]} 
            value={status}
            onChange={(e) => setStatus(e.target.value as 'paid' | 'pending' | 'overdue')}
          />
          
          <div className="modal-actions">
            <button type="submit" className="btn btn-success">Save Record</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Fees;
