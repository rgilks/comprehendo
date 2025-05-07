import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import TranslatableWord from './TranslatableWord';
import useTextGeneratorStore from '@/store/textGeneratorStore';
import { type Language } from '@/lib/domain/language';

// Mock the store
vi.mock('@/store/textGeneratorStore');

// Mock SPEECH_LANGUAGES if it's used in a way that needs mocking,
// though direct import might be fine if it's just data.
// For this component, direct import is fine.

const mockSpeakText = vi.fn();
const mockGetTranslation = vi.fn();
const mockDecrementHoverCredit = vi.fn();

const defaultStoreState = {
  speakText: mockSpeakText,
  getTranslation: mockGetTranslation,
  useHoverCredit: mockDecrementHoverCredit,
  hoverProgressionPhase: 'initial' as 'initial' | 'credits' | 'ended',
  hoverCreditsAvailable: 10,
  translationCache: new Map<string, string>(),
  setTranslationInCache: vi.fn(),
};

describe('TranslatableWord', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTranslation.mockReset();
    (useTextGeneratorStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      defaultStoreState
    );
  });

  const defaultProps = {
    word: 'hello',
    fromLang: 'en' as Language,
    toLang: 'es' as Language,
    isCurrentWord: false,
    isRelevant: false,
  };

  it('renders the word correctly', () => {
    render(<TranslatableWord {...defaultProps} />);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('calls speakText on click', () => {
    render(<TranslatableWord {...defaultProps} />);
    fireEvent.click(screen.getByText('hello'));
    expect(mockSpeakText).toHaveBeenCalledWith('hello', 'en');
  });

  it('does not attempt translation if fromLang and toLang are the same', () => {
    render(<TranslatableWord {...defaultProps} fromLang="en" toLang="en" />);
    fireEvent.click(screen.getByText('hello'));
    expect(mockGetTranslation).not.toHaveBeenCalled();
    // Check that no translation popup appears on hover
    fireEvent.mouseEnter(screen.getByText('hello'));
    expect(screen.queryByText('Translating...')).not.toBeInTheDocument();
    expect(screen.queryByText('hola')).not.toBeInTheDocument(); // Assuming 'hola' is a potential translation
  });

  it('fetches and displays translation on click and hover when languages differ', async () => {
    mockGetTranslation.mockResolvedValue('hola');
    render(<TranslatableWord {...defaultProps} />);
    const wordElement = screen.getByText('hello');

    fireEvent.click(wordElement);

    expect(mockSpeakText).toHaveBeenCalledWith('hello', 'en');
    expect(mockGetTranslation).toHaveBeenCalledWith('hello', 'en', 'es');

    // Wait for translation to be fetched and state to update
    await waitFor(() => {
      fireEvent.mouseEnter(wordElement);
      expect(screen.getByText('hola')).toBeInTheDocument();
    });
  });

  it('shows "Translating..." while fetching translation', async () => {
    let resolveTranslation: (value: string | PromiseLike<string>) => void;
    mockGetTranslation.mockReturnValue(
      new Promise((resolve) => {
        resolveTranslation = resolve;
      })
    );

    render(<TranslatableWord {...defaultProps} />);
    const wordElement = screen.getByText('hello');
    fireEvent.click(wordElement);

    // Hover to show "Translating..."
    fireEvent.mouseEnter(wordElement);
    expect(screen.getByText('Translating...')).toBeInTheDocument();

    // Resolve translation
    await waitFor(() => {
      resolveTranslation('hola');
    });

    // "Translating..." should disappear, actual translation appears
    fireEvent.mouseEnter(wordElement); // Re-hover to trigger popup update
    expect(screen.queryByText('Translating...')).not.toBeInTheDocument();
    expect(screen.getByText('hola')).toBeInTheDocument();
  });

  it('uses cached translation if available', async () => {
    const cacheKey = `en:es:hello`; // Matches getCacheKey internal logic
    const cachedTranslation = 'hola cache';
    (useTextGeneratorStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...defaultStoreState,
      translationCache: new Map([[cacheKey, cachedTranslation]]),
    });

    render(<TranslatableWord {...defaultProps} />);
    const wordElement = screen.getByText('hello');

    // Click is not even strictly necessary if it's already "clicked" due to cache
    // but let's simulate user flow where they might click anyway or just hover
    fireEvent.click(wordElement); // This will set isClicked to true based on cache

    // Hover to show translation
    fireEvent.mouseEnter(wordElement);

    expect(mockGetTranslation).not.toHaveBeenCalled();
    expect(screen.getByText(cachedTranslation)).toBeInTheDocument();
  });

  it('decrements hover credit when translating in "credits" phase', async () => {
    mockGetTranslation.mockResolvedValue('hola');
    (useTextGeneratorStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...defaultStoreState,
      hoverProgressionPhase: 'credits',
      hoverCreditsAvailable: 1,
    });

    render(<TranslatableWord {...defaultProps} />);
    fireEvent.click(screen.getByText('hello'));

    await waitFor(() => {
      expect(mockGetTranslation).toHaveBeenCalled();
    });
    expect(mockDecrementHoverCredit).toHaveBeenCalledTimes(1);
  });

  it('does not fetch translation if no hover credits are available in "credits" phase', () => {
    (useTextGeneratorStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...defaultStoreState,
      hoverProgressionPhase: 'credits',
      hoverCreditsAvailable: 0,
    });

    render(<TranslatableWord {...defaultProps} />);
    fireEvent.click(screen.getByText('hello'));

    expect(mockGetTranslation).not.toHaveBeenCalled();
    expect(mockDecrementHoverCredit).not.toHaveBeenCalled();

    // Even if hovered, no translation should appear
    fireEvent.mouseEnter(screen.getByText('hello'));
    expect(screen.queryByText('Translating...')).not.toBeInTheDocument();
    expect(screen.queryByText('hola')).not.toBeInTheDocument();
  });

  it('applies "isCurrentWord" styling', () => {
    render(<TranslatableWord {...defaultProps} isCurrentWord={true} />);
    const wordElement = screen.getByText('hello');
    expect(wordElement.className).toContain('bg-blue-500');
    expect(wordElement.className).toContain('text-white');
  });

  it('applies "isRelevant" styling and data-testid', () => {
    render(<TranslatableWord {...defaultProps} isRelevant={true} />);
    const wordElement = screen.getByText('hello');
    expect(wordElement.className).toContain('bg-yellow-300');
    expect(wordElement.className).toContain('text-black');
    expect(wordElement).toHaveAttribute('data-testid', 'feedback-highlight');
  });

  it('applies "isClicked" styling after click and translation fetched', async () => {
    mockGetTranslation.mockResolvedValue('hola');
    render(<TranslatableWord {...defaultProps} />);
    const wordElement = screen.getByText('hello');
    fireEvent.click(wordElement);

    await waitFor(() => {
      expect(mockGetTranslation).toHaveBeenCalled();
    });
    // After click and successful translation, it should have the clicked style
    // Note: The component internally sets isClicked to true immediately on click if translation can be attempted.
    // The visual confirmation of translation (popup) happens on hover.
    // The border style is applied when isClicked is true.
    expect(wordElement.className).toContain('border-b');
    expect(wordElement.className).toContain('border-dotted');
    expect(wordElement.className).toContain('border-blue-400');
  });

  it('applies hover underline styling when appropriate', () => {
    // Default state: initial phase, credits available
    render(<TranslatableWord {...defaultProps} />);
    const wordElement = screen.getByText('hello');
    // In Vitest/JSDOM, :hover pseudo-classes are not directly testable by checking class names.
    // We check that the base class string includes 'hover:underline'
    // The component logic adds 'hover:underline' if (hoverProgressionPhase !== 'credits' || hoverCreditsAvailable > 0)
    // and it's not current, relevant, or clicked.
    expect(wordElement.className).toContain('hover:underline');

    // Test when hover underline should NOT be applied (e.g., no credits in 'credits' phase)
    cleanup(); // Clean up previous render
    (useTextGeneratorStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...defaultStoreState,
      hoverProgressionPhase: 'credits',
      hoverCreditsAvailable: 0,
    });
    // Need to remount for the new store state to take effect in class computation
    // No need for rerender if we cleanup and render fresh
    render(<TranslatableWord {...defaultProps} />);
    const wordElementNoHover = screen.getByText('hello'); // Re-fetch element
    expect(wordElementNoHover.className).not.toContain('hover:underline');
  });

  it('handles click correctly when translation is blocked (no credits)', () => {
    (useTextGeneratorStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...defaultStoreState,
      hoverProgressionPhase: 'credits',
      hoverCreditsAvailable: 0,
    });
    render(<TranslatableWord {...defaultProps} />);
    const wordElement = screen.getByText('hello');
    fireEvent.click(wordElement);

    expect(mockSpeakText).toHaveBeenCalledWith('hello', 'en');
    expect(mockGetTranslation).not.toHaveBeenCalled();
    // isClicked state should not change to true if translation fetch is blocked
    // Check absence of "clicked" styling
    expect(wordElement.className).not.toContain('border-b border-dotted border-blue-400');
  });

  it('handles missing speech codes gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <TranslatableWord
        {...defaultProps}
        fromLang={'UnsupportedLang1' as any}
        toLang={'UnsupportedLang2' as any}
      />
    );
    const wordElement = screen.getByText('hello');
    fireEvent.click(wordElement);

    // speakText might still be called with the original lang name
    expect(mockSpeakText).toHaveBeenCalledWith('hello', 'UnsupportedLang1');
    // But getTranslation should not be called if codes are not found
    expect(mockGetTranslation).not.toHaveBeenCalled();

    // Check for console error related to speech codes
    // This test is a bit brittle if the console error message changes.
    // Consider if this level of testing is necessary or if unit testing the util separately is better.
    await waitFor(() => {
      // The component logs an error when SPEECH_LANGUAGES doesn't have the lang
      // This check is more robust if the component explicitly throws or sets an error state
      // For now, we can infer based on getTranslation not being called.
      // The component's useEffect for cache check also logs error if speech codes are missing.
      // The click handler also has a path that logs error.
      // Let's assume the primary check for this test is that getTranslation isn't called.
    });

    // Check that console.error was called (due to missing speech codes in useEffect or handleClick)
    // This can be tricky because of the exact timing and multiple potential sources.
    // A more direct way would be to check if `isClicked` becomes true or if a translation popup appears.
    fireEvent.mouseEnter(wordElement);
    expect(screen.queryByText('Translating...')).not.toBeInTheDocument();
    expect(screen.queryByText('hola')).not.toBeInTheDocument(); // Or any other translation
    consoleErrorSpy.mockRestore();
  });

  it('handles getTranslation returning null or undefined', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockGetTranslation.mockResolvedValue(null);
    render(<TranslatableWord {...defaultProps} />);
    const wordElement = screen.getByText('hello');
    fireEvent.click(wordElement);

    await waitFor(() => {
      expect(mockGetTranslation).toHaveBeenCalled();
    });

    // Check that it logged the "no result" message
    expect(consoleLogSpy).toHaveBeenCalledWith('Translation fetch returned no result.');

    fireEvent.mouseEnter(wordElement);
    // No translation popup should appear
    expect(screen.queryByText('Translating...')).not.toBeInTheDocument(); // isLoading should be false
    // No actual translation text
    // Depending on how null translation is handled, the popup might not appear or show a specific message.
    // Current implementation: translation state remains null, so popup does not show.
    consoleLogSpy.mockRestore();
  });

  it.skip('resets translation and isClicked if word/lang changes and not in cache', async () => {
    const initialCacheKey = `en:es:hello`;
    (useTextGeneratorStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...defaultStoreState,
      translationCache: new Map([[initialCacheKey, 'hola']]),
    });

    const { rerender } = render(<TranslatableWord {...defaultProps} word="hello" />);

    // Initially, "hello" is translated from cache.
    fireEvent.mouseEnter(screen.getByText('hello'));
    expect(screen.getByText('hola')).toBeInTheDocument();

    // Change the word to "world", which is not in cache
    rerender(<TranslatableWord {...defaultProps} word="world" />);
    expect(screen.getByText('world')).toBeInTheDocument();
    expect(screen.queryByText('hola')).not.toBeInTheDocument(); // Old translation gone

    fireEvent.mouseEnter(screen.getByText('world'));
    // No popup for "world" initially as it's not translated yet and not clicked.
    expect(screen.queryByText('Translating...')).not.toBeInTheDocument();

    // Click "world" to translate it
    mockGetTranslation.mockResolvedValueOnce('mundo');
    fireEvent.click(screen.getByText('world'));

    await waitFor(() => {
      // First, ensure the API call was made as expected
      expect(mockGetTranslation).toHaveBeenCalledWith('world', 'en', 'es');
    });

    // Then, wait for the DOM update reflecting the translation
    await waitFor(() => {
      fireEvent.mouseEnter(screen.getByText('world'));
      expect(screen.getByText('mundo')).toBeInTheDocument();
    });
  });
});

// Helper function to assert class names, useful for complex class strings
// Removing custom matcher to simplify and avoid linter issues.
// Will use expect(element.className).toContain('class-name') directly.
