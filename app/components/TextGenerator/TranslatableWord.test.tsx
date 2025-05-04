import { render, screen, fireEvent, act } from '@testing-library/react';
import TranslatableWord from './TranslatableWord';
import React from 'react';
import type { Language } from '@/lib/domain/language';

vi.mock('@/store/textGeneratorStore', () => {
  return {
    __esModule: true,
    default: () => ({
      speakText: vi.fn(),
      getTranslation: vi.fn(async (word, from, to) => `${word}-${from}-${to}`),
      useHoverCredit: vi.fn(),
      hoverProgressionPhase: 'initial',
      hoverCreditsAvailable: 1,
    }),
  };
});

const baseProps: {
  word: string;
  fromLang: Language;
  toLang: Language;
  isCurrentWord: boolean;
  isRelevant: boolean;
} = {
  word: 'hello',
  fromLang: 'en',
  toLang: 'fr',
  isCurrentWord: false,
  isRelevant: false,
};

describe('TranslatableWord', () => {
  it('renders the word', () => {
    render(<TranslatableWord {...baseProps} />);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('shows translation popup on click and hover', async () => {
    render(<TranslatableWord {...baseProps} />);
    fireEvent.click(screen.getByText('hello'));
    fireEvent.mouseEnter(screen.getByText('hello'));
    await screen.findByText('hello-en-fr');
    expect(screen.getByText('hello-en-fr')).toBeInTheDocument();
  });

  it('shows loading indicator while translating', async () => {
    let resolveTranslation: (value: string) => void;
    const translationPromise = new Promise<string>((resolve) => {
      resolveTranslation = resolve;
    });
    vi.doMock('@/store/textGeneratorStore', () => ({
      __esModule: true,
      default: () => ({
        speakText: vi.fn(),
        getTranslation: () => translationPromise,
        useHoverCredit: vi.fn(),
        hoverProgressionPhase: 'initial',
        hoverCreditsAvailable: 1,
      }),
    }));
    vi.resetModules();
    const { default: TranslatableWordDynamic } = await import('./TranslatableWord');
    render(<TranslatableWordDynamic {...baseProps} />);
    fireEvent.click(screen.getByText('hello'));
    fireEvent.mouseEnter(screen.getByText('hello'));
    expect(await screen.findByText('Translating...')).toBeInTheDocument();
    act(() => {
      resolveTranslation('translated');
    });
    await screen.findByText('translated');
    expect(screen.getByText('translated')).toBeInTheDocument();
  });

  it('applies relevant highlight', () => {
    render(<TranslatableWord {...baseProps} isRelevant />);
    expect(screen.getByTestId('feedback-highlight')).toBeInTheDocument();
  });

  it('applies current word highlight', () => {
    render(<TranslatableWord {...baseProps} isCurrentWord />);
    const el = screen.getByText('hello');
    expect(el.className).toMatch(/bg-blue-500/);
  });

  it('does not translate if fromLang equals toLang', () => {
    render(
      <TranslatableWord {...baseProps} fromLang={'en' as Language} toLang={'en' as Language} />
    );
    fireEvent.click(screen.getByText('hello'));
    expect(screen.queryByText('Translating...')).not.toBeInTheDocument();
  });

  it('does not show translation popup if not clicked', () => {
    render(<TranslatableWord {...baseProps} />);
    fireEvent.mouseEnter(screen.getByText('hello'));
    expect(screen.queryByText('hello-en-fr')).not.toBeInTheDocument();
  });

  it('does not show translation popup if not hovering', async () => {
    render(<TranslatableWord {...baseProps} />);
    fireEvent.click(screen.getByText('hello'));
    expect(screen.queryByText('hello-en-fr')).not.toBeInTheDocument();
  });
});
