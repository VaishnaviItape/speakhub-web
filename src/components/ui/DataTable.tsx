import React, { useState, useEffect } from 'react';
import { Search, MoreHorizontal, ArrowUpDown, RefreshCw, Download } from 'lucide-react';
import EmptyState from './EmptyState';
import './DataTable.css';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps<T> {
  title: string;
  data: T[];
  columns: Column<T>[];
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  onRefresh?: () => void;
  searchPlaceholder?: string;
  isLoading?: boolean;
}

function DataTable<T extends { documentId?: string }>({
  title,
  data,
  columns,
  onEdit,
  onDelete,
  onRefresh,
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

  const handleDownload = () => {
    if (!filteredData.length) {
      alert("No data is available to download.");
      return;
    }

    // 1. Create Headers
    const headers = columns.map(c => `"${c.header.replace(/"/g, '""')}"`).join(',');

    // 2. Create Rows
    const csvRows = filteredData.map(row => {
      return columns.map(col => {
        let val = (row as any)[col.key];
        
        if (val === null || val === undefined) {
          val = '';
        } else if (typeof val === 'object') {
          if (Array.isArray(val)) {
            val = val.join('; ');
          } else if (val.toDate) {
            val = val.toDate().toLocaleDateString();
          } else {
            val = JSON.stringify(val);
          }
        }
        
        const stringVal = String(val).replace(/"/g, '""');
        return `"${stringVal}"`;
      }).join(',');
    });

    // 3. Combine and download
    const csvString = [headers, ...csvRows].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${title.replace(/\s+/g, '_').toLowerCase()}_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
          
          {onRefresh && (
            <button 
              type="button" 
              className="dt-btn-outline" 
              onClick={onRefresh}
              disabled={isLoading}
              title="Refresh table data"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          )}

          <button className="dt-btn-outline" onClick={handleDownload}>
            <Download size={14} />
            <span>Download</span>
          </button>
        </div>
      </div>

      <div className="dt-table-container">
        <table className="dt-table">
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} style={{ textAlign: col.align || 'left' }}>
                  <div className={`dt-th-content ${col.align === 'center' ? 'dt-justify-center' : col.align === 'right' ? 'dt-justify-end' : ''}`}>
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
                    <td key={colIdx} style={{ textAlign: col.align || 'left' }}>
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
                <td colSpan={columns.length + (onEdit || onDelete ? 1 : 0)} style={{ padding: 0 }}>
                  <EmptyState 
                    title={searchTerm ? "No matching records found" : `No ${title.toLowerCase()} available`}
                    description={searchTerm ? `No results match "${searchTerm}". Try adjusting your search query.` : "There are currently no records available in this view."}
                  />
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
