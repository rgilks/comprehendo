import React from 'react';
import {
  ArrowPathIcon as HeroRefreshIcon,
  ChevronLeftIcon as HeroChevronLeftIcon,
  ChevronRightIcon as HeroChevronRightIcon,
} from '@heroicons/react/24/solid';

const buttonBaseClass =
  'px-3 py-1.5 inline-flex items-center gap-2 border rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:ring-offset-gray-800';
const secondaryButtonClass = `${buttonBaseClass} text-gray-300 bg-gray-700 hover:bg-gray-600 focus:ring-indigo-500 border-gray-600 hover:border-gray-500`;
const refreshButtonClass = `${buttonBaseClass} text-white bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500 border-transparent`;

interface DataTableControlsProps {
  currentPage: number;
  totalPages: number;
  totalRows: number;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

export const DataTableControls: React.FC<DataTableControlsProps> = ({
  currentPage,
  totalPages,
  totalRows,
  isLoading,
  error,
  onRefresh,
  onPreviousPage,
  onNextPage,
}) => {
  const showControls = totalRows > 0 && !error;

  return (
    <div className="flex flex-wrap justify-between items-center gap-4 p-4 text-sm text-gray-300 min-h-[60px]">
      <div className="flex items-center gap-2">
        {showControls && currentPage === 1 && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className={refreshButtonClass}
            aria-label="Refresh data"
          >
            <HeroRefreshIcon
              className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>{isLoading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        )}
        {showControls && currentPage > 1 && (
          <button
            onClick={onPreviousPage}
            disabled={currentPage <= 1 || isLoading}
            className={secondaryButtonClass}
            aria-label="Previous page"
          >
            <HeroChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Previous</span>
          </button>
        )}
      </div>

      {showControls ? (
        <span className="text-gray-400 order-first sm:order-none w-full sm:w-auto text-center sm:text-left">
          Page {currentPage} of {totalPages} (Total: {totalRows} rows)
        </span>
      ) : (
        <div className="flex-grow sm:flex-grow-0"></div> // Placeholder to maintain structure when no controls
      )}

      <div className="flex items-center gap-2">
        {showControls && (
          <button
            onClick={onNextPage}
            disabled={currentPage >= totalPages || isLoading}
            className={secondaryButtonClass}
            aria-label="Next page"
          >
            <span className="hidden sm:inline">Next</span>
            <HeroChevronRightIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
};
