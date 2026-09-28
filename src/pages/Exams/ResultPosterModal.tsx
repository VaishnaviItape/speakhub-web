import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  X, Download, Printer, Copy, Check, Sparkles, 
  Settings, Calendar, User, ChevronLeft, ChevronRight, Layers, Clock, BookOpen, Layers2,
  ZoomIn, ZoomOut, Eye
} from 'lucide-react';
import { db } from '../../config/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import type { Exam } from '../../types/models';
import './ResultPosterModal.css';

interface ResultPosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: Exam | null;
  batchName?: string;
  teacherName?: string;
  attempts: any[];
}

// Permanent Speak Hub Academy official details (Non-editable as requested)
const INSTITUTE_TITLE = 'SPEAK HUB ACADEMY';
const TAGLINE = 'Offline & Online Spoken English Classes.';
const CONTACT_INFO = 'For Admission Contact – 9970964742, 8999080975.';
const ADDRESS = 'Office – Omkar Aprtment, Near Canara Bank, NDA Road, Warje-Malwadi, Pune – 58.';

export const ResultPosterModal: React.FC<ResultPosterModalProps> = ({
  isOpen,
  onClose,
  exam,
  batchName = '',
  teacherName: teacherNameProp = '',
  attempts = []
}) => {
  // Format date for display: e.g. "28 SEPTEMBER 2026"
  const getFormattedDate = (rawDateVal?: any) => {
    const rawDate: any = rawDateVal || new Date();
    let d: Date;
    if (rawDate && typeof rawDate.toDate === 'function') {
      d = rawDate.toDate();
    } else if (rawDate instanceof Date) {
      d = rawDate;
    } else {
      d = new Date(rawDate);
    }
    if (isNaN(d.getTime())) d = new Date();

    const months = [
      'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
      'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
    ];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const getMonthYear = (rawDateVal?: any) => {
    const rawDate: any = rawDateVal || new Date();
    let d: Date;
    if (rawDate && typeof rawDate.toDate === 'function') {
      d = rawDate.toDate();
    } else if (rawDate instanceof Date) {
      d = rawDate;
    } else {
      d = new Date(rawDate);
    }
    if (isNaN(d.getTime())) d = new Date();

    const months = [
      'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
      'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
    ];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const getISODateOnly = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Helper: Format Teacher / Trainer Name nicely (e.g. "Mrs. VAISHNAVI" or "Mrs. NILAM")
  const formatTeacherName = (rawName: string) => {
    if (!rawName || !rawName.trim()) return 'Mrs. NILAM';
    const trimmed = rawName.trim();
    if (/^(mrs\.|mr\.|ms\.|miss|dr\.|prof\.)/i.test(trimmed)) {
      return trimmed.toUpperCase();
    }
    return `Mrs. ${trimmed.toUpperCase()}`;
  };

  // Configurable Marksheet State
  const [courseName, setCourseName] = useState('SPOKEN ENGLISH - FOUNDATION');
  const [batchTiming, setBatchTiming] = useState(batchName ? `${batchName.toUpperCase()} BATCH` : '6 TO 7 PM BATCH');
  const [resultDateRaw, setResultDateRaw] = useState(() => getISODateOnly(new Date()));
  const [teacherName, setTeacherName] = useState(() => formatTeacherName(teacherNameProp));
  const [mainResultTitle, setMainResultTitle] = useState(() => `${getMonthYear(exam?.startDate || new Date())} ONLINE EXAM RESULT`);
  const [totalMarks, setTotalMarks] = useState<number>(Number(exam?.totalMarks) || 20);

  // Layout & Display Settings
  const [pageSize, setPageSize] = useState<'auto' | 'all' | '10' | '12' | '15'>('auto');
  const [showPartSuffix, setShowPartSuffix] = useState<boolean>(false);
  const [includeAbsent, setIncludeAbsent] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<'alphabetical' | 'score' | 'rank'>('alphabetical');

  // Pagination State
  const [activePart, setActivePart] = useState<number>(1);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Zoom / Scale level for preview (0.72 fits all students + footer cleanly on screen)
  const [zoomLevel, setZoomLevel] = useState<number>(0.72);

  // Canvas for export
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Formatted Result Date displayed on top right of Blue Banner
  const formattedResultDate = useMemo(() => {
    if (!resultDateRaw) return getFormattedDate(new Date());
    const [y, m, d] = resultDateRaw.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return getFormattedDate(dateObj);
  }, [resultDateRaw]);

  // Exam Date displayed in Gold Yellow in the Blue Banner (Taken automatically from exam)
  const examDateDisplay = useMemo(() => {
    const d = exam?.startDate || new Date();
    return `EXAM DATE – ${getFormattedDate(d)}`;
  }, [exam?.startDate]);

  // Sync defaults when exam or batch changes
  useEffect(() => {
    if (exam) {
      const isAbacus = (exam.title || '').toLowerCase().includes('abacus') || 
                       (exam.examType || '').toLowerCase().includes('abacus');
      
      setCourseName(
        isAbacus 
          ? 'ABACUS FOUNDATION' 
          : (exam.title ? exam.title.toUpperCase() : 'SPOKEN ENGLISH - FOUNDATION')
      );
      setMainResultTitle(`${getMonthYear(exam.startDate || new Date())} ONLINE EXAM RESULT`);
      setTotalMarks(Number(exam.totalMarks) || 20);

      if (batchName) {
        setBatchTiming(`${batchName.toUpperCase()} BATCH`);
      }
    }
  }, [exam, batchName]);

  // Robust Trainer / Teacher Name Resolution:
  // Checks teacherNameProp, exam.teacherName, or directly queries the assigned batch and user in Firestore
  useEffect(() => {
    if (teacherNameProp && teacherNameProp.trim()) {
      setTeacherName(formatTeacherName(teacherNameProp));
    } else {
      // Find batch ID to lookup assigned trainer
      const bId = exam?.batchId && exam.batchId !== 'all' 
        ? exam.batchId 
        : (Array.isArray(exam?.batchIds) && exam.batchIds.length > 0 && exam.batchIds[0] !== 'all' ? exam.batchIds[0] : '');

      if (bId) {
        getDoc(doc(db, 'batches', bId)).then(async (bDoc) => {
          if (bDoc.exists()) {
            const bData = bDoc.data();
            const tId = bData?.teacherId || bData?.trainerId || (exam as any)?.teacherId;
            if (tId) {
              const tDoc = await getDoc(doc(db, 'users', tId));
              if (tDoc.exists()) {
                const name = tDoc.data()?.name || tDoc.data()?.displayName || '';
                if (name) setTeacherName(formatTeacherName(name));
              } else {
                const uSnap = await getDocs(query(collection(db, 'users'), where('uid', '==', tId)));
                if (!uSnap.empty) {
                  const name = uSnap.docs[0].data()?.name || '';
                  if (name) setTeacherName(formatTeacherName(name));
                }
              }
            } else if (bData?.teacherName || bData?.trainerName) {
              setTeacherName(formatTeacherName(bData.teacherName || bData.trainerName));
            }
          }
        }).catch(() => {});
      } else if ((exam as any)?.teacherName) {
        setTeacherName(formatTeacherName((exam as any).teacherName));
      }
    }
  }, [teacherNameProp, exam]);

  // Process and sort students list
  const processedStudents = useMemo(() => {
    let list = attempts.map((a) => {
      const att = a.attempt;
      const score = att && att.score !== undefined ? Number(att.score) : undefined;
      const rank = att && att.rank !== undefined ? Number(att.rank) : 9999;
      return {
        id: a.id || a.documentId || Math.random().toString(),
        name: a.name || 'Student',
        score,
        isAbsent: score === undefined,
        rank,
        attempt: att
      };
    });

    if (!includeAbsent) {
      list = list.filter((s) => !s.isAbsent);
    }

    list.sort((a, b) => {
      if (sortBy === 'alphabetical') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortBy === 'score') {
        if (a.isAbsent && !b.isAbsent) return 1;
        if (!a.isAbsent && b.isAbsent) return -1;
        return (b.score || 0) - (a.score || 0);
      }
      if (sortBy === 'rank') {
        if (a.isAbsent && !b.isAbsent) return 1;
        if (!a.isAbsent && b.isAbsent) return -1;
        return a.rank - b.rank;
      }
      return 0;
    });

    return list;
  }, [attempts, includeAbsent, sortBy]);

  // Smart Page Sizing:
  // If 'auto' and total students <= 15: Fit all on 1 page!
  // If 'auto' and total students > 15: Split into 2 balanced pages!
  const effectivePageSize = useMemo(() => {
    const total = processedStudents.length;
    if (pageSize === 'auto') {
      if (total <= 15) return total;
      return Math.ceil(total / 2); // Split into 2 clean pages
    }
    if (pageSize === 'all') {
      return total;
    }
    return parseInt(pageSize, 10);
  }, [pageSize, processedStudents.length]);

  const totalParts = useMemo(() => {
    if (effectivePageSize <= 0) return 1;
    return Math.max(1, Math.ceil(processedStudents.length / effectivePageSize));
  }, [processedStudents.length, effectivePageSize]);

  // Reset active part if out of range
  useEffect(() => {
    if (activePart > totalParts) {
      setActivePart(1);
    }
  }, [totalParts, activePart]);

  if (!isOpen) return null;

  // Build rows for a specific part (1-indexed)
  // Renders EXACTLY the students in the part — NO giant empty space or unnecessary rows!
  const getRowsForPart = (partNum: number) => {
    const startIndex = (partNum - 1) * effectivePageSize;
    const partStudents = processedStudents.slice(startIndex, startIndex + effectivePageSize);
    
    return partStudents.map((student, i) => {
      const globalIndex = startIndex + i;
      const srNo = String(globalIndex + 1).padStart(2, '0');
      let scoreText = student.isAbsent ? 'AB' : `${student.score} / ${totalMarks}`;
      return {
        srNo,
        name: student.name,
        score: scoreText,
        isAbsent: student.isAbsent
      };
    });
  };

  const currentPartRows = getRowsForPart(activePart);

  // Helper: Round Rectangle on Canvas
  const roundRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill: boolean,
    stroke: boolean
  ) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  };

  // Helper to load logo image safely
  const loadLogoImage = (): Promise<HTMLImageElement | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = '/logo.png';
    });
  };

  // Resolve title pill text for current part
  const getPillTitle = (partNum: number) => {
    if (totalParts > 1 || showPartSuffix) {
      return `${mainResultTitle} PART - ${partNum}`;
    }
    return mainResultTitle;
  };

  // Render high-res exact graphic for a specific part on Canvas with NO wasted space
  const drawPosterOnCanvas = async (partNum: number): Promise<HTMLCanvasElement | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const rows = getRowsForPart(partNum);
    const rowH = 40; // Proportional clean row height
    const blueY = 104;
    const blueH = 158;
    const tableY = blueY + blueH;
    const thH = 40;
    const rowsStartY = tableY + thH;
    const tableTotalH = rows.length * rowH;
    const footerStartY = rowsStartY + tableTotalH + 10; // Clean 10px snug spacing
    const admH = 42;
    
    // Exact dynamic canvas height matching student count
    const W = 800;
    const H = footerStartY + admH + 34;

    canvas.width = W;
    canvas.height = H;

    // 1. Clean White Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // 2. Header with Logo & Brand Title (Permanent)
    const logoImg = await loadLogoImage();
    if (logoImg) {
      ctx.drawImage(logoImg, 25, 12, 85, 80);
    } else {
      ctx.fillStyle = '#cc0000';
      ctx.beginPath();
      ctx.arc(65, 45, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('S', 65, 52);
    }

    // Permanent Institute Title (Bold Red Serif)
    ctx.fillStyle = '#d32f2f';
    ctx.font = '900 36px "Times New Roman", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(INSTITUTE_TITLE, W / 2 + 35, 50);

    // Permanent Tagline (Bold Black Sans-serif)
    ctx.fillStyle = '#000000';
    ctx.font = '700 19px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(TAGLINE, W / 2 + 35, 82);

    // 3. Navy Blue Header Section
    ctx.fillStyle = '#002868';
    ctx.fillRect(0, blueY, W, blueH);

    // Left Column (Course & Batch)
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 15px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(courseName, 205, blueY + 28);

    // Left Horizontal Divider
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(35, blueY + 38);
    ctx.lineTo(375, blueY + 38);
    ctx.stroke();

    // Left Batch Timing
    ctx.fillText(batchTiming, 205, blueY + 58);

    // Middle Vertical Divider Line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(400, blueY + 12);
    ctx.lineTo(400, blueY + 68);
    ctx.stroke();

    // Right Column (Result Date & Teacher / Mentor)
    ctx.fillText(formattedResultDate, 595, blueY + 28);

    // Right Horizontal Divider
    ctx.beginPath();
    ctx.moveTo(425, blueY + 38);
    ctx.lineTo(765, blueY + 38);
    ctx.stroke();

    // Right Teacher / Mentor Name
    ctx.fillText(teacherName, 595, blueY + 58);

    // Center Pill: Result Title
    const pillW = 690;
    const pillH = 38;
    const pillX = (W - pillW) / 2;
    const pillY = blueY + 76;

    ctx.fillStyle = '#fef4e8';
    roundRect(ctx, pillX, pillY, pillW, pillH, 8, true, false);

    ctx.fillStyle = '#c62828';
    ctx.font = '900 18px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(getPillTitle(partNum), W / 2, pillY + 25);

    // Yellow Golden Exam Date (Automatically taken from exam)
    ctx.fillStyle = '#ffc107';
    ctx.font = '800 16px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(examDateDisplay, W / 2, blueY + 142);

    // 4. Results Table
    ctx.fillStyle = '#f5a623';
    ctx.fillRect(0, tableY, W, thH);

    // Header Vertical Separators
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(170, tableY);
    ctx.lineTo(170, tableY + thH);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(600, tableY);
    ctx.lineTo(600, tableY + thH);
    ctx.stroke();

    // Table Header Labels
    ctx.fillStyle = '#000000';
    ctx.font = '900 17px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SR. NO', 85, tableY + 26);
    ctx.fillText('STUDENT NAME', 385, tableY + 26);
    ctx.fillText('SCORE', 700, tableY + 26);

    // Rows (Fits exact student count with no trailing blank void)
    rows.forEach((row, i) => {
      const ry = rowsStartY + (i * rowH);

      // Alternating Background: peach cream & white
      ctx.fillStyle = i % 2 === 0 ? '#fae8d4' : '#ffffff';
      ctx.fillRect(0, ry, W, rowH);

      // Vertical Dividers
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(170, ry);
      ctx.lineTo(170, ry + rowH);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(600, ry);
      ctx.lineTo(600, ry + rowH);
      ctx.stroke();

      // Row bottom border
      ctx.strokeStyle = '#ffe0c0';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(0, ry + rowH);
      ctx.lineTo(W, ry + rowH);
      ctx.stroke();

      // Row Text
      ctx.fillStyle = '#000000';
      ctx.font = '800 17px Arial, sans-serif';
      ctx.textAlign = 'center';

      // SR. NO
      ctx.fillText(row.srNo, 85, ry + 26);

      // Student Name
      ctx.fillText(row.name, 385, ry + 26);

      // Score
      ctx.fillText(row.score, 700, ry + 26);
    });

    // 5. Permanent Footer Section
    const admW = 770;
    const admX = (W - admW) / 2;

    ctx.fillStyle = '#7d1867';
    roundRect(ctx, admX, footerStartY, admW, admH, 8, true, false);

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 17px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(CONTACT_INFO, W / 2, footerStartY + 27);

    // Permanent Office Address
    ctx.fillStyle = '#000000';
    ctx.font = '800 13px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(ADDRESS, W / 2, footerStartY + admH + 22);

    return canvas;
  };

  // 1. Download Current Part as PNG
  const handleDownloadPart = async (partNum: number) => {
    setIsGenerating(true);
    try {
      const canvas = await drawPosterOnCanvas(partNum);
      if (!canvas) return;

      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = url;
      const safeTitle = (exam?.title || 'Exam_Result').replace(/[^a-zA-Z0-9_-]/g, '_');
      const suffix = totalParts > 1 ? `_Part_${partNum}` : '';
      link.download = `${safeTitle}_Marksheet${suffix}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert('Could not download image: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // 2. Download All Parts sequentially
  const handleDownloadAllParts = async () => {
    setIsGenerating(true);
    try {
      for (let p = 1; p <= totalParts; p++) {
        const canvas = await drawPosterOnCanvas(p);
        if (canvas) {
          const url = canvas.toDataURL('image/png');
          const link = document.createElement('a');
          link.href = url;
          const safeTitle = (exam?.title || 'Exam_Result').replace(/[^a-zA-Z0-9_-]/g, '_');
          link.download = `${safeTitle}_Marksheet_Part_${p}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          await new Promise(r => setTimeout(r, 400));
        }
      }
    } catch (err: any) {
      alert('Error during bulk download: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // 3. Copy Current Part Image to Clipboard
  const handleCopyToClipboard = async () => {
    try {
      const canvas = await drawPosterOnCanvas(activePart);
      if (!canvas) return;

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2500);
        } catch {
          alert('Direct image copy is not supported in this browser. Please click "Download PNG" instead.');
        }
      });
    } catch (e: any) {
      alert('Error copying image: ' + e.message);
    }
  };

  // 4. Print / Save as PDF
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="speakhub-result-modal-overlay">
      <div className="speakhub-result-modal">
        
        {/* Top Action Header */}
        <div className="speakhub-modal-header">
          <div className="flex items-center gap-2">
            <span className="modal-title-badge">
              <Sparkles size={16} /> Official Result Marksheet Generator
            </span>
            <span className="text-xs text-gray-500 font-semibold hidden md:inline">
              Speak Hub Academy Official Format
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button 
              type="button" 
              className="action-btn copy-btn" 
              onClick={handleCopyToClipboard}
              title="Copy current marksheet image to clipboard (Ctrl+V in WhatsApp)"
            >
              {isCopied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
              {isCopied ? 'Copied Image!' : 'Copy Image'}
            </button>

            <button 
              type="button" 
              className="action-btn print-btn" 
              onClick={handlePrint}
              title="Print marksheet or Save as PDF"
            >
              <Printer size={14} /> Print / PDF
            </button>

            <button 
              type="button" 
              className="action-btn download-btn" 
              onClick={() => handleDownloadPart(activePart)}
              disabled={isGenerating}
              title="Download high-resolution image"
            >
              <Download size={14} /> 
              {isGenerating ? 'Rendering...' : totalParts > 1 ? `Download Part ${activePart} (PNG)` : 'Download PNG'}
            </button>

            {totalParts > 1 && (
              <button 
                type="button" 
                className="action-btn download-all-btn" 
                onClick={handleDownloadAllParts}
                disabled={isGenerating}
                title="Download all parts as individual PNGs"
              >
                <Layers size={14} /> All Parts ({totalParts})
              </button>
            )}

            <button type="button" className="close-btn" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body: Editor Sidebar + Live Visual Marksheet Preview */}
        <div className="speakhub-modal-body">
          
          {/* Controls Sidebar (Streamlined with only necessary admin controls) */}
          <div className="speakhub-sidebar">
            <h3 className="sidebar-heading">
              <Settings size={15} /> Marksheet Controls
            </h3>

            {/* 1. Result Date Selector (Only Date Admin Needs to Pick) */}
            <div className="form-group highlight-control">
              <label><Calendar size={14} className="text-blue-600" /> Result Publication Date (Pick Date):</label>
              <input 
                type="date" 
                value={resultDateRaw} 
                onChange={(e) => setResultDateRaw(e.target.value)} 
                className="date-input-featured"
              />
              <span className="text-[11px] font-bold text-blue-700">
                Displaying on Marksheet: <strong>{formattedResultDate}</strong>
              </span>
            </div>

            {/* 2. Trainer / Teacher Name (Auto-linked to assigned batch trainer) */}
            <div className="form-group highlight-control">
              <label><User size={14} className="text-purple-600" /> Trainer / Teacher (Auto-linked from Batch):</label>
              <input 
                type="text" 
                value={teacherName} 
                onChange={(e) => setTeacherName(e.target.value)} 
                placeholder="e.g. Mrs. VAISHNAVI"
              />
              <span className="text-[10px] text-gray-500">
                ✓ Automatically fetched from assigned batch trainer.
              </span>
            </div>

            {/* 3. Exam Schedule Date (Readonly indicator taken from exam) */}
            <div className="exam-date-info-card">
              <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900">
                <Clock size={13} /> Exam Date (Taken on this day):
              </div>
              <div className="text-sm font-extrabold text-amber-800 mt-0.5">
                {examDateDisplay}
              </div>
            </div>

            {/* 4. Course & Batch Info */}
            <div className="grid-2">
              <div className="form-group">
                <label><BookOpen size={12} /> Course / Subject</label>
                <input 
                  type="text" 
                  value={courseName} 
                  onChange={(e) => setCourseName(e.target.value)} 
                  placeholder="SPOKEN ENGLISH - FOUNDATION"
                />
              </div>

              <div className="form-group">
                <label>Batch Timing</label>
                <input 
                  type="text" 
                  value={batchTiming} 
                  onChange={(e) => setBatchTiming(e.target.value)} 
                  placeholder="6 TO 7 PM BATCH"
                />
              </div>
            </div>

            {/* 5. Title & Total Marks */}
            <div className="grid-2">
              <div className="form-group">
                <label>Result Badge Title</label>
                <input 
                  type="text" 
                  value={mainResultTitle} 
                  onChange={(e) => setMainResultTitle(e.target.value)} 
                  placeholder="SEPTEMBER 2026 ONLINE EXAM RESULT"
                />
              </div>

              <div className="form-group">
                <label>Total Exam Marks</label>
                <input 
                  type="number" 
                  value={totalMarks} 
                  onChange={(e) => setTotalMarks(Number(e.target.value) || 20)} 
                  placeholder="20"
                />
              </div>
            </div>

            {/* 6. Page Layout & Multi-Page Control */}
            <h3 className="sidebar-heading mt-2">
              <Layers2 size={15} /> Page Layout &amp; Multi-Page
            </h3>

            <div className="grid-2">
              <div className="form-group">
                <label>Page Layout</label>
                <select 
                  value={pageSize} 
                  onChange={(e) => {
                    setPageSize(e.target.value as any);
                    setActivePart(1);
                  }}
                >
                  <option value="auto">Auto (1 Page if ≤15, else 2 Pages)</option>
                  <option value="all">Fit All on 1 Page ({processedStudents.length} Students)</option>
                  <option value="10">10 Students / Page</option>
                  <option value="12">12 Students / Page</option>
                  <option value="15">15 Students / Page</option>
                </select>
              </div>

              <div className="form-group">
                <label>Sort Students</label>
                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value as any)}
                >
                  <option value="alphabetical">Student Name (A - Z)</option>
                  <option value="score">Highest Marks First</option>
                  <option value="rank">Exam Rank (#1, #2...)</option>
                </select>
              </div>
            </div>

            <div className="grid-2">
              <label className="checkbox-toggle">
                <input 
                  type="checkbox" 
                  checked={includeAbsent} 
                  onChange={(e) => setIncludeAbsent(e.target.checked)} 
                />
                <span>Include Absent (&quot;AB&quot;)</span>
              </label>

              <label className="checkbox-toggle">
                <input 
                  type="checkbox" 
                  checked={showPartSuffix} 
                  onChange={(e) => setShowPartSuffix(e.target.checked)} 
                />
                <span>Add &quot;PART - X&quot; Badge</span>
              </label>
            </div>

            {/* Multi-part Selector (only if split across multiple pages) */}
            {totalParts > 1 && (
              <div className="parts-selector-box">
                <label className="text-xs font-bold text-gray-700">Switch Page / Part:</label>
                <div className="parts-buttons-grid">
                  {Array.from({ length: totalParts }, (_, i) => i + 1).map((p) => (
                    <button 
                      key={p}
                      type="button"
                      className={`part-pill-btn ${activePart === p ? 'active' : ''}`}
                      onClick={() => setActivePart(p)}
                    >
                      Part {p} ({String((p - 1) * effectivePageSize + 1).padStart(2, '0')}-{String(Math.min(p * effectivePageSize, processedStudents.length)).padStart(2, '0')})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Permanent Official Speak Hub Details Card (Locked) */}
            <div className="official-branding-lock-card">
              <div className="text-[11px] font-bold text-gray-700 mb-1">
                🔒 Permanent Official Branding:
              </div>
              <div className="text-[11px] text-gray-600 space-y-0.5">
                <div>• Institute: <strong>{INSTITUTE_TITLE}</strong></div>
                <div>• Tagline: <strong>{TAGLINE}</strong></div>
                <div>• Helpline: <strong>9970964742, 8999080975</strong></div>
                <div>• Office: <strong>Omkar Aprtment, Warje-Malwadi, Pune – 58</strong></div>
              </div>
              <div className="text-[10px] text-emerald-700 font-bold mt-1.5 flex items-center gap-1">
                ✓ Locked to official Speak Hub Academy identity
              </div>
            </div>

          </div>

          {/* Live Marksheet Visual Preview Panel */}
          <div className="speakhub-preview-panel">
            
            {/* Part switcher & Zoom toolbar above the preview */}
            <div className="preview-top-toolbar no-print">
              <div className="flex items-center gap-2">
                {totalParts > 1 ? (
                  <>
                    <button 
                      type="button" 
                      className="nav-page-btn" 
                      disabled={activePart <= 1}
                      onClick={() => setActivePart(p => Math.max(1, p - 1))}
                    >
                      <ChevronLeft size={16} /> Prev Page
                    </button>
                    <span className="font-bold text-sm text-gray-700">
                      Page {activePart} of {totalParts} ({processedStudents.length} Students Total)
                    </span>
                    <button 
                      type="button" 
                      className="nav-page-btn" 
                      disabled={activePart >= totalParts}
                      onClick={() => setActivePart(p => Math.min(totalParts, p + 1))}
                    >
                      Next Page <ChevronRight size={16} />
                    </button>
                  </>
                ) : (
                  <span className="font-bold text-xs sm:text-sm text-gray-800 flex items-center gap-1.5">
                    <Check size={15} className="text-emerald-600" />
                    Single Page Marksheet • Showing All {processedStudents.length} Students
                  </span>
                )}
              </div>

              {/* View / Zoom scale toggles so user can see all students & footer at a glance */}
              <div className="flex items-center gap-2">
                <div className="zoom-toggle-group">
                  <button
                    type="button"
                    title="Fit entire marksheet with all students & footer on screen"
                    className={`zoom-btn ${zoomLevel === 0.72 ? 'active' : ''}`}
                    onClick={() => setZoomLevel(0.72)}
                  >
                    <Eye size={13} /> Fit Full Result
                  </button>
                  <button
                    type="button"
                    title="View 100% actual size"
                    className={`zoom-btn ${zoomLevel === 1.0 ? 'active' : ''}`}
                    onClick={() => setZoomLevel(1.0)}
                  >
                    100%
                  </button>
                  <button
                    type="button"
                    title="Zoom Out"
                    className="zoom-btn icon-only"
                    disabled={zoomLevel <= 0.4}
                    onClick={() => setZoomLevel(prev => Math.max(0.4, Number((prev - 0.1).toFixed(2))))}
                  >
                    <ZoomOut size={13} />
                  </button>
                  <span className="zoom-level-text">{Math.round(zoomLevel * 100)}%</span>
                  <button
                    type="button"
                    title="Zoom In"
                    className="zoom-btn icon-only"
                    disabled={zoomLevel >= 1.5}
                    onClick={() => setZoomLevel(prev => Math.min(1.5, Number((prev + 0.1).toFixed(2))))}
                  >
                    <ZoomIn size={13} />
                  </button>
                </div>

                <button 
                  type="button" 
                  className="btn-quick-download" 
                  onClick={() => handleDownloadPart(activePart)}
                >
                  <Download size={13} /> Save Image (PNG)
                </button>
              </div>
            </div>

            {/* SCREEN VIEW: Scaled container that fits all students & footer cleanly */}
            <div 
              className="speakhub-poster-scaler-wrapper"
              style={{
                zoom: zoomLevel,
              } as React.CSSProperties}
            >
              <div className="speakhub-poster-card screen-view-only">
                
                {/* 1. Header with Logo & Brand */}
                <div className="card-top-header">
                  <div className="logo-box">
                    <img src="/logo.png" alt="Speak Hub Logo" className="logo-img" />
                  </div>
                  <div className="title-box">
                    <h1 className="brand-title">{INSTITUTE_TITLE}</h1>
                    <p className="brand-subtitle">{TAGLINE}</p>
                  </div>
                </div>

                {/* 2. Navy Blue Banner Section */}
                <div className="card-blue-banner">
                  <div className="banner-two-cols">
                    <div className="col-side left">
                      <span className="col-text">{courseName}</span>
                      <div className="col-divider-h"></div>
                      <span className="col-text">{batchTiming}</span>
                    </div>

                    <div className="col-divider-v"></div>

                    <div className="col-side right">
                      <span className="col-text">{formattedResultDate}</span>
                      <div className="col-divider-h"></div>
                      <span className="col-text">{teacherName}</span>
                    </div>
                  </div>

                  {/* Light Rounded Pill */}
                  <div className="banner-result-pill">
                    {getPillTitle(activePart)}
                  </div>

                  {/* Yellow Exam Date (Taken automatically from exam schedule) */}
                  <div className="banner-exam-date">
                    {examDateDisplay}
                  </div>
                </div>

                {/* 3. Results Table (Renders exact student count with no trailing gap) */}
                <div className="card-table">
                  <div className="table-header-row">
                    <div className="th-cell th-sr">SR. NO</div>
                    <div className="th-cell th-name">STUDENT NAME</div>
                    <div className="th-cell th-score">SCORE</div>
                  </div>

                  <div className="table-rows-container">
                    {currentPartRows.map((row, idx) => (
                      <div 
                        key={idx} 
                        className={`table-body-row ${idx % 2 === 0 ? 'bg-peach' : 'bg-white'}`}
                      >
                        <div className="td-cell td-sr">{row.srNo}</div>
                        <div className="td-cell td-name">{row.name}</div>
                        <div className={`td-cell td-score ${row.isAbsent ? 'text-absent' : ''}`}>
                          {row.score}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Permanent Footer */}
                <div className="card-footer">
                  <div className="footer-admission-pill">
                    {CONTACT_INFO}
                  </div>
                  <div className="footer-address">
                    {ADDRESS}
                  </div>
                </div>

              </div>
            </div>

            {/* PRINT VIEW ONLY: Renders all parts sequentially with page breaks */}
            <div className="print-view-only">
              {Array.from({ length: totalParts }, (_, pIdx) => {
                const partNum = pIdx + 1;
                const partRows = getRowsForPart(partNum);
                return (
                  <div key={partNum} className="speakhub-poster-card print-page">
                    {/* Header */}
                    <div className="card-top-header">
                      <div className="logo-box">
                        <img src="/logo.png" alt="Speak Hub Logo" className="logo-img" />
                      </div>
                      <div className="title-box">
                        <h1 className="brand-title">{INSTITUTE_TITLE}</h1>
                        <p className="brand-subtitle">{TAGLINE}</p>
                      </div>
                    </div>

                    {/* Navy Blue Banner */}
                    <div className="card-blue-banner">
                      <div className="banner-two-cols">
                        <div className="col-side left">
                          <span className="col-text">{courseName}</span>
                          <div className="col-divider-h"></div>
                          <span className="col-text">{batchTiming}</span>
                        </div>

                        <div className="col-divider-v"></div>

                        <div className="col-side right">
                          <span className="col-text">{formattedResultDate}</span>
                          <div className="col-divider-h"></div>
                          <span className="col-text">{teacherName}</span>
                        </div>
                      </div>

                      <div className="banner-result-pill">
                        {getPillTitle(partNum)}
                      </div>

                      <div className="banner-exam-date">
                        {examDateDisplay}
                      </div>
                    </div>

                    {/* Table */}
                    <div className="card-table">
                      <div className="table-header-row">
                        <div className="th-cell th-sr">SR. NO</div>
                        <div className="th-cell th-name">STUDENT NAME</div>
                        <div className="th-cell th-score">SCORE</div>
                      </div>

                      <div className="table-rows-container">
                        {partRows.map((row, idx) => (
                          <div 
                            key={idx} 
                            className={`table-body-row ${idx % 2 === 0 ? 'bg-peach' : 'bg-white'}`}
                          >
                            <div className="td-cell td-sr">{row.srNo}</div>
                            <div className="td-cell td-name">{row.name}</div>
                            <div className={`td-cell td-score ${row.isAbsent ? 'text-absent' : ''}`}>
                              {row.score}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="card-footer">
                      <div className="footer-admission-pill">
                        {CONTACT_INFO}
                      </div>
                      <div className="footer-address">
                        {ADDRESS}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

        </div>

      </div>

      {/* Hidden high-res canvas used for generating the PNG image */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default ResultPosterModal;
