import React, { useState, useEffect, useMemo } from 'react';
import { Search, MoreHorizontal, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw, Download, Sparkles, X } from 'lucide-react';
import EmptyState from './EmptyState';
import './DataTable.css';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  exportValue?: (row: T) => string | number | boolean | null | undefined;
  hiddenFromExport?: boolean;
}

interface DataTableProps<T> {
  title: string;
  data: T[];
  columns: Column<T>[];
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  onRefresh?: () => void;
  onExport?: (data: T[]) => void;
  searchPlaceholder?: string;
  isLoading?: boolean;
  defaultSortKey?: string;
  defaultSortDirection?: 'asc' | 'desc';
}

/**
 * Extracts a numeric timestamp (epoch milliseconds) from various data formats
 * commonly used in Firebase Firestore (Timestamp, Date, seconds/nanoseconds, ISO string, etc.).
 */
export const extractTimestamp = (val: any): number | null => {
  if (val === null || val === undefined || val === '') return null;

  if (val instanceof Date) {
    const t = val.getTime();
    return isNaN(t) ? null : t;
  }

  // Firestore Timestamp instance (with toMillis or toDate)
  if (typeof val.toMillis === 'function') {
    try {
      const ms = val.toMillis();
      if (!isNaN(ms)) return ms;
    } catch { }
  }
  if (typeof val.toDate === 'function') {
    try {
      const t = val.toDate().getTime();
      if (!isNaN(t)) return t;
    } catch { }
  }

  // Firestore plain timestamp object: { seconds: number, nanoseconds?: number }
  if (typeof val.seconds === 'number') {
    return val.seconds * 1000 + (val.nanoseconds ? Math.floor(val.nanoseconds / 1000000) : 0);
  }

  // Numeric epoch
  if (typeof val === 'number') {
    if (val > 1000000000 && val < 10000000000) return val * 1000;
    if (val >= 10000000000) return val;
    return null;
  }

  // String date (ISO, YYYY-MM-DD, DD/MM/YYYY, etc.)
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;

    const parsed = Date.parse(trimmed);
    if (!isNaN(parsed) && parsed > 946684800000) {
      return parsed;
    }

    const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (dmy) {
      const parsedDmy = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])).getTime();
      if (!isNaN(parsedDmy)) return parsedDmy;
    }
  }

  return null;
};

/**
 * Finds the most recent creation/addition timestamp of any record across all known fields.
 */
export const getRecordTimestamp = (row: any): number => {
  if (!row || typeof row !== 'object') return 0;

  const priorityKeys = [
    'createdAt',
    'created_at',
    'addedAt',
    'added_at',
    'registeredAt',
    'joiningDate',
    'joiningDateRaw',
    'admissionDate',
    'enquiryDate',
    'submissionDate',
    'paymentDate',
    'paidAt',
    'updatedAt',
    'updated_at',
    'timestamp',
    'date',
    'startDate',
    'examDate'
  ];

  for (const k of priorityKeys) {
    if (row[k] !== undefined && row[k] !== null) {
      const ts = extractTimestamp(row[k]);
      if (ts !== null && ts > 0) return ts;
    }
  }

  for (const [key, val] of Object.entries(row)) {
    if (/(created|timestamp|date|time)/i.test(key)) {
      const ts = extractTimestamp(val);
      if (ts !== null && ts > 0) return ts;
    }
  }

  // Numeric fallback if id is an auto-increment or epoch number
  if (typeof row.id === 'number') {
    return row.id;
  }

  return 0;
};

/**
 * Retrieve column value for sorting
 */
const getColumnSortValue = (row: any, col: Column<any>): any => {
  if (!row) return null;
  const raw = row[col.key];
  if (raw !== undefined && raw !== null && raw !== '') {
    return raw;
  }
  if (typeof col.exportValue === 'function') {
    try {
      const ev = col.exportValue(row);
      if (ev !== undefined && ev !== null) return ev;
    } catch { }
  }
  return raw;
};

/**
 * Compares two values for column sorting (supporting dates, numbers, strings, and booleans)
 */
const compareColumnValues = (valA: any, valB: any, direction: 'asc' | 'desc'): number => {
  const isAEmpty = valA === null || valA === undefined || valA === '';
  const isBEmpty = valB === null || valB === undefined || valB === '';
  if (isAEmpty && isBEmpty) return 0;
  if (isAEmpty) return 1;
  if (isBEmpty) return -1;

  // Timestamps / Dates
  const tsA = extractTimestamp(valA);
  const tsB = extractTimestamp(valB);
  if (tsA !== null && tsB !== null) {
    return direction === 'asc' ? tsA - tsB : tsB - tsA;
  }

  // Numbers or numeric strings
  const numA = typeof valA === 'number' ? valA : (typeof valA === 'string' && /^-?\d+(\.\d+)?$/.test(valA.trim()) ? Number(valA.trim()) : NaN);
  const numB = typeof valB === 'number' ? valB : (typeof valB === 'string' && /^-?\d+(\.\d+)?$/.test(valB.trim()) ? Number(valB.trim()) : NaN);
  if (!isNaN(numA) && !isNaN(numB)) {
    return direction === 'asc' ? numA - numB : numB - numA;
  }

  // Boolean
  if (typeof valA === 'boolean' && typeof valB === 'boolean') {
    const diff = (valA ? 1 : 0) - (valB ? 1 : 0);
    return direction === 'asc' ? diff : -diff;
  }

  // String comparison (case-insensitive, natural)
  const strA = String(valA).trim().toLowerCase();
  const strB = String(valB).trim().toLowerCase();
  const cmp = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
  return direction === 'asc' ? cmp : -cmp;
};

function DataTable<T extends Record<string, any>>({
  title,
  data,
  columns,
  onEdit,
  onDelete,
  onRefresh,
  onExport,
  searchPlaceholder = "Search",
  isLoading = false,
  defaultSortKey,
  defaultSortDirection = 'desc'
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Sorting state: when key is null, defaults to "Recent on top"
  const [sortConfig, setSortConfig] = useState<{
    key: string | null;
    direction: 'asc' | 'desc';
  }>({
    key: defaultSortKey || null,
    direction: defaultSortDirection
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveDropdown(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Filter data (case-insensitive search across all values and formatted dates)
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const lowerSearch = searchTerm.toLowerCase();

    return data.filter(row => {
      return Object.values(row).some(val => {
        if (val === null || val === undefined) return false;
        if (typeof val === 'object') {
          if (val.toDate && typeof val.toDate === 'function') {
            return val.toDate().toLocaleDateString().toLowerCase().includes(lowerSearch);
          }
          return false;
        }
        return String(val).toLowerCase().includes(lowerSearch);
      });
    });
  }, [data, searchTerm]);

  // Sort data (Recent on top by default, or by active column)
  const sortedData = useMemo(() => {
    const list = [...filteredData];

    // If an explicit column is selected for sorting
    if (sortConfig.key) {
      const activeCol = columns.find(c => c.key === sortConfig.key);
      if (activeCol) {
        return list.sort((a, b) => {
          const valA = getColumnSortValue(a, activeCol);
          const valB = getColumnSortValue(b, activeCol);
          const cmp = compareColumnValues(valA, valB, sortConfig.direction);
          if (cmp !== 0) return cmp;

          // Secondary tie-breaker: Most recent record on top
          const tsA = getRecordTimestamp(a);
          const tsB = getRecordTimestamp(b);
          return tsB - tsA;
        });
      }
    }

    // Default Sorting: Most recently added data ALWAYS on top!
    return list.sort((a, b) => {
      const tsA = getRecordTimestamp(a);
      const tsB = getRecordTimestamp(b);
      if (tsA !== tsB) {
        return tsB - tsA; // Most recent first (descending)
      }
      return 0;
    });
  }, [filteredData, sortConfig, columns]);

  // Handle column header clicks
  const handleSort = (columnKey: string) => {
    setSortConfig(prev => {
      if (prev.key === columnKey) {
        // Toggle: asc -> desc -> reset to recent (null)
        if (prev.direction === 'asc') {
          return { key: columnKey, direction: 'desc' };
        }
        return { key: null, direction: 'desc' };
      }

      // New column clicked: default descending for dates/numeric amounts, ascending for text
      const isDateField = /(date|time|created|at|due|fee|marks|score|amount|paid)/i.test(columnKey);
      return { key: columnKey, direction: isDateField ? 'desc' : 'asc' };
    });
  };

  const resetToRecentSort = () => {
    setSortConfig({ key: null, direction: 'desc' });
  };

  const handleDownload = () => {
    if (onExport) {
      onExport(sortedData);
      return;
    }

    if (!sortedData.length) {
      alert("No data is available to download.");
      return;
    }

    // Filter out actions or columns hidden from export
    const exportColumns = columns.filter(c => !c.hiddenFromExport && c.key !== 'actions');

    // 1. Create Headers
    const headers = exportColumns.map(c => `"${(c.header || '').replace(/"/g, '""')}"`).join(',');

    // 2. Create Rows using sortedData (preserving user's sort preference or recent-first order)
    const csvRows = sortedData.map(row => {
      return exportColumns.map(col => {
        let val: any;
        if (typeof col.exportValue === 'function') {
          val = col.exportValue(row);
        } else {
          val = (row as any)[col.key];
        }

        if (val === null || val === undefined) {
          val = '';
        } else if (typeof val === 'object') {
          if (Array.isArray(val)) {
            val = val.join('; ');
          } else if (val.toDate && typeof val.toDate === 'function') {
            val = val.toDate().toLocaleDateString();
          } else {
            val = JSON.stringify(val);
          }
        }

        const stringVal = String(val).replace(/"/g, '""');
        return `"${stringVal}"`;
      }).join(',');
    });

    // 3. Combine and download with UTF-8 BOM (\uFEFF) for full Microsoft Excel compatibility
    const csvString = '\uFEFF' + [headers, ...csvRows].join('\r\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${title.replace(/\s+/g, '_').toLowerCase()}_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeColumnDef = columns.find(c => c.key === sortConfig.key);

  return (
    <div className="dt-card">
      <div className="dt-header">
        <div className="dt-title-group">
          <h2 className="dt-title">{title}</h2>
          {sortConfig.key ? (
            <button 
              type="button" 
              className="dt-active-sort-pill" 
              onClick={resetToRecentSort} 
              title="Currently sorted by column. Click to reset to Recent on Top."
            >
              <span>Sorted: <strong>{activeColumnDef?.header || sortConfig.key}</strong> ({sortConfig.direction === 'asc' ? 'Ascending' : 'Descending'})</span>
              <span className="dt-sort-pill-reset"><X size={12} /> Reset to Recent</span>
            </button>
          ) : (
            <span className="dt-recent-badge" title="Recently added records are automatically displayed on top">
              <Sparkles size={11} /> Recent First
            </span>
          )}
        </div>

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

          <button className="dt-btn-outline" onClick={handleDownload} title="Download CSV / Excel">
            <Download size={14} />
            <span>Download</span>
          </button>
        </div>
      </div>

      <div className="dt-table-container">
        <table className="dt-table">
          <thead>
            <tr>
              {columns.map((col, idx) => {
                const isSortable = col.sortable !== false;
                const isCurrentSort = sortConfig.key === col.key;
                return (
                  <th 
                    key={idx} 
                    style={{ textAlign: col.align || 'left' }}
                    className={isSortable ? 'dt-th-sortable' : ''}
                    onClick={() => isSortable && handleSort(col.key)}
                    title={isSortable ? (isCurrentSort ? `Sorted ${sortConfig.direction === 'asc' ? 'Ascending' : 'Descending'}. Click to toggle or reset.` : `Click to sort by ${col.header}`) : undefined}
                  >
                    <div className={`dt-th-content ${col.align === 'center' ? 'dt-justify-center' : col.align === 'right' ? 'dt-justify-end' : ''}`}>
                      <span className={isCurrentSort ? 'dt-th-title-active' : ''}>{col.header}</span>
                      {isSortable && (
                        isCurrentSort ? (
                          sortConfig.direction === 'asc' ? (
                            <ArrowUp size={14} className="dt-sort-icon dt-sort-icon-active" />
                          ) : (
                            <ArrowDown size={14} className="dt-sort-icon dt-sort-icon-active" />
                          )
                        ) : (
                          <ArrowUpDown size={14} className="dt-sort-icon" />
                        )
                      )}
                    </div>
                  </th>
                );
              })}
              {(onEdit || onDelete) && <th className="text-right">Action</th>}
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
            ) : sortedData.length > 0 ? (
              sortedData.map((row, rowIndex) => {
                const rowKey = row.documentId || row.id || rowIndex;
                const dropdownId = String(rowKey);
                return (
                  <tr key={rowKey}>
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
                            setActiveDropdown(activeDropdown === dropdownId ? null : dropdownId);
                          }}
                        >
                          <MoreHorizontal size={18} />
                        </button>
                        {activeDropdown === dropdownId && (
                          <div className="dt-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                            {onEdit && <button className="dt-dropdown-item" onClick={() => { onEdit(row); setActiveDropdown(null); }}>Edit</button>}
                            {onDelete && <button className="dt-dropdown-item text-red" onClick={() => { onDelete(row); setActiveDropdown(null); }}>Delete</button>}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
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
