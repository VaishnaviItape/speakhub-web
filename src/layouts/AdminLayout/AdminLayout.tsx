import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../../components/layout/Sidebar';
import Header from '../../components/layout/Header';
import { SidebarSearchProvider } from '../../contexts/SidebarSearchContext';
import './AdminLayout.css';

const AdminLayout: React.FC = () => {
  return (
    <SidebarSearchProvider>
      <div className="admin-layout">
        <Sidebar />
        <div className="main-wrapper">
          <Header />
          <main className="main-content">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarSearchProvider>
  );
};

export default AdminLayout;
