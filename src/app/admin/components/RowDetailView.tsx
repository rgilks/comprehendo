import React from 'react';
import { FormattedValueDisplay } from './FormattedValueDisplay';

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
  const handleDelete = () => {
    if (onDelete) {
      onDelete();
    }
  };

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
                  <dd className="text-sm text-gray-900 break-words">
                    <FormattedValueDisplay valueKey={key} value={value} />
                  </dd>
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
