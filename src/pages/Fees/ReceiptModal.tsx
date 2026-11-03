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
  RotateCcw
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
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
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [phonePromptOpen, setPhonePromptOpen] = useState<boolean>(false);
  const [customPhone, setCustomPhone] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const receiptContainerRef = useRef<HTMLDivElement | null>(null);

  if (!isOpen || !transaction) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const studentName = student?.name || (transaction as any).studentName || 'Student';
  const registeredPhone = (student as any)?.phone || (student as any)?.mobile || (transaction as any)?.phone || '';
  const receiptNumber = transaction.receiptNumber || '08/26-004';
  const courseName = course?.courseName || (transaction as any).courseName || 'Foundation-Spoken English';

  const formatDateDisplay = (dateVal?: any): string => {
    if (!dateVal) return 'N/A';
    let d: Date;
    if (dateVal instanceof Date) {
      d = dateVal;
    } else if (dateVal.seconds) {
      d = new Date(dateVal.seconds * 1000);
    } else if (typeof dateVal?.toDate === 'function') {
      d = dateVal.toDate();
    } else if (typeof dateVal === 'string') {
      d = new Date(dateVal);
    } else {
      d = new Date();
    }
    if (isNaN(d.getTime())) return 'N/A';
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  };

  const isNoDues = Boolean(
    transaction.nextDueDate && (
      transaction.nextDueDate.toString().toUpperCase() === 'NO_DUES' || 
      transaction.nextDueDate.toString().toLowerCase() === 'no dues'
    )
  );

  const amountPaid = transaction.amountPaid || 0;
  const discount = transaction.discount || 0;
  const perMonthFee = (transaction as any).perMonthFee || (amountPaid + discount);
  const remaining = (transaction as any).remainingBalance || 0;
  const paymentDateStr = formatDateDisplay(transaction.paymentDate);
  const nextDueDateStr = isNoDues ? 'No Dues (Full Paid)' : (transaction.nextDueDate ? formatDateDisplay(transaction.nextDueDate) : '-');

  // Build the complete WhatsApp Receipt message text
  const generateWhatsAppMessage = () => {
    return (
`🎓 *SPEAK HUB ACADEMY*
━━━━━━━━━━━━━━━━━━━━━━━━━━
        🧾 *OFFICIAL FEE PAYMENT RECEIPT*
━━━━━━━━━━━━━━━━━━━━━━━━━━

Dear *${studentName}*,
We have successfully received your fee payment. Thank you!

📋 *RECEIPT SUMMARY:*
──────────────────────────
• *Receipt No:* ${receiptNumber}
• *Payment Date:* ${paymentDateStr}
• *Student Name:* ${studentName}
• *Course:* ${courseName}
• *Payment Method:* ${transaction.paymentMode || 'UPI Transfer'}
${transaction.billingPeriod ? `• *Period:* ${transaction.billingPeriod}\n` : ''}
💵 *FINANCIAL DETAILS:*
──────────────────────────
• *Course / Monthly Fee:* ₹${perMonthFee || amountPaid}
• *Discount:* ₹${discount}
• *Amount Paid:* ₹${amountPaid}
• *Remaining Balance:* ₹${remaining}
• *Next Due Date:* ${nextDueDateStr}
${(transaction as any).remarks ? `• *Remarks:* ${(transaction as any).remarks}\n` : ''}
📍 *ACADEMY ADDRESS:*
Omkar Apartment, Shop No. 6 & 7,
Near Canara Bank, NDA Road,
Warje-Malwadi, Pune - 411058.

📞 *CONTACT US:*
Phone: 9970964742 / 8999080975

━━━━━━━━━━━━━━━━━━━━━━━━━━
_Note: Fees once paid are not returnable / refundable or transferable._
_Thank you for choosing Speak Hub Academy!_`
    );
  };

  const handleShareToWhatsApp = (targetPhone?: string) => {
    const rawPhone = targetPhone || customPhone || registeredPhone;
    const cleanPhone = (rawPhone || '').replace(/[^0-9]/g, '');

    if (!cleanPhone || cleanPhone.length < 10) {
      setCustomPhone(cleanPhone);
      setPhonePromptOpen(true);
      return;
    }

    const phoneWithCountry = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const msg = generateWhatsAppMessage();
    const url = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(msg)}`;

    window.open(url, '_blank');
    setPhonePromptOpen(false);
    showToast("WhatsApp opened! You can also download the receipt image to attach in chat.");
  };

  // 1. Native Print Handler
  const handlePrint = () => {
    window.print();
  };

  // 2. Download high-resolution PNG using html2canvas
  const handleDownloadImage = async () => {
    const el = document.getElementById('speak-hub-fee-receipt-box');
    if (!el) {
      alert("Receipt element not found for rendering.");
      return;
    }

    setIsExportingImage(true);
    try {
      const canvas = await html2canvas(el, {
        scale: 2.5, // 2.5x sharp retina resolution
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

  // 3. Download True A4 PDF using jsPDF + html2canvas
  const handleDownloadPdf = async () => {
    const el = document.getElementById('speak-hub-fee-receipt-box');
    if (!el) {
      alert("Receipt element not found for rendering.");
      return;
    }

    setIsExportingPdf(true);
    try {
      const canvas = await html2canvas(el, {
        scale: 2.5,
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
      pdf.save(`SpeakHub_Receipt_${receiptNumber.replace(/[/\\?%*:|"<>]/g, '_')}.pdf`);

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
              title="Share Receipt directly to Student's WhatsApp"
            >
              <MessageCircle size={16} />
              <span>Share to WhatsApp</span>
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
                Please enter the 10-digit mobile number for <strong>{studentName}</strong> to send the receipt:
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
                >
                  <MessageCircle size={14} />
                  <span>Send on WhatsApp</span>
                </button>
              </div>
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
