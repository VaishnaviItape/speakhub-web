export interface Timestamp {
  seconds: number;
  nanoseconds: number;
}

export interface User {
  documentId?: string;
  uid?: string;
  name?: string;
  role: 'admin' | 'teacher' | 'student' | 'parent';
  email: string;
  mobile?: string;
  phone?: string;
  status: 'active' | 'inactive' | 'pending';
  isDemoMode?: boolean;
  demoStartDate?: Timestamp | Date;
  demoEndDate?: Timestamp | Date;
  demoDays?: number;
  demoTiming?: string;
  forcePasswordChange?: boolean;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
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
  status: 'active' | 'inactive' | 'pending';
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
  topic?: string;
  partChapter?: string;
  teacherId: string;
  title: string;
  description: string;
  fileUrl?: string; // Optional if using external links
  fileType?: string;
  externalVideoLink?: string;
  youtubeLink?: string;
  referenceLink?: string;
  publishDate?: Timestamp | Date;
  publishTime?: string;
  status: 'draft' | 'scheduled' | 'published' | 'inactive';
  createdAt: Timestamp | Date;
}

export interface Homework {
  documentId?: string;
  courseId: string;
  batchId: string;
  subjectId: string;
  topic?: string;
  partChapter?: string;
  teacherId: string;
  title: string;
  description: string;
  instructions?: string;
  attachmentUrl?: string;
  maximumMarks?: number;
  submissionType?: string[]; // 'Image', 'PDF', 'Document', 'Text', 'Multiple', 'Audio Recording', 'Audio File Upload', 'Video Recording', 'Video Upload'
  allowLateSubmission?: boolean;
  maxFileSize?: number; // in MB
  maxAudioDuration?: number; // in minutes
  maxVideoDuration?: number; // in minutes
  videoQuality?: 'Low' | 'Medium' | 'High';
  dueDate: Timestamp | Date;
  dueTime?: string;
  publishDate?: Timestamp | Date;
  publishTime?: string;
  status: 'draft' | 'scheduled' | 'published' | 'closed';
}

export interface HomeworkSubmission {
  documentId?: string;
  homeworkId: string;
  studentId: string;
  submissionUrl?: string;
  multipleAttachments?: string[];
  textAnswer?: string;
  remarks?: string; // Student remarks
  teacherComments?: string;
  correctionNotes?: string;
  marks?: number;
  submissionStatus: 'pending' | 'submitted' | 'reviewed' | 'late' | 'overdue';
  submittedAt: Timestamp | Date;
}

export interface Exam {
  documentId?: string;
  courseId: string;
  batchId: string;
  subjectId: string;
  title: string;
  chapter?: string;
  description?: string;
  instructions?: string;
  examType: 'MCQ' | 'Reading' | 'Speaking' | 'Abacus';
  duration: number; // in minutes
  passingMarks: number;
  totalMarks: number;
  numberOfQuestions: number;
  marksPerQuestion: number;
  negativeMarking: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  allowReview: boolean;
  showResultImmediately: boolean;
  maxViolationsAllowed?: number;
  maxViolationDuration?: number; // seconds
  violationAction?: 'AutoSubmit' | 'Lock' | 'MarkSuspicious';
  startDate?: Timestamp | Date;
  endDate?: Timestamp | Date;
  status: 'draft' | 'scheduled' | 'published' | 'completed' | 'cancelled';
}

export interface ExamQuestion {
  documentId?: string;
  examId: string;
  question: string;
  questionType: 'MCQ' | 'TrueFalse' | 'FillBlank';
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctAnswer: string; // 'A', 'B', 'C', 'D' or 'True'/'False' or text
  marks: number;
}

export interface ExamAttempt {
  documentId?: string;
  examId: string;
  studentId: string;
  answers: Record<string, string>; // questionId -> studentAnswer
  score: number;
  percentage: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  timeUsed: number; // in seconds
  appSwitchCount?: number;
  totalExitDuration?: number; // in seconds
  isSuspicious?: boolean;
  isLocked?: boolean;
  autoSubmitReason?: string;
  rank?: number;
  grade?: string;
  startedAt: Timestamp | Date;
  submittedAt: Timestamp | Date;
}

export interface FeePlan {
  documentId?: string;
  courseId: string;
  planName: string;
  admissionFee: number;
  monthlyFee?: number;
  quarterlyFee?: number;
  halfYearlyFee?: number;
  yearlyFee?: number;
  registrationFee: number;
  discount: number;
  gst?: number;
  totalFee: number;
  status: 'active' | 'inactive';
  createdAt?: Timestamp | Date;
}

export interface StudentFeePlan {
  documentId?: string;
  studentId: string;
  courseId: string;
  batchId: string;
  feePlanId: string;
  billingFrequency: 'Monthly' | 'Quarterly' | 'Half-Yearly' | 'Yearly';
  paymentStartDate: Timestamp | Date;
  nextDueDate: Timestamp | Date;
  totalPaid: number;
  status: 'active' | 'inactive' | 'overdue';
  createdAt?: Timestamp | Date;
}

export interface FeeTransaction {
  documentId?: string;
  studentId: string;
  studentFeePlanId: string;
  academicYear?: string;
  billingPeriod?: string;
  paymentDate: Timestamp | Date;
  amountPaid: number;
  discount?: number;
  lateFee?: number;
  remainingBalance?: number;
  nextDueDate?: Timestamp | Date;
  paymentMode: 'Cash' | 'UPI' | 'Bank Transfer' | 'Card' | 'Cheque' | 'Online Gateway';
  transactionNumber?: string;
  receivedBy: string; // Admin userId
  remarks?: string;
  receiptNumber: string;
  status?: 'PAID';
  createdAt?: Timestamp | Date;
}

export interface ContentView {
  documentId?: string;
  studentId: string;
  batchId: string;
  contentId: string;
  contentType: 'homework' | 'note';
  firstViewedAt: Timestamp | Date;
  lastViewedAt: Timestamp | Date;
  viewCount: number;
  totalReadingDuration?: number; // in seconds
}
