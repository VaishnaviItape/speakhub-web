import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import DataTable, { type ColumnDef } from '../../components/tables/DataTable';
import Modal from '../../components/modals/Modal';
import Input from '../../components/forms/Input';

interface Role {
  id: string;
  roleName: string;
}

const dummyRoles: Role[] = [
  { id: '1', roleName: 'Admin' },
  { id: '2', roleName: 'Manager' },
  { id: '3', roleName: 'Teacher' },
  { id: '4', roleName: 'Student' },
];

const Roles: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>(dummyRoles);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');

  const columns: ColumnDef<Role>[] = [
    { header: 'ID', accessor: 'id' },
    { header: 'Role Name', accessor: 'roleName' },
  ];

  const handleAddRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName) return;
    
    const newRole: Role = {
      id: (roles.length + 1).toString(),
      roleName: newRoleName,
    };
    
    setRoles([...roles, newRole]);
    setNewRoleName('');
    setIsModalOpen(false);
  };

  const handleEdit = (role: Role) => {
    console.log('Edit role:', role);
  };

  const handleDelete = (role: Role) => {
    setRoles(roles.filter(r => r.id !== role.id));
  };

  return (
    <div className="page-container flex flex-col gap-6">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">Roles Master</h1>
          <div className="breadcrumbs">
            <span className="text-primary">Settings</span> <span className="text-muted">/ Roles</span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          Add Role
        </button>
      </div>

      <DataTable 
        columns={columns} 
        data={roles} 
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Add New Role"
      >
        <form onSubmit={handleAddRole} className="flex flex-col gap-4">
          <Input 
            label="Role Name" 
            placeholder="Enter role name" 
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-primary w-full mt-4 justify-center">
            Save Role
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default Roles;
