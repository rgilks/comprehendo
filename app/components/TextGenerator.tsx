// TextGenerator component - Provides reading comprehension quiz functionality with formatting
'use client';

import { useState, useEffect } from 'react';

type QuizData = {
  paragraph: string;
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  explanations: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: string;
  relevantText: string;
  topic: string;
};

type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
type Language = 'English' | 'Italian' | 'Spanish' | 'French' | 'German';

const CEFR_LEVELS = {
  A1: 'Beginner',
  A2: 'Elementary',
  B1: 'Intermediate',
  B2: 'Upper Intermediate',
  C1: 'Advanced',
  C2: 'Proficiency',
};

const CEFR_DESCRIPTIONS = {
  A1: 'Basic phrases, simple questions',
  A2: 'Familiar topics, simple sentences',
  B1: 'Routine matters, basic opinions',
  B2: 'Technical discussions, clear viewpoints',
  C1: 'Complex topics, spontaneous expression',
  C2: 'Virtually everything, nuanced expression',
};

const LANGUAGES = {
  English: 'English',
  Italian: 'Italiano',
  Spanish: 'Español',
  French: 'Français',
  German: 'Deutsch',
};

export default function TextGenerator() {
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [cefrLevel, setCefrLevel] = useState<CEFRLevel>('B1');
  const [language, setLanguage] = useState<Language>('English');
  const [highlightedParagraph, setHighlightedParagraph] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);

  useEffect(() => {
    if (quizData && isAnswered) {
      const highlightRelevantText = () => {
        if (!quizData || !quizData.relevantText) return;

        const { paragraph, relevantText } = quizData;

        // Escape special regex characters in the relevant text
        const escapedText = relevantText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Create a regular expression to find the text to highlight
        const regex = new RegExp(`(${escapedText})`, 'gi');

        // Replace the matched text with highlighted version
        const highlighted = paragraph.replace(
          regex,
          '<span class="bg-yellow-300 text-black px-1 rounded">$1</span>'
        );

        setHighlightedParagraph(highlighted);
      };

      highlightRelevantText();
    } else {
      setHighlightedParagraph(null);
    }
  }, [isAnswered, quizData]);

  const generateText = async () => {
    setLoading(true);
    setError(null);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setHighlightedParagraph(null);
    setShowExplanation(false);

    // Clear previous quiz data when starting to load a new one
    setQuizData(null);

    try {
      // Generate a random seed to get different cached responses
      const seed = Math.floor(Math.random() * 100);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: `Generate a reading comprehension paragraph in ${language} with multiple choice questions in English for CEFR level ${cefrLevel} (${CEFR_LEVELS[cefrLevel]}) language learners.`,
          seed: seed,
        }),
      });

      if (response.status === 429) {
        setError("You've reached the usage limit. Please try again later.");
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to generate text');
      }

      const data = await response.json();
      try {
        // Parse the JSON response from the string
        const jsonString = data.result.replace(/```json|```/g, '').trim();
        const parsedData = JSON.parse(jsonString);
        setQuizData(parsedData);
      } catch (parseErr) {
        console.error('Error parsing JSON:', parseErr);
        setError('Failed to parse the generated quiz. Please try again.');
      }
    } catch (err) {
      console.error('Error generating text:', err);
      setError('Failed to generate text. Please try again.');
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
    setHighlightedParagraph(null);
    setShowExplanation(false);
  };

  const generateNewQuiz = () => {
    generateText();
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
            onClick={generateText}
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
                Generate {language} Reading Practice
              </div>
            )}
          </button>
        </div>
      </div>

      {loading && (
        <div className="bg-gradient-to-r from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-12 border border-gray-700 shadow-lg mb-8 fade-in">
          <div className="flex flex-col items-center justify-center">
            <div className="w-16 h-16 mb-6 relative">
              <svg
                className="animate-spin w-16 h-16 text-blue-500"
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
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-2 w-2 rounded-full bg-green-400 animate-ping"></div>
              </div>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Generating Your Quiz</h3>
            <p className="text-gray-400 text-center">
              Creating a {cefrLevel} level reading passage in {language}...
            </p>
          </div>
        </div>
      )}

      {!quizData && !loading && (
        <div className="bg-gradient-to-r from-gray-800/80 to-gray-900/80 backdrop-blur-sm rounded-xl p-6 border border-gray-700 shadow-lg mb-8 fade-in">
          <h2 className="text-xl font-semibold mb-4 text-white flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 mr-2 text-blue-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            How It Works
          </h2>
          <ol className="text-left space-y-4 text-gray-300">
            <li className="flex items-start p-3 bg-gray-800/50 rounded-lg border border-gray-700">
              <span className="flex-shrink-0 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full h-8 w-8 flex items-center justify-center mr-3 shadow-md">
                1
              </span>
              <div>
                <span className="font-medium text-white">Select your settings</span>
                <p className="mt-1 text-sm">
                  Choose your <span className="text-blue-400">CEFR level</span> and preferred{' '}
                  <span className="text-green-400">reading language</span> to customize your
                  practice
                </p>
              </div>
            </li>
            <li className="flex items-start p-3 bg-gray-800/50 rounded-lg border border-gray-700">
              <span className="flex-shrink-0 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full h-8 w-8 flex items-center justify-center mr-3 shadow-md">
                2
              </span>
              <div>
                <span className="font-medium text-white">Generate a passage</span>
                <p className="mt-1 text-sm">
                  AI creates a reading passage tailored to your level with a comprehension question
                </p>
              </div>
            </li>
            <li className="flex items-start p-3 bg-gray-800/50 rounded-lg border border-gray-700">
              <span className="flex-shrink-0 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full h-8 w-8 flex items-center justify-center mr-3 shadow-md">
                3
              </span>
              <div>
                <span className="font-medium text-white">Test your comprehension</span>
                <p className="mt-1 text-sm">
                  Answer the multiple-choice question and receive instant feedback with explanations
                </p>
              </div>
            </li>
          </ol>
          <div className="mt-4 text-center text-sm text-gray-400">
            Click the Generate button above to start practicing!
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-900/70 border border-red-700 text-red-100 rounded-lg shadow-md">
          <div className="flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 mr-2 text-red-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {error}
          </div>
        </div>
      )}

      {quizData && !loading && (
        <div className="space-y-6 fade-in">
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 border border-gray-700 rounded-xl shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-gray-900 to-indigo-900/40 p-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-white flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2 text-blue-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                </svg>
                Reading Passage {language !== 'English' && `(${LANGUAGES[language]})`}
              </h2>
              <div className="flex space-x-2">
                <span className="text-sm bg-gradient-to-r from-blue-600 to-blue-700 text-white px-2 py-1 rounded-full shadow-sm">
                  Level: {cefrLevel}
                </span>
                <span className="text-sm bg-gradient-to-r from-green-600 to-green-700 text-white px-2 py-1 rounded-full shadow-sm">
                  {LANGUAGES[language]}
                </span>
              </div>
            </div>

            <div className="p-5 bg-gray-800/90 text-white backdrop-blur-sm">
              {highlightedParagraph ? (
                <p
                  className="leading-relaxed text-lg"
                  dangerouslySetInnerHTML={{ __html: highlightedParagraph }}
                />
              ) : (
                <p className="leading-relaxed text-lg">{quizData.paragraph}</p>
              )}
            </div>

            {quizData.topic && (
              <div className="p-3 bg-gradient-to-r from-gray-900 to-indigo-900/40 border-t border-gray-700 flex justify-end">
                <span className="text-xs text-gray-400">Topic: {quizData.topic}</span>
              </div>
            )}
          </div>

          <div className="bg-gradient-to-r from-gray-800 to-gray-900 border border-gray-700 rounded-xl shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-gray-900 to-indigo-900/40 p-4">
              <h3 className="text-lg font-medium text-white flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2 text-yellow-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1a1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
                    clipRule="evenodd"
                  />
                </svg>
                Question (English)
              </h3>
            </div>

            <div className="p-5 bg-gray-800/90 text-white backdrop-blur-sm">
              <p className="text-lg mb-6 font-medium">{quizData.question}</p>

              <div className="space-y-3">
                {Object.entries(quizData.options).map(([key, value]) => (
                  <button
                    key={key}
                    disabled={isAnswered}
                    className={`p-3 border w-full text-left rounded-lg cursor-pointer transition-all ${
                      selectedAnswer === key
                        ? 'border-blue-500 bg-blue-900/50'
                        : 'border-gray-600 hover:bg-gray-700'
                    } ${
                      isAnswered && key === quizData.correctAnswer
                        ? 'border-green-500 bg-green-900/50 ring-2 ring-green-500'
                        : ''
                    } ${
                      isAnswered && selectedAnswer === key && key !== quizData.correctAnswer
                        ? 'border-red-500 bg-red-900/50 ring-2 ring-red-500'
                        : ''
                    }`}
                    onClick={() => !isAnswered && handleAnswerSelect(key)}
                  >
                    <div className="flex items-start">
                      <span
                        className={`flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center mr-2 text-sm font-semibold ${
                          selectedAnswer === key
                            ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white'
                            : isAnswered && key === quizData.correctAnswer
                              ? 'bg-gradient-to-r from-green-600 to-green-700 text-white'
                              : 'bg-gray-700 text-white'
                        }`}
                      >
                        {key}
                      </span>
                      <span className="pt-0.5">{value}</span>
                    </div>

                    {isAnswered && showExplanation && (
                      <div
                        className={`mt-2 text-sm px-2 py-1 rounded ${
                          key === quizData.correctAnswer
                            ? 'bg-green-900/40 text-green-300'
                            : 'bg-red-900/40 text-red-300'
                        }`}
                      >
                        {quizData.explanations[key as keyof typeof quizData.explanations]}
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {!isAnswered && selectedAnswer && (
                <div className="mt-4">
                  <button
                    onClick={checkAnswer}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-colors shadow-md"
                  >
                    Check Answer
                  </button>
                </div>
              )}

              {isAnswered && (
                <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
                  <button
                    onClick={resetQuiz}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors w-full sm:w-auto shadow-md"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={generateNewQuiz}
                    className="px-4 py-2 bg-gradient-to-r from-blue-500 via-indigo-500 to-green-500 text-white rounded-lg hover:from-blue-600 hover:via-indigo-600 hover:to-green-600 transition-colors w-full sm:w-auto shadow-md"
                  >
                    Generate New Quiz
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
