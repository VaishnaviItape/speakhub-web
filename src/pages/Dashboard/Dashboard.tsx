import React from 'react';
import './Dashboard.css';
import '../../components/ui/TableStyles.css';
import { Plus } from 'lucide-react';

const Dashboard: React.FC = () => {
  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <div className="breadcrumbs">
            <span>Dashboard</span> <span className="separator">/</span> <span className="current">Overview</span>
          </div>
        </div>
        <button className="btn btn-primary add-employee-btn">
          <Plus size={18} />
          Add Employee
        </button>
      </div>

      <div className="dashboard-grid top-cards">
        {/* Satisfied Card */}
        <div className="card satisfied-card">
          <div className="satisfied-content">
            <h3 className="card-subtitle">Employee Satisfied</h3>
            <h2 className="card-title text-accent-yellow">95.27%</h2>
            <p className="card-text">
              There are currently <span className="text-primary font-semibold">1,204 employees</span> who are satisfied with working in your office, an increase from last month.
            </p>
          </div>
          <div className="satisfied-image">
            {/* Placeholder for 3D character with chart */}
            <div className="placeholder-illustration">
               <div className="pie-slice slice-1"></div>
               <div className="pie-slice slice-2"></div>
               <div className="pie-slice slice-3"></div>
            </div>
          </div>
        </div>

        {/* Task Status Card */}
        <div className="card task-status-card">
          <div className="task-content">
            <h3 className="card-subtitle">Task Status</h3>
            <p className="card-text text-sm">
              <span className="font-semibold">90%</span> of the work was completed last week, a significant portion of the total task.
            </p>
            <button className="btn btn-primary btn-sm mt-4">
              <Plus size={16} />
              Add Task
            </button>
          </div>
          <div className="task-chart">
            <div className="progress-arc">
              <svg viewBox="0 0 100 50">
                <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#fff" strokeWidth="10" opacity="0.3" strokeLinecap="round" />
                <path d="M 10 50 A 40 40 0 0 1 70 15" fill="none" stroke="#fff" strokeWidth="10" strokeLinecap="round" />
              </svg>
              <div className="arc-text">
                <h3>65.7%</h3>
                <span>421/500 Total task done</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-grid bottom-cards mt-6">
        {/* KPI Chart Card */}
        <div className="card kpi-card">
          <div className="kpi-header flex justify-between items-center">
            <div>
              <h3 className="card-subtitle">Average Team KPI</h3>
              <div className="kpi-value-row">
                <h2 className="kpi-value">65,276K</h2>
                <span className="kpi-trend text-green">↑+9% than last year</span>
              </div>
            </div>
            <button className="btn btn-outline btn-sm">Download Report</button>
          </div>
          <div className="kpi-chart-container">
             {/* Chart placeholder */}
             <div className="kpi-chart-placeholder">
               <svg viewBox="0 0 500 100" preserveAspectRatio="none">
                 <path d="M0,80 Q50,90 100,60 T200,40 T300,70 T400,30 T500,50 L500,100 L0,100 Z" fill="rgba(245, 158, 11, 0.1)" stroke="#f59e0b" strokeWidth="2" />
                 <line x1="0" y1="90" x2="500" y2="90" stroke="#e2e8f0" strokeDasharray="4 4" />
               </svg>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
