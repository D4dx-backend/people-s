/**
 * Generic CSV Helper Utility
 * 
 * Provides reusable CSV generation from any data array using configurable column definitions.
 * Used by the generic export handler and individual service exports.
 */

/**
 * Access a nested property from an object using dot notation
 * @param {Object} obj - The object to access
 * @param {string} path - Dot-separated path (e.g., 'beneficiary.name')
 * @returns {*} The value at the path, or undefined
 */
function getNestedValue(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

/**
 * Format a value for CSV output
 * @param {*} value - The value to format
 * @param {string} [type] - Optional type hint: 'date', 'currency', 'number', 'boolean'
 * @returns {string} CSV-safe formatted string
 */
function formatValue(value, type) {
  if (value === null || value === undefined) return '';

  switch (type) {
    case 'date':
      if (!value) return '';
      try {
        const date = new Date(value);
        if (isNaN(date.getTime())) return String(value);
        return date.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      } catch {
        return String(value);
      }

    case 'datetime':
      if (!value) return '';
      try {
        const dt = new Date(value);
        if (isNaN(dt.getTime())) return String(value);
        return dt.toLocaleString('en-IN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      } catch {
        return String(value);
      }

    case 'currency':
      if (!value && value !== 0) return '';
      return Number(value).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });

    case 'number':
      if (!value && value !== 0) return '';
      return String(Number(value));

    case 'boolean':
      return value ? 'Yes' : 'No';

    case 'array':
      if (Array.isArray(value)) return value.join(', ');
      return String(value || '');

    default:
      return String(value || '');
  }
}

/**
 * Escape a value for CSV (RFC 4180 compliant)
 * @param {string} val - The string value to escape
 * @returns {string} Escaped CSV value wrapped in double quotes
 */
function escapeCSV(val) {
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Convert an array of data objects to CSV string
 * 
 * @param {Array<Object>} data - Array of data objects (typically from .lean())
 * @param {Array<Object>} columns - Column definitions
 * @param {string} columns[].header - CSV column header text
 * @param {string} columns[].accessor - Dot-notation path to the value (e.g., 'beneficiary.name')
 * @param {string} [columns[].type] - Value type for formatting: 'date', 'datetime', 'currency', 'number', 'boolean', 'array'
 * @param {Function} [columns[].transform] - Optional custom transform function: (value, row) => string
 * @returns {string} CSV formatted string with headers and data rows
 * 
 * @example
 * const columns = [
 *   { header: 'Name', accessor: 'name' },
 *   { header: 'Amount', accessor: 'amount', type: 'currency' },
 *   { header: 'Date', accessor: 'createdAt', type: 'date' },
 *   { header: 'Status', accessor: 'status', transform: (val) => val?.toUpperCase() }
 * ];
 * const csv = convertToCSV(data, columns);
 */
function convertToCSV(data, columns) {
  if (!data || !data.length || !columns || !columns.length) {
    return '';
  }

  const headers = columns.map(col => escapeCSV(col.header));

  const rows = data.map(row => {
    return columns.map(col => {
      let value = getNestedValue(row, col.accessor);

      // Apply custom transform if provided
      if (col.transform && typeof col.transform === 'function') {
        value = col.transform(value, row);
      }

      // Format the value based on type
      const formatted = formatValue(value, col.type);
      return escapeCSV(formatted);
    }).join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

module.exports = {
  convertToCSV,
  getNestedValue,
  formatValue,
  escapeCSV
};
