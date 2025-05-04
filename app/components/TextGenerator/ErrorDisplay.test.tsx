import React from 'react';
import { render, screen } from '@testing-library/react';
import ErrorDisplay from './ErrorDisplay';

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    useTranslation: () => ({ t: (key: string) => key }),
    initReactI18next: { type: '3rdParty', init: () => {} },
  };
});
vi.mock('@/store/textGeneratorStore');
import useTextGeneratorStore from '@/store/textGeneratorStore';

describe('ErrorDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing if there is no error', () => {
    (useTextGeneratorStore as any).mockReturnValue({ error: null });
    const { container } = render(<ErrorDisplay />);
    expect(container.firstChild).toBeNull();
  });

  it('renders error message when error is present', () => {
    (useTextGeneratorStore as any).mockReturnValue({ error: 'Something went wrong' });
    render(<ErrorDisplay />);
    const alert = screen.getByTestId('error-display');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('common.errorPrefix');
    expect(alert).toHaveTextContent('Something went wrong');
    expect(alert).toHaveAttribute('role', 'alert');
  });
});
