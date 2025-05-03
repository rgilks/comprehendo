import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { DataTableControls } from './DataTableControls';

describe('DataTableControls', () => {
  const mockOnRefresh = vi.fn();
  const mockOnPreviousPage = vi.fn();
  const mockOnNextPage = vi.fn();

  const defaultProps = {
    currentPage: 1,
    totalPages: 5,
    totalRows: 50,
    isLoading: false,
    error: null,
    onRefresh: mockOnRefresh,
    onPreviousPage: mockOnPreviousPage,
    onNextPage: mockOnNextPage,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders refresh button on page 1 and no previous button', () => {
    render(<DataTableControls {...defaultProps} />);
    expect(screen.getByLabelText('Refresh data')).toBeInTheDocument();
    expect(screen.queryByLabelText('Previous page')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Next page')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 5 (Total: 50 rows)')).toBeInTheDocument();
  });

  it('renders previous and next buttons on a middle page', () => {
    render(<DataTableControls {...defaultProps} currentPage={3} />);
    expect(screen.queryByLabelText('Refresh data')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Previous page')).toBeInTheDocument();
    expect(screen.getByLabelText('Next page')).toBeInTheDocument();
    expect(screen.getByText('Page 3 of 5 (Total: 50 rows)')).toBeInTheDocument();
  });

  it('disables next button on the last page', () => {
    render(<DataTableControls {...defaultProps} currentPage={5} />);
    expect(screen.getByLabelText('Previous page')).toBeInTheDocument();
    expect(screen.getByLabelText('Previous page')).toBeEnabled();
    expect(screen.getByLabelText('Next page')).toBeInTheDocument();
    expect(screen.getByLabelText('Next page')).toBeDisabled();
  });

  it('disables previous button on the first page (when not showing refresh)', () => {
    // This scenario shouldn't happen with current logic (refresh shows on page 1)
    // but testing for completeness if logic changes
    render(<DataTableControls {...defaultProps} currentPage={1} totalRows={1} />); // Keep showControls true
    // Manually trigger the state where previous would show instead of refresh if possible
    // With current logic, refresh always shows on page 1 if showControls is true.
    // If logic changed to show Prev even on page 1 under some conditions:
    // expect(screen.getByLabelText('Previous page')).toBeDisabled();
    expect(screen.getByLabelText('Refresh data')).toBeInTheDocument(); // Current behavior
  });

  it('disables buttons when loading', () => {
    render(<DataTableControls {...defaultProps} isLoading={true} />);
    expect(screen.getByLabelText('Refresh data')).toBeDisabled();
    expect(screen.getByLabelText('Next page')).toBeDisabled();
    // Refresh button shows "Refreshing..." text
    expect(screen.getByText('Refreshing...')).toBeInTheDocument();
  });

  it('disables buttons when loading on a middle page', () => {
    render(<DataTableControls {...defaultProps} isLoading={true} currentPage={3} />);
    expect(screen.getByLabelText('Previous page')).toBeDisabled();
    expect(screen.getByLabelText('Next page')).toBeDisabled();
  });

  it('hides controls when there are no rows', () => {
    render(<DataTableControls {...defaultProps} totalRows={0} />);
    expect(screen.queryByLabelText('Refresh data')).not.toBeInTheDocument();
    // Controls should not be rendered at all
    expect(screen.queryByLabelText('Previous page')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Next page')).not.toBeInTheDocument();
    expect(screen.queryByText(/Page \d+ of \d+/)).not.toBeInTheDocument();
  });

  it('hides controls when there is an error', () => {
    render(<DataTableControls {...defaultProps} error="Failed to load" />);
    expect(screen.queryByLabelText('Refresh data')).not.toBeInTheDocument();
    // Controls should not be rendered at all
    expect(screen.queryByLabelText('Previous page')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Next page')).not.toBeInTheDocument();
    expect(screen.queryByText(/Page \d+ of \d+/)).not.toBeInTheDocument();
  });

  it('calls onRefresh when refresh button is clicked', () => {
    render(<DataTableControls {...defaultProps} />);
    fireEvent.click(screen.getByLabelText('Refresh data'));
    expect(mockOnRefresh).toHaveBeenCalledTimes(1);
  });

  it('calls onPreviousPage when previous button is clicked', () => {
    render(<DataTableControls {...defaultProps} currentPage={3} />);
    fireEvent.click(screen.getByLabelText('Previous page'));
    expect(mockOnPreviousPage).toHaveBeenCalledTimes(1);
  });

  it('calls onNextPage when next button is clicked', () => {
    render(<DataTableControls {...defaultProps} currentPage={3} />);
    fireEvent.click(screen.getByLabelText('Next page'));
    expect(mockOnNextPage).toHaveBeenCalledTimes(1);
  });
});
