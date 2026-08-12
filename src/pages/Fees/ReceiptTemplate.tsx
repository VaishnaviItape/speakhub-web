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
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const paymentDateStr = formatDateDisplay(transaction.paymentDate);
  const nextDueDateStr = transaction.nextDueDate ? formatDateDisplay(transaction.nextDueDate) : 'N/A';
  const joiningDateStr = (student as any).joiningDate ? formatDateDisplay((student as any).joiningDate) : '01 Jan 2026';

  const baseFee = (transaction.amountPaid || 0) + (transaction.discount || 0) - (transaction.lateFee || 0);

  return (
    <div className="receipt-container">
      {/* Background Speak Hub Logo Watermark */}
      <img 
        src="/logo.png" 
        alt="" 
        className="receipt-watermark-logo" 
        onError={(e) => {
          (e.target as HTMLElement).style.display = 'none';
        }}
      />

      {/* Brand Header */}
      <div className="receipt-header-wrapper">
        <div className="brand-logo-section">
          <img 
            src="/logo.png" 
            alt="Speak Hub Academy" 
            className="receipt-brand-logo"
            onError={(e) => {
              // Hide image if missing and fallback to text logo
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div className="brand-text-block">
            <h1 className="brand-title">SPEAK HUB ACADEMY</h1>
            <p className="brand-tagline">Excellence in Communication & Learning</p>
          </div>
        </div>

        <div className="academy-address-block">
          <p className="address-line font-bold">Speak Hub Academy</p>
          <p className="address-line">Shop No. 6 & 7, Omkar Apartment, Swami Samarth Mandir Chowk,</p>
          <p className="address-line">NDA Road, near Canara Bank, Giridhar Nagar, Warje, Pune, Maharashtra</p>
          <p className="address-line"><strong>Contact:</strong> +91-99709-64742</p>
          <p className="address-line"><strong>E-Mail:</strong> speakhubgallery@gmail.com</p>
          <p className="address-line"><strong>Follow on:</strong> youtube.com/speakhubacademy</p>
        </div>
      </div>

      <div className="receipt-title-bar">
        <h2 className="receipt-main-title">FEE PAYMENT RECEIPT</h2>
        <span className="receipt-status-badge">PAID ✓</span>
      </div>

      {/* Meta Information Bar */}
      <div className="receipt-meta-grid">
        <div className="meta-item">
          <span className="meta-label">Receipt Number:</span>
          <span className="meta-value font-mono">{transaction.receiptNumber}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Payment Date:</span>
          <span className="meta-value">{paymentDateStr}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Academic Year:</span>
          <span className="meta-value">{transaction.academicYear || '2026-27'}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Payment Mode:</span>
          <span className="meta-value">{transaction.paymentMode}</span>
        </div>
      </div>

      {/* Student & Course Details */}
      <div className="receipt-details-box">
        <h3 className="section-subtitle">STUDENT & COURSE INFORMATION</h3>
        <div className="details-grid">
          <div className="detail-cell">
            <span className="cell-label">Student Name:</span>
            <span className="cell-value bold">{student.name || 'Student'}</span>
          </div>
          <div className="detail-cell">
            <span className="cell-label">Student ID:</span>
            <span className="cell-value font-mono">{student.documentId || 'N/A'}</span>
          </div>
          <div className="detail-cell">
            <span className="cell-label">Assigned Course:</span>
            <span className="cell-value">{course.courseName || 'Unassigned'}</span>
          </div>
          <div className="detail-cell">
            <span className="cell-label">Mobile Number:</span>
            <span className="cell-value">{student.mobile || student.phone || 'N/A'}</span>
          </div>
          <div className="detail-cell">
            <span className="cell-label">Student Joining Date:</span>
            <span className="cell-value">{joiningDateStr}</span>
          </div>
          <div className="detail-cell">
            <span className="cell-label">Billing Period / Duration:</span>
            <span className="cell-value">{transaction.billingPeriod || 'Monthly Fee'}</span>
          </div>
        </div>
      </div>

      {/* Fee Breakdown Table */}
      <div className="receipt-table-wrapper">
        <h3 className="section-subtitle">PAYMENT BREAKDOWN</h3>
        <table className="receipt-table">
          <thead>
            <tr>
              <th style={{ width: '60%' }}>Description</th>
              <th style={{ width: '20%' }}>Period / Months</th>
              <th style={{ width: '20%', textAlign: 'right' }}>Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Course Fee Payment</strong>
                <span className="table-subtext block">{course.courseName}</span>
              </td>
              <td>{transaction.monthsCount ? `${transaction.monthsCount} ${transaction.monthsCount === 1 ? 'Month' : 'Months'}` : '1 Month'}</td>
              <td style={{ textAlign: 'right' }}>₹{baseFee.toLocaleString()}</td>
            </tr>
            {transaction.lateFee ? (
              <tr>
                <td>Late Payment Penalty</td>
                <td>-</td>
                <td style={{ textAlign: 'right', color: '#b91c1c' }}>+₹{transaction.lateFee.toLocaleString()}</td>
              </tr>
            ) : null}
            {transaction.discount ? (
              <tr>
                <td>Discount Special Concession</td>
                <td>-</td>
                <td style={{ textAlign: 'right', color: '#15803d' }}>-₹{transaction.discount.toLocaleString()}</td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} style={{ textAlign: 'right' }}><strong>TOTAL AMOUNT PAID:</strong></td>
              <td style={{ textAlign: 'right' }} className="total-cell">
                <strong>₹{transaction.amountPaid.toLocaleString()}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Prominent Next Due Date Banner */}
      <div className="receipt-due-banner">
        <div className="due-banner-left">
          <span className="due-banner-icon">📅</span>
          <div>
            <span className="due-banner-title">NEXT PAYMENT DUE DATE</span>
            <span className="due-banner-sub">Please make sure to complete your next fee installment before this date.</span>
          </div>
        </div>
        <div className="due-banner-date font-bold">
          {nextDueDateStr}
        </div>
      </div>

      {/* Signatures & Footer */}
      <div className="receipt-footer-grid">
        <div className="footer-left-block">
          <p><strong>Payment Status:</strong> PAID IN FULL</p>
          <p><strong>Collected By:</strong> {transaction.receivedBy || 'Admin'}</p>
          <p className="printed-time">Printed on: {new Date().toLocaleString()}</p>
        </div>

        <div className="footer-right-block">
          <div className="signature-line-box">
            <p className="signature-title">Authorized Signatory</p>
            <p className="signature-sub">Speak Hub Academy</p>
          </div>
        </div>
      </div>

      <div className="receipt-bottom-note">
        Thank you for your payment! Please retain this official receipt for your records.
      </div>
    </div>
  );
};

export default ReceiptTemplate;
