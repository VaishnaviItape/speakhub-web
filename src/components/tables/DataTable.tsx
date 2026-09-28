import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MoreHorizontal, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import EmptyState from '../ui/EmptyState';
import { extractTimestamp, getRecordTimestamp } from '../ui/DataTable';
import './DataTable.css';

export interface ColumnDef<T> {
  header: string;
  accessor: keyof T | string;
  cell?: (row: T) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
}

function DataTable<T extends { id: string | number }>({ columns, data, onEdit, onDelete }: DataTableProps<T>) {
  const [openActionId, setOpenActionId] = useState<string | number | null>(null);
  const [sortConfig, setSortConfig] = useState<{
    key: string | null;
    direction: 'asc' | 'desc';
  }>({
    key: null,
    direction: 'desc'
  });

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

  const handleSort = (accessor: string) => {
    setSortConfig(prev => {
      if (prev.key === accessor) {
        if (prev.direction === 'asc') {
          return { key: accessor, direction: 'desc' };
        }
        return { key: null, direction: 'desc' };
      }
      return { key: accessor, direction: 'asc' };
    });
  };

  const sortedData = useMemo(() => {
    const list = [...data];

    if (sortConfig.key) {
      const colKey = sortConfig.key;
      return list.sort((a: any, b: any) => {
        const valA = a[colKey];
        const valB = b[colKey];

        const isAEmpty = valA === null || valA === undefined || valA === '';
        const isBEmpty = valB === null || valB === undefined || valB === '';
        if (isAEmpty && isBEmpty) return 0;
        if (isAEmpty) return 1;
        if (isBEmpty) return -1;

        // Timestamps
        const tsA = extractTimestamp(valA);
        const tsB = extractTimestamp(valB);
        if (tsA !== null && tsB !== null) {
          return sortConfig.direction === 'asc' ? tsA - tsB : tsB - tsA;
        }

        // Numeric
        const numA = Number(valA);
        const numB = Number(valB);
        if (!isNaN(numA) && !isNaN(numB)) {
          return sortConfig.direction === 'asc' ? numA - numB : numB - numA;
        }

        // String
        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        const cmp = strA.localeCompare(strB, undefined, { numeric: true });
        if (cmp !== 0) {
          return sortConfig.direction === 'asc' ? cmp : -cmp;
        }

        // Tie breaker: recent on top
        return getRecordTimestamp(b) - getRecordTimestamp(a);
      });
    }

    // Default: Recent on top
    return list.sort((a, b) => {
      const tsA = getRecordTimestamp(a);
      const tsB = getRecordTimestamp(b);
      if (tsA !== tsB) {
        return tsB - tsA;
      }
      // If numeric IDs
      const idA = Number(a.id);
      const idB = Number(b.id);
      if (!isNaN(idA) && !isNaN(idB)) {
        return idB - idA;
      }
      return 0;
    });
  }, [data, sortConfig]);

  return (
    <div className="data-table-container">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col, index) => {
              const isSortable = col.sortable !== false;
              const accessorStr = String(col.accessor);
              const isCurrentSort = sortConfig.key === accessorStr;

              return (
                <th 
                  key={index}
                  className={isSortable ? 'sortable-th' : ''}
                  onClick={() => isSortable && handleSort(accessorStr)}
                  title={isSortable ? `Click to sort by ${col.header}` : undefined}
                >
                  <div className="th-content-wrapper">
                    <span className={isCurrentSort ? 'active-th-title' : ''}>{col.header}</span>
                    {isSortable && (
                      isCurrentSort ? (
                        sortConfig.direction === 'asc' ? (
                          <ArrowUp size={14} className="sort-icon active-sort-icon" />
                        ) : (
                          <ArrowDown size={14} className="sort-icon active-sort-icon" />
                        )
                      ) : (
                        <ArrowUpDown size={14} className="sort-icon" />
                      )
                    )}
                  </div>
                </th>
              );
            })}
            {(onEdit || onDelete) && <th>Action</th>}
          </tr>
        </thead>
        <tbody>
          {sortedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (onEdit || onDelete ? 1 : 0)} style={{ padding: 0 }}>
                <EmptyState />
              </td>
            </tr>
          ) : (
            sortedData.map((row) => (
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
