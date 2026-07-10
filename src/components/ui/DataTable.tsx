import React, { useState, useEffect } from 'react';
import { Search, MoreHorizontal, ArrowUpDown, ChevronDown } from 'lucide-react';
import './DataTable.css';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  title: string;
  data: T[];
  columns: Column<T>[];
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  searchPlaceholder?: string;
  isLoading?: boolean;
}

function DataTable<T extends { documentId?: string }>({
  title,
  data,
  columns,
  onEdit,
  onDelete,
  searchPlaceholder = "Search",
  isLoading = false
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveDropdown(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Basic search filter (searches all string values in the row)
  const filteredData = data.filter(row => {
    if (!searchTerm) return true;
    return Object.values(row).some(val => 
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className="dt-card">
      <div className="dt-header">
        <h2 className="dt-title">{title}</h2>
        <div className="dt-actions">
          <div className="dt-search-box">
            <Search className="dt-search-icon" size={16} />
            <input 
              type="text" 
              placeholder={searchPlaceholder}
              className="dt-search-input"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="dt-btn-outline">Download Report</button>
          <button className="dt-btn-outline dt-dropdown-btn">
            2024 <ChevronDown size={14} />
          </button>
        </div>
      </div>

      <div className="dt-table-container">
        <table className="dt-table">
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th key={idx}>
                  <div className="dt-th-content">
                    {col.header}
                    {col.sortable !== false && <ArrowUpDown size={14} className="dt-sort-icon" />}
                  </div>
                </th>
              ))}
              {(onEdit || onDelete) && <th className="text-right">Action <ArrowUpDown size={14} className="dt-sort-icon" /></th>}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              // Loader Rows
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx}>
                  {columns.map((__, colIdx) => (
                    <td key={colIdx}>
                      <div className="dt-skeleton-pulse"></div>
                    </td>
                  ))}
                  {(onEdit || onDelete) && (
                    <td><div className="dt-skeleton-pulse" style={{ width: '30px', marginLeft: 'auto' }}></div></td>
                  )}
                </tr>
              ))
            ) : filteredData.length > 0 ? (
              filteredData.map((row, rowIndex) => (
                <tr key={row.documentId || rowIndex}>
                  {columns.map((col, colIdx) => (
                    <td key={colIdx}>
                      {col.render ? col.render(row) : (row as any)[col.key]}
                    </td>
                  ))}
                  {(onEdit || onDelete) && (
                    <td className="dt-action-cell relative">
                      <button 
                        className="dt-action-trigger"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDropdown(activeDropdown === row.documentId ? null : row.documentId!);
                        }}
                      >
                        <MoreHorizontal size={18} />
                      </button>
                      {activeDropdown === row.documentId && (
                        <div className="dt-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                          {onEdit && <button className="dt-dropdown-item" onClick={() => { onEdit(row); setActiveDropdown(null); }}>Edit</button>}
                          {onDelete && <button className="dt-dropdown-item text-red" onClick={() => { onDelete(row); setActiveDropdown(null); }}>Delete</button>}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length + (onEdit || onDelete ? 1 : 0)} className="dt-empty">
                  No data available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataTable;
