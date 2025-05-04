import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import ReadingPassage from './ReadingPassage';
import * as LanguageContext from '@/contexts/LanguageContext';
import useTextGeneratorStore from '@/store/textGeneratorStore';
import React from 'react';

vi.mock('@/store/textGeneratorStore');
vi.mock('./AudioControls', () => ({ default: () => <div data-testid="audio-controls" /> }));

const mockUseLanguage = vi.spyOn(LanguageContext, 'useLanguage');
const mockSetLanguage = vi.fn();
const mockLanguages = {
  zh: 'Chinese',
  en: 'English',
  fil: 'Filipino',
  fr: 'French',
  de: 'German',
  el: 'Greek',
  he: 'Hebrew',
  hi: 'Hindi',
  it: 'Italian',
  ja: 'Japanese',
  ko: 'Korean',
  la: 'Latin',
  pl: 'Polish',
  pt: 'Portuguese',
  ru: 'Russian',
  es: 'Spanish',
  th: 'Thai',
};

const mockedStore = vi.mocked(useTextGeneratorStore);

describe('ReadingPassage', () => {
  beforeEach(() => {
    mockUseLanguage.mockReturnValue({
      language: 'en',
      setLanguage: mockSetLanguage,
      languages: mockLanguages,
    });
    mockedStore.mockReturnValue({
      quizData: {
        paragraph: 'Hello world.',
        question: 'What is this?',
        options: { A: 'A', B: 'B', C: 'C', D: 'D' },
        topic: 'Test',
        language: 'en',
      },
      showQuestionSection: true,
      currentWordIndex: 0,
      isSpeakingPassage: false,
      relevantTextRange: null,
      generatedPassageLanguage: 'en',
      hoverProgressionPhase: 'credits',
      hoverCreditsAvailable: 3,
    } as any);
  });

  it('renders passage title and text', () => {
    render(<ReadingPassage />);
    expect(screen.getByTestId('passage-title')).toBeInTheDocument();
    expect(screen.getByTestId('passage-text')).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.textContent === 'Hello')).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.textContent === 'world.')).toBeInTheDocument();
  });

  it('shows hover credits when in credits phase', () => {
    render(<ReadingPassage />);
    expect(screen.getByTestId('hover-credits-display')).toHaveTextContent('3');
  });

  it('renders audio controls', () => {
    render(<ReadingPassage />);
    expect(screen.getByTestId('audio-controls')).toBeInTheDocument();
  });

  it('shows question will appear message when showQuestionSection is false', () => {
    mockedStore.mockReturnValue({
      quizData: {
        paragraph: 'Hello world.',
        question: 'What is this?',
        options: { A: 'A', B: 'B', C: 'C', D: 'D' },
        topic: 'Test',
        language: 'en',
      },
      showQuestionSection: false,
      currentWordIndex: 0,
      isSpeakingPassage: false,
      relevantTextRange: null,
      generatedPassageLanguage: 'en',
      hoverProgressionPhase: 'credits',
      hoverCreditsAvailable: 3,
    } as any);
    render(<ReadingPassage />);
    expect(screen.getByText('practice.questionWillAppear')).toBeInTheDocument();
  });

  it('renders nothing if quizData or generatedPassageLanguage is missing', () => {
    mockedStore.mockReturnValue({
      quizData: null,
      generatedPassageLanguage: null,
    } as any);
    const { container } = render(<ReadingPassage />);
    expect(container).toBeEmptyDOMElement();
  });

  it('highlights relevant words when relevantTextRange is set', () => {
    mockedStore.mockReturnValue({
      quizData: {
        paragraph: 'Hello world.',
        question: 'What is this?',
        options: { A: 'A', B: 'B', C: 'C', D: 'D' },
        topic: 'Test',
        language: 'en',
      },
      showQuestionSection: true,
      currentWordIndex: 0,
      isSpeakingPassage: false,
      relevantTextRange: { start: 6, end: 11 },
      generatedPassageLanguage: 'en',
      hoverProgressionPhase: 'credits',
      hoverCreditsAvailable: 3,
    } as any);
    render(<ReadingPassage />);
    const highlights = screen.getAllByTestId('feedback-highlight');
    expect(highlights).toHaveLength(1);
    expect(highlights[0]).toHaveTextContent('world');
  });
});
