import React from "react";
import { Link } from "react-router-dom";
import {
  GraduationCap,
  Calendar,
  BookOpen,
  FileText,
  CreditCard,
  Briefcase,
  Users,
  ArrowRight,
  PieChart,
} from "lucide-react";
import { ReportConfig } from "./ReportConfig";
import "./ReportsDashboard.css";

const iconMap: Record<string, React.ReactNode> = {
  GraduationCap: <GraduationCap size={20} />,
  Calendar: <Calendar size={20} />,
  BookOpen: <BookOpen size={20} />,
  FileText: <FileText size={20} />,
  CreditCard: <CreditCard size={20} />,
  Briefcase: <Briefcase size={20} />,
  Users: <Users size={20} />,
};

const iconMapLarge: Record<string, React.ReactNode> = {
  GraduationCap: <GraduationCap size={24} />,
  Calendar: <Calendar size={24} />,
  BookOpen: <BookOpen size={24} />,
  FileText: <FileText size={24} />,
  CreditCard: <CreditCard size={24} />,
  Briefcase: <Briefcase size={24} />,
  Users: <Users size={24} />,
};

const ReportsDashboard: React.FC = () => {
  return (
    <div className="page-container reports-container">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-3">
            {/* <div className="group-icon-wrapper">
              <PieChart size={22} />
            </div> */}
            Reports & Analytics
          </h1>
          <div className="breadcrumbs mt-2">
            <Link to="/dashboard" className="hover:text-primary">
              Dashboard
            </Link>
            <span className="separator">/</span>
            <span className="current">Reports Center</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-10 mt-6">
        {ReportConfig.map((group) => (
          <div key={group.id} className="report-group">
            <div className="report-group-header flex items-center gap-3">
              {/* <div className="group-icon-wrapper">
                {iconMapLarge[group.icon] || <FileText size={24} />}
              </div> */}
              <h2 className="text-xl font-bold text-gray-800">{group.title}</h2>
            </div>
            <div className="reports-grid">
              {group.reports.map((report) => (
                <Link
                  to={`/reports/${report.id}`}
                  key={report.id}
                  className="block"
                >
                  <div className="report-card">
                    <div className="report-card-top-accent"></div>
                    <div className="report-card-content">
                      <div className="report-card-header-row">
                        <div className="report-card-icon-wrapper">
                          {iconMap[group.icon] || <FileText size={20} />}
                        </div>
                        <h3 className="report-card-title">{report.title}</h3>
                      </div>
                      <p className="report-card-desc">{report.description}</p>
                    </div>
                    <button className="report-card-button">
                      Open Report <ArrowRight size={16} />
                    </button>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReportsDashboard;
