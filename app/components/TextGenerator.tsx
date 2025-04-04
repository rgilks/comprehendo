// TextGenerator component - Provides reading comprehension quiz functionality with formatting
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
// Removed import for HighlightedParagraph and constants
// import {
//   CEFR_LEVELS,
//   CEFR_DESCRIPTIONS,
//   LANGUAGES,
// } from '../../lib/constants';
// import { HighlightedParagraph } from './HighlightedParagraph';
import { z } from 'zod';

// Simple Speaker Icon
// const SpeakerIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
//   <svg
//     xmlns="http://www.w3.org/2000/svg"
//     viewBox="0 0 24 24"
//     fill="currentColor"
//     className={className}
//   >
//     <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.348 2.595.341 1.24 1.518 1.905 2.66 1.905H6.44l4.5 4.5c.945.945 2.56.276 2.56-1.06V4.06zM18.584 5.106a.75.75 0 0 1 1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 0 1-1.06-1.06 8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06z" />
//     <path d="M15.932 7.757a.75.75 0 0 1 1.061 0 6 6 0 0 1 0 8.486.75.75 0 0 1-1.06-1.061 4.5 4.5 0 0 0 0-6.364.75.75 0 0 1 0-1.06z" />
//   </svg>
// );

// --- NEW Icons for Controls ---
const PlayIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path
      fillRule="evenodd"
      d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z"
      clipRule="evenodd"
    />
  </svg>
);

const PauseIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path
      fillRule="evenodd"
      d="M6.75 5.25a.75.75 0 0 1 .75.75V18a.75.75 0 0 1-1.5 0V6a.75.75 0 0 1 .75-.75Zm9 0a.75.75 0 0 1 .75.75V18a.75.75 0 0 1-1.5 0V6a.75.75 0 0 1 .75-.75Z"
      clipRule="evenodd"
    />
  </svg>
);

const StopIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path
      fillRule="evenodd"
      d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z"
      clipRule="evenodd"
    />
  </svg>
);
// --- End Icons ---

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
type Language = 'English' | 'Italian' | 'Spanish' | 'French' | 'German' | 'Hindi' | 'Hebrew';

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

// Add a constant to identify RTL languages
const RTL_LANGUAGES: Language[] = ['Hebrew'];

const LANGUAGES: Record<Language, string> = {
  English: 'English',
  Italian: 'Italiano',
  Spanish: 'Español',
  French: 'Français',
  German: 'Deutsch',
  Hindi: 'हिन्दी',
  Hebrew: 'עברית',
};

// Map Language type to BCP 47 language codes for SpeechSynthesis
const BCP47_LANGUAGE_MAP: Record<Language, string> = {
  English: 'en-US',
  Italian: 'it-IT',
  Spanish: 'es-ES',
  French: 'fr-FR',
  German: 'de-DE',
  Hindi: 'hi-IN',
  Hebrew: 'he-IL',
};

// Skeleton Loader Component
const QuizSkeleton = () => (
  <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg animate-pulse">
    <div className="h-4 bg-gray-700 rounded w-3/4 mb-4"></div> {/* Title Placeholder */}
    <div className="space-y-3 mb-6">
      <div className="h-3 bg-gray-700 rounded w-full"></div>
      <div className="h-3 bg-gray-700 rounded w-full"></div>
      <div className="h-3 bg-gray-700 rounded w-5/6"></div>
      <div className="h-3 bg-gray-700 rounded w-4/6"></div>
    </div>{' '}
    {/* Paragraph Placeholder */}
    <div className="h-4 bg-gray-700 rounded w-1/2 mb-4"></div> {/* Question Placeholder */}
    <div className="space-y-2">
      <div className="h-10 bg-gray-700 rounded w-full"></div>
      <div className="h-10 bg-gray-700 rounded w-full"></div>
      <div className="h-10 bg-gray-700 rounded w-full"></div>
      <div className="h-10 bg-gray-700 rounded w-full"></div>
    </div>{' '}
    {/* Options Placeholder */}
  </div>
);

// Add a helper function to determine text direction
const getTextDirection = (language: Language) => {
  return RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr';
};

export default function TextGenerator() {
  const [cefrLevel, setCefrLevel] = useState<CEFRLevel>('B1');
  const [passageLanguage, setPassageLanguage] = useState<Language>('English');
  const [questionLanguage, setQuestionLanguage] = useState<Language>('English');
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [highlightedParagraph, setHighlightedParagraph] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState<boolean>(false); // State for speech support
  // --- NEW State for Speech Control ---
  const [isSpeakingPassage, setIsSpeakingPassage] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  // Use a ref to hold the utterance, avoiding re-renders on change
  const passageUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  // --- End NEW State ---
  const [generatedPassageLanguage, setGeneratedPassageLanguage] = useState<Language | null>(null); // Store language at generation time
  const [generatedQuestionLanguage, setGeneratedQuestionLanguage] = useState<Language | null>(null); // Store question language at generation time

  // --- Question Delay State ---
  const QUESTION_DELAY_MS = 20000; // 20 seconds
  const [showQuestionSection, setShowQuestionSection] = useState<boolean>(false);
  const questionDelayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // --- End Question Delay State ---

  // Check for Speech Synthesis support on mount
  useEffect(() => {
    setIsSpeechSupported(
      'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
    );
  }, []);

  // --- Stop Passage Speech Utility ---
  const stopPassageSpeech = useCallback(() => {
    if (isSpeechSupported) {
      window.speechSynthesis.cancel(); // Cancels all speech
      setIsSpeakingPassage(false);
      setIsPaused(false);
      passageUtteranceRef.current = null; // Clear the ref
    }
  }, [isSpeechSupported]);

  // --- Speech Synthesis Utility (Modified for single words) ---
  const speakText = useCallback(
    (text: string | null, lang: string) => {
      if (!isSpeechSupported || !text) {
        // console.warn('Speech synthesis not supported or text is empty.'); // Can be noisy
        return; // Exit if not supported or no text
      }

      // Stop any ongoing passage speech before speaking a word
      stopPassageSpeech();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang; // Set the language

      // Optional: Add error handling for the speech event
      utterance.onerror = (event) => {
        console.error('Speech synthesis error (word):', event.error);
      };

      // We don't track state for single words, just speak them
      window.speechSynthesis.speak(utterance);
    },
    [isSpeechSupported, stopPassageSpeech] // Added stopPassageSpeech dependency
  );

  // --- NEW Passage Speech Controls ---
  const handlePlayPause = useCallback(() => {
    // Use generatedPassageLanguage for speech
    if (!isSpeechSupported || !quizData?.paragraph || !generatedPassageLanguage) return;

    if (isSpeakingPassage) {
      if (isPaused) {
        // Resume
        window.speechSynthesis.resume();
        setIsPaused(false);
      } else {
        // Pause
        window.speechSynthesis.pause();
        setIsPaused(true);
      }
    } else {
      // Start new playback
      stopPassageSpeech(); // Ensure any previous state is cleared

      const utterance = new SpeechSynthesisUtterance(quizData.paragraph);
      utterance.lang = BCP47_LANGUAGE_MAP[generatedPassageLanguage]; // Use stored language
      passageUtteranceRef.current = utterance; // Store the utterance

      utterance.onend = () => {
        setIsSpeakingPassage(false);
        setIsPaused(false);
        passageUtteranceRef.current = null;
      };

      utterance.onerror = (event) => {
        // Ignore interruption errors, as they are expected when stopping/cancelling
        if (event.error !== 'interrupted') {
          console.error('Speech synthesis error (passage):', event.error);
          // Reset state only for unexpected errors
          setIsSpeakingPassage(false);
          setIsPaused(false);
          passageUtteranceRef.current = null;
          // Optionally provide user feedback here for unexpected errors
        }
      };

      window.speechSynthesis.speak(utterance);
      setIsSpeakingPassage(true);
      setIsPaused(false);
    }
  }, [
    isSpeechSupported,
    quizData?.paragraph,
    isSpeakingPassage,
    isPaused,
    generatedPassageLanguage, // Depend on stored language
    stopPassageSpeech,
  ]);

  const handleStop = useCallback(() => {
    stopPassageSpeech();
  }, [stopPassageSpeech]);
  // --- End NEW Passage Speech Controls ---

  const highlightRelevantText = useCallback(() => {
    // Highlight whenever explanations are shown and relevant text exists
    if (quizData && showExplanation && quizData.relevantText) {
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
  }, [quizData, showExplanation]);

  useEffect(() => {
    if (showExplanation) {
      highlightRelevantText();
    }
    // Reset highlighting when explanations are hidden or quiz data changes
    if (!showExplanation && quizData) {
      setHighlightedParagraph(quizData.paragraph);
    }
  }, [showExplanation, highlightRelevantText, quizData]);

  // Stop speech when component unmounts or quiz data changes
  useEffect(() => {
    return () => {
      // Use the dedicated stop function
      stopPassageSpeech();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizData]); // Keep dependency on quizData

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      // Cleanup question delay timer
      if (questionDelayTimeoutRef.current) clearTimeout(questionDelayTimeoutRef.current);
    };
  }, []);

  // --- Function to render paragraph with click-to-speak words ---
  const renderParagraphWithWordHover = useCallback(
    (paragraphHtml: string | null, langType: Language) => {
      if (!paragraphHtml) return null;
      if (!isSpeechSupported) {
        // If speech is not supported, just render the HTML directly
        return (
          <div
            dir={getTextDirection(langType)}
            className="text-gray-200 leading-relaxed mb-6"
            dangerouslySetInnerHTML={{ __html: paragraphHtml }}
          />
        );
      }

      // Regular expression to split the HTML string by spaces,
      // keeping the spaces and also handling HTML tags without splitting them.
      const segments = paragraphHtml.split(/(\<[^>]+\>|\s+)/).filter(Boolean);

      return (
        <div dir={getTextDirection(langType)} className="text-gray-200 leading-relaxed mb-6">
          {segments.map((segment, index) => {
            if (segment.match(/^\s+$/)) {
              // If segment is whitespace, preserve it
              return <span key={index}>{segment}</span>;
            }
            if (segment.startsWith('<')) {
              // If segment is an HTML tag, render it directly
              return <span key={index} dangerouslySetInnerHTML={{ __html: segment }} />;
            }
            // For actual words, make them interactive
            return (
              <span
                key={index}
                className="cursor-pointer hover:text-blue-400 transition-colors duration-200"
                onClick={() => speakText(segment, langType)}
              >
                {segment}
              </span>
            );
          })}
        </div>
      );
    },
    [isSpeechSupported, speakText]
  );

  const generateText = async () => {
    // Stop speech before generating new text
    stopPassageSpeech();
    setGeneratedPassageLanguage(null); // Reset generated language
    setGeneratedQuestionLanguage(null); // Reset generated question language
    setLoading(true);
    setError(null);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setHighlightedParagraph(null); // Reset highlight
    setShowExplanation(false);
    setQuizData(null);

    // Clear existing question delay timer and hide section
    if (questionDelayTimeoutRef.current) clearTimeout(questionDelayTimeoutRef.current);
    setShowQuestionSection(false); // Hide question section immediately

    const maxAttempts = 3;
    const retryDelayMs = 1000; // 1 second delay between retries

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        console.log(`Attempt ${attempt + 1} of ${maxAttempts} to generate text...`);
        const seed = Math.floor(Math.random() * 100);
        const responseResult: unknown = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: `Generate a reading comprehension paragraph in ${passageLanguage} and the corresponding multiple choice question, options, and explanations ONLY in ${questionLanguage} for CEFR level ${cefrLevel} (${CEFR_LEVELS[cefrLevel]}) language learners.`,
            seed: seed,
            passageLanguage: passageLanguage,
            questionLanguage: questionLanguage,
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
          // Don't retry on rate limit error, show message immediately
          setError(data.error || "You've reached the usage limit. Please try again later.");
          setGeneratedPassageLanguage(null);
          setGeneratedQuestionLanguage(null);
          // No need to break here, the finally block will handle loading state
          return; // Exit generateText completely
        }

        if (!response.ok || !data.result) {
          console.error('API Error Response:', data);
          throw new Error(data.error || `API request failed with status ${response.status}`);
        }

        // Attempt to parse the inner JSON (quiz data)
        try {
          const jsonString = data.result.replace(/```json|```/g, '').trim();
          const parsedQuizData = quizDataSchema.safeParse(JSON.parse(jsonString));

          if (!parsedQuizData.success) {
            console.error('Error parsing generated quiz JSON:', parsedQuizData.error);
            throw new Error('Failed to parse the structure of the generated quiz.');
          }

          // SUCCESS!
          setQuizData(parsedQuizData.data);
          setHighlightedParagraph(parsedQuizData.data.paragraph);
          setGeneratedPassageLanguage(passageLanguage);
          setGeneratedQuestionLanguage(questionLanguage);
          setError(null); // Clear any previous errors

          // --- START QUESTION DELAY TIMER ---
          if (questionDelayTimeoutRef.current) clearTimeout(questionDelayTimeoutRef.current);
          questionDelayTimeoutRef.current = setTimeout(() => {
            setShowQuestionSection(true);
          }, QUESTION_DELAY_MS);
          // --- END QUESTION DELAY TIMER ---

          console.log(`Successfully generated text on attempt ${attempt + 1}`);
          break; // Exit the retry loop on success
        } catch (parseErr) {
          console.error(`Attempt ${attempt + 1}: Error parsing inner JSON`, parseErr);
          // Throw the parsing error to be caught by the outer catch block for retry logic
          if (parseErr instanceof Error) throw parseErr;
          else throw new Error('Failed to parse generated quiz content.');
        }
      } catch (err: unknown) {
        console.error(`Attempt ${attempt + 1} failed:`, err);

        // If this was the last attempt, set the final error state
        if (attempt === maxAttempts - 1) {
          console.error('All generation attempts failed.');
          setGeneratedPassageLanguage(null);
          setGeneratedQuestionLanguage(null);
          if (err instanceof Error) {
            setError(
              err.message || 'Failed to generate text after multiple attempts. Please try again.'
            );
          } else {
            setError('An unknown error occurred after multiple attempts.');
          }
          // Let the loop finish so finally block runs
        } else {
          // Wait before the next retry
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        }
      }
    } // End of for loop

    // This runs after the loop finishes (either by success break or all attempts failing)
    setLoading(false);
  };

  const handleAnswerSelect = (answer: string) => {
    // Allow selecting even if cooldown is active, but don't allow changing selection
    if (isAnswered) return;

    setSelectedAnswer(answer);
    setIsAnswered(true);
    setShowExplanation(true);
  };

  const generateNewQuiz = () => {
    // Check conditions *before* stopping speech or calling generateText
    if (loading || (quizData !== null && !isAnswered)) {
      console.log('Cannot generate new quiz while loading or previous question is unanswered.');
      return;
    }
    // Stop speech before generating new quiz
    stopPassageSpeech();
    // Proceed with generation
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
                    d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.56-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.572-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-2.003 2H8.032c.093 1.414.377 2.649.766 3.556.24.56.5.948.737 1.182.233.23.389.262.465.262.076 0 .232-.032.465-.262.238-.234.498-.623.737-1.182.389-.907.673-2.142.766-3.556zm1.166 4.118c.454-1.147.748-2.572.837-4.118h1.946a6.004 6.004 0 01-2.783 4.118zm-6.268 0C6.412 13.97 6.118 12.546 6.03 11H4.083a6.004 6.004 0 002.783 4.118z"
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
                  onClick={() => setPassageLanguage(lang)}
                  className={`px-3 py-2 text-sm rounded transition-colors ${
                    passageLanguage === lang
                      ? 'bg-gradient-to-r from-green-600 to-green-700 text-white'
                      : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                  }`}
                >
                  {LANGUAGES[lang]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              <span className="flex items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-1 text-purple-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10c0 3.866-3.582 7-8 7a8.74 8.74 0 01-4.145-.993L.5 19.5l1.846-4.309A7.984 7.984 0 012 10c0-3.866 3.582-7 8-7s8 3.134 8 7zm-8-5c-3.309 0-6 2.239-6 5s2.691 5 6 5 6-2.239 6-5-2.691-5-6-5z"
                    clipRule="evenodd"
                  />
                </svg>
                Question & Options Language:
              </span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {(Object.keys(LANGUAGES) as Language[]).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setQuestionLanguage(lang)}
                  className={`px-3 py-2 text-sm rounded transition-colors ${
                    questionLanguage === lang
                      ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white'
                      : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                  }`}
                >
                  {LANGUAGES[lang]}
                </button>
              ))}
            </div>
          </div>
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

      {loading && !quizData && <QuizSkeleton />}

      {quizData && generatedPassageLanguage && generatedQuestionLanguage && (
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
              Reading Passage {passageLanguage !== 'English' && `(${LANGUAGES[passageLanguage]})`}
            </h2>
            <div className="flex space-x-2">
              <span className="text-sm bg-gradient-to-r from-blue-600 to-blue-700 text-white px-2 py-1 rounded-full shadow-sm">
                {cefrLevel}
              </span>
              <span className="text-sm bg-gradient-to-r from-green-600 to-green-700 text-white px-2 py-1 rounded-full shadow-sm">
                P: {LANGUAGES[generatedPassageLanguage]}
              </span>
              <span className="text-sm bg-gradient-to-r from-purple-600 to-purple-700 text-white px-2 py-1 rounded-full shadow-sm">
                Q: {LANGUAGES[generatedQuestionLanguage]}
              </span>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-semibold text-white">
                Reading Passage ({passageLanguage})
              </h3>
              {/* --- UPDATED Speech Controls --- */}
              {isSpeechSupported && quizData.paragraph && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handlePlayPause}
                    title={isSpeakingPassage && !isPaused ? 'Pause' : 'Play'}
                    className="flex items-center justify-center p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors disabled:opacity-50"
                    disabled={!quizData.paragraph}
                  >
                    {isSpeakingPassage && !isPaused ? (
                      <PauseIcon className="w-4 h-4" />
                    ) : (
                      <PlayIcon className="w-4 h-4" />
                    )}
                  </button>
                  {isSpeakingPassage && ( // Show Stop button only when speaking/paused
                    <button
                      onClick={handleStop}
                      title="Stop"
                      className="flex items-center justify-center p-2 bg-red-600 text-white rounded-full hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors"
                    >
                      <StopIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
              {/* --- End UPDATED Speech Controls --- */}
            </div>
            <div
              className="prose prose-invert max-w-none text-gray-300 leading-relaxed"
              // Render using the word hover function
            >
              {/* Conditional Rendering: Use dangerouslySetInnerHTML if highlighting is active, otherwise use word hover */}
              {highlightedParagraph && highlightedParagraph !== quizData.paragraph ? (
                <div dangerouslySetInnerHTML={{ __html: highlightedParagraph }} />
              ) : generatedPassageLanguage ? (
                renderParagraphWithWordHover(
                  quizData.paragraph, // Pass original paragraph for word hover
                  generatedPassageLanguage // Pass the stored Language type
                )
              ) : (
                // Fallback if language isn't set (shouldn't normally happen here)
                <div>{quizData.paragraph}</div>
              )}
            </div>
          </div>

          {/* Indicator shown during question delay */}
          {quizData && !showQuestionSection && (
            <div className="mt-4 text-center text-gray-400 text-sm animate-pulse">
              Question will appear shortly...
            </div>
          )}

          {/* --- Conditionally Rendered Question/Options/Explanation Block --- */}
          {showQuestionSection && (
            <>
              <div className="mt-6">
                <h3
                  dir={getTextDirection(questionLanguage)}
                  className="text-lg font-semibold text-white mb-4"
                >
                  {quizData.question}
                </h3>
                <div className="space-y-3">
                  {Object.entries(quizData.options).map(([key, value]) => (
                    <button
                      key={key}
                      onClick={() => handleAnswerSelect(key)}
                      disabled={isAnswered}
                      dir={getTextDirection(questionLanguage)}
                      className={`w-full text-left p-3 rounded transition-colors duration-200 ${
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
                      <span className="font-semibold">{key}:</span> {value}
                    </button>
                  ))}
                </div>
              </div>

              {showExplanation && (
                <div className="mt-6 pt-4 border-t border-gray-700">
                  <h4 className="text-md font-semibold mb-3 text-white">Explanations</h4>
                  <div className="space-y-3">
                    {(
                      Object.keys(quizData.explanations) as Array<
                        keyof typeof quizData.explanations
                      >
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
            </>
          )}
        </div>
      )}

      {/* Generate Button - Moved to the bottom */}
      <div className="mt-8">
        {' '}
        {/* Add some margin above the button */}
        <button
          onClick={generateNewQuiz}
          disabled={loading || (quizData !== null && !isAnswered)}
          className={`w-full px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white ${loading || (quizData !== null && !isAnswered) ? 'bg-gray-600 cursor-not-allowed opacity-70' : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-green-500 hover:from-blue-600 hover:via-indigo-600 hover:to-green-600'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-cyan-500 transition duration-150 ease-in-out flex items-center justify-center`}
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
          ) : quizData !== null && !isAnswered ? (
            // Differentiate between delay period and question visible period
            showQuestionSection ? (
              'Answer the question below'
            ) : (
              'Reading time...'
            )
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
              Generate New Quiz
            </div>
          )}
        </button>
      </div>
    </div>
  );
}
