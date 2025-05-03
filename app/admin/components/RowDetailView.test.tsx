import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RowDetailView } from './RowDetailView';

describe('RowDetailView', () => {
  const mockRowData = {
    id: 1,
    name: 'Test Item',
    value: 100,
    isActive: true,
    nested: { key: 'value' },
    list: [1, 2, 3],
    nullValue: null,
    undefinedValue: undefined,
  };
  const mockOnClose = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnUpdate = vi.fn();

  it('renders with minimal props and displays row data', () => {
    render(<RowDetailView rowData={mockRowData} onClose={mockOnClose} tableName={null} />);

    expect(screen.getByText('Row Details')).toBeInTheDocument();

    Object.entries(mockRowData).forEach(([key, value]) => {
      expect(screen.getByText(key)).toBeInTheDocument();
      // Check for value presence; specific rendering is handled by FormattedValueDisplay
      if (value !== null && value !== undefined) {
        // Basic check, might need refinement for complex types
      }
    });

    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Update' })).not.toBeInTheDocument();
  });

  it('displays the table name in the title when provided', () => {
    render(<RowDetailView rowData={mockRowData} onClose={mockOnClose} tableName="TestTable" />);
    expect(screen.getByText('TestTable Details')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', () => {
    render(<RowDetailView rowData={mockRowData} onClose={mockOnClose} tableName="TestTable" />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('renders Delete button and calls onDelete when clicked', () => {
    render(
      <RowDetailView
        rowData={mockRowData}
        onClose={mockOnClose}
        tableName="TestTable"
        onDelete={mockOnDelete}
      />
    );
    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    expect(deleteButton).toBeInTheDocument();
    fireEvent.click(deleteButton);
    expect(mockOnDelete).toHaveBeenCalledTimes(1);
  });

  it('disables Delete button when isDeleting is true', () => {
    render(
      <RowDetailView
        rowData={mockRowData}
        onClose={mockOnClose}
        tableName="TestTable"
        onDelete={mockOnDelete}
        isDeleting={true}
      />
    );
    const deleteButton = screen.getByRole('button', { name: 'Deleting...' });
    expect(deleteButton).toBeDisabled();
  });

  it('renders Update button and calls onUpdate with rowData when clicked', () => {
    render(
      <RowDetailView
        rowData={mockRowData}
        onClose={mockOnClose}
        tableName="TestTable"
        onUpdate={mockOnUpdate}
      />
    );
    const updateButton = screen.getByRole('button', { name: 'Update' });
    expect(updateButton).toBeInTheDocument();
    fireEvent.click(updateButton);
    expect(mockOnUpdate).toHaveBeenCalledTimes(1);
    expect(mockOnUpdate).toHaveBeenCalledWith(mockRowData);
  });
});
