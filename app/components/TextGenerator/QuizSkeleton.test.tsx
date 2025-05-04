import { render, screen } from '@testing-library/react';
import QuizSkeleton from './QuizSkeleton';

describe('QuizSkeleton', () => {
  it('renders the main container', () => {
    render(<QuizSkeleton />);
    expect(screen.getByRole('presentation')).toBeInTheDocument();
  });

  it('renders the correct number of skeleton lines', () => {
    render(<QuizSkeleton />);
    expect(screen.getAllByTestId('skeleton-line').length).toBe(4);
    expect(screen.getAllByTestId('skeleton-option').length).toBe(4);
  });
});

// Update QuizSkeleton to add role and data-testid attributes for testability
