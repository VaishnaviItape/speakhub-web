import React, { useState, useEffect } from 'react';
import { Download, TrendingUp, IndianRupee, AlertCircle } from 'lucide-react';
import { db } from '../../config/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import type { FeeTransaction, StudentFeePlan } from '../../types/models';

const FeeReports: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [totalCollection, setTotalCollection] = useState(0);
  const [thisMonthCollection, setThisMonthCollection] = useState(0);
  const [pendingAmount, setPendingAmount] = useState(0);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const transSnap = await getDocs(collection(db, 'fee_transactions'));
      let total = 0;
      let monthTotal = 0;
      const now = new Date();

      transSnap.forEach((doc) => {
        const d = doc.data() as FeeTransaction;
        total += d.amountPaid || 0;
        
        const pt = d.paymentDate instanceof Date ? d.paymentDate : (d.paymentDate as any)?.toDate?.() || new Date();
        if (pt.getMonth() === now.getMonth() && pt.getFullYear() === now.getFullYear()) {
          monthTotal += d.amountPaid || 0;
        }
      });

      setTotalCollection(total);
      setThisMonthCollection(monthTotal);

      const planSnap = await getDocs(collection(db, 'student_fee_plans'));
      let pending = 0;
      // We need to fetch fee_plans to know total plan fee
      const fpSnap = await getDocs(collection(db, 'fee_plans'));
      const fpMap: Record<string, number> = {};
      fpSnap.forEach(fp => { fpMap[fp.id] = fp.data().totalFee; });

      planSnap.forEach(doc => {
        const p = doc.data() as StudentFeePlan;
        const totalP = fpMap[p.feePlanId] || 0;
        pending += Math.max(0, totalP - (p.totalPaid || 0));
      });
      setPendingAmount(pending);

    } catch (e) {
      console.error("Error fetching analytics", e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Fee Analytics & Reports</h1>
          <div className="breadcrumbs">
            <span>Finance</span> <span className="separator">/</span> <span className="current">Reports</span>
          </div>
        </div>
        <button className="btn btn-outline" onClick={() => alert("Report Export feature coming soon!")}>
          <Download size={16} /> Export CSV
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-8">Loading analytics...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
              <div className="p-4 bg-blue-50 text-blue-600 rounded-lg mr-4">
                <IndianRupee size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Collection</p>
                <h3 className="text-2xl font-bold text-gray-800">₹{totalCollection.toLocaleString()}</h3>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
              <div className="p-4 bg-green-50 text-green-600 rounded-lg mr-4">
                <TrendingUp size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">This Month</p>
                <h3 className="text-2xl font-bold text-gray-800">₹{thisMonthCollection.toLocaleString()}</h3>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center">
              <div className="p-4 bg-orange-50 text-orange-600 rounded-lg mr-4">
                <AlertCircle size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">Pending Dues</p>
                <h3 className="text-2xl font-bold text-gray-800">₹{pendingAmount.toLocaleString()}</h3>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mt-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Analytics Charts</h3>
            <div className="h-64 flex items-center justify-center bg-gray-50 border border-dashed border-gray-200 rounded-lg text-gray-500">
               Interactive Revenue Charts will appear here when sufficient data is collected.
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default FeeReports;
