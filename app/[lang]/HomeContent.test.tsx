import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import HomeContent from './HomeContent';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: { [key: string]: string } = {
        subtitle: 'Mock Subtitle',
        powered_by: 'Mock Powered By',
        github: 'Mock GitHub',
      };
      return translations[key] || key;
    },
  }),
}));

vi.mock('@/components/LanguageSelector', () => ({
  default: () => <div data-testid="language-selector-mock">LanguageSelector</div>,
}));
vi.mock('@/components/AuthButton', () => ({
  default: () => <div data-testid="auth-button-mock">AuthButton</div>,
}));
vi.mock('@/components/TextGenerator', () => ({
  default: () => <div data-testid="text-generator-mock">TextGenerator</div>,
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('next/image', () => ({
  default: (props: any) => {
    return <img {...props} />;
  },
}));

describe('HomeContent Component', () => {
  it('renders the main title', () => {
    render(<HomeContent />);
    expect(screen.getByRole('heading', { name: /Comprehendo/i })).toBeInTheDocument();
  });

  it('renders the subtitle using mock translation', () => {
    render(<HomeContent />);
    expect(screen.getByText('Mock Subtitle')).toBeInTheDocument();
  });

  it('renders the mocked child components', () => {
    render(<HomeContent />);
    expect(screen.getByTestId('language-selector-mock')).toBeInTheDocument();
    expect(screen.getByTestId('auth-button-mock')).toBeInTheDocument();
    expect(screen.getByTestId('text-generator-mock')).toBeInTheDocument();
  });

  it('renders the footer with mock translations and link', () => {
    render(<HomeContent />);
    expect(screen.getByText(/Mock Powered By/i)).toBeInTheDocument();
    const githubLink = screen.getByRole('link', { name: /Mock GitHub/i });
    expect(githubLink).toBeInTheDocument();
    expect(githubLink).toHaveAttribute('href', 'https://github.com/rgilks/comprehendo');
  });

  it('renders the Ko-fi image link', () => {
    render(<HomeContent />);
    const kofiLink = screen.getByRole('link', { name: /Buy Me a Coffee at ko-fi.com/i });
    expect(kofiLink).toBeInTheDocument();
    expect(kofiLink).toHaveAttribute('href', 'https://ko-fi.com/N4N31DPNUS');
    const kofiImage = screen.getByAltText('Buy Me a Coffee at ko-fi.com');
    expect(kofiImage).toBeInTheDocument();
    expect(kofiImage).toHaveAttribute('src', 'https://storage.ko-fi.com/cdn/kofi2.png?v=6');
  });
});
