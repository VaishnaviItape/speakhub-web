import { 
  LayoutDashboard, 
  Users,
  Shield,
  BookOpen,
  GraduationCap,
  Briefcase,
  FileText,
  Calendar,
  PenTool,
  HelpCircle,
  CreditCard,
  BarChart3
} from 'lucide-react';
import React from 'react';

export interface MenuItem {
  id: string;
  title: string;
  path: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  adminOnly?: boolean;
  keywords?: string[];
  description?: string;
}

export interface MenuGroup {
  title: string;
  adminOnly?: boolean;
  items: MenuItem[];
}

export const MENU_GROUPS: MenuGroup[] = [
  {
    title: 'MAIN',
    items: [
      {
        id: 'dashboard',
        title: 'Dashboard',
        path: '/dashboard',
        icon: LayoutDashboard,
        keywords: ['home', 'overview', 'metrics', 'stats', 'main'],
        description: 'Academy overview and statistics'
      }
    ]
  },
  {
    title: 'MASTERS SETUP',
    items: [
      {
        id: 'teachers',
        title: 'Teacher Master',
        path: '/teachers',
        icon: Briefcase,
        adminOnly: true,
        keywords: ['faculty', 'instructors', 'staff', 'teachers', 'educators'],
        description: 'Manage teachers and faculty profiles'
      },
      {
        id: 'courses',
        title: 'Course Master',
        path: '/courses',
        icon: BookOpen,
        keywords: ['curriculum', 'subjects', 'courses', 'programs', 'phonics', 'abacus'],
        description: 'Configure courses and syllabus'
      },
      {
        id: 'batches',
        title: 'Batch Master',
        path: '/batches',
        icon: Calendar,
        keywords: ['batches', 'timings', 'schedules', 'classrooms', 'slots'],
        description: 'Organize class batches and schedules'
      },
      {
        id: 'users',
        title: 'User / Staff Master',
        path: '/users',
        icon: Users,
        adminOnly: true,
        keywords: ['staff', 'users', 'admins', 'accounts', 'logins', 'permissions'],
        description: 'Manage staff and administrator logins'
      }
    ]
  },
  {
    title: 'STUDENT OPERATIONS',
    items: [
      {
        id: 'students',
        title: 'Student Master / Directory',
        path: '/students',
        icon: GraduationCap,
        keywords: ['students', 'directory', 'admissions', 'enrolled', 'profiles', 'kids'],
        description: 'View student directory and enrollments'
      },
      {
        id: 'enquiries',
        title: 'Enquiries & Leads',
        path: '/enquiries',
        icon: HelpCircle,
        keywords: ['leads', 'enquiries', 'inquiries', 'prospects', 'follow-ups', 'crm'],
        description: 'Track incoming student leads and enquiries'
      },
      {
        id: 'attendance',
        title: 'Attendance',
        path: '/attendance',
        icon: Calendar,
        keywords: ['attendance', 'present', 'absent', 'leaves', 'records', 'daily'],
        description: 'Mark and track student attendance'
      },
      {
        id: 'fees',
        title: 'Fees Collection',
        path: '/fees',
        icon: CreditCard,
        adminOnly: true,
        keywords: ['fees', 'payments', 'dues', 'collection', 'receipts', 'installments'],
        description: 'Collect student fees and issue receipts'
      },
      {
        id: 'fee-reports',
        title: 'Fee Reports',
        path: '/fees/reports',
        icon: FileText,
        adminOnly: true,
        keywords: ['fee reports', 'revenue', 'outstanding', 'financials', 'collections', 'statements'],
        description: 'Comprehensive fee collection analytics'
      }
    ]
  },
  {
    title: 'LEARNING & EXAMS',
    items: [
      {
        id: 'videos',
        title: 'YouTube Videos',
        path: '/videos',
        icon: FileText,
        keywords: ['youtube', 'videos', 'lectures', 'recordings', 'tutorials', 'video lessons'],
        description: 'Recorded lectures and video resources'
      },
      {
        id: 'notes',
        title: 'Study Notes',
        path: '/notes',
        icon: FileText,
        keywords: ['study notes', 'notes', 'materials', 'pdf', 'documents', 'worksheets'],
        description: 'Downloadable notes and study guides'
      },
      {
        id: 'homework',
        title: 'Homework',
        path: '/homework',
        icon: PenTool,
        keywords: ['homework', 'assignments', 'tasks', 'submissions', 'practice', 'home work', 'hom'],
        description: 'Assign and review student homework'
      },
      {
        id: 'exams',
        title: 'Exams',
        path: '/exams',
        icon: FileText,
        keywords: ['exams', 'tests', 'mock tests', 'quizzes', 'scores', 'assessments'],
        description: 'Online exams, question papers, and results'
      }
    ]
  },
  {
    title: 'ANALYTICS & SETTINGS',
    adminOnly: true,
    items: [
      {
        id: 'reports',
        title: 'Reports Center',
        path: '/reports',
        icon: BarChart3,
        adminOnly: true,
        keywords: ['reports', 'analytics', 'data', 'exports', 'charts', 'summary'],
        description: 'Consolidated performance and system reports'
      },
      {
        id: 'roles',
        title: 'Roles & Permissions',
        path: '/settings/roles',
        icon: Shield,
        adminOnly: true,
        keywords: ['roles', 'permissions', 'access control', 'security', 'privileges'],
        description: 'Configure security roles and staff access'
      }
    ]
  }
];
