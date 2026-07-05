import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from '../layouts/AdminLayout/AdminLayout';
import Dashboard from '../pages/Dashboard/Dashboard';
import Employees from '../pages/Employees/Employees';
import Roles from '../pages/Settings/Roles';

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      
      <Route element={<AdminLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/settings/roles" element={<Roles />} />
        {/* Placeholder routes for sidebar links */}
        <Route path="/extended" element={<div className="p-6">Extended UI (Placeholder)</div>} />
        <Route path="/icons" element={<div className="p-6">Icons (Placeholder)</div>} />
        <Route path="/forms" element={<div className="p-6">Form Elements (Placeholder)</div>} />
        <Route path="/tables" element={<div className="p-6">Tables (Placeholder)</div>} />
        <Route path="/charts" element={<div className="p-6">Charts (Placeholder)</div>} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default AppRoutes;
