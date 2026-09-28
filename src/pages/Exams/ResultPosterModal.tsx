import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  X, Download, Printer, Copy, Check, Sparkles, 
  Settings, Award, Calendar, User, MapPin, ChevronLeft, ChevronRight, Layers, Phone
} from 'lucide-react';
import type { Exam } from '../../types/models';
import './ResultPosterModal.css';

interface ResultPosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  exam: Exam | null;
  batchName?: string;
  attempts: any[];
}

export const ResultPosterModal: React.FC<ResultPosterModalProps> = ({
  isOpen,
  onClose,
  exam,
  batchName = '',
  attempts = []
}) => {
  // Format current or exam date for default display: e.g. "27 SEPTEMBER 2026"
  const getFormattedDate = (rawDateVal?: any) => {
    const rawDate: any = rawDateVal || exam?.startDate || new Date();
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
    const rawDate: any = rawDateVal || exam?.startDate || new Date();
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

  // Marksheet Customization State matching user format identically
  const [instituteTitle, setInstituteTitle] = useState('SPEAK HUB ACADEMY');
  const [tagline, setTagline] = useState('Offline & Online Spoken English Classes.');
  const [courseName, setCourseName] = useState('SPOKEN ENGLISH - FOUNDATION');
  const [batchTiming, setBatchTiming] = useState(batchName ? `${batchName.toUpperCase()} BATCH` : '6 TO 7 PM BATCH');
  const [resultDate, setResultDate] = useState(getFormattedDate());
  const [teacherName, setTeacherName] = useState('Mrs. NILAM');
  const [mainResultTitle, setMainResultTitle] = useState(`${getMonthYear()} ONLINE EXAM RESULT`);
  const [examDate, setExamDate] = useState(`EXAM DATE – ${getFormattedDate()}`);
  const [contactInfo, setContactInfo] = useState('For Admission Contact – 9970964742, 8999080975.');
  const [address, setAddress] = useState(
    'Office – Omkar Aprtment, Near Canara Bank, NDA Road, Warje-Malwadi, Pune – 58.'
  );
  const [totalMarks, setTotalMarks] = useState<number>(Number(exam?.totalMarks) || 20);

  // Filter & Sort Settings
  const [includeAbsent, setIncludeAbsent] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<'alphabetical' | 'score' | 'rank'>('alphabetical');

  // Multi-part Pagination State (10 students per part)
  const [activePart, setActivePart] = useState<number>(1);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // Canvas for crisp export
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sync defaults when exam or batch changes
  useEffect(() => {
    if (exam) {
      const isAbacus = (exam.title || '').toLowerCase().includes('abacus') || 
                       (exam.examType || '').toLowerCase().includes('abacus');
      
      if (isAbacus) {
        setInstituteTitle('SPEAK HUB ABACUS');
        setTagline('Fun With Mathematics');
        setCourseName('ABACUS FOUNDATION');
      } else {
        setInstituteTitle('SPEAK HUB ACADEMY');
        setTagline('Offline & Online Spoken English Classes.');
        setCourseName(exam.title ? exam.title.toUpperCase() : 'SPOKEN ENGLISH - FOUNDATION');
      }

      setMainResultTitle(`${getMonthYear(exam.startDate)} ONLINE EXAM RESULT`);
      setExamDate(`EXAM DATE – ${getFormattedDate(exam.startDate)}`);
      setTotalMarks(Number(exam.totalMarks) || 20);

      if (batchName) {
        setBatchTiming(`${batchName.toUpperCase()} BATCH`);
      }
    }
  }, [exam, batchName]);

  // Process and sort students
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

  // Calculate total parts (10 students per part, minimum 1)
  const totalParts = Math.max(1, Math.ceil(processedStudents.length / 10));

  // Reset active part if out of range
  useEffect(() => {
    if (activePart > totalParts) {
      setActivePart(1);
    }
  }, [totalParts, activePart]);

  if (!isOpen) return null;

  // Build the 10 rows for a specific part (1-indexed)
  const getRowsForPart = (partNum: number) => {
    const startIndex = (partNum - 1) * 10;
    const rows = [];
    for (let i = 0; i < 10; i++) {
      const globalIndex = startIndex + i;
      const srNo = String(globalIndex + 1).padStart(2, '0');
      const student = processedStudents[globalIndex];
      let scoreText = '';
      if (student) {
        scoreText = student.isAbsent ? 'AB' : `${student.score} / ${totalMarks}`;
      }
      rows.push({
        srNo,
        name: student ? student.name : '',
        score: scoreText,
        isAbsent: student?.isAbsent ?? false,
        hasData: !!student
      });
    }
    return rows;
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

  // Render high-res exact graphic for a specific part on Canvas
  const drawPosterOnCanvas = async (partNum: number): Promise<HTMLCanvasElement | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // High resolution canvas width and height
    const W = 800;
    const H = 940;

    canvas.width = W;
    canvas.height = H;

    // 1. Clean White Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // 2. Header with Logo & Brand Title
    const logoImg = await loadLogoImage();
    if (logoImg) {
      // Draw official Speak Hub Logo
      ctx.drawImage(logoImg, 25, 12, 85, 80);
    } else {
      // Vector fallback logo swirl
      ctx.fillStyle = '#cc0000';
      ctx.beginPath();
      ctx.arc(65, 45, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('S', 65, 52);
    }

    // Institute Title (Bold Red Serif)
    ctx.fillStyle = '#d32f2f';
    ctx.font = '900 36px "Times New Roman", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(instituteTitle, W / 2 + 35, 50);

    // Tagline (Bold Black Sans-serif)
    ctx.fillStyle = '#000000';
    ctx.font = '700 19px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(tagline, W / 2 + 35, 82);

    // 3. Navy Blue Header Section
    const blueY = 104;
    const blueH = 158;
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

    // Right Column (Date & Teacher)
    ctx.fillText(resultDate, 595, blueY + 28);

    // Right Horizontal Divider
    ctx.beginPath();
    ctx.moveTo(425, blueY + 38);
    ctx.lineTo(765, blueY + 38);
    ctx.stroke();

    // Right Teacher Name
    ctx.fillText(teacherName, 595, blueY + 58);

    // Center Pill: Result Title with Part number
    const pillW = 690;
    const pillH = 38;
    const pillX = (W - pillW) / 2;
    const pillY = blueY + 76;

    ctx.fillStyle = '#fef4e8';
    roundRect(ctx, pillX, pillY, pillW, pillH, 8, true, false);

    ctx.fillStyle = '#c62828';
    ctx.font = '900 18px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${mainResultTitle} PART - ${partNum}`, W / 2, pillY + 25);

    // Yellow Golden Exam Date
    ctx.fillStyle = '#ffc107';
    ctx.font = '800 16px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(examDate, W / 2, blueY + 142);

    // 4. Results Table
    const tableY = blueY + blueH;
    const thH = 42;

    // Header Gold Amber Fill
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
    ctx.fillText('SR. NO', 85, tableY + 27);
    ctx.fillText('STUDENT NAME', 385, tableY + 27);
    ctx.fillText('SCORE', 700, tableY + 27);

    // 10 Rows (Always exactly 10 rows for uniform grid)
    const rowH = 43;
    const rowsStartY = tableY + thH;
    const rows = getRowsForPart(partNum);

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

      // Subtle row border
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
      ctx.fillText(row.srNo, 85, ry + 27);

      // Student Name
      ctx.fillText(row.name, 385, ry + 27);

      // Score
      ctx.fillText(row.score, 700, ry + 27);
    });

    // 5. Footer Section
    const footerStartY = rowsStartY + (10 * rowH) + 12;

    // Admission Banner (Purple/Magenta Pill)
    const admW = 770;
    const admH = 44;
    const admX = (W - admW) / 2;

    ctx.fillStyle = '#7d1867';
    roundRect(ctx, admX, footerStartY, admW, admH, 8, true, false);

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 17px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(contactInfo, W / 2, footerStartY + 28);

    // Office Address
    ctx.fillStyle = '#000000';
    ctx.font = '800 13px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(address, W / 2, footerStartY + admH + 24);

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
      link.download = `${safeTitle}_Marksheet_Part_${partNum}.png`;
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
          // Small pause between multiple downloads
          await new Promise(r => setTimeout(r, 400));
        }
      }
    } catch (err: any) {
      alert('Error during bulk download: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // 3. Copy Current Part Image to Clipboard for instant WhatsApp paste
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
              title="Copy current part image to clipboard (Ctrl+V in WhatsApp)"
            >
              {isCopied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
              {isCopied ? 'Copied Image!' : 'Copy Image'}
            </button>

            <button 
              type="button" 
              className="action-btn print-btn" 
              onClick={handlePrint}
              title="Print all parts or Save as PDF"
            >
              <Printer size={14} /> Print / PDF
            </button>

            <button 
              type="button" 
              className="action-btn download-btn" 
              onClick={() => handleDownloadPart(activePart)}
              disabled={isGenerating}
              title="Download high-resolution image for current part"
            >
              <Download size={14} /> 
              {isGenerating ? 'Rendering...' : `Download Part ${activePart} (PNG)`}
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
          
          {/* Controls Sidebar */}
          <div className="speakhub-sidebar">
            <h3 className="sidebar-heading">
              <Settings size={15} /> Customize Marksheet Details
            </h3>

            <div className="form-group">
              <label><Award size={13} /> Institute Name</label>
              <input 
                type="text" 
                value={instituteTitle} 
                onChange={(e) => setInstituteTitle(e.target.value)} 
                placeholder="SPEAK HUB ACADEMY"
              />
            </div>

            <div className="form-group">
              <label>Tagline</label>
              <input 
                type="text" 
                value={tagline} 
                onChange={(e) => setTagline(e.target.value)} 
                placeholder="Offline & Online Spoken English Classes."
              />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label>Course / Subject</label>
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

            <div className="grid-2">
              <div className="form-group">
                <label><Calendar size={13} /> Result Date</label>
                <input 
                  type="text" 
                  value={resultDate} 
                  onChange={(e) => setResultDate(e.target.value)} 
                  placeholder="27 SEPTEMBER 2026"
                />
              </div>

              <div className="form-group">
                <label><User size={13} /> Teacher / Mentor</label>
                <input 
                  type="text" 
                  value={teacherName} 
                  onChange={(e) => setTeacherName(e.target.value)} 
                  placeholder="Mrs. NILAM"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Pill Title (Part is added automatically)</label>
              <input 
                type="text" 
                value={mainResultTitle} 
                onChange={(e) => setMainResultTitle(e.target.value)} 
                placeholder="SEPTEMBER 2026 ONLINE EXAM RESULT"
              />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label>Exam Date Banner</label>
                <input 
                  type="text" 
                  value={examDate} 
                  onChange={(e) => setExamDate(e.target.value)} 
                  placeholder="EXAM DATE – 17 SEPTEMBER 2026"
                />
              </div>

              <div className="form-group">
                <label>Total Marks</label>
                <input 
                  type="number" 
                  value={totalMarks} 
                  onChange={(e) => setTotalMarks(Number(e.target.value) || 20)} 
                  placeholder="20"
                />
              </div>
            </div>

            <div className="form-group">
              <label><Phone size={13} /> Admission Contact Banner</label>
              <input 
                type="text" 
                value={contactInfo} 
                onChange={(e) => setContactInfo(e.target.value)} 
                placeholder="For Admission Contact – 9970964742, 8999080975."
              />
            </div>

            <div className="form-group">
              <label><MapPin size={13} /> Office Address (Footer)</label>
              <textarea 
                rows={2}
                value={address} 
                onChange={(e) => setAddress(e.target.value)} 
                placeholder="Office – Omkar Aprtment, Near Canara Bank, NDA Road, Warje-Malwadi, Pune – 58."
              />
            </div>

            {/* Filter & Sorting Controls */}
            <h3 className="sidebar-heading mt-3">
              <Settings size={15} /> Student Roster &amp; Display
            </h3>

            <div className="grid-2">
              <div className="form-group">
                <label>Sort Order</label>
                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value as any)}
                >
                  <option value="alphabetical">Student Name (A - Z)</option>
                  <option value="score">Highest Marks First</option>
                  <option value="rank">Exam Rank (#1, #2...)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Absent Students</label>
                <label className="checkbox-toggle">
                  <input 
                    type="checkbox" 
                    checked={includeAbsent} 
                    onChange={(e) => setIncludeAbsent(e.target.checked)} 
                  />
                  <span>Show &quot;AB&quot; for absent</span>
                </label>
              </div>
            </div>

            {/* Multi-part Selector */}
            {totalParts > 1 && (
              <div className="parts-selector-box">
                <label className="text-xs font-bold text-gray-700">Jump to Part / Page:</label>
                <div className="parts-buttons-grid">
                  {Array.from({ length: totalParts }, (_, i) => i + 1).map((p) => (
                    <button 
                      key={p}
                      type="button"
                      className={`part-pill-btn ${activePart === p ? 'active' : ''}`}
                      onClick={() => setActivePart(p)}
                    >
                      Part {p} ({String((p - 1) * 10 + 1).padStart(2, '0')}-{String(Math.min(p * 10, processedStudents.length)).padStart(2, '0')})
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="sidebar-tip-box">
              <strong>💡 Pro Tip:</strong> Each part holds exactly 10 students. You can copy the image directly to WhatsApp Web using <b>&quot;Copy Image&quot;</b> or click <b>&quot;Print / PDF&quot;</b> to generate a multi-page PDF identical to your shared format!
            </div>
          </div>

          {/* Live Preview Panel */}
          <div className="speakhub-preview-panel">
            
            {/* Part switcher above the preview */}
            <div className="preview-top-toolbar no-print">
              <div className="flex items-center gap-2">
                <button 
                  type="button" 
                  className="nav-page-btn" 
                  disabled={activePart <= 1}
                  onClick={() => setActivePart(p => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={16} /> Prev Part
                </button>
                <span className="font-bold text-sm text-gray-700">
                  Part {activePart} of {totalParts} ({processedStudents.length} Students Total)
                </span>
                <button 
                  type="button" 
                  className="nav-page-btn" 
                  disabled={activePart >= totalParts}
                  onClick={() => setActivePart(p => Math.min(totalParts, p + 1))}
                >
                  Next Part <ChevronRight size={16} />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  type="button" 
                  className="btn-quick-download" 
                  onClick={() => handleDownloadPart(activePart)}
                >
                  <Download size={13} /> Save Part {activePart} PNG
                </button>
              </div>
            </div>

            {/* SCREEN VIEW: Shows the currently selected part */}
            <div className="speakhub-poster-card screen-view-only">
              
              {/* 1. Header with Logo & Brand */}
              <div className="card-top-header">
                <div className="logo-box">
                  <img src="/logo.png" alt="Speak Hub Logo" className="logo-img" />
                </div>
                <div className="title-box">
                  <h1 className="brand-title">{instituteTitle}</h1>
                  <p className="brand-subtitle">{tagline}</p>
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
                    <span className="col-text">{resultDate}</span>
                    <div className="col-divider-h"></div>
                    <span className="col-text">{teacherName}</span>
                  </div>
                </div>

                {/* Light Rounded Pill */}
                <div className="banner-result-pill">
                  {mainResultTitle} PART - {activePart}
                </div>

                {/* Yellow Exam Date */}
                <div className="banner-exam-date">
                  {examDate}
                </div>
              </div>

              {/* 3. Results Table */}
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

              {/* 4. Footer */}
              <div className="card-footer">
                <div className="footer-admission-pill">
                  {contactInfo}
                </div>
                <div className="footer-address">
                  {address}
                </div>
              </div>

            </div>

            {/* PRINT VIEW ONLY: Renders ALL parts sequentially with page breaks */}
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
                        <h1 className="brand-title">{instituteTitle}</h1>
                        <p className="brand-subtitle">{tagline}</p>
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
                          <span className="col-text">{resultDate}</span>
                          <div className="col-divider-h"></div>
                          <span className="col-text">{teacherName}</span>
                        </div>
                      </div>

                      <div className="banner-result-pill">
                        {mainResultTitle} PART - {partNum}
                      </div>

                      <div className="banner-exam-date">
                        {examDate}
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
                        {contactInfo}
                      </div>
                      <div className="footer-address">
                        {address}
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
