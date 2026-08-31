/**
 * Indian Standard DateTime utilities for Speak Hub Admin Panel & Mobile Web
 * Formats time in 12-hour AM/PM format (Indian Clock Format)
 */

export const parseDate = (input: any): Date | null => {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  if (typeof input === 'object' && typeof input.toDate === 'function') {
    try {
      const d = input.toDate();
      return isNaN(d.getTime()) ? null : d;
    } catch {
      return null;
    }
  }
  if (typeof input === 'object' && input.seconds !== undefined) {
    const d = new Date(input.seconds * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Format in 12-Hour Indian Clock time (e.g. "10:30 AM", "04:15 PM")
 */
export const formatIndianTime = (input: any): string => {
  const d = parseDate(input);
  if (!d) return '-';
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

/**
 * Format in Indian Date (e.g. "31 Aug 2026" or "31/08/2026")
 */
export const formatIndianDate = (input: any, style: 'short' | 'medium' = 'medium'): string => {
  const d = parseDate(input);
  if (!d) return '-';
  if (style === 'short') {
    return d.toLocaleDateString('en-GB'); // DD/MM/YYYY
  }
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

/**
 * Format full date & 12-hour AM/PM time (e.g. "31 Aug 2026, 10:30 AM")
 */
export const formatIndianDateTime = (input: any): string => {
  const d = parseDate(input);
  if (!d) return '-';
  const dateStr = d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  const timeStr = d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  return `${dateStr}, ${timeStr}`;
};

/**
 * Format schedule range (e.g. "31 Aug 2026, 10:00 AM - 11:30 AM")
 */
export const formatIndianScheduleRange = (startInput: any, endInput: any): string => {
  const start = parseDate(startInput);
  const end = parseDate(endInput);
  if (!start && !end) return 'Unscheduled';
  if (start && !end) return `Starts: ${formatIndianDateTime(start)}`;
  if (!start && end) return `Ends: ${formatIndianDateTime(end)}`;

  const startDateStr = start!.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  const endDateStr = end!.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  const startTimeStr = start!.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
  const endTimeStr = end!.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  if (startDateStr === endDateStr) {
    return `${startDateStr}, ${startTimeStr} - ${endTimeStr}`;
  }
  return `${startDateStr} ${startTimeStr} - ${endDateStr} ${endTimeStr}`;
};
