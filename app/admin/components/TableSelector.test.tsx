import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TableSelector } from './TableSelector';

describe('TableSelector', () => {
  const mockTableNames = ['users', 'products', 'orders'];
  const mockOnSelectTable = vi.fn();

  it('should render loading state', () => {
    render(
      <TableSelector
        tableNames={[]}
        selectedTable={null}
        onSelectTable={mockOnSelectTable}
        isLoading={true}
        error={null}
      />
    );
    expect(screen.getByText('Loading table names...')).toBeInTheDocument();
  });

  it('should render error state', () => {
    render(
      <TableSelector
        tableNames={[]}
        selectedTable={null}
        onSelectTable={mockOnSelectTable}
        isLoading={false}
        error="Failed to fetch"
      />
    );
    expect(screen.getByText('Error loading tables: Failed to fetch')).toBeInTheDocument();
  });

  it('should render no tables found message', () => {
    render(
      <TableSelector
        tableNames={[]}
        selectedTable={null}
        onSelectTable={mockOnSelectTable}
        isLoading={false}
        error={null}
      />
    );
    expect(screen.getByText('No tables found.')).toBeInTheDocument();
  });

  it('should render table name buttons', () => {
    render(
      <TableSelector
        tableNames={mockTableNames}
        selectedTable={null}
        onSelectTable={mockOnSelectTable}
        isLoading={false}
        error={null}
      />
    );
    mockTableNames.forEach((name) => {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    });
  });

  it('should apply correct styles to selected and unselected buttons', () => {
    const selected = mockTableNames[1]; // 'products'
    render(
      <TableSelector
        tableNames={mockTableNames}
        selectedTable={selected}
        onSelectTable={mockOnSelectTable}
        isLoading={false}
        error={null}
      />
    );

    const selectedButton = screen.getByRole('button', { name: selected });
    const unselectedButton = screen.getByRole('button', { name: mockTableNames[0] });

    expect(selectedButton.className).toContain('bg-blue-600'); // Unique part of primary class
    expect(unselectedButton.className).toContain('bg-gray-200'); // Unique part of secondary class
    expect(selectedButton.className).not.toContain('bg-gray-200');
    expect(unselectedButton.className).not.toContain('bg-blue-600');
  });

  it('should call onSelectTable when a button is clicked', () => {
    render(
      <TableSelector
        tableNames={mockTableNames}
        selectedTable={null}
        onSelectTable={mockOnSelectTable}
        isLoading={false}
        error={null}
      />
    );
    const buttonToClick = screen.getByRole('button', { name: mockTableNames[2] }); // 'orders'
    fireEvent.click(buttonToClick);
    expect(mockOnSelectTable).toHaveBeenCalledTimes(1);
    expect(mockOnSelectTable).toHaveBeenCalledWith(mockTableNames[2]);
  });
});
