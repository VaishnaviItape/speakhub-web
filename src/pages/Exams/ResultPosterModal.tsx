import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Download, Printer, Copy, Check, Sparkles, 
  Settings, Award, Calendar, User, MapPin, Palette 
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
  // Format current or exam date for default display: e.g. "23 SEPTEMBER 2026"
  const getFormattedDate = () => {
    const rawDate: any = exam?.startDate || new Date();
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

  // Customizable Poster Fields
  const [instituteTitle, setInstituteTitle] = useState('SPEAK HUB ABACUS');
  const [tagline, setTagline] = useState('Fun With Mathematics');
  const [batchType, setBatchType] = useState(batchName ? `${batchName.toUpperCase()} BATCH` : 'OFFLINE ABACUS BATCH');
  const [examDate, setExamDate] = useState(getFormattedDate());
  const [batchCategory, setBatchCategory] = useState('ALL BATCHES');
  const [teacherNames, setTeacherNames] = useState('Mrs. SHWETA & GAYATRI');
  const [posterTitle, setPosterTitle] = useState(
    exam?.title 
      ? `${exam.title.toUpperCase()} TEST RESULT` 
      : 'SEPTEMBER ABACUS BATCH TEST RESULT'
  );
  const [address, setAddress] = useState(
    'Office - Omkar Apartment, Near Canara Bank, Warje-Malwadi, Pune-58.'
  );
  
  // Filtering & Ordering
  const [studentLimit, setStudentLimit] = useState<'all' | '10' | '12' | '15'>('12');
  const [sortBy, setSortBy] = useState<'score' | 'rank' | 'time'>('score');
  const [colorTheme, setColorTheme] = useState<'magenta' | 'purple' | 'navy' | 'emerald'>('magenta');

  // Copy state
  const [isCopied, setIsCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Canvas ref for drawing the high-res PNG export
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Synchronize defaults when exam changes
  useEffect(() => {
    if (exam) {
      const isAbacus = (exam.title || '').toLowerCase().includes('abacus') || 
                       (exam.examType || '').toLowerCase().includes('abacus');
      setInstituteTitle(isAbacus ? 'SPEAK HUB ABACUS' : 'SPEAK HUB ACADEMY');
      setTagline(isAbacus ? 'Fun With Mathematics' : 'Excellence in Learning');
      setPosterTitle(`${exam.title.toUpperCase()} TEST RESULT`);
      if (batchName) {
        setBatchType(`${batchName.toUpperCase()}`);
      }
    }
  }, [exam, batchName]);

  if (!isOpen) return null;

  // Filter only submitted attempts with scores (exclude absents from the celebratory poster)
  const submittedStudents = attempts
    .filter(a => a.attempt && a.attempt.score !== undefined)
    .map(a => {
      const att = a.attempt;
      const score = Number(att.score) || 0;
      const timeSeconds = Number(att.timeUsed) || 360;
      
      // Calculate formatted time taken (e.g. 6, 7:28, 10, 9:50)
      const m = Math.floor(timeSeconds / 60);
      const s = timeSeconds % 60;
      const timeTakeFormatted = s === 0 ? `${m || 5}` : `${m}:${s < 10 ? '0' : ''}${s}`;

      return {
        name: a.name || 'Student',
        score,
        timeSeconds,
        timeTake: timeTakeFormatted,
        rank: Number(att.rank) || 1
      };
    });

  // Sort according to selection
  submittedStudents.sort((a, b) => {
    if (sortBy === 'score') {
      if (b.score !== a.score) return b.score - a.score;
      return a.timeSeconds - b.timeSeconds; // tie-breaker: faster time wins
    }
    if (sortBy === 'rank') return a.rank - b.rank;
    if (sortBy === 'time') return a.timeSeconds - b.timeSeconds;
    return 0;
  });

  // Slice based on limit
  const displayStudents = studentLimit === 'all' 
    ? submittedStudents 
    : submittedStudents.slice(0, parseInt(studentLimit, 10));

  const totalMarks = Number(exam?.totalMarks) || 100;

  // Color Palettes
  const themes = {
    magenta: {
      primary: '#d81b60',
      dark: '#ad1457',
      light: '#fce4ec',
      accent: '#c2185b',
      titleColor: '#b71c1c',
      badgeBg: '#ffffff'
    },
    purple: {
      primary: '#7c3aed',
      dark: '#5b21b6',
      light: '#ede9fe',
      accent: '#6d28d9',
      titleColor: '#4c1d95',
      badgeBg: '#ffffff'
    },
    navy: {
      primary: '#1e40af',
      dark: '#1e3a8a',
      light: '#eff6ff',
      accent: '#1d4ed8',
      titleColor: '#172554',
      badgeBg: '#ffffff'
    },
    emerald: {
      primary: '#059669',
      dark: '#065f46',
      light: '#ecfdf5',
      accent: '#047857',
      titleColor: '#064e3b',
      badgeBg: '#ffffff'
    }
  };

  const currentTheme = themes[colorTheme];

  // Draw High-Resolution Poster on Canvas (Exact 800 x 1100 resolution)
  const drawPosterOnCanvas = (): HTMLCanvasElement | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const W = 800;
    // Calculate required height based on rows
    const rowHeight = 36;
    const headerHeight = 230;
    const footerHeight = 300;
    const H = headerHeight + (displayStudents.length * rowHeight) + footerHeight;

    canvas.width = W;
    canvas.height = H;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // 1. TOP LOGO & HEADER
    ctx.fillStyle = currentTheme.titleColor;
    ctx.font = '900 36px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(instituteTitle, W / 2, 45);

    ctx.fillStyle = '#111827';
    ctx.font = '700 20px "Segoe UI", Arial, sans-serif';
    ctx.fillText(tagline, W / 2, 75);

    // Mini decorative abacus frame on top right
    drawAbacusBeads(ctx, W - 140, 20, 110, 48);

    // 2. MAGENTA/THEME BANNER SECTION
    ctx.fillStyle = currentTheme.primary;
    ctx.fillRect(0, 95, W, 125);

    // Left info
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 15px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(batchType, 30, 125);
    ctx.font = '600 13px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#fce4ec';
    ctx.fillText(examDate, 30, 145);

    // Right info
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 15px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(batchCategory, W - 30, 125);
    ctx.font = '700 13px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#fffbeb';
    ctx.fillText(teacherNames, W - 30, 145);

    // Center Badge: TEST RESULT PILL
    const badgeW = 520;
    const badgeH = 40;
    const badgeX = (W - badgeW) / 2;
    const badgeY = 162;

    ctx.fillStyle = '#ffffff';
    roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 10, true, false);
    ctx.strokeStyle = '#f472b6';
    ctx.lineWidth = 1.5;
    roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 10, false, true);

    ctx.fillStyle = '#111827';
    ctx.font = '900 19px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(posterTitle, W / 2, badgeY + 27);

    // 3. TABLE HEADER
    const tableTop = 220;
    ctx.fillStyle = currentTheme.dark;
    ctx.fillRect(0, tableTop, W, 38);

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 14px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('TIME TAKE (Minutes)', 35, tableTop + 24);

    ctx.textAlign = 'center';
    ctx.fillText('SCORE', 380, tableTop + 24);

    ctx.textAlign = 'left';
    ctx.fillText('STUDENT NAME', 520, tableTop + 24);

    // 4. STUDENT ROWS
    let currentY = tableTop + 38;
    displayStudents.forEach((student, idx) => {
      // Alternating background
      ctx.fillStyle = idx % 2 === 0 ? '#fffdf7' : '#ffffff';
      ctx.fillRect(0, currentY, W, rowHeight);

      // Subtle divider
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(20, currentY + rowHeight);
      ctx.lineTo(W - 20, currentY + rowHeight);
      ctx.stroke();

      // Time
      ctx.fillStyle = '#0f172a';
      ctx.font = '800 16px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(student.timeTake, 75, currentY + 24);

      // Score
      ctx.fillStyle = '#0f172a';
      ctx.font = '800 17px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${student.score} / ${totalMarks}`, 380, currentY + 24);

      // Student Name
      ctx.fillStyle = '#0f172a';
      ctx.font = '900 17px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(student.name, 520, currentY + 24);

      currentY += rowHeight;
    });

    // 5. BOTTOM ILLUSTRATION & BENEFITS SECTION
    const bottomY = currentY;
    const bottomH = 220;

    // Gradient background for illustration box
    const grad = ctx.createLinearGradient(0, bottomY, W, bottomY + bottomH);
    grad.addColorStop(0, '#1e3a8a');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, bottomY, W, bottomH);

    // Left: Draw Student with Abacus Illustration
    drawStudentStudyGraphic(ctx, 40, bottomY + 25);

    // Center: Draw Golden Trophy
    drawGoldenTrophy(ctx, W / 2 - 35, bottomY + 30);

    // Trophy pedestal text
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 12px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Keep Practicing', W / 2, bottomY + 175);
    ctx.fillText('Keep Achieving', W / 2, bottomY + 192);

    // Right: Draw Benefits Grid
    drawBenefitsBlock(ctx, W - 260, bottomY + 20);

    // 6. BOTTOM FOOTER STRIP
    const footerY = bottomY + bottomH;
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, footerY, W, 42);

    ctx.fillStyle = '#1e293b';
    ctx.font = '700 14px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(address, W / 2, footerY + 26);

    return canvas;
  };

  // Helper: Round Rectangle
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

  // Helper: Draw Abacus frame on top right
  const drawAbacusBeads = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = '#78350f';
    roundRect(ctx, x, y, w, h, 6, true, false);

    // Dividing bar
    ctx.fillStyle = '#b45309';
    ctx.fillRect(x, y + 16, w, 4);

    // Metal rods and beads
    const rods = 5;
    const rodStep = w / (rods + 1);
    for (let i = 1; i <= rods; i++) {
      const rx = x + (i * rodStep);
      ctx.fillStyle = '#d1d5db';
      ctx.fillRect(rx - 1, y + 4, 2, h - 8);

      // Top beads (brown / amber)
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(rx, y + 9, 4, 0, Math.PI * 2);
      ctx.fill();

      // Bottom beads
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.arc(rx, y + 26, 4, 0, Math.PI * 2);
      ctx.arc(rx, y + 36, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // Helper: Draw Golden Trophy
  const drawGoldenTrophy = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    // Cup body
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 10);
    ctx.lineTo(x + 60, y + 10);
    ctx.quadraticCurveTo(x + 60, y + 65, x + 35, y + 75);
    ctx.quadraticCurveTo(x + 10, y + 65, x + 10, y + 10);
    ctx.fill();

    // Handles
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x + 8, y + 35, 14, Math.PI * 0.5, Math.PI * 1.5);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x + 62, y + 35, 14, Math.PI * 1.5, Math.PI * 0.5);
    ctx.stroke();

    // Star in trophy
    ctx.fillStyle = '#fef08a';
    ctx.font = '22px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('★', x + 35, y + 45);

    // Stem
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(x + 30, y + 75, 10, 25);

    // Base pedestal
    ctx.fillStyle = '#1e293b';
    roundRect(ctx, x - 25, y + 100, 120, 50, 8, true, false);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x - 25, y + 100, 120, 50, 8, false, true);
  };

  // Helper: Draw Student with Abacus & Math symbols
  const drawStudentStudyGraphic = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    // Student head & smile
    ctx.fillStyle = '#fcd34d';
    ctx.beginPath();
    ctx.arc(x + 50, y + 40, 28, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = '#1e1b4b';
    ctx.beginPath();
    ctx.arc(x + 50, y + 30, 28, Math.PI * 0.8, Math.PI * 2.2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(x + 42, y + 38, 3, 0, Math.PI * 2);
    ctx.arc(x + 58, y + 38, 3, 0, Math.PI * 2);
    ctx.fill();

    // Smile
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x + 50, y + 44, 12, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();

    // Shirt / body
    ctx.fillStyle = '#3b82f6';
    roundRect(ctx, x + 25, y + 70, 50, 45, 10, true, false);

    // Student Abacus toy on desk
    ctx.fillStyle = '#78350f';
    roundRect(ctx, x + 15, y + 115, 80, 40, 4, true, false);
    ctx.fillStyle = '#f97316';
    for (let r = 0; r < 4; r++) {
      ctx.beginPath();
      ctx.arc(x + 28 + (r * 18), y + 128, 5, 0, Math.PI * 2);
      ctx.arc(x + 28 + (r * 18), y + 142, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Floating colorful math symbols
    ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#ec4899';
    ctx.fillText('+', x - 5, y + 25);
    ctx.fillStyle = '#22c55e';
    ctx.fillText('=', x + 20, y + 15);
    ctx.fillStyle = '#eab308';
    ctx.fillText('%', x - 8, y + 65);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('1', x + 105, y + 20);
    ctx.fillStyle = '#a855f7';
    ctx.fillText('2', x + 115, y + 45);
    ctx.fillStyle = '#fb923c';
    ctx.fillText('3', x + 120, y + 75);
  };

  // Helper: Draw Benefits Block
  const drawBenefitsBlock = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    const boxW = 240;
    const boxH = 175;

    // Outer card
    ctx.fillStyle = '#0f172a';
    roundRect(ctx, x, y, boxW, boxH, 12, true, false);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, boxW, boxH, 12, false, true);

    // Badge Title
    ctx.fillStyle = '#0284c7';
    roundRect(ctx, x + 35, y - 10, 170, 26, 13, true, false);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 12px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ABACUS BENEFITS', x + 120, y + 8);

    // 2x2 Grid of benefits
    const items = [
      { icon: '🧠', title: 'Improves', sub: 'Concentration' },
      { icon: '⚡', title: 'Faster', sub: 'Calculation' },
      { icon: '💡', title: 'Boosts', sub: 'Memory' },
      { icon: '🎯', title: 'Sharpens', sub: 'Brain' }
    ];

    items.forEach((item, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const ix = x + 15 + (col * 115);
      const iy = y + 28 + (row * 68);

      ctx.font = '22px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(item.icon, ix + 45, iy + 22);

      ctx.font = '700 11px "Segoe UI", Arial, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(item.title, ix + 45, iy + 42);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 10px "Segoe UI", Arial, sans-serif';
      ctx.fillText(item.sub, ix + 45, iy + 55);
    });
  };

  // 1. Download Poster as PNG Image
  const handleDownloadImage = () => {
    setIsGenerating(true);
    setTimeout(() => {
      try {
        const canvas = drawPosterOnCanvas();
        if (!canvas) return;

        const url = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = url;
        const safeTitle = (exam?.title || 'Exam_Result').replace(/[^a-zA-Z0-9_-]/g, '_');
        link.download = `${safeTitle}_Poster.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err: any) {
        alert('Could not download image: ' + err.message);
      } finally {
        setIsGenerating(false);
      }
    }, 100);
  };

  // 2. Copy Poster Image to Clipboard
  const handleCopyToClipboard = async () => {
    try {
      const canvas = drawPosterOnCanvas();
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
          alert('Direct image copy is not supported in this browser. Please use "Download PNG" instead.');
        }
      });
    } catch (e: any) {
      alert('Error copying image: ' + e.message);
    }
  };

  // 3. Print Poster
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="result-poster-overlay">
      <div className="result-poster-modal">
        
        {/* Modal Header */}
        <div className="result-poster-header">
          <div className="flex items-center gap-2">
            <span className="poster-header-badge">
              <Sparkles size={16} /> Result Poster Generator
            </span>
            <span className="text-xs text-gray-500 font-medium">WhatsApp / Social Media Format</span>
          </div>

          <div className="flex items-center gap-2">
            <button 
              type="button" 
              className="poster-btn-copy" 
              onClick={handleCopyToClipboard}
              title="Copy poster image directly to paste into WhatsApp Web"
            >
              {isCopied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
              {isCopied ? 'Copied to Clipboard!' : 'Copy Image'}
            </button>

            <button 
              type="button" 
              className="poster-btn-print" 
              onClick={handlePrint}
              title="Print poster or save as PDF"
            >
              <Printer size={14} /> Print / PDF
            </button>

            <button 
              type="button" 
              className="poster-btn-download" 
              onClick={handleDownloadImage}
              disabled={isGenerating}
              title="Download high-resolution image to post on WhatsApp status"
            >
              <Download size={14} /> 
              {isGenerating ? 'Rendering...' : 'Download PNG'}
            </button>

            <button type="button" className="poster-btn-close" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body: Editor Sidebar + Live Visual Poster Preview */}
        <div className="result-poster-content">
          
          {/* Controls Sidebar */}
          <div className="poster-editor-sidebar">
            <h3 className="editor-section-title">
              <Settings size={15} /> Customize Poster Content
            </h3>

            <div className="editor-form-group">
              <label><Award size={13} /> Institute Name</label>
              <input 
                type="text" 
                value={instituteTitle} 
                onChange={(e) => setInstituteTitle(e.target.value)} 
                placeholder="e.g. SPEAK HUB ABACUS"
              />
            </div>

            <div className="editor-form-group">
              <label>Tagline</label>
              <input 
                type="text" 
                value={tagline} 
                onChange={(e) => setTagline(e.target.value)} 
                placeholder="e.g. Fun With Mathematics"
              />
            </div>

            <div className="editor-grid-2">
              <div className="editor-form-group">
                <label>Batch Mode / Type</label>
                <input 
                  type="text" 
                  value={batchType} 
                  onChange={(e) => setBatchType(e.target.value)} 
                  placeholder="e.g. OFFLINE ABACUS BATCH"
                />
              </div>

              <div className="editor-form-group">
                <label><Calendar size={13} /> Exam Date</label>
                <input 
                  type="text" 
                  value={examDate} 
                  onChange={(e) => setExamDate(e.target.value)} 
                  placeholder="e.g. 23 SEPTEMBER 2026"
                />
              </div>
            </div>

            <div className="editor-grid-2">
              <div className="editor-form-group">
                <label>Batch Category</label>
                <input 
                  type="text" 
                  value={batchCategory} 
                  onChange={(e) => setBatchCategory(e.target.value)} 
                  placeholder="e.g. ALL BATCHES"
                />
              </div>

              <div className="editor-form-group">
                <label><User size={13} /> Teachers / Mentors</label>
                <input 
                  type="text" 
                  value={teacherNames} 
                  onChange={(e) => setTeacherNames(e.target.value)} 
                  placeholder="e.g. Mrs. SHWETA & GAYATRI"
                />
              </div>
            </div>

            <div className="editor-form-group">
              <label>Poster Main Title Badge</label>
              <input 
                type="text" 
                value={posterTitle} 
                onChange={(e) => setPosterTitle(e.target.value)} 
                placeholder="e.g. SEPTEMBER ABACUS BATCH TEST RESULT"
              />
            </div>

            <div className="editor-form-group">
              <label><MapPin size={13} /> Office Address (Footer)</label>
              <textarea 
                rows={2}
                value={address} 
                onChange={(e) => setAddress(e.target.value)} 
                placeholder="e.g. Office - Omkar Apartment, Near Canara Bank..."
              />
            </div>

            {/* Filter & Sort controls */}
            <h3 className="editor-section-title mt-4">
              <Palette size={15} /> Display &amp; Themes
            </h3>

            <div className="editor-grid-2">
              <div className="editor-form-group">
                <label>Theme Color</label>
                <select 
                  value={colorTheme} 
                  onChange={(e) => setColorTheme(e.target.value as any)}
                >
                  <option value="magenta">Magenta / Pink (Standard)</option>
                  <option value="purple">Royal Purple</option>
                  <option value="navy">Navy Blue</option>
                  <option value="emerald">Emerald Green</option>
                </select>
              </div>

              <div className="editor-form-group">
                <label>Students on Poster</label>
                <select 
                  value={studentLimit} 
                  onChange={(e) => setStudentLimit(e.target.value as any)}
                >
                  <option value="10">Top 10 Toppers</option>
                  <option value="12">Top 12 Students (Ideal)</option>
                  <option value="15">Top 15 Students</option>
                  <option value="all">All Submitted Students</option>
                </select>
              </div>
            </div>

            <div className="editor-form-group">
              <label>Sort Students By</label>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value as any)}
              >
                <option value="score">Highest Score (Marks)</option>
                <option value="time">Fastest Time Taken</option>
                <option value="rank">Student Rank</option>
              </select>
            </div>

            <div className="poster-tip-box">
              <strong>💡 Status Tip:</strong> You can download this PNG or copy it directly into WhatsApp Web to celebrate your students' exam achievements on social media.
            </div>
          </div>

          {/* Live Poster Preview (Exact Format as requested) */}
          <div className="poster-preview-panel">
            <div className="poster-sheet print-area" style={{ '--theme-primary': currentTheme.primary, '--theme-dark': currentTheme.dark } as any}>
              
              {/* 1. White Top Header with Logo & Abacus graphic */}
              <div className="poster-top-bar">
                <div className="poster-branding">
                  <h1 className="poster-main-title" style={{ color: currentTheme.titleColor }}>{instituteTitle}</h1>
                  <p className="poster-tagline">{tagline}</p>
                </div>
                
                <div className="poster-mini-abacus" title="Speak Hub Abacus">
                  <div className="abacus-rod"></div>
                  <div className="abacus-rod"></div>
                  <div className="abacus-rod"></div>
                  <div className="abacus-rod"></div>
                  <div className="abacus-rod"></div>
                  <div className="abacus-separator"></div>
                </div>
              </div>

              {/* 2. Theme Colored Banner */}
              <div className="poster-banner-bar" style={{ backgroundColor: currentTheme.primary }}>
                <div className="banner-side left">
                  <span className="banner-highlight">{batchType}</span>
                  <span className="banner-sub">{examDate}</span>
                </div>

                <div className="banner-side right">
                  <span className="banner-highlight">{batchCategory}</span>
                  <span className="banner-sub">{teacherNames}</span>
                </div>

                {/* White Result Pill */}
                <div className="poster-result-pill">
                  {posterTitle}
                </div>
              </div>

              {/* 3. Result Table Header */}
              <div className="poster-table-header" style={{ backgroundColor: currentTheme.dark }}>
                <div className="col-time">TIME TAKE (Minutes)</div>
                <div className="col-score">SCORE</div>
                <div className="col-name">STUDENT NAME</div>
              </div>

              {/* 4. Result Rows */}
              <div className="poster-table-body">
                {displayStudents.length > 0 ? (
                  displayStudents.map((st, index) => (
                    <div key={index} className={`poster-table-row ${index % 2 === 0 ? 'even' : 'odd'}`}>
                      <div className="col-time font-black">{st.timeTake}</div>
                      <div className="col-score font-black">{st.score} / {totalMarks}</div>
                      <div className="col-name font-black">{st.name}</div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-gray-400 font-bold">
                    No submitted student marks found to display.
                  </div>
                )}
              </div>

              {/* 5. Bottom Graphic Banner with Trophy & Benefits */}
              <div className="poster-bottom-graphic">
                
                {/* Left: Study character with Math symbols */}
                <div className="poster-character-box">
                  <div className="floating-math-symbol s1">+</div>
                  <div className="floating-math-symbol s2">=</div>
                  <div className="floating-math-symbol s3">%</div>
                  <div className="floating-math-symbol s4">1</div>
                  <div className="floating-math-symbol s5">2</div>
                  <div className="floating-math-symbol s6">3</div>
                  
                  <div className="student-avatar-art">
                    <span className="avatar-face">👦</span>
                    <span className="avatar-thumbs">👍</span>
                  </div>
                  <div className="mini-desk-abacus">
                    <span className="bead b1"></span>
                    <span className="bead b2"></span>
                    <span className="bead b3"></span>
                    <span className="bead b4"></span>
                  </div>
                </div>

                {/* Center: Golden Trophy */}
                <div className="poster-trophy-box">
                  <div className="trophy-cup">
                    <div className="trophy-handle left"></div>
                    <div className="trophy-body">★</div>
                    <div className="trophy-handle right"></div>
                  </div>
                  <div className="trophy-stem"></div>
                  <div className="trophy-pedestal">
                    <span>Keep Practicing</span>
                    <span>Keep Achieving</span>
                  </div>
                </div>

                {/* Right: Abacus Benefits Grid */}
                <div className="poster-benefits-card">
                  <div className="benefits-badge">ABACUS BENEFITS</div>
                  <div className="benefits-grid">
                    <div className="benefit-item">
                      <span className="b-icon">🧠</span>
                      <span className="b-title">Improves</span>
                      <span className="b-sub">Concentration</span>
                    </div>
                    <div className="benefit-item">
                      <span className="b-icon">⚡</span>
                      <span className="b-title">Faster</span>
                      <span className="b-sub">Calculation</span>
                    </div>
                    <div className="benefit-item">
                      <span className="b-icon">💡</span>
                      <span className="b-title">Boosts</span>
                      <span className="b-sub">Memory</span>
                    </div>
                    <div className="benefit-item">
                      <span className="b-icon">🎯</span>
                      <span className="b-title">Sharpens</span>
                      <span className="b-sub">Brain</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* 6. Footer Office Address */}
              <div className="poster-footer-strip">
                {address}
              </div>

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
