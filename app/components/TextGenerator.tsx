// TextGenerator component - Provides reading comprehension quiz functionality with formatting
'use client';

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
// Removed import for HighlightedParagraph and constants
// import {
//   CEFR_LEVELS,
//   CEFR_DESCRIPTIONS,
//   LANGUAGES,
// } from '../../lib/constants';
// import { HighlightedParagraph } from './HighlightedParagraph';
import { z } from 'zod';
import {
  PlayIcon as HeroPlayIcon,
  PauseIcon as HeroPauseIcon,
  StopIcon as HeroStopIcon,
  SpeakerWaveIcon,
  InformationCircleIcon,
  GlobeAltIcon,
  ChatBubbleLeftRightIcon,
  BookOpenIcon,
  ArrowPathIcon,
  PlusCircleIcon,
} from '@heroicons/react/24/solid';

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
// const PlayIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
//   <svg
//     xmlns="http://www.w3.org/2000/svg"
//     viewBox="0 0 24 24"
//     fill="currentColor"
//     className={className}
//   >
//     <path
//       fillRule="evenodd"
//       d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z"
//       clipRule="evenodd"
//     />
//   </svg>
// );

// const PauseIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
//   <svg
//     xmlns="http://www.w3.org/2000/svg"
//     viewBox="0 0 24 24"
//     fill="currentColor"
//     className={className}
//   >
//     <path
//       fillRule="evenodd"
//       d="M6.75 5.25a.75.75 0 0 1 .75.75V18a.75.75 0 0 1-1.5 0V6a.75.75 0 0 1 .75-.75Zm9 0a.75.75 0 0 1 .75.75V18a.75.75 0 0 1-1.5 0V6a.75.75 0 0 1 .75-.75Z"
//       clipRule="evenodd"
//     />
//   </svg>
// );

// const StopIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
//   <svg
//     xmlns="http://www.w3.org/2000/svg"
//     viewBox="0 0 24 24"
//     fill="currentColor"
//     className={className}
//   >
//     <path
//       fillRule="evenodd"
//       d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z"
//       clipRule="evenodd"
//     />
//   </svg>
// );
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

interface TranslatableWordProps {
  word: string;
  fromLang: Language;
  isCurrentWord: boolean;
  onSpeak: () => void;
  onTranslate: (word: string, sourceLang: string, targetLang: string) => Promise<string>;
}

const TranslatableWord = memo(
  ({ word, fromLang, isCurrentWord, onSpeak, onTranslate }: TranslatableWordProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const [translation, setTranslation] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleMouseEnter = useCallback(() => {
      setIsHovered(true);
      if (!translation && !isLoading) {
        void (async () => {
          setIsLoading(true);
          try {
            const sourceLang = BCP47_LANGUAGE_MAP[fromLang].split('-')[0];
            const targetLang = BCP47_LANGUAGE_MAP['English'].split('-')[0];
            const result = await onTranslate(word, sourceLang, targetLang);
            setTranslation(result);
          } finally {
            setIsLoading(false);
          }
        })();
      }
    }, [word, fromLang, onTranslate, translation, isLoading]);

    const handleMouseLeave = useCallback(() => {
      setIsHovered(false);
    }, []);

    return (
      <span
        className={`cursor-pointer transition-colors duration-200 px-1 -mx-1 relative group ${
          isCurrentWord ? 'bg-blue-500 text-white rounded' : 'hover:text-blue-400'
        }`}
        onClick={() => void onSpeak()}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {word}
        {isHovered && (
          <span className="absolute -top-12 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-gray-900/95 border border-gray-600 text-white text-base rounded-lg shadow-xl z-10 whitespace-nowrap min-w-[100px] text-center backdrop-blur-sm">
            {isLoading ? (
              <span className="inline-block animate-pulse">Translating...</span>
            ) : (
              <span className="font-medium">{translation || word}</span>
            )}
          </span>
        )}
      </span>
    );
  }
);

TranslatableWord.displayName = 'TranslatableWord';

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
  const [isSpeechSupported, setIsSpeechSupported] = useState<boolean>(false);
  const [isSpeakingPassage, setIsSpeakingPassage] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentWordIndex, setCurrentWordIndex] = useState<number | null>(null);
  const passageUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const wordsRef = useRef<string[]>([]);
  const [generatedPassageLanguage, setGeneratedPassageLanguage] = useState<Language | null>(null);
  const [generatedQuestionLanguage, setGeneratedQuestionLanguage] = useState<Language | null>(null);
  const [volume, setVolume] = useState(0.5); // Change initial volume to 50%

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
      window.speechSynthesis.cancel();
      setIsSpeakingPassage(false);
      setIsPaused(false);
      setCurrentWordIndex(null);
      passageUtteranceRef.current = null;
    }
  }, [isSpeechSupported]);

  // --- Speech Synthesis Utility (Modified for single words) ---
  const speakText = useCallback(
    (text: string | null, lang: Language) => {
      if (!isSpeechSupported || !text) {
        return;
      }

      stopPassageSpeech();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = BCP47_LANGUAGE_MAP[lang];
      utterance.volume = volume;

      utterance.onerror = (event) => {
        console.error('Speech synthesis error (word):', event.error);
      };

      window.speechSynthesis.speak(utterance);
    },
    [isSpeechSupported, stopPassageSpeech, volume]
  );

  // --- NEW Passage Speech Controls ---
  const handlePlayPause = useCallback(() => {
    if (!isSpeechSupported || !quizData?.paragraph || !generatedPassageLanguage) return;

    if (isSpeakingPassage) {
      if (isPaused) {
        window.speechSynthesis.resume();
        setIsPaused(false);
      } else {
        window.speechSynthesis.pause();
        setIsPaused(true);
      }
    } else {
      stopPassageSpeech();

      const words = quizData.paragraph.split(/\s+/);
      wordsRef.current = words;

      const utterance = new SpeechSynthesisUtterance(quizData.paragraph);
      utterance.lang = BCP47_LANGUAGE_MAP[generatedPassageLanguage];
      utterance.volume = volume;

      passageUtteranceRef.current = utterance;

      utterance.onboundary = (event) => {
        if (event.name === 'word') {
          let wordIndex = 0;
          let charCount = 0;
          for (let i = 0; i < words.length; i++) {
            charCount += words[i].length + 1;
            if (charCount > event.charIndex) {
              wordIndex = i;
              break;
            }
          }
          setCurrentWordIndex(wordIndex);
        }
      };

      utterance.onend = () => {
        setIsSpeakingPassage(false);
        setIsPaused(false);
        setCurrentWordIndex(null);
        passageUtteranceRef.current = null;
      };

      utterance.onerror = (event) => {
        if (event.error !== 'interrupted') {
          console.error('Speech synthesis error (passage):', event.error);
          setIsSpeakingPassage(false);
          setIsPaused(false);
          setCurrentWordIndex(null);
          passageUtteranceRef.current = null;
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
    generatedPassageLanguage,
    stopPassageSpeech,
    volume,
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

  // Add type for translation API response
  interface TranslationResponse {
    responseStatus: number;
    responseData: {
      translatedText: string;
    };
  }

  const getTranslation = useCallback(
    async (word: string, sourceLang: string, targetLang: string): Promise<string> => {
      try {
        const response = await fetch(
          `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=${sourceLang}|${targetLang}`
        );

        if (!response.ok) throw new Error('Translation failed');

        const data = (await response.json()) as TranslationResponse;
        if (data.responseStatus === 200 && data.responseData?.translatedText) {
          return data.responseData.translatedText;
        }
        throw new Error('No translation available');
      } catch (error) {
        console.error('Translation error:', error);
        return word; // Return original word on error instead of null
      }
    },
    []
  );

  // Modify the renderParagraphWithWordHover function
  const renderParagraphWithWordHover = useCallback(
    (paragraphHtml: string | null, langType: Language) => {
      if (!paragraphHtml) return null;
      if (!isSpeechSupported) {
        return (
          <div
            dir={getTextDirection(langType)}
            className="text-gray-200 leading-relaxed mb-6"
            dangerouslySetInnerHTML={{ __html: paragraphHtml }}
          />
        );
      }

      const segments = paragraphHtml.split(/(\<[^>]+\>|\s+)/).filter(Boolean);
      let wordCounter = 0;

      return (
        <div dir={getTextDirection(langType)} className="text-gray-200 leading-relaxed mb-6">
          {segments.map((segment, index) => {
            if (segment.match(/^\s+$/)) {
              return <span key={index}>{segment}</span>;
            }
            if (segment.startsWith('<')) {
              return <span key={index} dangerouslySetInnerHTML={{ __html: segment }} />;
            }
            const isCurrentWord = wordCounter === currentWordIndex;
            wordCounter++;
            return (
              <TranslatableWord
                key={index}
                word={segment}
                fromLang={langType}
                isCurrentWord={isCurrentWord}
                onSpeak={() => speakText(segment, langType)}
                onTranslate={getTranslation}
              />
            );
          })}
        </div>
      );
    },
    [isSpeechSupported, speakText, getTranslation, currentWordIndex]
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

  // Add a function to handle volume changes
  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume);
    // Update volume of current utterance if one is playing
    if (passageUtteranceRef.current) {
      passageUtteranceRef.current.volume = newVolume;
    }
    // Also update any currently speaking synthesis
    if (window.speechSynthesis.speaking) {
      // Cancel and restart with new volume
      window.speechSynthesis.cancel();
      if (passageUtteranceRef.current) {
        passageUtteranceRef.current.volume = newVolume;
        window.speechSynthesis.speak(passageUtteranceRef.current);
        setIsSpeakingPassage(true);
        setIsPaused(false);
      }
    }
  }, []);

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
                <InformationCircleIcon className="h-5 w-5 mr-1 text-blue-400" aria-hidden="true" />
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
                <GlobeAltIcon className="h-5 w-5 mr-1 text-green-400" aria-hidden="true" />
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
                <ChatBubbleLeftRightIcon
                  className="h-5 w-5 mr-1 text-purple-400"
                  aria-hidden="true"
                />
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
              <BookOpenIcon className="h-5 w-5 mr-2 text-blue-400" aria-hidden="true" />
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
                      <HeroPauseIcon className="w-4 h-4" />
                    ) : (
                      <HeroPlayIcon className="w-4 h-4" />
                    )}
                  </button>
                  {isSpeakingPassage && ( // Show Stop button only when speaking/paused
                    <button
                      onClick={handleStop}
                      title="Stop"
                      className="flex items-center justify-center p-2 bg-red-600 text-white rounded-full hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors"
                    >
                      <HeroStopIcon className="w-4 h-4" />
                    </button>
                  )}
                  <div className="flex items-center space-x-2 bg-gray-700 rounded-full px-3 py-1">
                    <SpeakerWaveIcon className="w-4 h-4 text-gray-300" aria-hidden="true" />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={volume}
                      onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                      className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      title="Volume"
                    />
                  </div>
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
              <ArrowPathIcon
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                aria-hidden="true"
              />
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
              <PlusCircleIcon className="h-5 w-5 mr-2" aria-hidden="true" />
              Generate New Quiz
            </div>
          )}
        </button>
      </div>
    </div>
  );
}
