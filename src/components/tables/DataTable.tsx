import React, { useState, useRef, useEffect } from 'react';
import { MoreHorizontal } from 'lucide-react';
import './DataTable.css';

export interface ColumnDef<T> {
  header: string;
  accessor: keyof T | string;
  cell?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
}

function DataTable<T extends { id: string | number }>({ columns, data, onEdit, onDelete }: DataTableProps<T>) {
  const [openActionId, setOpenActionId] = useState<string | number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenActionId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleAction = (id: string | number, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenActionId(openActionId === id ? null : id);
  };

  return (
    <div className="data-table-container">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col, index) => (
              <th key={index}>{col.header}</th>
            ))}
            {(onEdit || onDelete) && <th>Action</th>}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (onEdit || onDelete ? 1 : 0)} className="text-center py-4">
                No data available
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr key={row.id}>
                {columns.map((col, index) => (
                  <td key={index}>
                    {col.cell ? col.cell(row) : (row as any)[col.accessor as string]}
                  </td>
                ))}
                {(onEdit || onDelete) && (
                  <td className="action-cell">
                    <button 
                      className="action-btn"
                      onClick={(e) => toggleAction(row.id, e)}
                    >
                      <MoreHorizontal size={18} />
                    </button>
                    {openActionId === row.id && (
                      <div className="action-dropdown" ref={dropdownRef}>
                        {onEdit && (
                          <button className="action-item" onClick={() => { onEdit(row); setOpenActionId(null); }}>
                            Edit
                          </button>
                        )}
                        {onDelete && (
                          <button className="action-item text-red-500" onClick={() => { onDelete(row); setOpenActionId(null); }}>
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
