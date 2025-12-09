
export const buttonBaseClass =
  'px-4 py-3 sm:px-4 sm:py-2 inline-flex items-center justify-center text-center gap-2 border rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors';
export const primaryButtonClass = `${buttonBaseClass} text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500 border-transparent`;
export const secondaryButtonClass = `${buttonBaseClass} text-gray-300 bg-gray-700 hover:bg-gray-600 focus:ring-indigo-500 border-gray-600 hover:border-gray-500`;
interface TableSelectorProps {
  tableNames: string[];
  selectedTable: string | null;
  onSelectTable: (tableName: string) => void;
  isLoading: boolean;
  error: string | null;
}

export const TableSelector: React.FC<TableSelectorProps> = ({
  tableNames,
  selectedTable,
  onSelectTable,
  isLoading,
  error,
}) => {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-20">
        <p className="text-lg">Loading table names...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-700 border border-red-500 text-red-100 px-6 py-4 rounded-lg shadow-md">
        <p>Error loading tables: {error}</p>
      </div>
    );
  }

  if (tableNames.length === 0) {
    return (
      <div className="flex justify-center items-center h-20">
        <p className="text-lg">No tables found.</p>
      </div>
    );
  }

  return (
    <div className="p-3 bg-gray-800 shadow-lg rounded-lg">
      <div
        className="flex flex-wrap justify-center sm:justify-start gap-3 py-2"
        role="group"
        aria-label="Table selection"
      >
        {tableNames.map((name) => (
          <button
            key={name}
            onClick={() => {
              onSelectTable(name);
            }}
            className={selectedTable === name ? primaryButtonClass : secondaryButtonClass}
            aria-pressed={selectedTable === name}
          >
            {name.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
          </button>
        ))}
      </div>
    </div>
  );
};
