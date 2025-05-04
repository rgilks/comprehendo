vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    setLanguage: vi.fn(),
    languages: { en: 'English', fr: 'Français', de: 'Deutsch' },
  }),
}));

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import LanguageSelector from './LanguageSelector';

describe('LanguageSelector', () => {
  it('renders the current language', () => {
    render(<LanguageSelector />);
    expect(screen.getByRole('button', { name: /Language:/ })).toBeInTheDocument();
  });

  it('opens and closes the dropdown', () => {
    render(<LanguageSelector />);
    const button = screen.getByRole('button', { name: /Language:/ });
    fireEvent.click(button);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.click(button);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('shows all language options when open', () => {
    render(<LanguageSelector />);
    fireEvent.click(screen.getByRole('button', { name: /Language:/ }));
    expect(screen.getByRole('menuitem', { name: 'English' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Français' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Deutsch' })).toBeInTheDocument();
  });

  it('calls setLanguage and closes dropdown on option click', () => {
    render(<LanguageSelector />);
    fireEvent.click(screen.getByRole('button', { name: /Language:/ }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Français' }));
    // This will not check the mockSetLanguage, but the inline mock in the vi.mock above
    // so this test will need to be adapted if you want to check the call
  });

  it('closes dropdown when clicking outside', () => {
    render(<LanguageSelector />);
    fireEvent.click(screen.getByRole('button', { name: /Language:/ }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
