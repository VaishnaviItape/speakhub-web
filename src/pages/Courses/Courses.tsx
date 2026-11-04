import React, { useState, useEffect } from 'react';
import { Plus, Globe, Building2, CreditCard, CheckCircle2 } from 'lucide-react';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';
import Modal from '../../components/ui/Modal';
import DataTable, { type Column } from '../../components/ui/DataTable';
import type { Course } from '../../types/models';
import { db } from '../../config/firebase';
import { collection, query, getDocs, addDoc, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { validateName, validatePositiveNumber } from '../../utils/validation';
import '../../components/ui/TableStyles.css';

const Courses: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form State
  const [courseName, setCourseName] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('');
  const [mode, setMode] = useState<'online' | 'offline'>('online');
  const [monthlyFee, setMonthlyFee] = useState('');
  
  // Offline Fee State
  const [offlineOneTimeFee, setOfflineOneTimeFee] = useState('4000');
  const [hasInstallments, setHasInstallments] = useState(true);
  const [offlineInstallmentFee, setOfflineInstallmentFee] = useState('4000');
  const [installmentsCount, setInstallmentsCount] = useState<number>(2);
  const [installmentAmount, setInstallmentAmount] = useState('2000');

  const [demoVideoUrl, setDemoVideoUrl] = useState('https://youtube.com/@speakhubacademy?si=ZSnvnh5MzSqXPrpM');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Data
  const [courses, setCourses] = useState<Course[]>([]);

  const fetchCourses = async () => {
    try {
      setIsLoading(true);
      const q = query(collection(db, 'courses'));
      const querySnapshot = await getDocs(q);
      const fetchedCourses: Course[] = [];
      querySnapshot.forEach((docSnap) => {
        fetchedCourses.push({ documentId: docSnap.id, ...docSnap.data() } as Course);
      });
      setCourses(fetchedCourses);
    } catch (error) {
      console.error("Error fetching courses:", error);
      alert("Failed to load courses");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const handleInstallmentsCountChange = (count: number) => {
    setInstallmentsCount(count);
    const total = Number(offlineInstallmentFee) || Number(offlineOneTimeFee) || 4000;
    if (count > 0) {
      setInstallmentAmount(Math.round(total / count).toString());
    }
  };

  const handleOfflineFeeChange = (val: string) => {
    setOfflineOneTimeFee(val);
    setOfflineInstallmentFee(val);
    const num = Number(val) || 0;
    if (installmentsCount > 0) {
      setInstallmentAmount(Math.round(num / installmentsCount).toString());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nameVal = validateName(courseName, 'Course Name');
    if (!nameVal.isValid) { alert(nameVal.error); return; }

    if (mode === 'online') {
      const feeVal = validatePositiveNumber(monthlyFee, 'Monthly Fee');
      if (!feeVal.isValid) { alert(feeVal.error); return; }
    } else {
      const offlineFeeVal = validatePositiveNumber(offlineOneTimeFee, 'Offline Full / One-Time Fee');
      if (!offlineFeeVal.isValid) { alert(offlineFeeVal.error); return; }

      if (hasInstallments) {
        const instVal = validatePositiveNumber(installmentAmount, 'Installment Amount');
        if (!instVal.isValid) { alert(instVal.error); return; }
      }
    }

    setIsSaving(true);
    try {
      const coursePayload: Partial<Course> = {
        courseName: courseName.trim(),
        description: description.trim(),
        duration: duration.trim(),
        mode,
        modeBadge: mode.toUpperCase(),
        monthlyFee: mode === 'online' ? Number(monthlyFee) : 0,
        offlineOneTimeFee: mode === 'offline' ? Number(offlineOneTimeFee || 4000) : 0,
        hasInstallments: mode === 'offline' ? hasInstallments : false,
        offlineInstallmentFee: mode === 'offline' && hasInstallments ? Number(offlineInstallmentFee || offlineOneTimeFee || 4000) : 0,
        installmentsCount: mode === 'offline' && hasInstallments ? Number(installmentsCount || 2) : 0,
        installmentAmount: mode === 'offline' && hasInstallments ? Number(installmentAmount || 2000) : 0,
        demoVideoUrl: demoVideoUrl.trim(),
        status
      };

      if (editingId) {
        // Update existing course
        const courseRef = doc(db, 'courses', editingId);
        await updateDoc(courseRef, {
          ...coursePayload,
          updatedAt: serverTimestamp()
        });
      } else {
        // Add new course
        await addDoc(collection(db, 'courses'), {
          ...coursePayload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      resetForm();
      fetchCourses();
    } catch (error) {
      console.error("Error saving course:", error);
      alert("Failed to save course");
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setCourseName('');
    setDescription('');
    setDuration('');
    setMode('online');
    setMonthlyFee('');
    setOfflineOneTimeFee('4000');
    setHasInstallments(true);
    setOfflineInstallmentFee('4000');
    setInstallmentsCount(2);
    setInstallmentAmount('2000');
    setDemoVideoUrl('https://youtube.com/@speakhubacademy?si=ZSnvnh5MzSqXPrpM');
    setStatus('active');
    setEditingId(null);
  };

  const handleEdit = (course: Course) => {
    setCourseName(course.courseName || '');
    setDescription(course.description || '');
    setDuration(course.duration || '');
    
    // Infer mode if missing from legacy records
    const detectedMode: 'online' | 'offline' = course.mode || (course.modeBadge?.toLowerCase().includes('offline') ? 'offline' : 'online');
    setMode(detectedMode);

    setMonthlyFee(course.monthlyFee ? course.monthlyFee.toString() : '');
    const oneTime = course.offlineOneTimeFee || 4000;
    setOfflineOneTimeFee(oneTime.toString());
    setHasInstallments(course.hasInstallments !== false);
    setOfflineInstallmentFee((course.offlineInstallmentFee || oneTime).toString());
    const count = course.installmentsCount || 2;
    setInstallmentsCount(count);
    setInstallmentAmount((course.installmentAmount || Math.round(oneTime / count)).toString());

    setDemoVideoUrl(course.demoVideoUrl || 'https://youtube.com/@speakhubacademy?si=ZSnvnh5MzSqXPrpM');
    setStatus(course.status || 'active');
    setEditingId(course.documentId || null);
    setIsModalOpen(true);
  };

  const handleDelete = async (course: Course) => {
    if (!course.documentId) return;
    if (window.confirm(`Are you sure you want to delete the course "${course.courseName}"?`)) {
      try {
        await deleteDoc(doc(db, 'courses', course.documentId));
        fetchCourses();
      } catch (error) {
        console.error("Error deleting course:", error);
        alert("Failed to delete course");
      }
    }
  };

  const columns: Column<Course>[] = [
    {
      key: 'courseName',
      header: 'Course Name',
      render: (row) => (
        <div>
          <span className="font-semibold text-slate-900 dark:text-slate-100">{row.courseName}</span>
          {row.description && (
            <div className="text-xs text-slate-500 max-w-xs truncate" title={row.description}>
              {row.description}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'mode',
      header: 'Course Mode',
      render: (row) => {
        const isOffline = row.mode === 'offline' || row.modeBadge?.toLowerCase().includes('offline');
        return isOffline ? (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 700,
            background: '#fef3c7',
            color: '#b45309',
            border: '1px solid #fde68a'
          }}>
            <Building2 size={12} />
            Offline
          </span>
        ) : (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: 700,
            background: '#e0f2fe',
            color: '#0369a1',
            border: '1px solid #bae6fd'
          }}>
            <Globe size={12} />
            Online
          </span>
        );
      }
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (row) => <span>{row.duration || 'N/A'}</span>
    },
    {
      key: 'monthlyFee',
      header: 'Fee Structure',
      render: (row) => {
        const isOffline = row.mode === 'offline' || row.modeBadge?.toLowerCase().includes('offline');
        if (isOffline) {
          const oneTime = row.offlineOneTimeFee || 4000;
          const count = row.installmentsCount || 2;
          const instAmt = row.installmentAmount || Math.round(oneTime / count);
          return (
            <div>
              <div style={{ fontWeight: 700, color: '#15803d', fontSize: '13px' }}>
                One-Time: ₹{oneTime.toLocaleString('en-IN')}
              </div>
              {row.hasInstallments !== false && (
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  Installments: {count} × ₹{instAmt.toLocaleString('en-IN')}
                </div>
              )}
            </div>
          );
        }
        return (
          <div>
            <span style={{ fontWeight: 700, color: '#0369a1', fontSize: '13px' }}>
              ₹{(row.monthlyFee || 0).toLocaleString('en-IN')}
            </span>
            <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '4px' }}>/ month</span>
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
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Courses</h1>
          <div className="breadcrumbs">
            <span>Dashboard</span> <span className="separator">/</span> <span className="current">Course Master</span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setIsModalOpen(true); }}>
          <Plus size={16} />
          Add Course
        </button>
      </div>

      <DataTable 
        title="Course Records" 
        data={courses} 
        columns={columns} 
        onEdit={handleEdit}
        onDelete={handleDelete}
        onRefresh={fetchCourses}
        searchPlaceholder="Search courses by name or mode..."
        isLoading={isLoading}
      />

      {/* Add/Edit Course Modal */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title={editingId ? "Edit Course" : "Add Course"}>
        <form onSubmit={handleSubmit} className="modal-form">
          <Input 
            label="Course Name *" 
            placeholder="e.g. Spoken English Masterclass"
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
            required 
          />

          {/* Course Mode Selector */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main, #334155)', marginBottom: '8px', display: 'block' }}>
              Course Mode *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div 
                onClick={() => setMode('online')}
                style={{
                  border: mode === 'online' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                  backgroundColor: mode === 'online' ? '#eff6ff' : '#ffffff',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'all 0.2s',
                  boxShadow: mode === 'online' ? '0 2px 8px rgba(37, 99, 235, 0.15)' : 'none'
                }}
              >
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: mode === 'online' ? '#dbeafe' : '#f1f5f9',
                  color: mode === 'online' ? '#1d4ed8' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Globe size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: mode === 'online' ? '#1e40af' : '#1e293b' }}>Online Mode</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Virtual sessions / Monthly fee</div>
                </div>
              </div>

              <div 
                onClick={() => setMode('offline')}
                style={{
                  border: mode === 'offline' ? '2px solid #d97706' : '1px solid #cbd5e1',
                  backgroundColor: mode === 'offline' ? '#fffbeb' : '#ffffff',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'all 0.2s',
                  boxShadow: mode === 'offline' ? '0 2px 8px rgba(217, 119, 6, 0.15)' : 'none'
                }}
              >
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: mode === 'offline' ? '#fef3c7' : '#f1f5f9',
                  color: mode === 'offline' ? '#b45309' : '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Building2 size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: mode === 'offline' ? '#b45309' : '#1e293b' }}>Offline Mode</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Classroom / One-time & Installments</div>
                </div>
              </div>
            </div>
          </div>

          {/* Conditional Fee Settings Based on Mode */}
          {mode === 'online' ? (
            <div className="grid grid-cols-2 gap-4">
              <Input 
                label="Duration *" 
                placeholder="e.g. 3 Months"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                required 
              />
              <Input 
                label="Monthly Fee (₹) *" 
                type="number"
                placeholder="e.g. 800"
                value={monthlyFee}
                onChange={(e) => setMonthlyFee(e.target.value)}
                required 
              />
            </div>
          ) : (
            <div style={{
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <CreditCard size={18} color="#b45309" />
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#92400e' }}>
                  Offline Fee & Installments Structure
                </h4>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input 
                  label="Course Duration *" 
                  placeholder="e.g. 3 Months / Full Term"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  required 
                />
                <Input 
                  label="One-Time / Full Fee (₹) *" 
                  type="number"
                  placeholder="e.g. 4000"
                  value={offlineOneTimeFee}
                  onChange={(e) => handleOfflineFeeChange(e.target.value)}
                  required 
                />
              </div>

              {/* Installment Options */}
              <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px dashed #fde68a' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', color: '#78350f' }}>
                  <input 
                    type="checkbox"
                    checked={hasInstallments}
                    onChange={(e) => setHasInstallments(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: '#d97706' }}
                  />
                  <span>Allow Fee Payment in Installments (e.g. 2 Installments)</span>
                </label>

                {hasInstallments && (
                  <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <Select 
                      label="Number of Installments"
                      options={[
                        { label: '2 Installments', value: '2' },
                        { label: '3 Installments', value: '3' },
                        { label: '4 Installments', value: '4' }
                      ]}
                      value={installmentsCount.toString()}
                      onChange={(e) => handleInstallmentsCountChange(Number(e.target.value))}
                    />
                    <Input 
                      label={`Fee Per Installment (₹) (${installmentsCount} × ₹${installmentAmount})`}
                      type="number"
                      placeholder="e.g. 2000"
                      value={installmentAmount}
                      onChange={(e) => setInstallmentAmount(e.target.value)}
                      required
                    />
                  </div>
                )}

                <div style={{
                  marginTop: '12px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  backgroundColor: '#fef3c7',
                  fontSize: '12px',
                  color: '#92400e',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <CheckCircle2 size={16} color="#b45309" style={{ flexShrink: 0 }} />
                  <span>
                    {hasInstallments
                      ? `Students can pay ₹${Number(offlineOneTimeFee || 4000).toLocaleString('en-IN')} upfront, OR in ${installmentsCount} installments of ₹${Number(installmentAmount || 2000).toLocaleString('en-IN')} each.`
                      : `Students must pay ₹${Number(offlineOneTimeFee || 4000).toLocaleString('en-IN')} in full upfront (No installments).`}
                  </span>
                </div>
              </div>
            </div>
          )}

          <Input 
            label="Description (Optional)" 
            placeholder="Course syllabus, highlights, or eligibility..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Demo Video Link (YouTube / Web)" 
              placeholder="https://youtube.com/@speakhubacademy?si=ZSnvnh5MzSqXPrpM"
              value={demoVideoUrl}
              onChange={(e) => setDemoVideoUrl(e.target.value)}
            />
            <Select 
              label="Course Status" 
              options={[{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }]} 
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
            />
          </div>
          
          <div className="modal-form-footer">
            <button type="button" className="btn-modal-cancel" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn-modal-primary" disabled={isSaving}>
              {isSaving ? "Saving..." : (editingId ? "Update Course" : "Save Course")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Courses;
