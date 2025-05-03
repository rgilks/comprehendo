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
  onDelete?: () => void;
  onUpdate?: (row: Record<string, unknown>) => void;
  isDeleting?: boolean;
  onClose: () => void;
}

export const RowDetailView: React.FC<RowDetailViewProps> = ({
  rowData,
  onBack,
  tableName,
  onDelete,
  onUpdate,
  isDeleting,
  onClose,
}) => {
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
      } catch {
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
        } catch {
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

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
    }
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
      <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto relative">
          <button
            onClick={onClose}
            className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl"
          >
            &times;
          </button>
          <h2 className="text-xl font-semibold p-4 border-b">Row Details</h2>
          <div className="p-4">
            <pre className="bg-gray-100 p-3 rounded text-sm overflow-x-auto">
              {JSON.stringify(rowData, null, 2)}
            </pre>
          </div>
          <div className="p-4 border-t flex justify-end space-x-2">
            {onDelete && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            )}
            {onUpdate && (
              <button
                onClick={() => { onUpdate(rowData); }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              >
                Update
              </button>
            )}
            <button
              onClick={onClose}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
