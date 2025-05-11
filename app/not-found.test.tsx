import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import NotFound from './not-found';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('NotFound component', () => {
  it('renders the 404 heading', () => {
    render(<NotFound />);
    expect(screen.getByRole('heading', { name: /404 - Page Not Found/i })).toBeInTheDocument();
  });

  it('renders the descriptive paragraph', () => {
    render(<NotFound />);
    expect(
      screen.getByText(/Oops! The page you are looking for does not exist./i)
    ).toBeInTheDocument();
  });

  it('renders the link to the homepage', () => {
    render(<NotFound />);
    const homeLink = screen.getByRole('link', { name: /Go back to Home/i });
    expect(homeLink).toBeInTheDocument();
    expect(homeLink).toHaveAttribute('href', '/');
  });
});
