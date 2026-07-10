import type { Column } from '../../components/ui/DataTable';

export interface ReportFilter {
  field: string;
  operator: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'array-contains';
  value: any;
}

export interface ReportDefinition {
  id: string;
  title: string;
  description: string;
  collection: string;
  filters?: ReportFilter[];
  columns: Column<any>[];
}

export interface ReportGroup {
  id: string;
  title: string;
  icon: string;
  reports: ReportDefinition[];
}

export const ReportConfig: ReportGroup[] = [
  {
    id: 'students',
    title: 'Student Reports',
    icon: 'GraduationCap',
    reports: [
      {
        id: 'student-master',
        title: 'Student Master Report',
        description: 'Displays all student information, including status and details.',
        collection: 'users',
        filters: [{ field: 'role', operator: 'in', value: ['student', 'parent'] }],
        columns: [
          { key: 'name', header: 'Student Name' },
          { key: 'email', header: 'Email' },
          { key: 'phone', header: 'Mobile Number' },
          { key: 'status', header: 'Status', render: (row: any) => row.status ? row.status.toUpperCase() : 'UNKNOWN' },
          { key: 'isDemoMode', header: 'Demo Status', render: (row: any) => row.isDemoMode ? 'Demo' : 'Regular' },
        ]
      },
      {
        id: 'active-students',
        title: 'Active Students Report',
        description: 'Displays all active students.',
        collection: 'users',
        filters: [
          { field: 'role', operator: 'in', value: ['student', 'parent'] },
          { field: 'status', operator: '==', value: 'active' }
        ],
        columns: [
          { key: 'name', header: 'Student Name' },
          { key: 'email', header: 'Email' },
          { key: 'phone', header: 'Mobile Number' }
        ]
      },
      {
        id: 'inactive-students',
        title: 'Inactive Students Report',
        description: 'Displays students who have left or are inactive.',
        collection: 'users',
        filters: [
          { field: 'role', operator: 'in', value: ['student', 'parent'] },
          { field: 'status', operator: '==', value: 'inactive' }
        ],
        columns: [
          { key: 'name', header: 'Student Name' },
          { key: 'email', header: 'Email' },
          { key: 'phone', header: 'Mobile Number' }
        ]
      },
      {
        id: 'demo-students',
        title: 'Demo Students Report',
        description: 'Students currently attending demo classes.',
        collection: 'users',
        filters: [
          { field: 'role', operator: 'in', value: ['student', 'parent'] },
          { field: 'isDemoMode', operator: '==', value: true }
        ],
        columns: [
          { key: 'name', header: 'Student Name' },
          { key: 'phone', header: 'Mobile Number' },
          { key: 'demoStartDate', header: 'Demo Start', render: (row: any) => row.demoStartDate?.toDate ? row.demoStartDate.toDate().toLocaleDateString() : '-' },
          { key: 'demoEndDate', header: 'Demo End', render: (row: any) => row.demoEndDate?.toDate ? row.demoEndDate.toDate().toLocaleDateString() : '-' }
        ]
      }
    ]
  },
  {
    id: 'fees',
    title: 'Fee Reports',
    icon: 'CreditCard',
    reports: [
      {
        id: 'fee-collection',
        title: 'Fee Collection Report',
        description: 'Total fees collected.',
        collection: 'fees',
        columns: [
          { key: 'studentId', header: 'Student ID' },
          { key: 'amountPaid', header: 'Amount Paid' },
          { key: 'paymentDate', header: 'Payment Date', render: (row: any) => row.paymentDate?.toDate ? row.paymentDate.toDate().toLocaleDateString() : '-' },
          { key: 'paymentMode', header: 'Payment Mode' }
        ]
      },
      {
        id: 'pending-fees',
        title: 'Pending Fee Report',
        description: 'Students with pending fees.',
        collection: 'fees',
        filters: [{ field: 'status', operator: '==', value: 'pending' }],
        columns: [
          { key: 'studentId', header: 'Student ID' },
          { key: 'dueAmount', header: 'Due Amount' },
          { key: 'dueDate', header: 'Due Date', render: (row: any) => row.dueDate?.toDate ? row.dueDate.toDate().toLocaleDateString() : '-' }
        ]
      }
    ]
  },
  {
    id: 'exams',
    title: 'Examination Reports',
    icon: 'FileText',
    reports: [
      {
        id: 'exam-master',
        title: 'Exam Report',
        description: 'All examinations.',
        collection: 'exams',
        columns: [
          { key: 'title', header: 'Exam Title' },
          { key: 'courseId', header: 'Course' },
          { key: 'batchId', header: 'Batch' },
          { key: 'totalMarks', header: 'Total Marks' }
        ]
      },
      {
        id: 'upcoming-exams',
        title: 'Upcoming Exams Report',
        description: 'Scheduled upcoming exams.',
        collection: 'exams',
        filters: [{ field: 'status', operator: '==', value: 'upcoming' }],
        columns: [
          { key: 'title', header: 'Exam Title' },
          { key: 'scheduledDate', header: 'Date', render: (row: any) => row.scheduledDate?.toDate ? row.scheduledDate.toDate().toLocaleDateString() : '-' }
        ]
      },
      {
        id: 'completed-exams',
        title: 'Completed Exams Report',
        description: 'Completed exams.',
        collection: 'exams',
        filters: [{ field: 'status', operator: '==', value: 'completed' }],
        columns: [
          { key: 'title', header: 'Exam Title' },
          { key: 'completedDate', header: 'Completion Date', render: (row: any) => row.completedDate?.toDate ? row.completedDate.toDate().toLocaleDateString() : '-' }
        ]
      }
    ]
  },
  {
    id: 'batches',
    title: 'Batch Reports',
    icon: 'Calendar',
    reports: [
      {
        id: 'batch-master',
        title: 'Batch Report',
        description: 'Displays all batches.',
        collection: 'batches',
        columns: [
          { key: 'batchName', header: 'Batch Name' },
          { key: 'teacherId', header: 'Teacher ID' },
          { key: 'status', header: 'Status' }
        ]
      },
      {
        id: 'active-batches',
        title: 'Active Batches Report',
        description: 'Running batches.',
        collection: 'batches',
        filters: [{ field: 'status', operator: '==', value: 'active' }],
        columns: [
          { key: 'batchName', header: 'Batch Name' },
          { key: 'courseId', header: 'Course' },
          { key: 'teacherId', header: 'Teacher ID' }
        ]
      }
    ]
  },
  {
    id: 'courses',
    title: 'Course Reports',
    icon: 'BookOpen',
    reports: [
      {
        id: 'course-master',
        title: 'Course Report',
        description: 'Displays all available courses.',
        collection: 'courses',
        columns: [
          { key: 'courseName', header: 'Course Name' },
          { key: 'duration', header: 'Duration' },
          { key: 'status', header: 'Status' },
        ]
      }
    ]
  },
  {
    id: 'teachers',
    title: 'Teacher Reports',
    icon: 'Briefcase',
    reports: [
      {
        id: 'teacher-master',
        title: 'Teacher Report',
        description: 'All teachers in the institute.',
        collection: 'users',
        filters: [{ field: 'role', operator: '==', value: 'teacher' }],
        columns: [
          { key: 'name', header: 'Teacher Name' },
          { key: 'email', header: 'Email' },
          { key: 'phone', header: 'Phone' },
          { key: 'status', header: 'Status' }
        ]
      }
    ]
  },
  {
    id: 'homework',
    title: 'Homework Reports',
    icon: 'FileText',
    reports: [
      {
        id: 'homework-master',
        title: 'Homework Assignment Report',
        description: 'All assigned homework.',
        collection: 'homework',
        columns: [
          { key: 'title', header: 'Title' },
          { key: 'dueDate', header: 'Due Date', render: (row: any) => row.dueDate?.toDate ? row.dueDate.toDate().toLocaleDateString() : '-' },
          { key: 'courseId', header: 'Course' },
          { key: 'batchId', header: 'Batch' }
        ]
      }
    ]
  },
  {
    id: 'notes',
    title: 'Notes Reports',
    icon: 'BookOpen',
    reports: [
      {
        id: 'notes-master',
        title: 'Notes Upload Report',
        description: 'All uploaded notes.',
        collection: 'notes',
        columns: [
          { key: 'title', header: 'Title' },
          { key: 'subjectId', header: 'Subject' },
          { key: 'uploadDate', header: 'Upload Date', render: (row: any) => row.uploadDate?.toDate ? row.uploadDate.toDate().toLocaleDateString() : '-' },
          { key: 'teacherId', header: 'Uploaded By' }
        ]
      }
    ]
  }
];

export const getReportById = (id: string): ReportDefinition | undefined => {
  for (const group of ReportConfig) {
    const report = group.reports.find(r => r.id === id);
    if (report) return report;
  }
  return undefined;
};
