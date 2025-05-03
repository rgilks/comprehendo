import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataTableBody } from './DataTableBody';

// Mock the rendering utility as its implementation details are not relevant here
vi.mock('@/lib/utils/rendering', () => ({
  renderTableCellValue: (value: unknown) =>
    typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value),
}));

// Define a type for the mock data row
type MockDataRow = {
  id?: string; // Make id optional to match the data structure
  name: string;
  age: number;
  isActive: boolean;
};

describe('DataTableBody', () => {
  // Use keyof MockDataRow for headers, excluding 'id' if we don't want it as a header
  const mockHeaders: (keyof Omit<MockDataRow, 'id'>)[] = ['name', 'age', 'isActive'];
  const mockData: MockDataRow[] = [
    { id: '1', name: 'Alice', age: 30, isActive: true },
    { id: '2', name: 'Bob', age: 25, isActive: false },
    { name: 'Charlie', age: 35, isActive: true }, // No ID
  ];
  const mockOnRowClick = vi.fn();

  const defaultProps = {
    headers: mockHeaders,
    data: mockData,
    isLoading: false,
    minBodyHeight: 200,
    onRowClick: mockOnRowClick,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders headers correctly', () => {
    render(<DataTableBody {...defaultProps} />);
    mockHeaders.forEach((header) => {
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument();
    });
  });

  it('renders data rows and cells correctly', () => {
    render(<DataTableBody {...defaultProps} />);
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBe(mockData.length + 1); // +1 for header row

    // Check Alice's row (id: 1)
    const aliceRow = rows[1]; // First data row
    expect(within(aliceRow).getByRole('cell', { name: 'Alice' })).toBeInTheDocument();
    expect(within(aliceRow).getByRole('cell', { name: '30' })).toBeInTheDocument();
    expect(within(aliceRow).getByRole('cell', { name: 'Yes' })).toBeInTheDocument();

    // Check Bob's row (id: 2)
    const bobRow = rows[2]; // Second data row
    expect(within(bobRow).getByRole('cell', { name: 'Bob' })).toBeInTheDocument();
    expect(within(bobRow).getByRole('cell', { name: '25' })).toBeInTheDocument();
    expect(within(bobRow).getByRole('cell', { name: 'No' })).toBeInTheDocument();

    // Check Charlie's row (no id, index: 2)
    const charlieRow = rows[3]; // Third data row
    expect(within(charlieRow).getByRole('cell', { name: 'Charlie' })).toBeInTheDocument();
    expect(within(charlieRow).getByRole('cell', { name: '35' })).toBeInTheDocument();
    expect(within(charlieRow).getByRole('cell', { name: 'Yes' })).toBeInTheDocument();
  });

  it('renders "No data found" when data array is empty', () => {
    render(<DataTableBody {...defaultProps} data={[]} />);
    expect(screen.getByText('No data found in this table.')).toBeInTheDocument();
    expect(screen.getAllByRole('row').length).toBe(2); // Header + message row
  });

  it('applies loading styles when isLoading is true', () => {
    const { container } = render(<DataTableBody {...defaultProps} isLoading />);
    const wrapperDiv = container.firstChild as HTMLElement;
    expect(wrapperDiv).toHaveClass('opacity-60');
    expect(screen.queryByText('No data found in this table.')).not.toBeInTheDocument();
  });

  it('calls onRowClick with correct row data when a row is clicked', () => {
    render(<DataTableBody {...defaultProps} />);
    const aliceRow = screen.getByRole('cell', { name: 'Alice' }).closest('tr');
    if (aliceRow) {
      fireEvent.click(aliceRow);
      expect(mockOnRowClick).toHaveBeenCalledTimes(1);
      expect(mockOnRowClick).toHaveBeenCalledWith(mockData[0]);
    } else {
      throw new Error('Row for Alice not found');
    }
  });

  it('uses index as key when id is not present', () => {
    render(<DataTableBody {...defaultProps} />);
    // Hard to test exact key value in RTL, but ensure component renders without key warnings/errors
    // Check if Charlie's row (which lacks an id) is rendered
    expect(screen.getByRole('cell', { name: 'Charlie' })).toBeInTheDocument();
  });

  it('renders a single header cell with non-breaking space when headers are empty', () => {
    render(<DataTableBody {...defaultProps} headers={[]} data={mockData} />);
    const headers = screen.getAllByRole('columnheader');
    expect(headers.length).toBe(1);
    expect(headers[0]).toContainHTML('&nbsp;');

    // Ensure data cells still render correctly under the single implied column
    expect(screen.queryByRole('cell')).not.toBeInTheDocument(); // Cells shouldn't render if no headers match
  });

  it('renders correctly when both headers and data are empty', () => {
    render(<DataTableBody {...defaultProps} headers={[]} data={[]} />);
    const headers = screen.getAllByRole('columnheader');
    expect(headers.length).toBe(1);
    expect(headers[0]).toContainHTML('&nbsp;');
    expect(screen.getByText('No data found in this table.')).toBeInTheDocument();
    expect(screen.getAllByRole('row').length).toBe(2); // Header + message row
  });
});
