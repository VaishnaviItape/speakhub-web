import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import { db } from '../../config/firebase';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import type { FeePlan, Course } from '../../types/models';
import '../../components/ui/TableStyles.css';

const FeePlans: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Data State
  const [plans, setPlans] = useState<FeePlan[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  // Form State
  const [courseId, setCourseId] = useState('');
  const [planName, setPlanName] = useState('');
  const [admissionFee, setAdmissionFee] = useState<number>(0);
  const [monthlyFee, setMonthlyFee] = useState<number>(0);
  const [quarterlyFee, setQuarterlyFee] = useState<number>(0);
  const [halfYearlyFee, setHalfYearlyFee] = useState<number>(0);
  const [yearlyFee, setYearlyFee] = useState<number>(0);
  const [registrationFee, setRegistrationFee] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [gst, setGst] = useState<number>(0);
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  const totalFee = admissionFee + registrationFee + yearlyFee - discount; // Approximate simple total representation

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const cSnap = await getDocs(collection(db, 'courses'));
      setCourses(cSnap.docs.map(d => ({ documentId: d.id, ...d.data() } as Course)));
      
      const snap = await getDocs(collection(db, 'fee_plans'));
      setPlans(snap.docs.map(d => ({ documentId: d.id, ...d.data() } as FeePlan)));
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const planData: Partial<FeePlan> = {
        courseId, planName, admissionFee, monthlyFee, quarterlyFee, halfYearlyFee, yearlyFee, registrationFee, discount, gst, totalFee, status
      };

      if (editingId) {
        await updateDoc(doc(db, 'fee_plans', editingId), planData);
      } else {
        planData.createdAt = serverTimestamp() as any;
        await addDoc(collection(db, 'fee_plans'), planData);
      }

      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (e) {
      console.error(e);
      alert("Error saving fee plan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setCourseId(''); setPlanName(''); setAdmissionFee(0); setMonthlyFee(0); setQuarterlyFee(0); setHalfYearlyFee(0); setYearlyFee(0);
    setRegistrationFee(0); setDiscount(0); setGst(0); setStatus('active');
  };

  const handleEdit = (plan: FeePlan) => {
    setEditingId(plan.documentId!);
    setCourseId(plan.courseId); setPlanName(plan.planName); setAdmissionFee(plan.admissionFee); setMonthlyFee(plan.monthlyFee || 0);
    setQuarterlyFee(plan.quarterlyFee || 0); setHalfYearlyFee(plan.halfYearlyFee || 0); setYearlyFee(plan.yearlyFee || 0);
    setRegistrationFee(plan.registrationFee); setDiscount(plan.discount); setGst(plan.gst || 0); setStatus(plan.status);
    setIsModalOpen(true);
  };

  const handleDelete = async (plan: FeePlan) => {
    if(confirm("Are you sure you want to delete this fee plan?")) {
      await deleteDoc(doc(db, 'fee_plans', plan.documentId!));
      fetchData();
    }
  };

  const columns: Column<FeePlan>[] = [
    {
      key: 'planName',
      header: 'Plan Details',
      render: (row) => (
        <div>
          <div className="font-medium">{row.planName}</div>
          <div className="text-xs text-[var(--text-muted)]">{courses.find(c => c.documentId === row.courseId)?.courseName || row.courseId}</div>
        </div>
      )
    },
    {
      key: 'fees',
      header: 'Fee Structure',
      render: (row) => (
        <div className="text-sm">
          <div>Admission: <span className="font-bold text-gray-800">₹{row.admissionFee}</span></div>
          <div>Monthly: <span className="font-bold text-gray-800">₹{row.monthlyFee}</span></div>
          <div>Registration: <span className="font-bold text-gray-800">₹{row.registrationFee}</span></div>
        </div>
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span className={`px-2 py-1 rounded text-xs font-bold ${row.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {row.status.toUpperCase()}
        </span>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex gap-2 items-center">
          <button className="text-blue-600 hover:bg-blue-50 p-1 rounded" onClick={() => handleEdit(row)}><Edit size={16}/></button>
          <button className="text-red-600 hover:bg-red-50 p-1 rounded" onClick={() => handleDelete(row)}><Trash2 size={16}/></button>
        </div>
      )
    }
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Fee Plans Configuration</h1>
          <div className="breadcrumbs">
            <span>Fees</span> <span className="separator">/</span> <span className="current">Plans</span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setIsModalOpen(true); }}>
          <Plus size={16} /> Add Fee Plan
        </button>
      </div>

      <DataTable 
        title="Fee Plans" 
        data={plans} 
        columns={columns} 
        searchPlaceholder="Search plans..."
        isLoading={isLoading}
      />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Edit Fee Plan" : "Create Fee Plan"}>
        <form onSubmit={handleSubmit} className="modal-form" style={{maxHeight: '75vh', overflowY: 'auto', paddingRight: '10px'}}>
          
          <div className="bg-gray-50 p-4 rounded-lg mb-4 border border-gray-200">
            <h4 className="font-bold text-gray-700 mb-2">Basic Info</h4>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Input label="Plan Name" placeholder="e.g. Standard Entry Plan" value={planName} onChange={(e) => setPlanName(e.target.value)} required />
              <Select label="Course" options={[{label: 'Select Course', value: ''}, ...courses.map(c => ({label: c.courseName, value: c.documentId!}))]} value={courseId} onChange={(e) => setCourseId(e.target.value)} required />
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg mb-4 border border-blue-200">
            <h4 className="font-bold text-blue-800 mb-2">Fee Structure</h4>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <Input label="Registration Fee (₹)" type="number" value={registrationFee.toString()} onChange={(e) => setRegistrationFee(Number(e.target.value))} required />
              <Input label="Admission Fee (₹)" type="number" value={admissionFee.toString()} onChange={(e) => setAdmissionFee(Number(e.target.value))} required />
              <Input label="Discount (₹)" type="number" value={discount.toString()} onChange={(e) => setDiscount(Number(e.target.value))} />
            </div>
            
            <h4 className="font-bold text-blue-800 mb-2 border-t border-blue-200 pt-4">Recurring Fees</h4>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Input label="Monthly Fee (₹)" type="number" value={monthlyFee.toString()} onChange={(e) => setMonthlyFee(Number(e.target.value))} />
              <Input label="Quarterly Fee (₹)" type="number" value={quarterlyFee.toString()} onChange={(e) => setQuarterlyFee(Number(e.target.value))} />
              <Input label="Half-Yearly Fee (₹)" type="number" value={halfYearlyFee.toString()} onChange={(e) => setHalfYearlyFee(Number(e.target.value))} />
              <Input label="Yearly Fee (₹)" type="number" value={yearlyFee.toString()} onChange={(e) => setYearlyFee(Number(e.target.value))} />
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-4 border-t border-blue-200 pt-4">
               <Input label="GST (%)" type="number" value={gst.toString()} onChange={(e) => setGst(Number(e.target.value))} />
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-200">
             <Select 
                label="Status" 
                options={[{label: 'Active', value: 'active'}, {label: 'Inactive', value: 'inactive'}]} 
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
              />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn bg-gray-200 text-gray-800" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Plan'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default FeePlans;
