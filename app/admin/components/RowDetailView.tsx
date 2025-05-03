import React from 'react';

// Consolidate button styles - these might be shared or moved later

interface RowDetailViewProps {
  rowData: Record<string, unknown>;
  tableName: string | null;
  onDelete?: () => void;
  onUpdate?: (row: Record<string, unknown>) => void;
  isDeleting?: boolean;
  onClose: () => void;
}

export const RowDetailView: React.FC<RowDetailViewProps> = ({
  rowData,
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

  // Render only the modal
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl z-10"
          aria-label="Close details"
        >
          &times;
        </button>
        <h2 className="text-xl font-semibold p-4 border-b flex-shrink-0">
          {tableName ? `${tableName} Details` : 'Row Details'}
        </h2>
        <div className="p-4 overflow-y-auto flex-grow">
          {/* Render the formatted list inside the modal body */}
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
        {/* Footer with action buttons */}
        <div className="p-4 border-t flex justify-end space-x-2 flex-shrink-0">
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
              onClick={() => {
                onUpdate(rowData);
              }}
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
  );
};
