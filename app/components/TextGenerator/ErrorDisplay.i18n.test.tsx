import React from 'react';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    useTranslation: () => ({ t: (key: string) => (key === 'common.errorPrefix' ? 'Error:' : key) }),
    initReactI18next: { type: '3rdParty', init: () => {} },
  };
});
vi.mock('@/store/textGeneratorStore');
import useTextGeneratorStore from '@/store/textGeneratorStore';
import ErrorDisplay from './ErrorDisplay';

describe('ErrorDisplay (i18n)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with translated prefix', () => {
    (useTextGeneratorStore as any).mockReturnValue({ error: 'Translated error' });
    render(<ErrorDisplay />);
    expect(screen.getByTestId('error-display')).toHaveTextContent('Error:');
    expect(screen.getByTestId('error-display')).toHaveTextContent('Translated error');
  });
});
