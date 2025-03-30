// TextGenerator component - Provides reading comprehension quiz functionality with formatting
'use client';

import React, { useState, useEffect, useCallback } from 'react';
// Removed import for HighlightedParagraph and constants
// import {
//   CEFR_LEVELS,
//   CEFR_DESCRIPTIONS,
//   LANGUAGES,
// } from '../../lib/constants';
// import { HighlightedParagraph } from './HighlightedParagraph';
import { z } from 'zod';

// Define Zod schema for QuizData
const quizDataSchema = z.object({
  paragraph: z.string(),
  question: z.string(),
  options: z.object({
    A: z.string(),
    B: z.string(),
    C: z.string(),
    D: z.string(),
  }),
  explanations: z.object({
    A: z.string(),
    B: z.string(),
    C: z.string(),
    D: z.string(),
  }),
  correctAnswer: z.string(),
  relevantText: z.string(),
  topic: z.string(),
});

// Infer QuizData type from the schema
type QuizData = z.infer<typeof quizDataSchema>;

// Define Zod schema for the API response
const apiResponseSchema = z.object({
  result: z.string().optional(),
  error: z.string().optional(),
});

// Type definitions
type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
type Language = 'English' | 'Italian' | 'Spanish' | 'French' | 'German';

// Define constants directly in the component
const CEFR_LEVELS: Record<CEFRLevel, string> = {
  A1: 'Beginner',
  A2: 'Elementary',
  B1: 'Intermediate',
  B2: 'Upper Intermediate',
  C1: 'Advanced',
  C2: 'Proficiency',
};

const CEFR_DESCRIPTIONS: Record<CEFRLevel, string> = {
  A1: 'Basic phrases, simple questions',
  A2: 'Familiar topics, simple sentences',
  B1: 'Routine matters, basic opinions',
  B2: 'Technical discussions, clear viewpoints',
  C1: 'Complex topics, spontaneous expression',
  C2: 'Virtually everything, nuanced expression',
};

const LANGUAGES: Record<Language, string> = {
  English: 'English',
  Italian: 'Italiano',
  Spanish: 'Español',
  French: 'Français',
  German: 'Deutsch',
};

export default function TextGenerator() {
  const [cefrLevel, setCefrLevel] = useState<CEFRLevel>('B1');
  const [language, setLanguage] = useState<Language>('English');
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [highlightedParagraph, setHighlightedParagraph] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);

  useEffect(() => {
    // Initial text generation
    generateText().catch((error) => {
      console.error('Error during initial text generation:', error);
      setError('Failed to load initial content.');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  const highlightRelevantText = useCallback(() => {
    if (quizData && isAnswered && selectedAnswer === quizData.correctAnswer) {
      try {
        const escapedText = quizData.relevantText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedText})`, 'gi');
        // Use dangerouslySetInnerHTML for highlighting, ensuring proper handling
        const highlighted = quizData.paragraph.replace(
          regex,
          '<mark class="bg-yellow-300 text-black px-1 rounded">$1</mark>' // Example mark tag
        );
        setHighlightedParagraph(highlighted);
      } catch (e) {
        console.error('Error creating regex or highlighting text:', e);
        setHighlightedParagraph(quizData.paragraph); // Fallback to original paragraph
      }
    } else {
      setHighlightedParagraph(quizData?.paragraph ?? null); // Show original paragraph or null
    }
  }, [quizData, isAnswered, selectedAnswer]);

  useEffect(() => {
    if (showExplanation) {
      highlightRelevantText();
    }
    // Reset highlighting when explanations are hidden or quiz data changes
    if (!showExplanation && quizData) {
      setHighlightedParagraph(quizData.paragraph);
    }
  }, [showExplanation, highlightRelevantText, quizData]);

  const generateText = async () => {
    setLoading(true);
    setError(null);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setHighlightedParagraph(null); // Reset highlight
    setShowExplanation(false);
    setQuizData(null);

    try {
      const seed = Math.floor(Math.random() * 100);
      const responseResult: unknown = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Generate a reading comprehension paragraph in ${language} with multiple choice questions in English for CEFR level ${cefrLevel} (${CEFR_LEVELS[cefrLevel]}) language learners.`,
          seed: seed,
        }),
      });

      if (!(responseResult instanceof Response)) {
        console.error('Fetch did not return a Response object.', responseResult);
        throw new Error('Invalid response received from server.');
      }
      const response: Response = responseResult;

      // Parse JSON directly into the validator
      const parsedApiResponse = apiResponseSchema.safeParse(await response.json());

      if (!parsedApiResponse.success) {
        console.error('Invalid API response structure:', parsedApiResponse.error);
        throw new Error('Received invalid data structure from server.');
      }
      const data = parsedApiResponse.data;

      if (response.status === 429) {
        setError(data.error || "You've reached the usage limit. Please try again later.");
        setLoading(false);
        return;
      }
      if (!response.ok || !data.result) {
        console.error('API Error Response:', data);
        throw new Error(data.error || 'Failed to generate text');
      }

      try {
        const jsonString = data.result.replace(/```json|```/g, '').trim();

        // Parse JSON string directly into the validator
        const parsedQuizData = quizDataSchema.safeParse(JSON.parse(jsonString));

        if (!parsedQuizData.success) {
          console.error('Error parsing generated quiz JSON:', parsedQuizData.error);
          setError('Failed to parse the structure of the generated quiz. Please try again.');
          setQuizData(null);
          return;
        }
        setQuizData(parsedQuizData.data);
        setHighlightedParagraph(parsedQuizData.data.paragraph); // Set initial paragraph
      } catch (parseErr) {
        console.error('Error parsing JSON string:', parseErr);
        setError('Failed to parse the generated quiz content. Please try again.');
      }
    } catch (err: unknown) {
      console.error('Error generating text:', err);
      if (err instanceof Error) {
        setError(err.message || 'Failed to generate text. Please try again.');
      } else {
        setError('An unknown error occurred while generating text.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (answer: string) => {
    setSelectedAnswer(answer);
  };

  const checkAnswer = () => {
    if (selectedAnswer) {
      setIsAnswered(true);
      setShowExplanation(true);
    }
  };

  const resetQuiz = () => {
    setSelectedAnswer(null);
    setIsAnswered(false);
    setHighlightedParagraph(quizData?.paragraph ?? null); // Reset to original paragraph
    setShowExplanation(false);
  };

  const generateNewQuiz = () => {
    generateText().catch((error) => {
      console.error('Error explicitly caught from generateNewQuiz:', error);
    });
  };

  return (
    <div className="w-full max-w-3xl mx-auto my-8">
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700 shadow-lg mb-8">
        <h2 className="text-xl font-bold mb-4 text-white bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
          Customize Your Practice
        </h2>

        <div className="mb-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              <span className="flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-1 text-blue-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1a1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
                    clipRule="evenodd"
                  />
                </svg>
                CEFR Level:{' '}
                <span className="text-xs text-blue-300 ml-2">
                  What&apos;s your proficiency level?
                </span>
              </span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(CEFR_LEVELS) as CEFRLevel[]).map((level) => (
                <button
                  key={level}
                  onClick={() => setCefrLevel(level)}
                  className={`relative px-3 py-2 text-sm rounded transition-colors ${
                    cefrLevel === level
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white'
                      : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                  }`}
                >
                  <div className="font-semibold">
                    {level} - {CEFR_LEVELS[level]}
                  </div>
                  <div className="text-xs opacity-80 mt-1 line-clamp-1">
                    {CEFR_DESCRIPTIONS[level]}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              <span className="flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-1 text-green-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.56-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.97-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-2.003 2H8.032c.093 1.414.377 2.649.766 3.556.24.56.5.948.737 1.182.233.23.389.262.465.262.076 0 .232-.032.465-.262.238-.234.498-.623.737-1.182.389-.907.673-2.142.766-3.556zm1.166 4.118c.454-1.147.748-2.572.837-4.118h1.946a6.004 6.004 0 01-2.783 4.118zm-6.268 0C6.412 13.97 6.118 12.546 6.03 11H4.083a6.004 6.004 0 002.783 4.118z"
                    clipRule="evenodd"
                  />
                </svg>
                Reading Passage Language:
              </span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {(Object.keys(LANGUAGES) as Language[]).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`px-3 py-2 text-sm rounded transition-colors ${
                    language === lang
                      ? 'bg-gradient-to-r from-green-600 to-green-700 text-white'
                      : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                  }`}
                >
                  {LANGUAGES[lang]}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => {
              void generateText();
            }}
            disabled={loading}
            className="px-5 py-3 bg-gradient-to-r from-blue-500 via-indigo-500 to-green-500 text-white rounded-lg hover:from-blue-600 hover:via-indigo-600 hover:to-green-600 disabled:opacity-50 disabled:cursor-not-allowed w-full font-medium transition-all transform hover:scale-[1.02] flex items-center justify-center shadow-lg"
          >
            {loading ? (
              <div className="flex items-center">
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Generating...
              </div>
            ) : (
              <div className="flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
                    clipRule="evenodd"
                  />
                </svg>
                Generate New Text
              </div>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div
          className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded relative mb-6 shadow-md"
          role="alert"
        >
          <strong className="font-bold">Error:</strong>
          <span className="block sm:inline ml-2">{error}</span>
        </div>
      )}

      {loading && !quizData && (
        <div className="flex justify-center items-center h-64">
          <div className="loader ease-linear rounded-full border-4 border-t-4 border-gray-200 h-12 w-12 mb-4"></div>
        </div>
      )}

      {quizData && (
        <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
          <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-white flex items-center">
              <svg
                className="h-5 w-5 mr-2 text-blue-400"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
              </svg>
              Reading Passage {language !== 'English' && `(${LANGUAGES[language]})`}
            </h2>
            <div className="flex space-x-2">
              <span className="text-sm bg-gradient-to-r from-blue-600 to-blue-700 text-white px-2 py-1 rounded-full shadow-sm">
                {cefrLevel}
              </span>
              <span className="text-sm bg-gradient-to-r from-green-600 to-green-700 text-white px-2 py-1 rounded-full shadow-sm">
                {LANGUAGES[language]}
              </span>
            </div>
          </div>

          <div className="mb-6">
            <div
              className="prose prose-invert max-w-none text-white leading-relaxed"
              dangerouslySetInnerHTML={{ __html: highlightedParagraph || quizData.paragraph || '' }}
            />
          </div>

          <div className="mb-6">
            <h3 className="text-md font-semibold mb-3 text-white">{quizData.question}</h3>
            <div className="space-y-2">
              {(Object.keys(quizData.options) as Array<keyof typeof quizData.options>).map(
                (key) => (
                  <button
                    key={key}
                    onClick={() => handleAnswerSelect(key)}
                    disabled={isAnswered}
                    className={`w-full text-left px-4 py-3 rounded transition-colors disabled:cursor-not-allowed flex items-center ${
                      isAnswered
                        ? key === quizData.correctAnswer
                          ? 'bg-gradient-to-r from-green-700 to-green-800 border border-green-600 text-white'
                          : key === selectedAnswer
                            ? 'bg-gradient-to-r from-red-700 to-red-800 border border-red-600 text-white'
                            : 'bg-gray-700 border border-gray-600 text-gray-400'
                        : selectedAnswer === key
                          ? 'bg-gradient-to-r from-blue-600 to-blue-700 border border-blue-500 text-white'
                          : 'bg-gray-700 border border-gray-600 text-gray-200 hover:bg-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <span className="font-semibold mr-2">{key}.</span>
                    <span>{quizData.options[key]}</span>
                    {isAnswered && key === quizData.correctAnswer && (
                      <svg
                        className="w-5 h-5 text-green-300 ml-auto"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                    {isAnswered && key !== quizData.correctAnswer && key === selectedAnswer && (
                      <svg
                        className="w-5 h-5 text-red-300 ml-auto"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-between items-center">
            <button
              onClick={isAnswered ? generateNewQuiz : checkAnswer}
              disabled={!selectedAnswer && !isAnswered}
              className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105"
            >
              {isAnswered ? 'Next Quiz' : 'Check Answer'}
            </button>
            {isAnswered && (
              <button
                onClick={resetQuiz}
                className="px-4 py-2 bg-gray-600 text-gray-200 rounded hover:bg-gray-500 transition-colors text-sm"
              >
                Try Again
              </button>
            )}
          </div>

          {showExplanation && (
            <div className="mt-6 pt-4 border-t border-gray-700">
              <h4 className="text-md font-semibold mb-3 text-white">Explanations</h4>
              <div className="space-y-3">
                {(
                  Object.keys(quizData.explanations) as Array<keyof typeof quizData.explanations>
                ).map((key) => (
                  <div
                    key={key}
                    className={`p-3 rounded border ${
                      key === quizData.correctAnswer
                        ? 'bg-green-900 border-green-700'
                        : key === selectedAnswer
                          ? 'bg-red-900 border-red-700'
                          : 'bg-gray-750 border-gray-600'
                    }`}
                  >
                    <p className="text-sm text-gray-200">
                      <strong
                        className={`font-semibold ${
                          key === quizData.correctAnswer
                            ? 'text-green-300'
                            : key === selectedAnswer
                              ? 'text-red-300'
                              : 'text-gray-300'
                        }`}
                      >
                        {key}. {quizData.options[key]}:
                      </strong>
                      <span className="ml-1">{quizData.explanations[key]}</span>
                    </p>
                    {key === quizData.correctAnswer && quizData.relevantText && (
                      <p className="text-xs text-gray-400 mt-1 italic">
                        Supporting text: &quot;{quizData.relevantText}&quot;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
