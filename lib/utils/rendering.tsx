import React from 'react';

// Utility to render cell values
export const renderTableCellValue = (value: unknown): React.ReactNode => {
  if (value === null || value === undefined) {
    return <span className="text-gray-500 italic">NULL</span>;
  }
  if (typeof value === 'string') {
    return value.length > 100 ? `${value.substring(0, 100)}...` : value;
  }
  if (typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'object') {
    try {
      const stringified = JSON.stringify(value);
      return stringified.length > 100 ? `${stringified.substring(0, 100)}...` : stringified;
    } catch (_e) {
      return '[Object]'; // Handle potential stringification errors
    }
  }
  // Fallback for other types (e.g., functions, symbols) - should ideally not happen with JSON-like data
  return '[Unsupported Value]';
};
