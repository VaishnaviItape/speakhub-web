import React from 'react';
import type { FeeTransaction, User, Course, FeePlan } from '../../types/models';
import './ReceiptTemplate.css';

interface ReceiptTemplateProps {
  transaction: FeeTransaction;
  student: User;
  course: Course;
  plan: FeePlan;
}

const ReceiptTemplate: React.FC<ReceiptTemplateProps> = ({ transaction, student, course, plan }) => {
  return (
    <div className="receipt-container">
      {/* Header */}
      <div className="receipt-header">
        <h1 className="receipt-title">Speak Hub Academy</h1>
        <p className="receipt-subtitle">123 Education Lane, Learning City</p>
        <p className="receipt-subtitle">+91-9876543210 | support@speakhub.com</p>
        <h2 className="receipt-heading">FEE PAYMENT RECEIPT</h2>
      </div>

      <div className="receipt-meta-grid">
        <div className="meta-left">
          <p><strong>Receipt No:</strong> {transaction.receiptNumber}</p>
          <p><strong>Date:</strong> {transaction.paymentDate instanceof Date ? transaction.paymentDate.toLocaleDateString() : new Date((transaction.paymentDate as any).seconds * 1000).toLocaleDateString()}</p>
        </div>
        <div className="meta-right">
          <p><strong>Academic Year:</strong> {transaction.academicYear || '2026-27'}</p>
          <p><strong>Ref No:</strong> {transaction.transactionNumber || 'N/A'}</p>
        </div>
      </div>

      <hr className="receipt-divider" />

      {/* Student Info */}
      <div className="receipt-section">
        <div className="info-row"><span className="info-label">Student Name:</span> <span className="info-val">{student.name}</span></div>
        <div className="info-row"><span className="info-label">Student ID:</span> <span className="info-val">{student.documentId}</span></div>
        <div className="info-row"><span className="info-label">Course:</span> <span className="info-val">{course.courseName}</span></div>
        <div className="info-row"><span className="info-label">Mobile:</span> <span className="info-val">{student.mobile || student.phone || 'N/A'}</span></div>
      </div>

      <hr className="receipt-divider" />

      {/* Payment Details */}
      <div className="receipt-section">
        <div className="info-row"><span className="info-label">Fee Plan:</span> <span className="info-val">{plan.planName}</span></div>
        <div className="info-row"><span className="info-label">Billing Period:</span> <span className="info-val">{transaction.billingPeriod || 'N/A'}</span></div>
        <div className="info-row"><span className="info-label">Payment Mode:</span> <span className="info-val">{transaction.paymentMode}</span></div>
        
        <table className="receipt-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Course Fee Payment</td>
              <td>{transaction.amountPaid + (transaction.discount || 0) - (transaction.lateFee || 0)}</td>
            </tr>
            {transaction.lateFee ? (
              <tr>
                <td>Late Fee Penalty</td>
                <td>{transaction.lateFee}</td>
              </tr>
            ) : null}
            {transaction.discount ? (
              <tr>
                <td>Discount Applied</td>
                <td>-{transaction.discount}</td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr>
              <td><strong>Total Amount Paid</strong></td>
              <td><strong>₹{transaction.amountPaid}</strong></td>
            </tr>
          </tfoot>
        </table>
        
        <div className="mt-4 flex justify-between text-sm">
           <p><strong>Next Due Date:</strong> {transaction.nextDueDate instanceof Date ? transaction.nextDueDate.toLocaleDateString() : new Date((transaction.nextDueDate as any)?.seconds * 1000).toLocaleDateString()}</p>
           <p><strong>Remaining Balance:</strong> ₹{transaction.remainingBalance || 0}</p>
        </div>
      </div>

      <hr className="receipt-divider" />

      {/* Footer */}
      <div className="receipt-footer">
        <div className="footer-left">
           <p><strong>Status:</strong> {transaction.status || 'PAID'}</p>
           <p><strong>Collected By:</strong> {transaction.receivedBy}</p>
        </div>
        <div className="footer-right">
           <div className="signature-box">
              <p>Authorized Signature</p>
           </div>
        </div>
      </div>

      <p className="receipt-thankyou">Thank You!</p>
    </div>
  );
};

export default ReceiptTemplate;
