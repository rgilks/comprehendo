import React from 'react';
import {
  ArrowPathIcon as HeroRefreshIcon,
  ChevronLeftIcon as HeroChevronLeftIcon,
  ChevronRightIcon as HeroChevronRightIcon,
} from '@heroicons/react/24/solid';

// Shared button styles
const buttonBaseClass =
  'px-4 py-2 inline-flex items-center gap-2 border border-transparent rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
const secondaryButtonClass = `${buttonBaseClass} text-gray-700 bg-gray-200 hover:bg-gray-300 focus:ring-indigo-500`;
const refreshButtonClass = `${buttonBaseClass} text-white bg-green-600 hover:bg-green-700 focus:ring-green-500`;

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
    <div className="flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-0 mb-4 text-sm min-h-[38px]">
      {currentPage === 1 && showControls ? (
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className={`${refreshButtonClass} px-3 py-1 sm:px-4 sm:py-2`}
          aria-label="Refresh data"
        >
          <HeroRefreshIcon className="h-4 w-4" aria-hidden="true" />
          <span>{isLoading ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      ) : (
        <button
          onClick={onPreviousPage}
          disabled={currentPage <= 1 || isLoading || !showControls}
          className={`${secondaryButtonClass} ${!showControls ? 'invisible' : ''}`}
          aria-label="Previous page"
        >
          <HeroChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      )}

      <span className={`text-gray-300 ${!showControls ? 'invisible' : ''}`}>
        Page {currentPage} of {totalPages} (Total: {totalRows} rows)
      </span>

      <button
        onClick={onNextPage}
        disabled={currentPage >= totalPages || isLoading || !showControls}
        className={`${secondaryButtonClass} ${!showControls ? 'invisible' : ''}`}
        aria-label="Next page"
      >
        <HeroChevronRightIcon className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
};
