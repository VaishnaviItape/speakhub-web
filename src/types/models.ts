export interface Timestamp {
  seconds: number;
  nanoseconds: number;
}

export interface User {
  documentId?: string;
  uid: string;
  role: 'admin' | 'teacher' | 'student';
  email: string;
  mobile?: string;
  status: 'active' | 'inactive';
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface Student {
  documentId?: string;
  studentCode: string;
  userId: string;
  firstName: string;
  lastName: string;
  parentName?: string;
  parentMobile?: string;
  courseIds: string[];
  batchIds: string[];
  joiningDate: Timestamp | Date;
  photo?: string;
  status: 'active' | 'inactive';
}

export interface Course {
  documentId?: string;
  courseName: string;
  description: string;
  duration: string;
  image?: string;
  status: 'active' | 'inactive';
}

export interface Subject {
  documentId?: string;
  courseId: string;
  subjectName: string;
  status: 'active' | 'inactive';
}

export interface Batch {
  documentId?: string;
  courseId: string;
  teacherId: string;
  batchName: string;
  meetingLink?: string;
  startDate: Timestamp | Date;
  endDate: Timestamp | Date;
  status: 'active' | 'completed' | 'inactive';
}

export interface Note {
  documentId?: string;
  courseId: string;
  batchId: string;
  subjectId: string;
  teacherId: string;
  title: string;
  description: string;
  fileUrl: string;
  fileType: string;
  status: 'active' | 'inactive';
  createdAt: Timestamp | Date;
}

export interface Homework {
  documentId?: string;
  courseId: string;
  batchId: string;
  subjectId: string;
  teacherId: string;
  title: string;
  description: string;
  attachmentUrl?: string;
  dueDate: Timestamp | Date;
  status: 'active' | 'inactive';
}

export interface HomeworkSubmission {
  documentId?: string;
  homeworkId: string;
  studentId: string;
  submissionUrl: string;
  remarks?: string;
  marks?: number;
  submittedAt: Timestamp | Date;
}

export interface Exam {
  documentId?: string;
  courseId: string;
  batchId: string;
  subjectId: string;
  title: string;
  examType: 'MCQ' | 'Reading' | 'Speaking' | 'Abacus';
  duration: number; // in minutes
  passingMarks: number;
  totalMarks: number;
  status: 'active' | 'inactive';
}

export interface ExamQuestion {
  documentId?: string;
  examId: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  marks: number;
}

export interface ExamAttempt {
  documentId?: string;
  examId: string;
  studentId: string;
  score: number;
  percentage: number;
  startedAt: Timestamp | Date;
  submittedAt: Timestamp | Date;
}

export interface Fee {
  documentId?: string;
  studentId: string;
  courseId: string;
  amount: number;
  paidAmount: number;
  dueDate: Timestamp | Date;
  status: 'paid' | 'pending' | 'overdue';
  paymentMethod?: 'UPI' | 'Razorpay' | 'Cash';
  receiptUrl?: string;
  createdAt: Timestamp | Date;
}
