import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import DataTable, { type ColumnDef } from '../../components/tables/DataTable';
import Modal from '../../components/modals/Modal';
import Input from '../../components/forms/Input';
import Select from '../../components/forms/Select';

interface Employee {
  id: string;
  firebaseUid: string;
  roleId: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  profileImage: string;
  status: 'Active' | 'Inactive';
  createdAt: string;
  updatedAt: string;
}

const dummyEmployees: Employee[] = [
  {
    id: '1',
    firebaseUid: 'fb123',
    roleId: '1',
    firstName: 'Anthony',
    lastName: 'Thomas',
    email: 'anthony@example.com',
    mobile: '+1 234 567 8900',
    profileImage: 'https://ui-avatars.com/api/?name=Anthony+Thomas',
    status: 'Active',
    createdAt: '2023-10-01',
    updatedAt: '2023-10-01'
  },
  {
    id: '2',
    firebaseUid: 'fb124',
    roleId: '2',
    firstName: 'Benjamin',
    lastName: 'Martinez',
    email: 'benjamin@example.com',
    mobile: '+1 234 567 8901',
    profileImage: 'https://ui-avatars.com/api/?name=Benjamin+Martinez',
    status: 'Active',
    createdAt: '2023-10-05',
    updatedAt: '2023-10-05'
  },
  {
    id: '3',
    firebaseUid: 'fb125',
    roleId: '3',
    firstName: 'Christopher',
    lastName: 'Moore',
    email: 'christopher@example.com',
    mobile: '+1 234 567 8902',
    profileImage: 'https://ui-avatars.com/api/?name=Christopher+Moore',
    status: 'Inactive',
    createdAt: '2023-10-10',
    updatedAt: '2023-11-01'
  },
];

const roleOptions = [
  { label: 'Admin', value: '1' },
  { label: 'Manager', value: '2' },
  { label: 'Teacher', value: '3' },
  { label: 'Student', value: '4' },
];

const statusOptions = [
  { label: 'Active', value: 'Active' },
  { label: 'Inactive', value: 'Inactive' },
];

const Employees: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>(dummyEmployees);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    mobile: '',
    roleId: '',
    status: 'Active'
  });

  const columns: ColumnDef<Employee>[] = [
    {
      header: 'Name',
      accessor: 'firstName',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <img src={row.profileImage || `https://ui-avatars.com/api/?name=${row.firstName}+${row.lastName}`} alt="avatar" className="w-8 h-8 rounded-full object-cover" style={{width: 32, height: 32, borderRadius: '50%'}} />
          <span className="font-semibold text-main">{row.firstName} {row.lastName}</span>
        </div>
      )
    },
    { header: 'Email', accessor: 'email' },
    { header: 'Mobile', accessor: 'mobile' },
    { 
      header: 'Role ID', 
      accessor: 'roleId',
    },
    {
      header: 'Status',
      accessor: 'status',
      cell: (row) => (
        <span className={`badge-status ${row.status === 'Active' ? 'badge-new' : 'badge-inactive'}`}>
          {row.status}
        </span>
      )
    },
    { header: 'Created', accessor: 'createdAt' }
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    const newEmployee: Employee = {
      id: (employees.length + 1).toString(),
      firebaseUid: `fb_new_${Date.now()}`,
      ...formData,
      status: formData.status as 'Active' | 'Inactive',
      profileImage: `https://ui-avatars.com/api/?name=${formData.firstName}+${formData.lastName}`,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };
    
    setEmployees([...employees, newEmployee]);
    setFormData({ firstName: '', lastName: '', email: '', mobile: '', roleId: '', status: 'Active' });
    setIsModalOpen(false);
  };

  const handleEdit = (employee: Employee) => {
    console.log('Edit employee:', employee);
  };

  const handleDelete = (employee: Employee) => {
    setEmployees(employees.filter(e => e.id !== employee.id));
  };

  return (
    <div className="page-container flex flex-col gap-6">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">Employees Master</h1>
          <div className="breadcrumbs">
            <span className="text-primary">Dashboard</span> <span className="text-muted">/ Employees</span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          Add Employee
        </button>
      </div>

      <DataTable 
        columns={columns} 
        data={employees} 
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title="Add New Employee"
      >
        <form onSubmit={handleAddEmployee} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
            <Input label="First Name" name="firstName" placeholder="First Name" value={formData.firstName} onChange={handleInputChange} required />
            <Input label="Last Name" name="lastName" placeholder="Last Name" value={formData.lastName} onChange={handleInputChange} required />
          </div>
          <Input label="Email" name="email" type="email" placeholder="Email Address" value={formData.email} onChange={handleInputChange} />
          <Input label="Mobile" name="mobile" placeholder="Mobile Number" value={formData.mobile} onChange={handleInputChange} required />
          <Select label="Role" name="roleId" options={roleOptions} value={formData.roleId} onChange={handleInputChange} required />
          <Select label="Status" name="status" options={statusOptions} value={formData.status} onChange={handleInputChange} required />
          
          <button type="submit" className="btn btn-primary w-full mt-4 justify-center">
            Save Employee
          </button>
        </form>
      </Modal>
    </div>
  );
};

export default Employees;
