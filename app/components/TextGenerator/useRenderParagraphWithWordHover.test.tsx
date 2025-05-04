import { render } from '@testing-library/react';
import React from 'react';
import useRenderParagraphWithWordHover from './useRenderParagraphWithWordHover';
import type { Language } from '@/lib/domain/language';

vi.mock('./TranslatableWord', () => ({
  __esModule: true,
  default: ({ word, fromLang, toLang, isCurrentWord, isRelevant }: any) => (
    <span
      data-testid="translatable-word"
      data-word={word}
      data-from={fromLang}
      data-to={toLang}
      data-current={isCurrentWord}
      data-relevant={isRelevant}
    >
      {word}
    </span>
  ),
}));

type Params = Parameters<typeof useRenderParagraphWithWordHover>[0];

const TestComponent = ({
  paragraph,
  lang = 'en',
  params,
}: {
  paragraph: string;
  lang?: Language;
  params?: Partial<Params>;
}) => {
  const defaultParams: Params = {
    currentWordIndex: null,
    isSpeakingPassage: false,
    relevantTextRange: null,
    actualQuestionLanguage: 'en',
  };
  const renderParagraph = useRenderParagraphWithWordHover({ ...defaultParams, ...params });
  return <div>{renderParagraph(paragraph, lang)}</div>;
};

describe('useRenderParagraphWithWordHover', () => {
  it('renders words and whitespace correctly', () => {
    const { getAllByTestId } = render(<TestComponent paragraph="Hello   world!" />);
    const words = getAllByTestId('translatable-word');
    expect(words).toHaveLength(2);
    expect(words[0]).toHaveAttribute('data-word', 'Hello');
    expect(words[1]).toHaveAttribute('data-word', 'world!');
  });

  it('passes language props to TranslatableWord', () => {
    const { getAllByTestId } = render(
      <TestComponent paragraph="Hi there" params={{ actualQuestionLanguage: 'fr' }} />
    );
    const words = getAllByTestId('translatable-word');
    expect(words[0]).toHaveAttribute('data-from', 'en');
    expect(words[0]).toHaveAttribute('data-to', 'fr');
  });

  it('highlights the current word when speaking', () => {
    const { getAllByTestId } = render(
      <TestComponent paragraph="A B C" params={{ currentWordIndex: 1, isSpeakingPassage: true }} />
    );
    const words = getAllByTestId('translatable-word');
    expect(words[1]).toHaveAttribute('data-current', 'true');
    expect(words[0]).toHaveAttribute('data-current', 'false');
    expect(words[2]).toHaveAttribute('data-current', 'false');
  });

  it('does not highlight current word if not speaking', () => {
    const { getAllByTestId } = render(
      <TestComponent paragraph="A B C" params={{ currentWordIndex: 1, isSpeakingPassage: false }} />
    );
    const words = getAllByTestId('translatable-word');
    words.forEach((w) => { expect(w).toHaveAttribute('data-current', 'false'); });
  });

  it('highlights relevant words in the range', () => {
    const { getAllByTestId } = render(
      <TestComponent paragraph="foo bar baz" params={{ relevantTextRange: { start: 4, end: 7 } }} />
    );
    const words = getAllByTestId('translatable-word');
    expect(words[1]).toHaveAttribute('data-relevant', 'true');
    expect(words[0]).toHaveAttribute('data-relevant', 'false');
    expect(words[2]).toHaveAttribute('data-relevant', 'false');
  });

  it('handles empty paragraph', () => {
    const { container } = render(<TestComponent paragraph="" />);
    expect(container.textContent).toBe('');
  });
});
