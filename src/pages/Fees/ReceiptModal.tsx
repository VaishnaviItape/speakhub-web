import React, { useState, useRef } from 'react';
import { 
  X, 
  Printer, 
  MessageCircle, 
  Download, 
  FileText, 
  Check, 
  Phone,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Loader2
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../config/firebase';
import ReceiptTemplate from './ReceiptTemplate';
import type { FeeTransaction, User, Course } from '../../types/models';
import './ReceiptModal.css';

export interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: FeeTransaction | null;
  student?: User | { name?: string; phone?: string; mobile?: string } | null;
  course?: Course | { courseName?: string } | null;
  plan?: { planName?: string } | null;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  transaction,
  student,
  course,
  plan
}) => {
  const [isExportingImage, setIsExportingImage] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isSharingWhatsApp, setIsSharingWhatsApp] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [phonePromptOpen, setPhonePromptOpen] = useState<boolean>(false);
  const [desktopShareModalOpen, setDesktopShareModalOpen] = useState<boolean>(false);
  const [sharedFileName, setSharedFileName] = useState<string>('');
  const [targetSharedPhone, setTargetSharedPhone] = useState<string>('');
  const [customPhone, setCustomPhone] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const receiptContainerRef = useRef<HTMLDivElement | null>(null);

  if (!isOpen || !transaction) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  const studentName = student?.name || (transaction as any).studentName || 'Student';
  const registeredPhone = (student as any)?.phone || (student as any)?.mobile || (transaction as any)?.phone || '';
  const receiptNumber = transaction.receiptNumber || '08/26-004';
  const amountPaid = transaction.amountPaid || 0;

  // Build the A4 PDF Document from the HTML element
  const buildReceiptPdf = async () => {
    const el = document.getElementById('speak-hub-fee-receipt-box');
    if (!el) {
      alert("Receipt element not found for rendering.");
      return null;
    }

    const canvas = await html2canvas(el, {
      scale: 2.5, // 2.5x sharp retina resolution
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false
    });

    const imgData = canvas.toDataURL('image/png', 1.0);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // A4 page width = 210mm, margins = 10mm each side -> printable = 190mm
    const pageWidth = 210;
    const margin = 10;
    const printWidth = pageWidth - (margin * 2);
    const printHeight = (canvas.height * printWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', margin, margin, printWidth, printHeight);

    const safeNumber = receiptNumber.replace(/[/\\?%*:|"<>]/g, '_');
    const fileName = `SpeakHub_Receipt_${safeNumber}.pdf`;
    const blob = pdf.output('blob');
    const file = new File([blob], fileName, { type: 'application/pdf' });

    return { pdf, blob, file, fileName, canvas };
  };

  // 1. Share Receipt PDF directly to WhatsApp
  const handleShareToWhatsApp = async (targetPhone?: string) => {
    const rawPhone = targetPhone || customPhone || registeredPhone;
    const cleanPhone = (rawPhone || '').replace(/[^0-9]/g, '');

    if (!cleanPhone || cleanPhone.length < 10) {
      setCustomPhone(cleanPhone);
      setPhonePromptOpen(true);
      return;
    }

    setIsSharingWhatsApp(true);
    try {
      const res = await buildReceiptPdf();
      if (!res) {
        setIsSharingWhatsApp(false);
        return;
      }

      const { pdf, blob, file, fileName, canvas } = res;
      const phoneWithCountry = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
      setTargetSharedPhone(cleanPhone);
      setSharedFileName(fileName);

      // Method A: Native Web Share API Level 2 (shares the actual PDF document file directly to WhatsApp on mobile or supported OS)
      const canShareFile = typeof navigator !== 'undefined' && 
        !!navigator.canShare && 
        navigator.canShare({ files: [file] });

      if (canShareFile) {
        try {
          await navigator.share({
            files: [file],
            title: fileName
          });
          setPhonePromptOpen(false);
          showToast("Receipt PDF shared directly to WhatsApp!");
          setIsSharingWhatsApp(false);
          return;
        } catch (shareErr: any) {
          if (shareErr.name === 'AbortError') {
            setIsSharingWhatsApp(false);
            return;
          }
          console.warn("navigator.share failed, using web WhatsApp fallback:", shareErr);
        }
      }

      // Method B: Desktop / Web WhatsApp (Direct PDF Download + Cloud Direct PDF URL)
      // 1. Immediately save the physical PDF to Downloads
      pdf.save(fileName);

      // 2. Copy the receipt image to clipboard for instant Ctrl+V into WhatsApp Web
      try {
        canvas.toBlob(async (pngBlob) => {
          if (pngBlob && navigator.clipboard && (window as any).ClipboardItem) {
            try {
              await navigator.clipboard.write([
                new (window as any).ClipboardItem({ 'image/png': pngBlob })
              ]);
            } catch (e) { }
          }
        });
      } catch (e) { }

      // 3. Upload PDF to Firebase Storage for direct access link
      let pdfDownloadUrl = '';
      try {
        const storageRef = ref(storage, `receipt_pdfs/${Date.now()}_${fileName}`);
        const uploadPromise = uploadBytes(storageRef, blob, { contentType: 'application/pdf' })
          .then(snap => getDownloadURL(snap.ref));
        const timeoutPromise = new Promise<string>((_, reject) => 
          setTimeout(() => reject(new Error('timeout')), 5000)
        );
        pdfDownloadUrl = await Promise.race([uploadPromise, timeoutPromise]);
      } catch (sErr) {
        console.warn("Storage upload skipped or timed out:", sErr);
      }

      // 4. Open WhatsApp directly with direct PDF link (no formatted message table)
      let msg = '';
      if (pdfDownloadUrl) {
        msg = `📄 *Official Fee Receipt (PDF)* - ${studentName}\nReceipt No: *${receiptNumber}*\nAmount Paid: *₹${amountPaid}*\n\n📥 *Download Official PDF Receipt:*\n${pdfDownloadUrl}`;
      } else {
        msg = `📄 *Official Fee Receipt (PDF)* - ${studentName}\nReceipt No: *${receiptNumber}*\nAmount Paid: *₹${amountPaid}*`;
      }

      const whatsappUrl = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(msg)}`;
      window.open(whatsappUrl, '_blank');

      setPhonePromptOpen(false);
      setDesktopShareModalOpen(true);
      showToast("PDF downloaded & WhatsApp opened!");
    } catch (err: any) {
      console.error("Error sharing PDF to WhatsApp:", err);
      alert("Failed to share PDF: " + (err.message || 'Unknown error'));
    } finally {
      setIsSharingWhatsApp(false);
    }
  };

  // 2. Native Print Handler
  const handlePrint = () => {
    window.print();
  };

  // 3. Download high-resolution PNG using html2canvas
  const handleDownloadImage = async () => {
    const el = document.getElementById('speak-hub-fee-receipt-box');
    if (!el) {
      alert("Receipt element not found for rendering.");
      return null;
    }

    setIsExportingImage(true);
    try {
      const canvas = await html2canvas(el, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      const imgUrl = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.download = `SpeakHub_Receipt_${receiptNumber.replace(/[/\\?%*:|"<>]/g, '_')}.png`;
      link.href = imgUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast("Receipt Image (PNG) downloaded successfully!");
    } catch (err) {
      console.error("Image generation error:", err);
      alert("Could not generate image. Please try Print -> Save as PDF.");
    } finally {
      setIsExportingImage(false);
    }
  };

  // 4. Download True A4 PDF using jsPDF + html2canvas
  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
      const res = await buildReceiptPdf();
      if (!res) return;
      res.pdf.save(res.fileName);
      showToast("PDF downloaded successfully!");
    } catch (err) {
      console.error("PDF generation error:", err);
      alert("Could not generate PDF. Please try Print -> Save as PDF.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="receipt-modal-overlay">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="receipt-modal-toast animate-fade-in">
          <Check size={16} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="receipt-modal-window">
        {/* Modal Top Header */}
        <div className="receipt-modal-header no-print">
          <div className="flex items-center gap-3">
            <div className="receipt-header-icon-badge">
              <FileText size={18} className="text-indigo-600" />
            </div>
            <div>
              <div className="receipt-header-title">Official Fee Receipt</div>
              <div className="receipt-header-sub">
                <span className="font-mono font-bold text-indigo-700">{receiptNumber}</span>
                <span className="mx-2">•</span>
                <span>{studentName}</span>
              </div>
            </div>
          </div>

          <button 
            type="button" 
            className="receipt-modal-close-btn" 
            onClick={onClose}
            title="Close Receipt (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="receipt-action-toolbar no-print">
          <div className="receipt-action-buttons-group">
            {/* Share to WhatsApp Button */}
            <button
              type="button"
              className="receipt-btn receipt-btn-whatsapp"
              onClick={() => handleShareToWhatsApp()}
              disabled={isSharingWhatsApp}
              title="Share Receipt PDF directly to WhatsApp"
            >
              {isSharingWhatsApp ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Preparing PDF...</span>
                </>
              ) : (
                <>
                  <MessageCircle size={16} />
                  <span>Share PDF to WhatsApp</span>
                </>
              )}
            </button>

            {/* Print Receipt / Save as PDF */}
            <button
              type="button"
              className="receipt-btn receipt-btn-print"
              onClick={handlePrint}
              title="Print Receipt or Save as PDF"
            >
              <Printer size={16} />
              <span>Print Receipt</span>
            </button>

            {/* Download Image (PNG) */}
            <button
              type="button"
              className="receipt-btn receipt-btn-download-img"
              onClick={handleDownloadImage}
              disabled={isExportingImage}
              title="Download high-resolution receipt image (PNG)"
            >
              <Download size={16} />
              <span>{isExportingImage ? 'Generating PNG...' : 'Download Image'}</span>
            </button>

            {/* Download PDF */}
            <button
              type="button"
              className="receipt-btn receipt-btn-download-pdf"
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              title="Download A4 PDF document"
            >
              <FileText size={16} />
              <span>{isExportingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="receipt-zoom-group">
            <button 
              type="button" 
              className="receipt-zoom-btn" 
              onClick={() => setZoomLevel(prev => Math.max(0.65, prev - 0.1))}
              title="Zoom Out"
            >
              <ZoomOut size={15} />
            </button>
            <span className="receipt-zoom-level">{Math.round(zoomLevel * 100)}%</span>
            <button 
              type="button" 
              className="receipt-zoom-btn" 
              onClick={() => setZoomLevel(prev => Math.min(1.4, prev + 0.1))}
              title="Zoom In"
            >
              <ZoomIn size={15} />
            </button>
            <button 
              type="button" 
              className="receipt-zoom-btn" 
              onClick={() => setZoomLevel(1)}
              title="Reset Zoom"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

        {/* WhatsApp Mobile Number Prompt Modal (if phone is missing or edit desired) */}
        {phonePromptOpen && (
          <div className="receipt-phone-prompt-backdrop no-print">
            <div className="receipt-phone-prompt-box">
              <div className="flex items-center gap-2 mb-3">
                <Phone size={18} className="text-emerald-600" />
                <h4 className="font-bold text-slate-800 text-sm">Enter WhatsApp Number</h4>
              </div>
              <p className="text-xs text-slate-600 mb-3">
                Please enter the 10-digit mobile number for <strong>{studentName}</strong> to send the PDF receipt:
              </p>
              <input
                type="tel"
                className="receipt-phone-input"
                placeholder="e.g. 9970964742"
                value={customPhone}
                onChange={(e) => setCustomPhone(e.target.value)}
                autoFocus
                maxLength={13}
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md"
                  onClick={() => setPhonePromptOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-md flex items-center gap-1.5"
                  onClick={() => handleShareToWhatsApp(customPhone)}
                  disabled={isSharingWhatsApp}
                >
                  {isSharingWhatsApp ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Preparing PDF...</span>
                    </>
                  ) : (
                    <>
                      <MessageCircle size={14} />
                      <span>Send PDF on WhatsApp</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Desktop WhatsApp PDF Share Helper Modal */}
        {desktopShareModalOpen && (
          <div className="receipt-desktop-share-backdrop no-print" onClick={() => setDesktopShareModalOpen(false)}>
            <div className="receipt-desktop-share-box" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-2">
                <div className="receipt-desktop-share-icon">
                  <FileText size={24} />
                </div>
                <button 
                  type="button" 
                  className="text-slate-400 hover:text-slate-600"
                  onClick={() => setDesktopShareModalOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <h3 className="font-bold text-slate-900 text-base mb-1">
                Receipt PDF Ready for WhatsApp
              </h3>
              <p className="text-xs text-slate-600 mb-3">
                WhatsApp chat has opened for <strong>+91 {targetSharedPhone}</strong>.
              </p>

              <div className="receipt-desktop-share-steps">
                <div className="step-item">
                  <span className="step-num">1</span>
                  <div>
                    <strong>PDF Document Downloaded:</strong> <code>{sharedFileName}</code> is saved to your computer downloads.
                  </div>
                </div>
                <div className="step-item">
                  <span className="step-num">2</span>
                  <div>
                    <strong>Direct PDF Link in Chat:</strong> A direct download link for the student to view the PDF has been placed in WhatsApp.
                  </div>
                </div>
                <div className="step-item">
                  <span className="step-num">3</span>
                  <div>
                    <strong>Attach or Paste:</strong> You can drag the downloaded PDF into WhatsApp chat, or press <kbd>Ctrl</kbd>+<kbd>V</kbd> to paste the receipt!
                  </div>
                </div>
              </div>

              <button 
                type="button" 
                className="receipt-btn-done" 
                onClick={() => setDesktopShareModalOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Receipt Preview Canvas Area */}
        <div className="receipt-modal-scroll-area">
          <div 
            className="receipt-scale-wrapper"
            ref={receiptContainerRef}
            style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}
          >
            <ReceiptTemplate
              transaction={transaction}
              student={student || undefined}
              course={course || undefined}
              plan={plan || undefined}
              isScreenPreview={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceiptModal;
