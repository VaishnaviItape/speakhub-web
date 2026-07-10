import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ProtectedRoute from '../components/layout/ProtectedRoute';

// Layouts
import AdminLayout from '../layouts/AdminLayout/AdminLayout';

// Auth Pages
import Login from '../pages/Login/Login';
import ChangePassword from '../pages/Login/ChangePassword';

// Main Pages
import Dashboard from '../pages/Dashboard/Dashboard';

// Academics
import Courses from '../pages/Courses/Courses';
import Subjects from '../pages/Subjects/Subjects';
import Batches from '../pages/Batches/Batches';

// Users
import Students from '../pages/Students/Students';
import Teachers from '../pages/Teachers/Teachers';
import Users from '../pages/Users/Users';
import Employees from '../pages/Employees/Employees';
import Roles from '../pages/Settings/Roles';

// Resources & Exams
import Notes from '../pages/Notes/Notes';
import Homework from '../pages/Homework/Homework';
import HomeworkReview from '../pages/Homework/HomeworkReview';
import Exams from '../pages/Exams/Exams';
import ExamQuestions from '../pages/Exams/ExamQuestions';
import ExamResults from '../pages/Exams/ExamResults';

// Finance
import FeePlans from '../pages/Fees/FeePlans';
import Fees from '../pages/Fees/Fees';
import FeeReports from '../pages/Fees/FeeReports';

// Student Pages
import StudentDashboard from '../pages/StudentPortal/StudentDashboard';
import StudentExams from '../pages/StudentPortal/StudentExams';
import StudentProfile from '../pages/StudentPortal/StudentProfile';
import StudentLayout from '../layouts/StudentLayout/StudentLayout';

const AppRoutes: React.FC = () => {
  const { isAuthenticated, user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={
        isAuthenticated && !user?.forcePasswordChange ? (
          <Navigate to={user?.role === 'student' ? '/student/dashboard' : '/dashboard'} replace />
        ) : <Login />
      } />

      <Route path="/change-password" element={
        isAuthenticated ? <ChangePassword /> : <Navigate to="/login" replace />
      } />
      
      <Route path="/" element={
        <Navigate to={user?.role === 'student' ? '/student/dashboard' : '/dashboard'} replace />
      } />
      
      {/* Wrapper for all ADMIN authenticated routes */}
      <Route element={isAuthenticated && user?.role !== 'student' ? <AdminLayout /> : <Navigate to="/login" replace />}>
        
        {/* Routes accessible to Admin and Teacher */}
        <Route element={<ProtectedRoute allowedRoles={['admin', 'teacher']} />}>
          <Route path="/dashboard" element={<Dashboard />} />
          
          <Route path="/courses" element={<Courses />} />
          <Route path="/subjects" element={<Subjects />} />
          <Route path="/batches" element={<Batches />} />
          
          <Route path="/students" element={<Students />} />
          
          <Route path="/notes" element={<Notes />} />
          <Route path="/homework" element={<Homework />} />
          <Route path="/homework/:homeworkId/review" element={<HomeworkReview />} />
          <Route path="/exams" element={<Exams />} />
          <Route path="/exams/:examId/questions" element={<ExamQuestions />} />
          <Route path="/exams/:examId/results" element={<ExamResults />} />
        </Route>

        {/* Routes accessible ONLY to Admin */}
        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route path="/teachers" element={<Teachers />} />
          <Route path="/users" element={<Users />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/settings/roles" element={<Roles />} />
          <Route path="/fees/plans" element={<FeePlans />} />
          <Route path="/fees" element={<Fees />} />
          <Route path="/fees/reports" element={<FeeReports />} />
        </Route>
        
      </Route>

      {/* Wrapper for STUDENT authenticated routes */}
      <Route element={isAuthenticated && user?.role === 'student' ? <StudentLayout /> : <Navigate to="/login" replace />}>
        <Route path="/student/dashboard" element={<StudentDashboard />} />
        <Route path="/student/exams" element={<StudentExams />} />
        <Route path="/student/profile" element={<StudentProfile />} />
        {/* Placeholders for others */}
        <Route path="/student/courses" element={<div className="p-4">My Courses</div>} />
        <Route path="/student/homework" element={<div className="p-4">My Homework</div>} />
      </Route>

      <Route path="*" element={<Navigate to={user?.role === 'student' ? '/student/dashboard' : '/dashboard'} replace />} />
    </Routes>
  );
};

export default AppRoutes;
