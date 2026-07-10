import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import DataTable from '../../components/ui/DataTable';
import { getReportById, type ReportDefinition } from './ReportConfig';
import { ChevronLeft } from 'lucide-react';

const ReportViewer: React.FC = () => {
  const { reportId } = useParams<{ reportId: string }>();
  const [reportDef, setReportDef] = useState<ReportDefinition | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (reportId) {
      const def = getReportById(reportId);
      if (def) {
        setReportDef(def);
        fetchReportData(def);
      } else {
        setIsLoading(false);
      }
    }
  }, [reportId]);

  const fetchReportData = async (def: ReportDefinition) => {
    setIsLoading(true);
    try {
      let q = query(collection(db, def.collection));
      
      // Apply filters if any
      if (def.filters && def.filters.length > 0) {
        // Note: Firestore has limitations on multiple inequality/array-contains filters
        // but for equality, this works well.
        for (const filter of def.filters) {
          q = query(q, where(filter.field, filter.operator as any, filter.value));
        }
      }

      const snapshot = await getDocs(q);
      const items: any[] = [];
      snapshot.forEach(doc => {
        items.push({ documentId: doc.id, ...doc.data() });
      });
      
      setData(items);
    } catch (error) {
      console.error('Error fetching report data:', error);
      alert('Failed to fetch report data.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isLoading && !reportDef) {
    return (
      <div className="page-container flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Report Not Found</h2>
          <p className="text-gray-500 mb-4">The requested report does not exist or has been moved.</p>
          <Link to="/reports" className="btn btn-primary">Back to Reports</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link to="/reports" className="text-gray-500 hover:text-primary transition-colors">
              <ChevronLeft size={20} />
            </Link>
            <h1 className="page-title !mb-0">{reportDef?.title || 'Loading Report...'}</h1>
          </div>
          <div className="breadcrumbs">
            <Link to="/dashboard">Dashboard</Link> <span className="separator">/</span> 
            <Link to="/reports">Reports</Link> <span className="separator">/</span> 
            <span className="current">{reportDef?.title || '...'}</span>
          </div>
        </div>
      </div>

      <div className="mb-4 text-gray-600 bg-blue-50 p-4 rounded-lg border border-blue-100">
        <p>{reportDef?.description}</p>
      </div>

      <DataTable 
        title={`${reportDef?.title} Data`} 
        data={data} 
        columns={reportDef?.columns || []} 
        searchPlaceholder="Search in report..."
        isLoading={isLoading}
      />
    </div>
  );
};

export default ReportViewer;
