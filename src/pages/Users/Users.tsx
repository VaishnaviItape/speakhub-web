import React, { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import type { User } from '../../types/models';
import DataTable, { type Column } from '../../components/ui/DataTable';
import '../../components/ui/TableStyles.css';

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      let fetchedUsers: User[] = [];
      try {
        const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
          fetchedUsers.push({ documentId: doc.id, ...doc.data() } as User);
        });
      } catch (err) {
        // Fallback if index on createdAt doesn't exist yet
        const qFallback = query(collection(db, 'users'));
        const snapshotFallback = await getDocs(qFallback);
        snapshotFallback.forEach(doc => {
          fetchedUsers.push({ documentId: doc.id, ...doc.data() } as User);
        });
      }
      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return <span className="status-badge status-active">Active</span>;
      case 'inactive': return <span className="status-badge status-inactive">Inactive</span>;
      case 'pending': return <span className="status-badge status-pending">Pending</span>;
      default: return <span className="status-badge status-inactive">{status || 'Unknown'}</span>;
    }
  };

  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="dt-avatar" style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: '#e0e7ff',
            color: '#4338ca',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '12px'
          }}>
            {row.name ? row.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <span style={{ fontWeight: 600 }}>{row.name || 'N/A'}</span>
        </div>
      ),
      exportValue: (row) => row.name || ''
    },
    {
      key: 'role',
      header: 'Role',
      render: (row) => <span style={{ textTransform: 'capitalize' }}>{row.role || '-'}</span>,
      exportValue: (row) => row.role || ''
    },
    {
      key: 'email',
      header: 'Email',
      render: (row) => <span>{row.email || '-'}</span>,
      exportValue: (row) => row.email || ''
    },
    {
      key: 'mobile',
      header: 'Phone / Mobile',
      render: (row) => <span>{row.mobile || row.phone || '-'}</span>,
      exportValue: (row) => row.mobile || row.phone || ''
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => getStatusBadge(row.status),
      exportValue: (row) => row.status || ''
    }
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">User Master</h1>
          <div className="breadcrumbs">
            <span>Admin</span> <span className="separator">/</span> <span className="current">Users</span>
          </div>
        </div>
      </div>

      <DataTable
        title="System Users"
        data={users}
        columns={columns}
        isLoading={isLoading}
        onRefresh={fetchUsers}
        searchPlaceholder="Search name, email, or role..."
      />
    </div>
  );
};

export default Users;
