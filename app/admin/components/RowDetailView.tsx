import React from 'react';
import { FormattedValueDisplay } from './FormattedValueDisplay';
import { XMarkIcon } from '@heroicons/react/24/solid';

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
    <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-gray-800 text-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors z-10 p-1 rounded-full hover:bg-gray-700"
          aria-label="Close details"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>
        <h2 className="text-xl font-semibold p-4 border-b border-gray-700 flex-shrink-0">
          {tableName
            ? `${tableName.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())} Details`
            : 'Row Details'}
        </h2>
        <div className="p-4 overflow-y-auto flex-grow">
          <div className="bg-gray-700 shadow overflow-hidden sm:rounded-lg border border-gray-600">
            <dl>
              {Object.entries(rowData).map(([key, value], index) => (
                <div
                  key={key}
                  className={`${index % 2 === 0 ? 'bg-gray-750' : 'bg-gray-700'} px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 transition-colors block`}
                >
                  <dt className="text-sm font-medium text-gray-300 break-words mb-1 sm:mb-0">
                    {key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  </dt>
                  <dd className="text-sm text-gray-100 sm:col-span-2 break-words">
                    <FormattedValueDisplay valueKey={key} value={value} />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="p-4 border-t border-gray-700 flex flex-col sm:flex-row sm:justify-end gap-3 flex-shrink-0 bg-gray-800 rounded-b-lg">
          {onDelete && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-60 focus:ring-offset-gray-800 transition-colors"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
          {onUpdate && (
            <button
              onClick={() => {
                onUpdate(rowData);
              }}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60 focus:ring-offset-gray-800 transition-colors"
            >
              Update
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-gray-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
