import React, { useState, useEffect } from 'react';
import { Check, CalendarPlus } from 'lucide-react';
import DataTable, { type Column } from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import Select from '../../components/forms/Select';
import { db } from '../../config/firebase';
import { collection, query, getDocs, doc, updateDoc, deleteDoc, orderBy, where, addDoc } from 'firebase/firestore';
import '../../components/ui/TableStyles.css';

interface Inquiry {
  documentId?: string;
  studentName: string;
  phone: string;
  courseName: string;
  notes: string;
  status: string;
  assignedBatchId?: string;
  assignedBatchName?: string;
  createdAt: any;
}

interface Batch {
  documentId: string;
  batchName: string;
  courseId?: string;
  courseName?: string;
}

const Enquiries: React.FC = () => {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Assign Batch Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState('');

  const fetchInquiries = async () => {
    try {
      setIsLoading(true);
      const q = query(collection(db, 'inquiries'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const fetchedInquiries: Inquiry[] = [];
      querySnapshot.forEach((doc) => {
        fetchedInquiries.push({ documentId: doc.id, ...doc.data() } as Inquiry);
      });
      setInquiries(fetchedInquiries);
    } catch (error) {
      console.error("Error fetching inquiries:", error);
      alert("Failed to load inquiries.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBatches = async () => {
    try {
      const bq = query(collection(db, 'batches'), where('status', '==', 'active'));
      const querySnapshot = await getDocs(bq);
      const fetchedBatches: Batch[] = [];
      querySnapshot.forEach((doc) => {
        fetchedBatches.push({ documentId: doc.id, ...doc.data() } as Batch);
      });
      setBatches(fetchedBatches);
    } catch (error) {
      console.error("Error fetching batches:", error);
    }
  };

  useEffect(() => {
    fetchInquiries();
    fetchBatches();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const docRef = doc(db, 'inquiries', id);
      await updateDoc(docRef, { status: newStatus });
      fetchInquiries();
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status.");
    }
  };

  const handleAssignBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInquiry || !selectedBatchId) return;

    const selectedBatch = batches.find(b => b.documentId === selectedBatchId);
    if (!selectedBatch) return;

    try {
      // 1. Update Inquiry Status
      const docRef = doc(db, 'inquiries', selectedInquiry.documentId!);
      await updateDoc(docRef, { 
        status: 'assigned',
        assignedBatchId: selectedBatch.documentId,
        assignedBatchName: selectedBatch.batchName
      });

      // 2. Add / Update Student in users collection
      const cleanPhone = selectedInquiry.phone.replace(/[^0-9]/g, '');
      const qPhone = query(collection(db, 'users'), where('phone', '==', cleanPhone));
      const pSnap = await getDocs(qPhone);
      
      if (!pSnap.empty) {
        // Update existing student
        const userDoc = pSnap.docs[0];
        const userData = userDoc.data();
        await updateDoc(doc(db, 'users', userDoc.id), {
          role: userData.role || 'student',
          status: userData.status || 'active',
          batchIds: Array.from(new Set([...(userData.batchIds || []), selectedBatch.documentId])),
          courseIds: Array.from(new Set([...(userData.courseIds || []), selectedBatch.courseId || '']))
        });
      } else {
        // Try checking 'mobile' field just in case
        const qMobile = query(collection(db, 'users'), where('mobile', '==', cleanPhone));
        const mSnap = await getDocs(qMobile);
        if (!mSnap.empty) {
          const userDoc = mSnap.docs[0];
          const userData = userDoc.data();
          await updateDoc(doc(db, 'users', userDoc.id), {
            role: userData.role || 'student',
            status: userData.status || 'active',
            batchIds: Array.from(new Set([...(userData.batchIds || []), selectedBatch.documentId])),
            courseIds: Array.from(new Set([...(userData.courseIds || []), selectedBatch.courseId || '']))
          });
        } else {
          // Create new student
          await addDoc(collection(db, 'users'), {
            name: selectedInquiry.studentName,
            phone: cleanPhone,
            mobile: cleanPhone,
            role: 'student',
            status: 'active',
            batchIds: [selectedBatch.documentId],
            courseIds: [selectedBatch.courseId || ''],
            joiningDate: new Date()
          });
        }
      }

      setIsModalOpen(false);
      setSelectedInquiry(null);
      setSelectedBatchId('');
      fetchInquiries();
    } catch (error) {
      console.error("Error assigning batch:", error);
      alert("Failed to assign batch.");
    }
  };

  const openAssignModal = (inquiry: Inquiry) => {
    setSelectedInquiry(inquiry);
    setSelectedBatchId('');
    setIsModalOpen(true);
  };

  const handleDelete = async (inquiry: Inquiry) => {
    if (!inquiry.documentId) return;
    if (window.confirm('Are you sure you want to delete this inquiry?')) {
      try {
        if (inquiry.status === 'assigned' && inquiry.assignedBatchId) {
          const cleanPhone = inquiry.phone.replace(/[^0-9]/g, '');
          const qPhone = query(collection(db, 'users'), where('phone', '==', cleanPhone));
          const pSnap = await getDocs(qPhone);
          
          if (!pSnap.empty) {
            const userDoc = pSnap.docs[0];
            const userData = userDoc.data();
            await updateDoc(doc(db, 'users', userDoc.id), {
              batchIds: (userData.batchIds || []).filter((id: string) => id !== inquiry.assignedBatchId)
            });
          } else {
            const qMobile = query(collection(db, 'users'), where('mobile', '==', cleanPhone));
            const mSnap = await getDocs(qMobile);
            if (!mSnap.empty) {
              const userDoc = mSnap.docs[0];
              const userData = userDoc.data();
              await updateDoc(doc(db, 'users', userDoc.id), {
                batchIds: (userData.batchIds || []).filter((id: string) => id !== inquiry.assignedBatchId)
              });
            }
          }
        }

        await deleteDoc(doc(db, 'inquiries', inquiry.documentId));
        fetchInquiries();
      } catch (error) {
        console.error("Error deleting inquiry:", error);
        alert("Failed to delete inquiry");
      }
    }
  };

  const columns: Column<Inquiry>[] = [
    {
      key: 'studentName',
      header: 'Student Name',
      render: (row) => <span className="font-bold text-gray-800">{row.studentName}</span>
    },
    {
      key: 'phone',
      header: 'Phone Number',
      render: (row) => <span className="text-gray-600 font-medium">{row.phone}</span>
    },
    {
      key: 'courseName',
      header: 'Interested Course',
      render: (row) => (
        <div className="flex flex-col">
          <span className="text-blue-700 font-medium">{row.courseName || '-'}</span>
          {row.assignedBatchName && (
            <span className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <Check size={12} /> {row.assignedBatchName}
            </span>
          )}
        </div>
      )
    },
    {
      key: 'notes',
      header: 'Notes / Time',
      render: (row) => <div className="max-w-xs truncate text-gray-500" title={row.notes}>{row.notes || '-'}</div>
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: (row) => (
        <span className="text-sm text-gray-500">
          {row.createdAt?.toDate ? row.createdAt.toDate().toLocaleDateString() : '-'}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        let badgeClass = 'inactive'; 
        if (row.status === 'resolved' || row.status === 'contacted' || row.status === 'assigned') badgeClass = 'active';
        if (row.status === 'pending') badgeClass = 'pending';
        
        return (
          <div className="flex gap-2 items-center">
            <span className={`dt-badge ${badgeClass}`}>
              {row.status ? row.status.charAt(0).toUpperCase() + row.status.slice(1) : 'Pending'}
            </span>
            {row.status === 'pending' && (
              <>
                <button 
                  title="Mark as Contacted"
                  onClick={() => handleUpdateStatus(row.documentId!, 'contacted')}
                  className="text-green-600 hover:bg-green-50 p-1 rounded transition-colors"
                >
                  <Check size={16} />
                </button>
                <button 
                  title="Assign Batch"
                  onClick={() => openAssignModal(row)}
                  className="text-blue-600 hover:bg-blue-50 p-1 rounded transition-colors"
                >
                  <CalendarPlus size={16} />
                </button>
              </>
            )}
            {row.status === 'contacted' && (
              <button 
                title="Assign Batch"
                onClick={() => openAssignModal(row)}
                className="text-blue-600 hover:bg-blue-50 p-1 rounded transition-colors"
              >
                <CalendarPlus size={16} />
              </button>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Enquiries</h1>
          <div className="breadcrumbs">
            <span>Dashboard</span> <span className="separator">/</span> <span className="current">Enquiries</span>
          </div>
        </div>
      </div>

      <DataTable 
        title="Recent Inquiries" 
        data={inquiries} 
        columns={columns} 
        onDelete={handleDelete}
        onRefresh={fetchInquiries}
        searchPlaceholder="Search enquiries by name or phone..."
        isLoading={isLoading}
      />

      {/* Assign Batch Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Assign Batch">
        <form onSubmit={handleAssignBatchSubmit} className="modal-form">
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-1">Student:</p>
            <p className="font-medium">{selectedInquiry?.studentName}</p>
          </div>
          
          <Select 
            label="Select Batch"
            options={[
              { label: 'Select a batch...', value: '' },
              ...batches.map(b => ({
                label: b.batchName,
                value: b.documentId
              }))
            ]}
            value={selectedBatchId}
            onChange={(e) => setSelectedBatchId(e.target.value)}
            required
          />

          <div className="modal-form-footer">
            <button type="button" className="btn-modal-cancel" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-modal-primary" disabled={!selectedBatchId}>
              Confirm Batch Assignment
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Enquiries;
