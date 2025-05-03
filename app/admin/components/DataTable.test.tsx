import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataTable } from './DataTable';

// Mock child components to isolate DataTable logic
vi.mock('./DataTableControls', () => ({
  DataTableControls: vi.fn(() => <div data-testid="data-table-controls">Controls</div>),
}));
vi.mock('./DataTableBody', () => ({
  DataTableBody: vi.fn(({ onRowClick, data, headers }) => (
    <div data-testid="data-table-body">
      Body
      <table>
        <tbody>
          {data.map((item: any, index: number) => (
            <tr key={index} onClick={() => onRowClick(item)} data-testid={`row-${index}`}>
              {headers.map((header: any) => (
                <td key={header}>{item[header] as React.ReactNode}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )),
}));

interface MockData {
  id: number;
  name: string;
  value: number;
}

const mockData: MockData[] = [
  { id: 1, name: 'Item 1', value: 100 },
  { id: 2, name: 'Item 2', value: 200 },
];

const mockHeaders: (keyof MockData)[] = ['id', 'name', 'value'];

const defaultProps = {
  tableName: 'TestTable',
  headers: mockHeaders,
  data: mockData,
  totalRows: mockData.length,
  currentPage: 1,
  rowsPerPage: 10,
  totalPages: 1,
  isLoading: false,
  error: null,
  onRowClick: vi.fn(),
  onRefresh: vi.fn(),
  onPreviousPage: vi.fn(),
  onNextPage: vi.fn(),
};

describe('DataTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders controls and body when not loading and no error', () => {
    render(<DataTable {...defaultProps} />);
    expect(screen.getByTestId('data-table-controls')).toBeInTheDocument();
    expect(screen.getByTestId('data-table-body')).toBeInTheDocument();
    expect(screen.queryByText(/Error loading data/)).not.toBeInTheDocument();
  });

  it('renders error message when error occurs', () => {
    const errorMessage = 'Failed to fetch';
    render(<DataTable {...defaultProps} error={errorMessage} />);
    expect(
      screen.getByText(`Error loading data for ${defaultProps.tableName}: ${errorMessage}`)
    ).toBeInTheDocument();
    expect(screen.queryByTestId('data-table-body')).not.toBeInTheDocument(); // Body should not render on error
    expect(screen.getByTestId('data-table-controls')).toBeInTheDocument(); // Controls might still render or show error state
  });

  it('passes correct props to DataTableControls', async () => {
    const { DataTableControls } = vi.mocked(await import('./DataTableControls'));
    const isLoading = true;
    render(<DataTable {...defaultProps} isLoading={isLoading} />);

    expect(DataTableControls).toHaveBeenCalledTimes(1);
    const actualProps = vi.mocked(DataTableControls).mock.calls[0][0];
    expect(actualProps).toEqual(
      expect.objectContaining({
        currentPage: defaultProps.currentPage,
        totalPages: defaultProps.totalPages,
        totalRows: defaultProps.totalRows,
        isLoading: isLoading, // Use the specific value passed
        error: defaultProps.error,
        onRefresh: defaultProps.onRefresh,
        onPreviousPage: defaultProps.onPreviousPage,
        onNextPage: defaultProps.onNextPage,
      })
    );
  });

  it('passes correct props to DataTableBody', async () => {
    const { DataTableBody } = vi.mocked(await import('./DataTableBody'));
    const estimatedRowHeight = 41;
    render(<DataTable {...defaultProps} />);

    expect(DataTableBody).toHaveBeenCalledTimes(1);
    const actualProps = vi.mocked(DataTableBody).mock.calls[0][0];
    expect(actualProps).toEqual(
      expect.objectContaining({
        headers: defaultProps.headers,
        data: defaultProps.data,
        isLoading: defaultProps.isLoading,
        minBodyHeight: defaultProps.rowsPerPage * estimatedRowHeight,
        onRowClick: defaultProps.onRowClick,
      })
    );
  });

  it('calls onRowClick when a row is clicked in DataTableBody', async () => {
    const { DataTableBody } = vi.mocked(await import('./DataTableBody'));
    const mockOnRowClick = vi.fn();

    // Reset mock before each call if needed, or ensure clean state
    DataTableBody.mockImplementation(({ onRowClick: passedOnRowClick, data, headers }) => (
      <div data-testid="data-table-body">
        <table>
          <tbody>
            {data.map((item: any, index: number) => (
              <tr
                key={index}
                onClick={() => {
                  passedOnRowClick(item);
                }}
                data-testid={`row-${index}`}
              >
                {headers.map((header: any) => (
                  <td key={header}>{item[header] as React.ReactNode}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ));

    render(<DataTable {...defaultProps} onRowClick={mockOnRowClick} />);

    // Simulate the click within the mocked component structure
    const firstRow = await screen.findByTestId('row-0');
    fireEvent.click(firstRow);

    expect(mockOnRowClick).toHaveBeenCalledTimes(1);
    expect(mockOnRowClick).toHaveBeenCalledWith(mockData[0]);
  });

  it('calculates minBodyHeight correctly', async () => {
    const { DataTableBody } = vi.mocked(await import('./DataTableBody'));
    const rowsPerPage = 5;
    const estimatedRowHeight = 41; // Match the component's internal value
    render(<DataTable {...defaultProps} rowsPerPage={rowsPerPage} />);

    expect(DataTableBody).toHaveBeenCalledTimes(1);
    const actualProps = vi.mocked(DataTableBody).mock.calls[0][0];
    expect(actualProps.minBodyHeight).toBe(rowsPerPage * estimatedRowHeight);
  });
});
