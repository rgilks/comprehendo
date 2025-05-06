import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import RootLayout from './layout';

describe('RootLayout', () => {
  it('should render children', () => {
    render(
      <RootLayout>
        <div>Test Child</div>
      </RootLayout>
    );
    expect(screen.getByText('Test Child')).toBeInTheDocument();
  });
});
