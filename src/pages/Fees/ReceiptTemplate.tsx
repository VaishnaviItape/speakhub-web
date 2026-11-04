import React from 'react';
import type { FeeTransaction, User, Course } from '../../types/models';
import logoImg from '../../assets/logo.png';
import stampImg from '../../assets/stamp.jpeg';
import signImg from '../../assets/sign.jpeg';
import './ReceiptTemplate.css';

export interface ReceiptTemplateProps {
  transaction: FeeTransaction;
  student?: User | { name?: string; phone?: string; mobile?: string };
  course?: Course | { courseName?: string };
  plan?: { planName?: string };
  isScreenPreview?: boolean;
}

const ReceiptTemplate: React.FC<ReceiptTemplateProps> = ({ 
  transaction, 
  student, 
  course,
  isScreenPreview = false 
}) => {
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

  const formatLongDate = (dateVal?: any): string => {
    if (!dateVal) return '-';
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
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const isNoDues = Boolean(
    transaction.nextDueDate && (
      transaction.nextDueDate.toString().toUpperCase() === 'NO_DUES' || 
      transaction.nextDueDate.toString().toLowerCase() === 'no dues'
    )
  );

  const isOffline = Boolean(
    (transaction as any).isOffline ||
    (transaction as any).totalCourseFee ||
    (transaction as any).installmentNumber !== undefined ||
    (course as any)?.mode === 'offline' ||
    (course as any)?.modeBadge?.toLowerCase().includes('offline') ||
    (transaction.billingPeriod && (
      transaction.billingPeriod.toLowerCase().includes('offline') ||
      transaction.billingPeriod.toLowerCase().includes('installment')
    ))
  );

  const isOneTimeFee = Boolean(
    isOffline ||
    (transaction as any).monthsCount === 0 || 
    (transaction.billingPeriod && (
      transaction.billingPeriod.toLowerCase().includes('one-time') ||
      transaction.billingPeriod.toLowerCase().includes('course fee')
    ))
  );

  const amountPaid = transaction.amountPaid || 0;
  const discount = transaction.discount || 0;
  const totalCourseFee = (transaction as any).totalCourseFee || (course as any)?.offlineOneTimeFee || (isOffline ? 4000 : undefined);
  const perMonthFee = isOffline 
    ? (totalCourseFee || 4000) 
    : (isOneTimeFee ? ((transaction as any).perMonthFee || amountPaid) : ((transaction as any).perMonthFee || (amountPaid + discount)));
  const remaining = (transaction as any).remainingBalance !== undefined 
    ? (transaction as any).remainingBalance 
    : (isOffline && totalCourseFee ? Math.max(0, totalCourseFee - amountPaid) : 0);

  const paymentDateStr = formatDateDisplay(transaction.paymentDate);
  const nextDueDateStr = (isNoDues || (isOffline && remaining === 0)) ? 'No Dues' : (transaction.nextDueDate ? formatLongDate(transaction.nextDueDate) : '-');
  
  const paymentMode = (transaction.paymentMode || '').toUpperCase();
  const isCash = paymentMode.includes('CASH');
  const isETransfer = paymentMode.includes('E-TRANSFER') || paymentMode.includes('BANK') || paymentMode.includes('NET');
  const isUpi = paymentMode.includes('UPI') || paymentMode.includes('GPAY') || paymentMode.includes('PHONEPE') || paymentMode.includes('PAYTM') || (!isCash && !isETransfer);

  const studentName = student?.name || (transaction as any).studentName || 'Student';
  const studentPhone = (student as any)?.phone || (student as any)?.mobile || (transaction as any)?.phone || '';
  const courseName = course?.courseName || (transaction as any).courseName || 'Foundation-Spoken English';

  return (
    <div className={`receipt-container-root ${isScreenPreview ? 'receipt-screen-mode' : 'receipt-print-wrapper'}`}>
      <div className="receipt-box" id="speak-hub-fee-receipt-box">
        {/* Top Header Row with Logo & Academy Title */}
        <div className="receipt-top-header">
          <div className="receipt-logo-block">
            <img 
              src={logoImg} 
              alt="Speak Hub Academy" 
              className="receipt-logo-img"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (target.src !== '/logo.png') {
                  target.src = '/logo.png';
                }
              }} 
            />
          </div>
          <div className="receipt-brand-title-col">
            <h1 className="receipt-brand-name">SPEAK HUB ACADEMY</h1>
          </div>
        </div>

        {/* Brown/Gold Tagline Banner */}
        <div className="receipt-banner-gold">
          ONLINE &amp; OFFLINE SPOKEN ENGLISH CLASSES
        </div>

        {/* Dark Navy Address & Contact Banner */}
        <div className="receipt-banner-navy-address">
          <span>Address- Omkar Apartment, Shop No- 6 &amp; 7, Near Canara Bank, NDA Road, Warje-Malwadi, Pune -58.</span>
          <span className="address-contact-sep"> | </span>
          <span className="address-contact-highlight">Contact: 9970964742, 8999080975</span>
        </div>

        {/* Dark Navy Payment Receipt Bar */}
        <div className="receipt-banner-navy-title">
          PAYMENT RECEIPT
        </div>

        {/* Main Grid Table */}
        <table className="receipt-main-table">
          <tbody>
            {/* Row 1: Student Name & Payment Date */}
            <tr>
              <th className="cell-th" style={{ width: '18%' }}>STUDENT NAME</th>
              <td className="cell-td font-serif font-bold" style={{ width: '32%' }}>
                <span className="student-name-display">{studentName}</span>
                {studentPhone && (
                  <span className="student-phone-sub"> (Mob: {studentPhone})</span>
                )}
              </td>
              <th className="cell-th" style={{ width: '22%' }}>PAYMENT DATE</th>
              <td className="cell-td font-bold" style={{ width: '28%' }}>
                {paymentDateStr}
              </td>
            </tr>

            {/* Row 2: Course Name & Receipt No */}
            <tr>
              <th className="cell-th">COURSE NAME</th>
              <td className="cell-td font-serif font-bold">
                {courseName}
              </td>
              <th className="cell-th">RECEIPT NO</th>
              <td className="cell-td font-bold font-mono">
                {transaction.receiptNumber || '08/26-004'}
              </td>
            </tr>

            {/* Row 3: Payment Method & Remark */}
            <tr>
              <th className="cell-th">PAYMENT METHOD</th>
              <td className="cell-td">
                <div className="payment-method-row">
                  <span className="method-item">
                    CASH <span className={`check-box ${isCash ? 'checked' : ''}`}>{isCash ? '✓' : ''}</span>
                  </span>
                  <span className="method-item">
                    E-TRANSFER <span className={`check-box ${isETransfer ? 'checked' : ''}`}>{isETransfer ? '✓' : ''}</span>
                  </span>
                  <span className="method-item">
                    UPI TRANSFER <span className={`check-box ${isUpi ? 'checked' : ''}`}>{isUpi ? '✓' : ''}</span>
                  </span>
                </div>
              </td>
              <th className="cell-th">Remark</th>
              <td className="cell-td font-bold">
                {(transaction as any).remarks || '-'}
              </td>
            </tr>

            {/* Row 4: Account Info & Payment Period Section Headers */}
            <tr className="section-header-row">
              <th colSpan={3} className="cell-section-header">ACCOUNT INFO</th>
              <th colSpan={2} className="cell-section-header">PAYMENT PERIOD</th>
            </tr>

            {/* Row 5: Financial Header */}
            <tr className="fin-headers-row">
              <th style={{ width: '18%' }} className="cell-th">{isOneTimeFee ? 'COURSE FEE' : 'PER MONTH FEE'}</th>
              <th style={{ width: '14%' }} className="cell-th">DISCOUNT</th>
              <th style={{ width: '18%' }} className="cell-th">AMOUNT PAID</th>
              <th style={{ width: '18%' }} className="cell-th">REMANING</th>
              <th style={{ width: '32%' }} className="cell-th">NEXT DUE DATE</th>
            </tr>

            {/* Row 6: Financial Values */}
            <tr className="fin-data-row">
              <td className="cell-td font-bold">
                <span className="currency-symbol">₹</span> {perMonthFee || amountPaid}
              </td>
              <td className="cell-td font-bold">
                <span className="currency-symbol">₹</span> {discount > 0 ? discount : '-'}
              </td>
              <td className="cell-td font-bold">
                <span className="currency-symbol">₹</span> {amountPaid}
              </td>
              <td className="cell-td font-bold">
                <span className="currency-symbol">₹</span> {remaining}
              </td>
              <td className={`cell-td font-bold ${(isNoDues || (isOffline && remaining === 0)) ? 'text-due-green' : 'text-due-red'}`}>
                {nextDueDateStr}
              </td>
            </tr>

            {/* Row 7: Signatures Section Header */}
            <tr className="section-header-row">
              <th colSpan={3} className="cell-section-header">AUTHORISED SIGNATURE</th>
              <th colSpan={2} className="cell-section-header">PARENT/STUDENT'S SIGNATURE</th>
            </tr>

            {/* Row 8: Signatures Content */}
            <tr className="sign-content-row">
              <td colSpan={3} className="cell-sign-authorised">
                <div className="authorised-sign-wrap">
                  <img 
                    src={stampImg} 
                    alt="Official Stamp" 
                    className="stamp-seal-img" 
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (target.src !== '/stamp.jpeg') target.src = '/stamp.jpeg';
                    }}
                  />
                  <img 
                    src={signImg} 
                    alt="Authorized Signatory" 
                    className="signature-pen-img" 
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (target.src !== '/sign.jpeg') target.src = '/sign.jpeg';
                    }}
                  />
                </div>
              </td>
              <td colSpan={2} className="cell-sign-parent">
                <div className="parent-sign-placeholder">
                  <span className="sign-dots">...................................................</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Bottom Note */}
        <div className="receipt-bottom-disclaimer">
          Note- Fees Once Paid Are Not Returnable / Refundable Or Transferrable.
        </div>
      </div>
    </div>
  );
};

export default ReceiptTemplate;
