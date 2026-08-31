import React, { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { Search, ChevronDown } from 'lucide-react';
import type { User } from '../../types/models';
import EmptyState from '../../components/ui/EmptyState';
import '../../components/ui/TableStyles.css';

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      // Attempt to order by createdAt if it exists, otherwise fallback to simple query
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

  const filteredUsers = users.filter(user => 
    (user.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (user.email?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (user.role?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': return <span className="status-badge status-active">Active</span>;
      case 'inactive': return <span className="status-badge status-inactive">Inactive</span>;
      case 'pending': return <span className="status-badge status-pending">Pending</span>;
      default: return <span className="status-badge status-inactive">{status || 'Unknown'}</span>;
    }
  };

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

      <div className="data-card">
        <div className="data-card-header">
          <h3 className="data-card-title">System Users</h3>
          <div className="data-card-actions">
            <div className="search-wrapper">
              <Search className="search-icon" size={16} />
              <input
                type="text"
                placeholder="Search name, email, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name <ChevronDown size={14} className="sort-icon" /></th>
                <th>Role</th>
                <th>Email</th>
                <th>Phone / Mobile</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="empty-state">
                    Loading users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 0 }}>
                    <EmptyState 
                      title="No users found"
                      description={searchQuery ? `No users matched "${searchQuery}". Try a different keyword.` : "No registered user records are currently available."}
                    />
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.documentId || user.uid}>
                    <td style={{ fontWeight: 600 }}>{user.name || 'N/A'}</td>
                    <td style={{ textTransform: 'capitalize' }}>{user.role}</td>
                    <td>{user.email || '-'}</td>
                    <td>{user.mobile || user.phone || '-'}</td>
                    <td>{getStatusBadge(user.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Users;
