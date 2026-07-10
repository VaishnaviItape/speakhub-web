import React, { useState, useEffect } from 'react';
import { Plus, ChevronDown } from 'lucide-react';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import type { Batch } from '../../types/models';
import '../../components/ui/TableStyles.css';

const Batches: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form State
  const [batchName, setBatchName] = useState('');
  const [courseId, setCourseId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<'active' | 'completed' | 'inactive'>('active');

  // Dummy Data
  const [batches, setBatches] = useState<Batch[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setBatches([
        { 
          documentId: '1', 
          courseId: 'Course1', 
          teacherId: 'Teacher1', 
          batchName: 'Morning Batch A',
          meetingLink: 'https://meet.google.com/abc-defg-hij',
          startDate: new Date(),
          endDate: new Date(),
          status: 'active' 
        }
      ]);
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newBatch: Batch = {
      documentId: Math.random().toString(36).substr(2, 9),
      batchName,
      courseId,
      teacherId,
      meetingLink,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status
    };
    setBatches([...batches, newBatch]);
    setIsModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setBatchName('');
    setCourseId('');
    setTeacherId('');
    setMeetingLink('');
    setStartDate('');
    setEndDate('');
    setStatus('active');
  };

  const handleEdit = (batch: Batch) => {
    setBatchName(batch.batchName);
    setCourseId(batch.courseId);
    setTeacherId(batch.teacherId);
    setMeetingLink(batch.meetingLink || '');
    // Format dates properly for input type="date"
    setStartDate(batch.startDate instanceof Date ? batch.startDate.toISOString().split('T')[0] : '');
    setEndDate(batch.endDate instanceof Date ? batch.endDate.toISOString().split('T')[0] : '');
    setStatus(batch.status);
    setIsModalOpen(true);
  };

  const handleDelete = (batch: Batch) => {
    setBatches(batches.filter(b => b.documentId !== batch.documentId));
  };

  const columns: Column<Batch>[] = [
    {
      key: 'batchName',
      header: 'Batch Name',
      render: (row) => <span className="font-medium">{row.batchName}</span>
    },
    {
      key: 'courseId',
      header: 'Course & Teacher',
      render: (row) => (
        <div>
          <div>{row.courseId}</div>
          <div style={{ fontSize: '0.75rem', color: '#a3aed0' }}>{row.teacherId}</div>
        </div>
      )
    },
    {
      key: 'meetingLink',
      header: 'Meeting Link',
      render: (row) => (
        row.meetingLink ? (
          <a href={row.meetingLink} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate inline-block max-w-[150px]">
            {row.meetingLink}
          </a>
        ) : (
          <span style={{ color: '#a3aed0' }}>-</span>
        )
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <button className={`dt-badge ${
          row.status === 'active' ? 'active' : 
          row.status === 'completed' ? 'pending' : 'inactive'
        }`}>
          {row.status.charAt(0).toUpperCase() + row.status.slice(1)} <ChevronDown size={14} />
        </button>
      )
    }
  ];

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Batches</h1>
          <div className="breadcrumbs">
            <span>Dashboard</span> <span className="separator">/</span> <span className="current">Batches</span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} />
          Add Batch
        </button>
      </div>

      <DataTable 
        title="Batch Records" 
        data={batches} 
        columns={columns} 
        onEdit={handleEdit}
        onDelete={handleDelete}
        searchPlaceholder="Search batches..."
        isLoading={isLoading}
      />

      {/* Add Batch Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Batch Request">
        <form onSubmit={handleSubmit} className="modal-form">
          <Input 
            label="Batch Name" 
            placeholder="e.g. Morning Batch A"
            value={batchName}
            onChange={(e) => setBatchName(e.target.value)}
            required 
          />
          <div className="grid grid-cols-2 gap-4">
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
            <Select 
              label="Teacher" 
              options={[
                {label: 'Select Teacher', value: ''},
                {label: 'John Doe', value: 'Teacher1'}, 
                {label: 'Jane Smith', value: 'Teacher2'}
              ]} 
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              required
            />
          </div>
          <Input 
            label="Meeting Link (Optional)" 
            placeholder="e.g. https://meet.google.com/..."
            value={meetingLink}
            onChange={(e) => setMeetingLink(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input 
              type="date"
              label="Start Date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
            <Input 
              type="date"
              label="End Date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>
          <Select 
            label="Status" 
            options={[
              {label: 'Active', value: 'active'}, 
              {label: 'Completed', value: 'completed'},
              {label: 'Inactive', value: 'inactive'}
            ]} 
            value={status}
            onChange={(e) => setStatus(e.target.value as 'active' | 'completed' | 'inactive')}
          />
          
          <div className="modal-actions">
            <button type="submit" className="btn btn-success">Save Batch</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Batches;
