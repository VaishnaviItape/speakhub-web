import React from 'react';
import type { FeeTransaction, User, Course } from '../../types/models';
import './ReceiptTemplate.css';

interface ReceiptTemplateProps {
  transaction: FeeTransaction;
  student: User;
  course: Course;
  plan?: { planName?: string };
}

const ReceiptTemplate: React.FC<ReceiptTemplateProps> = ({ transaction, student, course }) => {
  const formatDateDisplay = (dateVal?: any): string => {
    if (!dateVal) return 'N/A';
    let d: Date;
    if (dateVal instanceof Date) {
      d = dateVal;
    } else if (dateVal.seconds) {
      d = new Date(dateVal.seconds * 1000);
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
    } else if (typeof dateVal === 'string') {
      d = new Date(dateVal);
    } else {
      d = new Date();
    }
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const paymentDateStr = formatDateDisplay(transaction.paymentDate);
  const nextDueDateStr = transaction.nextDueDate ? formatLongDate(transaction.nextDueDate) : '-';
  
  const paymentMode = (transaction.paymentMode || '').toUpperCase();
  const isCash = paymentMode.includes('CASH');
  const isETransfer = paymentMode.includes('E-TRANSFER') || paymentMode.includes('BANK') || paymentMode.includes('NET');
  const isUpi = paymentMode.includes('UPI') || paymentMode.includes('GPAY') || paymentMode.includes('PHONEPE') || paymentMode.includes('PAYTM') || (!isCash && !isETransfer);

  const amountPaid = transaction.amountPaid || 0;
  const discount = transaction.discount || 0;
  const perMonthFee = (transaction as any).perMonthFee || (amountPaid + discount);
  const remaining = (transaction as any).remainingBalance || 0;

  return (
    <div className="receipt-print-wrapper">
      <div className="receipt-box">
        {/* Top Header Row with Logo & Academy Title */}
        <div className="receipt-top-header">
          <div className="receipt-logo-block">
            <img src="/logo.png" alt="Speak Hub" className="receipt-logo-img" />
            <span className="receipt-logo-label">Speak Hub</span>
          </div>
          <div className="receipt-brand-title-col">
            <h1 className="receipt-brand-name">SPEAK HUB ACADEMY</h1>
          </div>
        </div>

        {/* Brown/Gold Banner */}
        <div className="receipt-banner-gold">
          ONLINE &amp; OFFLINE SPOKEN ENGLISH CLASSES
        </div>

        {/* Dark Navy Address Banner */}
        <div className="receipt-banner-navy-address">
          Address- Omkar Apartment, Shop No- 6 &amp; 7, Near Canara Bank, NDA Road, Warje-Malwadi, Pune -58.
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
                {student?.name || (transaction as any).studentName || 'Student'}
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
                {course?.courseName || (transaction as any).courseName || 'Foundation-Spoken English'}
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
              <th style={{ width: '18%' }} className="cell-th">PER MONTH FEE</th>
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
              <td className="cell-td font-bold text-due-red">
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
                  <img src="/stamp.jpeg" alt="Stamp" className="stamp-seal-img" />
                  <img src="/sign.jpeg" alt="ShwetaSN" className="signature-pen-img" />
                </div>
              </td>
              <td colSpan={2} className="cell-sign-parent">
                {/* Empty space for Student/Parent signature */}
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
