import { render, screen } from '@testing-library/react';
import HomeContent from './page';

vi.mock('@/components/TextGenerator', () => ({
  __esModule: true,
  default: () => <div>TextGenerator</div>,
}));
vi.mock('@/components/AuthButton', () => ({
  __esModule: true,
  default: () => <button>AuthButton</button>,
}));
vi.mock('@/components/LanguageSelector', () => ({
  __esModule: true,
  default: () => <div>LanguageSelector</div>,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

describe('HomeContent', () => {
  it('renders heading, subtitle, AuthButton, LanguageSelector, TextGenerator, and GitHub link', () => {
    render(<HomeContent />);
    expect(screen.getByText('Comprehendo')).toBeInTheDocument();
    expect(screen.getByText('subtitle')).toBeInTheDocument();
    expect(screen.getByText('AuthButton')).toBeInTheDocument();
    expect(screen.getByText('LanguageSelector')).toBeInTheDocument();
    expect(screen.getByText('TextGenerator')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'github' })).toHaveAttribute(
      'href',
      'https://github.com/rgilks/comprehendo'
    );
  });
});
