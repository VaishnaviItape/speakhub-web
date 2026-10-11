import React, { useState, useEffect } from 'react';
import { Plus, BookOpen, Search, Check, Info, UserPlus, X } from 'lucide-react';
import Input from '../../components/forms/Input';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import type { User, Batch } from '../../types/models';
import { db } from '../../config/firebase';
import { secondaryAuth } from '../../config/secondaryFirebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { 
  collection, 
  query, 
  getDocs, 
  updateDoc, 
  doc, 
  setDoc, 
  where, 
  serverTimestamp, 
  deleteDoc 
} from 'firebase/firestore';
import { checkMobileExists } from '../../utils/phoneValidation';
import { validateName, validateEmail, validatePhoneNumber } from '../../utils/validation';
import '../../components/ui/TableStyles.css';
import './Teachers.css';

const Teachers: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [batchSearch, setBatchSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Data
  const [teachers, setTeachers] = useState<User[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  // Fetch batches so batchIds can be displayed with human-readable names
  const fetchBatches = async () => {
    try {
      const snap = await getDocs(collection(db, 'batches'));
      const batchList: Batch[] = [];
      snap.forEach(d => {
        batchList.push({ documentId: d.id, ...d.data() } as Batch);
      });
      setBatches(batchList);
    } catch (err) {
      console.error("Error fetching batches:", err);
    }
  };

  const fetchTeachers = async () => {
    try {
      setIsLoading(true);
      const q = query(collection(db, 'users'), where('role', '==', 'teacher'));
      const snapshot = await getDocs(q);
      const fetchedTeachers: User[] = [];
      snapshot.forEach(docSnap => {
        fetchedTeachers.push({ documentId: docSnap.id, ...docSnap.data() } as User);
      });
      setTeachers(fetchedTeachers);
    } catch (error) {
      console.error("Error fetching teachers:", error);
      alert("Failed to load teachers");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
    fetchTeachers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const fnVal = validateName(firstName, 'First Name');
    if (!fnVal.isValid) { alert(fnVal.error); return; }

    const lnVal = validateName(lastName, 'Last Name');
    if (!lnVal.isValid) { alert(lnVal.error); return; }

    const emailVal = validateEmail(email, 'Email Address');
    if (!emailVal.isValid) { alert(emailVal.error); return; }

    if (mobile.trim()) {
      const mobVal = validatePhoneNumber(mobile, 'Mobile Number');
      if (!mobVal.isValid) { alert(mobVal.error); return; }
    }

    try {
      if (mobile.trim()) {
        const mobileCheck = await checkMobileExists(mobile.trim(), editingId);
        if (mobileCheck.exists) {
          alert(mobileCheck.message || "This mobile number is already registered to another user.");
          return;
        }
      }

      setIsSaving(true);
      const fullName = `${firstName} ${lastName}`.trim();

      if (editingId) {
        // Update existing teacher
        await updateDoc(doc(db, 'users', editingId), {
          name: fullName,
          email: email.trim(),
          mobile: mobile.trim(),
          status,
          batchIds: selectedBatchIds,
          updatedAt: serverTimestamp()
        });
      } else {
        // Standard teacher default password
        const defaultPassword = 'Teacher@123';
        
        let uid = '';
        try {
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), defaultPassword);
          uid = userCredential.user.uid;
        } catch (authError: any) {
          if (authError.code === 'auth/email-already-in-use') {
            alert("A user with this email already exists in Authentication.");
            setIsSaving(false);
            return;
          } else {
            throw authError;
          }
        }

        // Save profile to users collection
        await setDoc(doc(db, 'users', uid), {
          uid,
          name: fullName,
          email: email.trim(),
          mobile: mobile.trim(),
          role: 'teacher',
          status,
          forcePasswordChange: true,
          batchIds: selectedBatchIds,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        alert(`Teacher Account Created Successfully!\n\nCredentials:\nEmail: ${email.trim()}\nPassword: ${defaultPassword}\nMobile: ${mobile.trim()}`);
      }

      setIsModalOpen(false);
      resetForm();
      fetchTeachers();
    } catch (error: any) {
      console.error("Error saving teacher:", error);
      alert("Failed to save teacher: " + (error.message || "Unknown error"));
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setMobile('');
    setStatus('active');
    setSelectedBatchIds([]);
    setEditingId(null);
    setBatchSearch('');
  };

  const handleEdit = (teacher: User) => {
    const parts = (teacher.name || '').split(' ');
    setFirstName(parts[0] || '');
    setLastName(parts.slice(1).join(' ') || '');
    setEmail(teacher.email || '');
    setMobile(teacher.mobile || '');
    setStatus((teacher.status as 'active' | 'inactive') || 'active');
    setSelectedBatchIds(teacher.batchIds || []);
    setEditingId(teacher.documentId || null);
    setBatchSearch('');
    setIsModalOpen(true);
  };

  const toggleBatch = (batchId: string) => {
    setSelectedBatchIds(prev =>
      prev.includes(batchId)
        ? prev.filter(id => id !== batchId)
        : [...prev, batchId]
    );
  };

  const handleSelectAllBatches = () => {
    const idsToSelect = filteredBatches.map(b => b.documentId!).filter(Boolean);
    setSelectedBatchIds(prev => Array.from(new Set([...prev, ...idsToSelect])));
  };

  const handleClearAllBatches = () => {
    setSelectedBatchIds([]);
  };

  const filteredBatches = batches.filter(b =>
    (b.batchName || '').toLowerCase().includes(batchSearch.toLowerCase().trim())
  );

  const handleDelete = async (teacher: User) => {
    if (window.confirm(`Are you sure you want to delete teacher ${teacher.name}?`)) {
      try {
        await deleteDoc(doc(db, 'users', teacher.documentId!));
        setTeachers(teachers.filter(t => t.documentId !== teacher.documentId));
      } catch (error: any) {
        alert("Failed to delete teacher: " + error.message);
      }
    }
  };

  const getAssignedBatchNames = (batchIds?: string[]) => {
    if (!batchIds || !Array.isArray(batchIds) || batchIds.length === 0) return [];
    return batchIds.map(bId => {
      const match = batches.find(b => b.documentId === bId);
      return match ? match.batchName : bId;
    });
  };

  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'Teacher Name',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
            {row.name ? row.name.charAt(0).toUpperCase() : 'T'}
          </div>
          <span className="font-medium">{row.name}</span>
        </div>
      )
    },
    {
      key: 'email',
      header: 'Email'
    },
    {
      key: 'mobile',
      header: 'Mobile',
      render: (row) => row.mobile || 'N/A'
    },
    {
      key: 'batchIds',
      header: 'Assigned Batches',
      render: (row) => {
        const batchNames = getAssignedBatchNames(row.batchIds);
        if (batchNames.length === 0) {
          return <span className="text-gray-400 text-xs italic">No Batches</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {batchNames.map((name, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <BookOpen size={10} />
                {name}
              </span>
            ))}
          </div>
        );
      }
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (row) => (
        <div className="flex justify-center items-center">
          <span className={`dt-badge ${row.status === 'active' ? 'active' : 'inactive'}`}>
            {row.status ? row.status.charAt(0).toUpperCase() + row.status.slice(1) : 'Unknown'}
          </span>
        </div>
      )
    }
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Teachers</h1>
          <div className="breadcrumbs">
            <span>Dashboard</span> <span className="separator">/</span> <span className="current">Teachers</span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setIsModalOpen(true); }}>
          <Plus size={16} />
          Add Teacher
        </button>
      </div>

      <DataTable 
        title="Teacher Records" 
        data={teachers} 
        columns={columns} 
        onEdit={handleEdit}
        onDelete={handleDelete}
        onRefresh={() => { fetchBatches(); fetchTeachers(); }}
        searchPlaceholder="Search teachers..."
        isLoading={isLoading}
      />

      {/* Add / Edit Teacher Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); resetForm(); }} 
        title={editingId ? "Edit Teacher" : "Add Teacher"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="teacher-form">
          {/* Row 1: First Name & Last Name */}
          <div className="form-grid-2col">
            <Input 
              label="First Name" 
              placeholder="e.g. John"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required 
            />
            <Input 
              label="Last Name" 
              placeholder="e.g. Doe"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required 
            />
          </div>

          {/* Row 2: Email & Mobile Number */}
          <div className="form-grid-2col">
            <Input 
              label="Email Address" 
              type="email"
              placeholder="teacher@speakhub.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!!editingId}
              required 
            />
            <Input 
              label="Mobile Number" 
              placeholder="e.g. 9096170701"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
            />
          </div>

          {/* Default Credentials Notice */}
          {!editingId && (
            <div className="password-callout">
              <Info size={18} className="password-callout-icon" />
              <div>
                <strong>Default Credentials:</strong> Temporary password is set to <code>Teacher@123</code>. The teacher will be prompted to change it upon first login.
              </div>
            </div>
          )}

          {/* Assign Batches Section */}
          <div className="batch-assign-card">
            <div className="batch-assign-header">
              <div className="batch-assign-title">
                <BookOpen size={16} />
                <span>Assign Batches</span>
                <span className={`batch-count-pill ${selectedBatchIds.length > 0 ? 'active' : ''}`}>
                  {selectedBatchIds.length} of {batches.length} selected
                </span>
              </div>
              {batches.length > 0 && (
                <div className="batch-quick-actions">
                  <button 
                    type="button" 
                    className="batch-quick-btn"
                    onClick={handleSelectAllBatches}
                  >
                    Select All
                  </button>
                  <span style={{ color: '#cbd5e1' }}>•</span>
                  <button 
                    type="button" 
                    className="batch-quick-btn"
                    onClick={handleClearAllBatches}
                  >
                    Clear All
                  </button>
                </div>
              )}
            </div>

            {/* Batch Search Box */}
            {batches.length > 2 && (
              <div className="batch-search-box">
                <Search size={15} className="batch-search-icon" />
                <input 
                  type="text"
                  placeholder="Filter batches by name..."
                  className="batch-search-input"
                  value={batchSearch}
                  onChange={(e) => setBatchSearch(e.target.value)}
                />
                {batchSearch && (
                  <button
                    type="button"
                    onClick={() => setBatchSearch('')}
                    style={{
                      position: 'absolute',
                      right: '0.6rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 0
                    }}
                    title="Clear filter"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )}

            {/* Batch Items List */}
            <div className="batch-list-box">
              {batches.length === 0 ? (
                <div className="batch-empty-text">No batches available in system</div>
              ) : filteredBatches.length === 0 ? (
                <div className="batch-empty-text">
                  No batches found matching "{batchSearch}".{' '}
                  <button 
                    type="button" 
                    className="batch-quick-btn"
                    onClick={() => setBatchSearch('')}
                  >
                    Clear search
                  </button>
                </div>
              ) : (
                filteredBatches.map(b => {
                  const isSelected = selectedBatchIds.includes(b.documentId!);
                  return (
                    <div 
                      key={b.documentId} 
                      className={`batch-item-row ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleBatch(b.documentId!)}
                      role="checkbox"
                      aria-checked={isSelected}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          toggleBatch(b.documentId!);
                        }
                      }}
                    >
                      <div className="batch-item-left">
                        <div className="batch-checkbox-custom">
                          {isSelected && <Check size={12} strokeWidth={3} />}
                        </div>
                        <span className="batch-name-text" title={b.batchName}>
                          {b.batchName}
                        </span>
                      </div>
                      <span className="batch-badge-tag">
                        {isSelected ? 'Assigned' : 'Optional'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Account Status Control */}
          <div className="status-toggle-group">
            <label className="status-toggle-label">Account Status</label>
            <div className="status-segmented-control">
              <button
                type="button"
                className={`status-segment-btn ${status === 'active' ? 'active active-status' : ''}`}
                onClick={() => setStatus('active')}
              >
                <span className="status-indicator-dot active" />
                Active Account
              </button>
              <button
                type="button"
                className={`status-segment-btn ${status === 'inactive' ? 'active inactive-status' : ''}`}
                onClick={() => setStatus('inactive')}
              >
                <span className="status-indicator-dot inactive" />
                Inactive / Suspended
              </button>
            </div>
          </div>

          {/* Modal Form Footer */}
          <div className="teacher-modal-footer">
            <button 
              type="button" 
              className="teacher-cancel-btn" 
              onClick={() => { setIsModalOpen(false); resetForm(); }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="teacher-submit-btn" 
              disabled={isSaving}
            >
              {isSaving ? (
                "Saving..."
              ) : editingId ? (
                "Update Teacher"
              ) : (
                <>
                  <UserPlus size={16} />
                  <span>Create Teacher Account</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Teachers;
