import { render, screen, fireEvent } from '@testing-library/react';
import Error from './error';

describe('Error', () => {
  const error = { name: 'Error', message: 'Test error', stack: 'stack', digest: 'digest' };
  let reset: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    reset = vi.fn();
  });

  it('renders error message', () => {
    render(<Error error={error} reset={reset} />);
    expect(screen.getByText('Something went wrong!')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  it('calls reset on button click', () => {
    render(<Error error={error} reset={reset} />);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(reset).toHaveBeenCalled();
  });

  it('shows fallback message if error message is missing', () => {
    render(<Error error={{ ...error, message: '' }} reset={reset} />);
    expect(screen.getByText('An unexpected error occurred.')).toBeInTheDocument();
  });
});
