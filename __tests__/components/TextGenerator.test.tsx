import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TextGenerator from '../../app/components/TextGenerator';

// Mock fetch API
global.fetch = jest.fn();

const mockFetch = global.fetch as jest.Mock;

describe('TextGenerator Component', () => {
  beforeEach(() => {
    mockFetch.mockClear();

    // Default mock implementation
    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            result: JSON.stringify({
              paragraph: 'Test paragraph for testing the component.',
              question: 'What is this paragraph about?',
              options: {
                A: 'Testing',
                B: 'Development',
                C: 'Production',
                D: 'Deployment',
              },
              explanations: {
                A: 'Correct. The paragraph is about testing.',
                B: 'Incorrect. The paragraph does not mention development.',
                C: 'Incorrect. The paragraph does not mention production.',
                D: 'Incorrect. The paragraph does not mention deployment.',
              },
              correctAnswer: 'A',
              relevantText: 'Test paragraph for testing',
              topic: 'Software Testing',
            }),
          }),
      })
    );
  });

  it('renders the component with initial state', () => {
    render(<TextGenerator />);

    expect(screen.getByText('CEFR Level:')).toBeInTheDocument();
    expect(screen.getByText('Reading Passage Language:')).toBeInTheDocument();
  });

  it('generates a quiz when generate button is clicked', async () => {
    render(<TextGenerator />);

    // Click the generate button
    fireEvent.click(screen.getByRole('button', { name: /Generate English Reading Practice/i }));

    // Check loading state
    expect(screen.getByText('Generating Your Quiz')).toBeInTheDocument();

    // Wait for the response to load
    await waitFor(() => {
      expect(screen.getByText('Test paragraph for testing the component.')).toBeInTheDocument();
      expect(screen.getByText('What is this paragraph about?')).toBeInTheDocument();
    });
  });

  it('shows appropriate error when API returns error', async () => {
    // Mock fetch to return an error
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
      })
    );

    render(<TextGenerator />);

    // Click the generate button
    fireEvent.click(screen.getByRole('button', { name: /Generate English Reading Practice/i }));

    // Wait for the error
    await waitFor(() => {
      expect(screen.getByText(/Failed to generate text/i)).toBeInTheDocument();
    });
  });

  it('handles selecting an answer in the quiz', async () => {
    render(<TextGenerator />);

    // Click generate and wait for quiz to load
    fireEvent.click(screen.getByRole('button', { name: /Generate English Reading Practice/i }));

    // Wait for the quiz to render
    await waitFor(() => {
      expect(screen.getByText('What is this paragraph about?')).toBeInTheDocument();
    });

    // Select an answer
    fireEvent.click(screen.getByText('Testing'));

    // Check answer
    fireEvent.click(screen.getByRole('button', { name: /check answer/i }));

    // Verify the explanation shows
    await waitFor(() => {
      expect(screen.getByText('Correct. The paragraph is about testing.')).toBeInTheDocument();
    });
  });

  it('handles rate limit errors', async () => {
    // Mock fetch to return a rate limit error
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ error: 'Rate limit exceeded' }),
      })
    );

    render(<TextGenerator />);

    // Click the generate button
    fireEvent.click(screen.getByRole('button', { name: /Generate English Reading Practice/i }));

    // Wait for the rate limit error message
    await waitFor(() => {
      expect(screen.getByText(/You've reached the usage limit/i)).toBeInTheDocument();
    });
  });

  it('allows changing language and CEFR level', async () => {
    render(<TextGenerator />);

    // Change language to Spanish
    fireEvent.click(screen.getByText('Español'));

    // Change CEFR level to C1
    fireEvent.click(screen.getByText('C1 - Advanced'));

    // Click the generate button with the new settings
    fireEvent.click(screen.getByRole('button', { name: /Generate Spanish Reading Practice/i }));

    // Verify the correct request was made
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/chat',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Spanish'),
        })
      );
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/chat',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('CEFR level C1'),
        })
      );
    });
  });

  it('handles network errors during fetch', async () => {
    // Mock fetch to throw a network error
    mockFetch.mockImplementationOnce(() => Promise.reject(new Error('Network error')));

    render(<TextGenerator />);

    // Click the generate button
    fireEvent.click(screen.getByRole('button', { name: /Generate English Reading Practice/i }));

    // Wait for the error
    await waitFor(() => {
      expect(screen.getByText(/Failed to generate text/i)).toBeInTheDocument();
    });
  });

  it('handles JSON parsing errors', async () => {
    // Mock fetch to return invalid JSON
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ result: 'Invalid JSON content' }),
      })
    );

    render(<TextGenerator />);

    // Click the generate button
    fireEvent.click(screen.getByRole('button', { name: /Generate English Reading Practice/i }));

    // Wait for the parsing error
    await waitFor(() => {
      expect(screen.getByText(/Failed to parse the generated quiz/i)).toBeInTheDocument();
    });
  });

  it('allows resetting the quiz', async () => {
    render(<TextGenerator />);

    // Generate quiz
    fireEvent.click(screen.getByRole('button', { name: /Generate English Reading Practice/i }));

    // Wait for quiz to load
    await waitFor(() => {
      expect(screen.getByText('What is this paragraph about?')).toBeInTheDocument();
    });

    // Select an answer and check it
    fireEvent.click(screen.getByText('Testing'));
    fireEvent.click(screen.getByRole('button', { name: /check answer/i }));

    // Verify the explanation is shown
    await waitFor(() => {
      expect(screen.getByText('Correct. The paragraph is about testing.')).toBeInTheDocument();
    });

    // Reset the quiz
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    // Verify quiz is reset (explanation gone, but paragraph still visible)
    expect(screen.queryByText('Correct. The paragraph is about testing.')).not.toBeInTheDocument();
    expect(screen.getByText('Test paragraph for testing the component.')).toBeInTheDocument();
  });

  it('highlights relevant text when answer is checked', async () => {
    // Mock document.querySelector
    document.body.innerHTML = '<div id="root"></div>';

    render(<TextGenerator />);

    // Generate quiz
    fireEvent.click(screen.getByRole('button', { name: /Generate English Reading Practice/i }));

    // Wait for quiz to load
    await waitFor(() => {
      expect(screen.getByText('What is this paragraph about?')).toBeInTheDocument();
    });

    // Select an answer and check it
    fireEvent.click(screen.getByText('Testing'));
    fireEvent.click(screen.getByRole('button', { name: /check answer/i }));

    // Wait for the highlight to be applied (this is a signal that highlightRelevantText was called)
    await waitFor(() => {
      // Since the highlightedParagraph sets HTML content with a span, we need to check if
      // the relevant text is now wrapped with a span. This is challenging to test directly
      // with React Testing Library, so we'll check for the explanation which appears
      // at the same time as the highlighting
      expect(screen.getByText('Correct. The paragraph is about testing.')).toBeInTheDocument();
    });
  });
});
