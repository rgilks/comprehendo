import React from 'react';
import { ChevronLeftIcon as HeroChevronLeftIcon } from '@heroicons/react/24/solid';

// Consolidate button styles - these might be shared or moved later
const buttonBaseClass =
  'px-4 py-2 inline-flex items-center gap-2 border border-transparent rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
const secondaryButtonClass = `${buttonBaseClass} text-gray-700 bg-gray-200 hover:bg-gray-300 focus:ring-indigo-500`;

interface RowDetailViewProps {
  rowData: Record<string, unknown>;
  onBack: () => void;
  tableName: string | null;
}

export const RowDetailView: React.FC<RowDetailViewProps> = ({ rowData, onBack, tableName }) => {
  const renderValue = (key: string, value: unknown) => {
    if (value === null || value === undefined) {
      return <span className="text-gray-500 italic">NULL</span>;
    }

    if (typeof value === 'boolean') {
      return value ? 'True' : 'False';
    }

    if (typeof value === 'string' && (key === 'created_at' || key === 'updated_at')) {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date.toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'medium',
          });
        }
      } catch (_e) {
        // Intentionally empty
      }
    }

    if (typeof value === 'string') {
      const trimmedValue = value.trim();
      if (
        (trimmedValue.startsWith('{') && trimmedValue.endsWith('}')) ||
        (trimmedValue.startsWith('[') && trimmedValue.endsWith(']'))
      ) {
        try {
          const parsedJson = JSON.parse(trimmedValue) as Record<string, unknown>;
          return (
            <pre className="bg-gray-100 p-2 rounded overflow-auto text-sm whitespace-pre-wrap break-words">
              {JSON.stringify(parsedJson, null, 2)}
            </pre>
          );
        } catch (_e) {
          // Intentionally empty
        }
      }
      return value;
    }

    if (typeof value === 'object') {
      return (
        <pre className="bg-gray-100 p-2 rounded overflow-auto text-sm whitespace-pre-wrap break-words">
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    }

    // Fallback for other types
    return '[Unsupported Value]';
  };

  return (
    <div>
      <button
        onClick={onBack}
        className={`${secondaryButtonClass} mb-4 px-3 py-1 sm:px-4 sm:py-2 flex items-center`}
      >
        <HeroChevronLeftIcon className="h-4 w-4 mr-1" aria-hidden="true" />
        Back to {tableName || 'Table'}
      </button>
      <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
        <dl>
          {Object.entries(rowData).map(([key, value], index) => (
            <div
              key={key}
              className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} px-4 py-3 sm:px-6`}
            >
              <dt className="text-sm font-medium text-gray-600 break-words mb-1">{key}</dt>
              <dd className="text-sm text-gray-900 break-words">{renderValue(key, value)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
};
