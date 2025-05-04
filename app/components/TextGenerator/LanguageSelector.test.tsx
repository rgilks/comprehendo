import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { LEARNING_LANGUAGES } from '@/lib/domain/language';

const mockSetPassageLanguage = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/store/textGeneratorStore', () => {
  let isProgressLoading = false;
  const store = () => ({
    passageLanguage: 'en',
    cefrLevel: 'B1',
    setPassageLanguage: mockSetPassageLanguage,
    get isProgressLoading() {
      return isProgressLoading;
    },
  });
  store.setLoading = (val: boolean) => {
    isProgressLoading = val;
  };
  return {
    __esModule: true,
    default: store,
  };
});

import LanguageSelector from './LanguageSelector';

describe('LanguageSelector', () => {
  beforeEach(async () => {
    mockSetPassageLanguage.mockClear();
    const storeModule = await import('@/store/textGeneratorStore');
    (storeModule.default as any).setLoading?.(false);
  });

  it('renders language options', () => {
    render(<LanguageSelector />);
    const select = screen.getByTestId('language-select');
    Object.keys(LEARNING_LANGUAGES).forEach((lang) => {
      expect(
        screen.getByRole('option', { name: `languages.learning.${lang}` })
      ).toBeInTheDocument();
    });
    expect(select).toHaveValue('en');
  });

  it('calls setPassageLanguage on change', () => {
    render(<LanguageSelector />);
    const select = screen.getByTestId('language-select');
    fireEvent.change(select, { target: { value: 'fr' } });
    expect(mockSetPassageLanguage).toHaveBeenCalledWith('fr');
  });

  it('displays CEFR level and label', () => {
    render(<LanguageSelector />);
    expect(screen.getByTestId('level-display')).toHaveTextContent('B1');
    expect(screen.getByText('practice.cefr.levels.B1.name')).toBeInTheDocument();
  });

  it('shows loading indicator when isProgressLoading is true', async () => {
    const storeModule = await import('@/store/textGeneratorStore');
    (storeModule.default as any).setLoading?.(true);
    const { default: ReloadedLanguageSelector } = await import('./LanguageSelector');
    render(<ReloadedLanguageSelector />);
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    (storeModule.default as any).setLoading?.(false);
  });
});
