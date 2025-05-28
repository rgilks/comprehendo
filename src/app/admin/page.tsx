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
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 gap-4 sm:gap-0">
          <h1 className="text-3xl font-bold text-center sm:text-left">Comprehendo Admin</h1>
          <Link
            href="/"
            className="text-blue-400 hover:text-blue-300 hover:underline flex items-center justify-center sm:justify-start"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5 mr-2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Back to App
          </Link>
        </div>

        {status === 'loading' ? (
          <div className="flex justify-center items-center h-64">
            <p className="text-xl">Loading authentication status...</p>
          </div>
        ) : status === 'unauthenticated' || !session?.user ? (
          <div className="bg-red-700 border border-red-500 text-red-100 px-6 py-4 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-2">Unauthorized Access</h2>
            <p>You must be logged in to access the admin dashboard.</p>
          </div>
        ) : !(session.user as { isAdmin?: boolean }).isAdmin ? (
          <div className="bg-red-700 border border-red-500 text-red-100 px-6 py-4 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-2">Permission Denied</h2>
            <p>You do not have the necessary permissions to view this page.</p>
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
              <div className="flex flex-col gap-4">
                <TableSelector
                  tableNames={tableNames}
                  selectedTable={selectedTable}
                  onSelectTable={handleTableSelectClick}
                  isLoading={isLoadingTables}
                  error={!selectedTable ? error : null}
                />

                {selectedTable && (
                  <div className="bg-gray-800 shadow-xl rounded-lg">
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
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminPage;
