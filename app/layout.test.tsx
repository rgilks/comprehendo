import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/font/google', () => ({
  Poppins: () => ({ className: 'mock-font' }),
}));

import RootLayout from './layout';

const Child = () => <div>child-content</div>;

describe('RootLayout', () => {
  it('renders children and providers', async () => {
    render(<RootLayout>{<Child />}</RootLayout>);
    expect(screen.getByText('child-content')).toBeInTheDocument();
  });
});
