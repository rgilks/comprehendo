'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { RowDetailView } from './components/RowDetailView';
import { TableSelector } from './components/TableSelector';
import { DataTable } from './components/DataTable';
import { useAdminTableData } from './hooks/useAdminTableData';

const AdminPage = () => {
  const { data: session, status } = useSession();
  const [selectedRowData, setSelectedRowData] = useState<Record<string, unknown> | null>(null);

  const {
    tableNames,
    selectedTable,
    tableData,
    currentPage,
    rowsPerPage,
    totalRows,
    totalPages,
    isLoadingTables,
    isLoadingData,
    error,
    selectAndFetchTable,
    refreshData,
    goToPreviousPage,
    goToNextPage,
  } = useAdminTableData(10);

  const handleBackFromDetail = useCallback(() => {
    setSelectedRowData(null);
  }, []);

  const handleTableSelectClick = useCallback(
    (tableName: string) => {
      setSelectedRowData(null);
      void selectAndFetchTable(tableName);
    },
    [selectAndFetchTable]
  );

  const handlePreviousPageClick = useCallback(() => {
    void goToPreviousPage();
  }, [goToPreviousPage]);

  const handleNextPageClick = useCallback(() => {
    void goToNextPage();
  }, [goToNextPage]);

  const handleRefreshClick = useCallback(() => {
    void refreshData();
  }, [refreshData]);

  const handleRowClick = useCallback((rowData: Record<string, unknown>) => {
    setSelectedRowData(rowData);
  }, []);

  const tableHeaders = tableData.length > 0 ? Object.keys(tableData[0]) : [];

  return (
    <div className="container mx-auto p-4">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-2">Comprehendo admin</h1>
        <div className="mb-4">
          <Link href="/" className="text-blue-600 hover:underline">
            &larr; Back to App
          </Link>
        </div>

        {status === 'loading' ? (
          <p>Loading authentication status...</p>
        ) : status === 'unauthenticated' || !session?.user ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <h2 className="font-bold">Unauthorized</h2>
            <p>You must be logged in to access the admin area.</p>
          </div>
        ) : !(session.user as { isAdmin?: boolean }).isAdmin ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <h2 className="font-bold">Unauthorized</h2>
            <p>You do not have admin permissions.</p>
          </div>
        ) : (
          <>
            {selectedRowData ? (
              <RowDetailView
                rowData={selectedRowData}
                tableName={selectedTable}
                onClose={handleBackFromDetail}
              />
            ) : (
              <>
                <TableSelector
                  tableNames={tableNames}
                  selectedTable={selectedTable}
                  onSelectTable={handleTableSelectClick}
                  isLoading={isLoadingTables}
                  error={!selectedTable ? error : null}
                />

                {selectedTable && (
                  <DataTable
                    tableName={selectedTable}
                    headers={tableHeaders}
                    data={tableData}
                    totalRows={totalRows}
                    currentPage={currentPage}
                    rowsPerPage={rowsPerPage}
                    totalPages={totalPages}
                    isLoading={isLoadingData}
                    error={selectedTable ? error : null}
                    onRowClick={handleRowClick}
                    onRefresh={handleRefreshClick}
                    onPreviousPage={handlePreviousPageClick}
                    onNextPage={handleNextPageClick}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminPage;
