import React, { useState, useEffect } from 'react';
import { Plus, BookOpen, Search, Check, Info, UserPlus, X } from 'lucide-react';
import Input from '../../components/forms/Input';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import type { User, Batch } from '../../types/models';
import { db } from '../../config/firebase';
import { secondaryAuth } from '../../config/secondaryFirebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updatePassword, 
  deleteUser, 
  signOut as secondarySignOut 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  getDocs, 
  updateDoc, 
  doc, 
  setDoc, 
  where, 
  serverTimestamp, 
  deleteDoc,
  arrayUnion,
  arrayRemove 
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
  const [editingTeacherUid, setEditingTeacherUid] = useState<string | null>(null);
  const [initialMobile, setInitialMobile] = useState('');

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
        const isMobileChanged = !editingId || mobile.trim() !== initialMobile.trim();
        if (isMobileChanged) {
          const mobileCheck = await checkMobileExists(mobile.trim(), editingId, email.trim());
          const isSelf = mobileCheck.existingUser && (
            mobileCheck.existingUser.id === editingId ||
            mobileCheck.existingUser.uid === editingId ||
            mobileCheck.existingUser.userId === editingId ||
            (editingTeacherUid && (
              mobileCheck.existingUser.id === editingTeacherUid ||
              mobileCheck.existingUser.uid === editingTeacherUid ||
              mobileCheck.existingUser.userId === editingTeacherUid
            )) ||
            (email.trim() && mobileCheck.existingUser.email?.trim().toLowerCase() === email.trim().toLowerCase())
          );

          if (mobileCheck.exists && !isSelf) {
            alert(mobileCheck.message || "This mobile number is already registered to another user.");
            return;
          }
        }
      }

      setIsSaving(true);
      const fullName = `${firstName} ${lastName}`.trim();
      let targetTeacherId = editingId || '';

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
            const candidatePasswords = [defaultPassword, 'teacher123', 'password123', mobile.trim()].filter(Boolean);
            let signedInUser: any = null;
            for (const candPwd of candidatePasswords) {
              try {
                const cred = await signInWithEmailAndPassword(secondaryAuth, email.trim(), candPwd);
                signedInUser = cred.user;
                break;
              } catch (e) { }
            }

            if (signedInUser) {
              try {
                await updatePassword(signedInUser, defaultPassword);
                uid = signedInUser.uid;
              } finally {
                await secondarySignOut(secondaryAuth);
              }
            } else {
              alert(`The email ${email.trim()} is already in Firebase Authentication with an unknown password. Please delete it from Firebase Console (Authentication > Users) and try again.`);
              setIsSaving(false);
              return;
            }
          } else {
            throw authError;
          }
        }

        targetTeacherId = uid;
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

      // targetTeacherId was assigned

      // Bidirectional sync with batches collection:
      // 1. Assign this teacher to all selected batches
      for (const bId of selectedBatchIds) {
        try {
          const idsToSync = Array.from(new Set([targetTeacherId, editingTeacherUid].filter(Boolean))) as string[];
          const batchUpdate: any = {
            updatedAt: serverTimestamp()
          };
          if (targetTeacherId) {
            batchUpdate.teacherId = targetTeacherId;
          }
          if (idsToSync.length > 0) {
            batchUpdate.teacherIds = arrayUnion(...idsToSync);
          }
          await updateDoc(doc(db, 'batches', bId), batchUpdate);
        } catch (bErr) {
          console.warn("Could not sync batch " + bId, bErr);
        }
      }

      // 2. Unassign from batches that were previously assigned to this teacher but are no longer selected
      if (editingId) {
        const unassignedBatches = batches.filter(b => 
          b.documentId && 
          !selectedBatchIds.includes(b.documentId) && (
            b.teacherId === editingId || 
            (editingTeacherUid && b.teacherId === editingTeacherUid) ||
            b.teacherId === email.trim() ||
            ((b as any).teacherIds && Array.isArray((b as any).teacherIds) && (
              (editingId && (b as any).teacherIds.includes(editingId)) ||
              (editingTeacherUid && (b as any).teacherIds.includes(editingTeacherUid)) ||
              (email.trim() && (b as any).teacherIds.includes(email.trim()))
            ))
          )
        );

        for (const unb of unassignedBatches) {
          try {
            const removes = Array.from(new Set([editingId, editingTeacherUid, email.trim()].filter(Boolean))) as string[];
            const batchUpdate: any = {
              teacherId: '',
              updatedAt: serverTimestamp()
            };
            if (removes.length > 0) {
              batchUpdate.teacherIds = arrayRemove(...removes);
            }
            await updateDoc(doc(db, 'batches', unb.documentId!), batchUpdate);
          } catch (unErr) {
            console.warn("Could not unassign batch " + unb.documentId, unErr);
          }
        }
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
    setEditingTeacherUid(null);
    setInitialMobile('');
    setBatchSearch('');
  };

  const handleEdit = (teacher: User) => {
    const parts = (teacher.name || '').split(' ');
    setFirstName(parts[0] || '');
    setLastName(parts.slice(1).join(' ') || '');
    setEmail(teacher.email || '');
    setMobile(teacher.mobile || '');
    setStatus((teacher.status as 'active' | 'inactive') || 'active');

    // Pre-select all batches currently assigned to this teacher
    const teacherId = teacher.documentId;
    const teacherUid = teacher.uid;
    const teacherEmail = teacher.email;
    const initialBatchIds = new Set<string>(teacher.batchIds || []);
    batches.forEach(b => {
      if (b.documentId) {
        if (
          (teacherId && b.teacherId === teacherId) ||
          (teacherUid && b.teacherId === teacherUid) ||
          (teacherEmail && b.teacherId === teacherEmail) ||
          ((b as any).teacherIds && Array.isArray((b as any).teacherIds) && (
            (teacherId && (b as any).teacherIds.includes(teacherId)) ||
            (teacherUid && (b as any).teacherIds.includes(teacherUid)) ||
            (teacherEmail && (b as any).teacherIds.includes(teacherEmail))
          ))
        ) {
          initialBatchIds.add(b.documentId);
        }
      }
    });

    setSelectedBatchIds(Array.from(initialBatchIds));
    setEditingId(teacher.documentId || null);
    setEditingTeacherUid(teacher.uid || null);
    setInitialMobile(teacher.mobile || teacher.phone || '');
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
    if (!window.confirm(`Are you sure you want to delete teacher ${teacher.name}?`)) return;

    try {
      const teacherEmail = (teacher.email || '').trim();
      let authDeleted = false;
      if (teacherEmail) {
        const candidatePasswords = [
          (teacher as any).plainPassword,
          'Teacher@123',
          'teacher123',
          'password123',
          teacher.mobile || ''
        ].filter(Boolean);

        for (const candPwd of candidatePasswords) {
          try {
            const cred = await signInWithEmailAndPassword(secondaryAuth, teacherEmail, candPwd);
            await deleteUser(cred.user);
            authDeleted = true;
            break;
          } catch (e) { }
        }
        try {
          await secondarySignOut(secondaryAuth);
        } catch (e) { }
      }

      // Unassign deleted teacher from any batches
      const teacherBatches = batches.filter(b => 
        b.teacherId === teacher.documentId ||
        (teacher.uid && b.teacherId === teacher.uid) ||
        ((b as any).teacherIds && Array.isArray((b as any).teacherIds) && (
          (b as any).teacherIds.includes(teacher.documentId) ||
          (teacher.uid && (b as any).teacherIds.includes(teacher.uid))
        ))
      );
      for (const tb of teacherBatches) {
        if (tb.documentId) {
          try {
            await updateDoc(doc(db, 'batches', tb.documentId), {
              teacherId: '',
              teacherIds: arrayRemove(teacher.documentId, teacher.uid || ''),
              updatedAt: serverTimestamp()
            });
          } catch (e) { }
        }
      }

      await deleteDoc(doc(db, 'users', teacher.documentId!));
      setTeachers(teachers.filter(t => t.documentId !== teacher.documentId));

      if (authDeleted) {
        alert(`Teacher ${teacher.name} and Authentication account deleted successfully.`);
      } else {
        alert(`Teacher ${teacher.name} deleted from database.`);
      }
    } catch (error: any) {
      alert("Failed to delete teacher: " + error.message);
    }
  };

  const getAssignedBatchNames = (batchIds?: string[], teacherDocId?: string, teacherUid?: string, teacherEmail?: string) => {
    const assignedIds = new Set<string>(batchIds || []);
    batches.forEach(b => {
      if (b.documentId) {
        if (
          (teacherDocId && b.teacherId === teacherDocId) ||
          (teacherUid && b.teacherId === teacherUid) ||
          (teacherEmail && b.teacherId === teacherEmail) ||
          ((b as any).teacherIds && Array.isArray((b as any).teacherIds) && (
            (teacherDocId && (b as any).teacherIds.includes(teacherDocId)) ||
            (teacherUid && (b as any).teacherIds.includes(teacherUid)) ||
            (teacherEmail && (b as any).teacherIds.includes(teacherEmail))
          ))
        ) {
          assignedIds.add(b.documentId);
        }
      }
    });

    if (assignedIds.size === 0) return [];
    return Array.from(assignedIds).map(bId => {
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
        const batchNames = getAssignedBatchNames(row.batchIds, row.documentId, row.uid, row.email);
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
