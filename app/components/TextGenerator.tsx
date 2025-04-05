'use client';

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';

import { z } from 'zod';
import {
  PlayIcon as HeroPlayIcon,
  PauseIcon as HeroPauseIcon,
  StopIcon as HeroStopIcon,
  SpeakerWaveIcon,
  GlobeAltIcon,
  BookOpenIcon,
  ArrowPathIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid';

import {
  useLanguage,
  type Language,
  LANGUAGES,
  SPEECH_LANGUAGES,
  getTextDirection,
} from '../contexts/LanguageContext';

import { useTranslation } from 'react-i18next';
import { useSession } from 'next-auth/react';
import AuthButton from './AuthButton';
import { toast, Toaster } from 'react-hot-toast';

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

type QuizData = z.infer<typeof quizDataSchema>;

const apiResponseSchema = z.object({
  result: z.string().optional(),
  error: z.string().optional(),
});

type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

const CEFR_LEVELS_LIST: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const QuizSkeleton = () => (
  <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg animate-pulse">
    <div className="h-4 bg-gray-700 rounded w-3/4 mb-4"></div>
    <div className="space-y-3 mb-6">
      <div className="h-3 bg-gray-700 rounded w-full"></div>
      <div className="h-3 bg-gray-700 rounded w-full"></div>
      <div className="h-3 bg-gray-700 rounded w-5/6"></div>
      <div className="h-3 bg-gray-700 rounded w-4/6"></div>
    </div>{' '}
    <div className="h-4 bg-gray-700 rounded w-1/2 mb-4"></div> {/* Question Placeholder */}
    <div className="space-y-2">
      <div className="h-10 bg-gray-700 rounded w-full"></div>
      <div className="h-10 bg-gray-700 rounded w-full"></div>
      <div className="h-10 bg-gray-700 rounded w-full"></div>
      <div className="h-10 bg-gray-700 rounded w-full"></div>
    </div>{' '}
  </div>
);

interface TranslatableWordProps {
  word: string;
  fromLang: Language;
  toLang: Language;
  isCurrentWord: boolean;
  isRelevant: boolean;
  onSpeak: () => void;
  onTranslate: (word: string, sourceLang: string, targetLang: string) => Promise<string>;
  t: (key: string) => string;
}

const TranslatableWord = memo(
  ({
    word,
    fromLang,
    toLang,
    isCurrentWord,
    isRelevant,
    onSpeak,
    onTranslate,
    t,
  }: TranslatableWordProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const [translation, setTranslation] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const shouldTranslate = fromLang !== toLang;

    const handleMouseEnter = useCallback(() => {
      setIsHovered(true);
      if (shouldTranslate && !translation && !isLoading) {
        void (async () => {
          setIsLoading(true);
          try {
            const sourceLang = SPEECH_LANGUAGES[fromLang].split('-')[0];
            const targetLang = SPEECH_LANGUAGES[toLang].split('-')[0];
            const result = await onTranslate(word, sourceLang, targetLang);
            setTranslation(result);
          } finally {
            setIsLoading(false);
          }
        })();
      }
    }, [word, fromLang, toLang, onTranslate, translation, isLoading, shouldTranslate]);

    const handleMouseLeave = useCallback(() => {
      setIsHovered(false);
    }, []);

    let combinedClassName =
      'cursor-pointer transition-colors duration-200 px-1 -mx-1 relative group';
    if (isRelevant) {
      combinedClassName += ' bg-yellow-300 text-black rounded';
    } else if (isCurrentWord) {
      combinedClassName += ' bg-blue-500 text-white rounded';
    } else {
      combinedClassName += ' hover:text-blue-400';
    }

    return (
      <span
        className={combinedClassName}
        onClick={onSpeak}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {word}
        {isHovered && shouldTranslate && (
          <span className="absolute -top-12 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-gray-900/95 border border-gray-600 text-white text-base rounded-lg shadow-xl z-10 whitespace-nowrap min-w-[100px] text-center backdrop-blur-sm">
            {isLoading ? (
              <span className="inline-block animate-pulse">{t('common.translating')}</span>
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

// Interface for API progress response
interface UserProgressResponse {
  currentLevel: CEFRLevel;
  currentStreak: number;
  leveledUp?: boolean; // Optional for GET response
}

export default function TextGenerator() {
  const { t } = useTranslation('common');
  const { status } = useSession();
  const [showLoginPrompt, setShowLoginPrompt] = useState(true);
  const [cefrLevel, setCefrLevel] = useState<CEFRLevel>('A1');
  const [userStreak, setUserStreak] = useState<number | null>(null);
  const [isProgressLoading, setIsProgressLoading] = useState<boolean>(false);
  const [passageLanguage, setPassageLanguage] = useState<Language>('en');
  const { language: questionLanguage } = useLanguage();
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);
  const [relevantTextRange, setRelevantTextRange] = useState<{ start: number; end: number } | null>(
    null
  );
  const [isSpeechSupported, setIsSpeechSupported] = useState<boolean>(false);
  const [isSpeakingPassage, setIsSpeakingPassage] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentWordIndex, setCurrentWordIndex] = useState<number | null>(null);
  const passageUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const wordsRef = useRef<string[]>([]);
  const [generatedPassageLanguage, setGeneratedPassageLanguage] = useState<Language | null>(null);
  const [generatedQuestionLanguage, setGeneratedQuestionLanguage] = useState<Language | null>(null);
  const [volume, setVolume] = useState(0.5);

  const [showQuestionSection, setShowQuestionSection] = useState<boolean>(false);
  const questionDelayTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setIsSpeechSupported(
      'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
    );
  }, []);

  useEffect(() => {
    const fetchUserProgress = async () => {
      if (status === 'authenticated') {
        setIsProgressLoading(true);
        let data: UserProgressResponse | null = null;
        try {
          const response = await fetch(`/api/user/progress?language=${passageLanguage}`);

          if (response.ok) {
            const rawData: unknown = await response.json();
            data = rawData as UserProgressResponse; // Assign typed data if ok
          } else {
            // Handle error response
            let errorMsg = `Failed to fetch user progress (${response.status})`;
            try {
              // Try reading error response as text first
              const errorText = await response.text();
              // Attempt to parse the text as JSON
              const errorData = JSON.parse(errorText) as { message?: string; error?: string }; // Type the parsed result
              errorMsg = errorData?.message || errorData?.error || errorMsg;
            } catch (errorParsingOrReadingError: unknown) {
              console.warn(
                '[Progress Fetch] Could not parse error response JSON or read text:',
                errorParsingOrReadingError
              );
              // Use the status code based message if parsing fails
            }
            throw new Error(errorMsg);
          }

          // Use the typed data variable now
          if (data && data.currentLevel && CEFR_LEVELS_LIST.includes(data.currentLevel)) {
            setCefrLevel(data.currentLevel);
          }
          setUserStreak(data?.currentStreak ?? 0);
          console.log(`[Progress] Fetched user progress for ${passageLanguage}:`, data);
        } catch (err) {
          console.error(`[Progress] Error fetching user progress for ${passageLanguage}:`, err);
          setCefrLevel('A1');
          setUserStreak(0);
        } finally {
          setIsProgressLoading(false);
        }
      } else {
        setUserStreak(null);
        setCefrLevel('A1');
      }
    };
    void fetchUserProgress();
  }, [status, passageLanguage]);

  const stopPassageSpeech = useCallback(() => {
    if (isSpeechSupported) {
      window.speechSynthesis.cancel();
      setIsSpeakingPassage(false);
      setIsPaused(false);
      setCurrentWordIndex(null);
      passageUtteranceRef.current = null;
    }
  }, [isSpeechSupported]);

  const speakText = useCallback(
    (text: string | null, lang: Language) => {
      if (!isSpeechSupported || !text) {
        return;
      }

      stopPassageSpeech();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = SPEECH_LANGUAGES[lang];
      utterance.volume = volume;

      utterance.onerror = (event) => {
        console.error('Speech synthesis error (word):', event.error);
      };

      window.speechSynthesis.speak(utterance);
    },
    [isSpeechSupported, stopPassageSpeech, volume]
  );

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
      utterance.lang = SPEECH_LANGUAGES[generatedPassageLanguage];
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

  useEffect(() => {
    return () => {
      stopPassageSpeech();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizData]);

  useEffect(() => {
    return () => {
      if (questionDelayTimeoutRef.current) clearTimeout(questionDelayTimeoutRef.current);
    };
  }, []);

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

  // Modified render function
  const renderParagraphWithWordHover = useCallback(
    (paragraph: string, lang: Language) => {
      const words = paragraph.split(/(\s+)/); // Split by spaces, keeping spaces
      let currentPos = 0;
      return words.map((segment, index) => {
        const segmentStart = currentPos;
        const segmentEnd = currentPos + segment.length;
        currentPos = segmentEnd; // Update position for next segment

        if (/^\s+$/.test(segment)) {
          return <span key={index}>{segment}</span>;
        }

        // Calculate word index based on non-whitespace segments
        const wordIndex = words.slice(0, index + 1).filter((s) => !/^\s+$/.test(s)).length - 1;
        const isCurrent = currentWordIndex === wordIndex && isSpeakingPassage;

        // Determine relevance based on character range overlap
        const isRelevant =
          relevantTextRange !== null &&
          segmentStart >= relevantTextRange.start &&
          segmentEnd <= relevantTextRange.end;

        return (
          <TranslatableWord
            key={index}
            word={segment}
            fromLang={lang}
            toLang={questionLanguage}
            isCurrentWord={isCurrent}
            isRelevant={isRelevant} // Pass the calculated relevance
            onSpeak={() => speakText(segment, lang)}
            onTranslate={getTranslation}
            t={t}
          />
        );
      });
    },
    [
      speakText,
      getTranslation,
      currentWordIndex,
      t,
      isSpeakingPassage,
      relevantTextRange,
      questionLanguage, // Add questionLanguage dependency
    ]
  );

  const generateText = useCallback(async () => {
    stopPassageSpeech();
    setLoading(true);
    setError(null);
    setQuizData(null);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setShowExplanation(false);
    setShowQuestionSection(false);
    setCurrentWordIndex(null);
    setRelevantTextRange(null); // Reset range
    if (questionDelayTimeoutRef.current) {
      clearTimeout(questionDelayTimeoutRef.current);
    }

    const levelToUse = cefrLevel;

    const passageLanguageName = LANGUAGES[passageLanguage] || passageLanguage;
    const questionLanguageName = LANGUAGES[questionLanguage] || questionLanguage;

    const prompt = `Generate a reading passage in ${passageLanguageName} suitable for CEFR level ${levelToUse}. The passage should be interesting and typical for language learners at this stage. After the passage, provide a multiple-choice comprehension question about it, four answer options (A, B, C, D), indicate the correct answer letter, provide a brief topic description (3-5 words in English) for image generation, provide explanations for each option being correct or incorrect, and include the relevant text snippet from the passage supporting the correct answer. Format the question, options, and explanations in ${questionLanguageName}. Respond ONLY with the JSON object.`;

    const seed = Math.floor(Math.random() * 100);

    console.log('[API] Sending request with prompt:', prompt.substring(0, 100) + '...');
    console.log(
      '[API] Passage Lang:',
      passageLanguage,
      'Question Lang:',
      questionLanguage,
      'Level:',
      levelToUse
    );

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, seed, passageLanguage, questionLanguage }),
      });

      if (!response.ok) {
        // Define a simple type for the expected error structure
        type ErrorResponse = { error?: string; message?: string };
        let errorData: ErrorResponse = {};
        try {
          // Try to parse the error response body
          errorData = (await response.json()) as ErrorResponse;
        } catch (parseError) {
          console.warn('Could not parse error response JSON:', parseError);
          // If parsing fails, use the status text or a default message
          throw new Error(response.statusText || `HTTP error! status: ${response.status}`);
        }
        // Use the parsed error message if available
        throw new Error(
          errorData.error || errorData.message || `HTTP error! status: ${response.status}`
        );
      }

      // Await the JSON response first, then parse
      const jsonResponse = (await response.json()) as unknown;
      const data = apiResponseSchema.parse(jsonResponse);

      if (data.error || !data.result) {
        throw new Error(data.error || 'No result received');
      }

      // Clean up the string response from the AI before parsing
      const jsonString = data.result.replace(/```json|```/g, '').trim();

      try {
        // Use Zod's pipeline for safe JSON parsing - this avoids direct JSON.parse entirely
        const parsedResult = z
          .string()
          .transform((str) => {
            try {
              return JSON.parse(str) as unknown;
            } catch (e) {
              throw new Error(`Failed to parse JSON: ${String(e)}`);
            }
          })
          .pipe(quizDataSchema)
          .safeParse(jsonString);

        if (!parsedResult.success) {
          console.error('Error parsing generated quiz JSON:', parsedResult.error);
          throw new Error('Failed to parse the structure of the generated quiz.');
        }

        // No need to cast - Zod guarantees the type
        const validatedData = parsedResult.data;

        setQuizData(validatedData);
        setGeneratedPassageLanguage(passageLanguage);
        setGeneratedQuestionLanguage(questionLanguage);

        // --- Calculate Dynamic Question Delay ---
        const WPM = 300; // Change WPM estimate to 300
        const wordCount = validatedData.paragraph.split(/\s+/).filter(Boolean).length;
        const readingTimeMs = (wordCount / WPM) * 60 * 1000;
        const bufferMs = 2000; // Reduce buffer further to 2 seconds
        const minDelayMs = 2000; // Reduce minimum delay further to 2 seconds
        const questionDelayMs = Math.max(minDelayMs, readingTimeMs + bufferMs);
        console.log(
          `[DelayCalc] Words: ${wordCount}, Est. Read Time: ${readingTimeMs.toFixed(0)}ms, Delay Set: ${questionDelayMs.toFixed(0)}ms`
        );
        // --- End Calculate Delay ---

        // Start timer to show question section using calculated delay
        questionDelayTimeoutRef.current = setTimeout(() => {
          setShowQuestionSection(true);
        }, questionDelayMs); // Use dynamic delay
      } catch (err: unknown) {
        console.error('Error parsing generated quiz JSON:', err);
        if (err instanceof Error) {
          setError(`${t('common.errorPrefix')} ${err.message}`);
        } else {
          setError(t('practice.error'));
        }
      }
    } catch (err: unknown) {
      console.error('Error generating text:', err);
      if (err instanceof Error) {
        setError(`${t('common.errorPrefix')} ${err.message}`);
      } else {
        setError(t('practice.error'));
      }
    } finally {
      setLoading(false);
    }
  }, [passageLanguage, questionLanguage, cefrLevel, stopPassageSpeech, t]);

  // Create a properly typed click handler function
  const handleGenerateClick = useCallback(() => {
    void generateText();
  }, [generateText]);

  const handleAnswerSelect = useCallback(
    async (answer: string) => {
      if (isAnswered || !quizData) return;

      stopPassageSpeech();
      setSelectedAnswer(answer);
      setIsAnswered(true);
      setShowExplanation(false);
      setRelevantTextRange(null); // Reset range initially

      // Find and set the relevant text range
      if (quizData.relevantText && quizData.paragraph) {
        const startIndex = quizData.paragraph.indexOf(quizData.relevantText);
        if (startIndex !== -1) {
          setRelevantTextRange({
            start: startIndex,
            end: startIndex + quizData.relevantText.length,
          });
          console.log(
            `[Highlight] Relevant text range found: ${startIndex} - ${startIndex + quizData.relevantText.length}`
          );
        } else {
          console.warn(
            '[Highlight] Relevant text not found exactly in paragraph:',
            quizData.relevantText
          );
        }
      }

      if (status === 'authenticated') {
        let progressData: UserProgressResponse | null = null;
        try {
          const response = await fetch('/api/user/progress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              isCorrect: answer === quizData.correctAnswer,
              language: generatedPassageLanguage,
            }),
          });

          if (response.ok) {
            progressData = (await response.json()) as UserProgressResponse;
          } else {
            let errorMsg = `Failed to update progress (${response.status})`;
            try {
              const errorText = await response.text();
              const errorData = JSON.parse(errorText) as { message?: string; error?: string }; // Type the parsed result
              errorMsg = errorData?.message || errorData?.error || errorMsg;
            } catch (errorParsingOrReadingError: unknown) {
              console.warn(
                '[Progress Update] Could not parse error response JSON or read text:',
                errorParsingOrReadingError
              );
            }
            throw new Error(errorMsg);
          }

          // Use the typed progressData variable
          if (progressData) {
            const previousStreak = userStreak || 0;
            setUserStreak(progressData.currentStreak);

            if (progressData.leveledUp) {
              console.log('[Progress] Leveled up!', progressData);
              setCefrLevel(progressData.currentLevel);
              toast.success(`${t('practice.leveledUp')} ${progressData.currentLevel}! 🎉`, {
                duration: 4000,
                position: 'top-center',
              });
            } else if (progressData.currentStreak > previousStreak) {
              // Show toast notification for streak increase
              toast.success(`${t('practice.streakIncreased')} ${progressData.currentStreak} 🔥`, {
                duration: 3000,
                position: 'top-center',
              });
              console.log('[Progress] Updated streak:', progressData.currentStreak);
            } else {
              console.log('[Progress] Updated streak:', progressData.currentStreak);
            }
          }
        } catch (err) {
          console.error('[Progress] Error updating progress:', err);
          toast.error(t('practice.progressUpdateError'), { duration: 3000 });
        }
      }

      setTimeout(() => setShowExplanation(true), 300);
    },
    [isAnswered, quizData, stopPassageSpeech, status, t, generatedPassageLanguage]
  );

  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume);
    if (passageUtteranceRef.current) {
      passageUtteranceRef.current.volume = newVolume;
    }
    if (window.speechSynthesis.speaking) {
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
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <Toaster />
      <div className="w-full max-w-3xl mx-auto my-8">
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700 shadow-lg mb-8">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <label
              htmlFor="passage-language-select"
              className="block text-sm font-medium text-white col-span-1"
            >
              <span className="flex items-center">
                <GlobeAltIcon className="h-5 w-5 mr-1 text-green-400" aria-hidden="true" />
                {t('practice.passageLanguageLabel')}
              </span>
            </label>
            <label
              htmlFor="cefr-level-display"
              className="block text-sm font-medium text-white col-span-1"
            >
              <span className="flex items-center">
                <BookOpenIcon className="h-4 w-4 mr-1.5 text-blue-400" />
                {t('practice.level')}
              </span>
            </label>
            <select
              id="passage-language-select"
              value={passageLanguage}
              onChange={(e) => setPassageLanguage(e.target.value as Language)}
              className="w-full px-3 py-2 text-sm text-white bg-gray-700 border border-gray-600 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-green-500 transition-colors col-span-1"
            >
              {(Object.keys(LANGUAGES) as Language[]).map((lang) => (
                <option key={lang} value={lang}>
                  {LANGUAGES[lang]}
                </option>
              ))}
            </select>
            <div
              id="cefr-level-display"
              className="relative w-full px-3 py-2 text-sm text-white bg-gray-800 border border-gray-700 rounded col-span-1 flex items-center justify-between cursor-default"
            >
              <span>
                {cefrLevel} - {t(`practice.cefr.levels.${cefrLevel}.name`)}
                {isProgressLoading && status === 'authenticated' && (
                  <span className="ml-2 text-xs text-gray-400 animate-pulse">
                    {t('common.loading')}
                  </span>
                )}
              </span>

              {/* Display Streak */}
              {status === 'authenticated' && userStreak !== null && userStreak > 0 && (
                <span
                  className="text-xs font-semibold bg-yellow-500 text-black px-2 py-0.5 rounded-full shadow"
                  title={`${t('practice.correctStreak')}: ${userStreak}`}
                >
                  🔥 {userStreak}
                </span>
              )}
            </div>
          </div>
        </div>

        {status === 'unauthenticated' && showLoginPrompt && (
          <div className="bg-gradient-to-r from-blue-900/60 to-indigo-900/60 border border-blue-700/70 rounded-lg p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
            <p className="text-sm text-blue-100 flex-grow text-center sm:text-left order-2 sm:order-1">
              {t('practice.signInPrompt.message')}
            </p>
            <div className="flex-shrink-0 order-1 sm:order-2">
              <AuthButton />
            </div>
            <button
              onClick={() => setShowLoginPrompt(false)}
              className="p-1 text-blue-300 hover:text-white hover:bg-blue-800/50 rounded-full transition-colors flex-shrink-0 order-3"
              aria-label={t('practice.signInPrompt.dismiss')}
              title={t('practice.signInPrompt.dismiss')}
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        )}

        {error && (
          <div
            className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded relative mb-6 shadow-md"
            role="alert"
          >
            <strong className="font-bold">{t('common.errorPrefix')}</strong>
            <span className="block sm:inline ml-2">{error}</span>
          </div>
        )}

        {loading && !quizData && <QuizSkeleton />}

        {quizData && !loading && generatedPassageLanguage && generatedQuestionLanguage && (
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
              <div className="flex items-center space-x-2 text-lg font-semibold">
                <BookOpenIcon className="w-5 h-5 text-blue-400" />
                <span>{t('practice.passageTitle')}</span>
              </div>

              {isSpeechSupported && quizData.paragraph && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handlePlayPause}
                    title={isSpeakingPassage && !isPaused ? t('common.pause') : t('common.play')}
                    className="flex items-center justify-center p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 transition-colors disabled:opacity-50"
                    disabled={!quizData.paragraph}
                  >
                    {isSpeakingPassage && !isPaused ? (
                      <HeroPauseIcon className="w-4 h-4" />
                    ) : (
                      <HeroPlayIcon className="w-4 h-4" />
                    )}
                  </button>
                  {isSpeakingPassage && (
                    <button
                      onClick={handleStop}
                      title={t('common.stop')}
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
                      title={t('common.volume')}
                    />
                  </div>
                </div>
              )}
            </div>

            <div
              className="prose prose-invert max-w-none text-gray-300 leading-relaxed"
              dir={getTextDirection(generatedPassageLanguage)}
            >
              {/* Always use renderParagraphWithWordHover */}
              {quizData && generatedPassageLanguage ? (
                renderParagraphWithWordHover(quizData.paragraph, generatedPassageLanguage)
              ) : (
                <div>{quizData?.paragraph}</div> // Fallback if needed
              )}
            </div>

            {quizData && !showQuestionSection && (
              <div className="mt-4 text-center text-gray-400 text-sm animate-pulse">
                {t('practice.questionWillAppear')}
              </div>
            )}

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
                        /* eslint-disable-next-line @typescript-eslint/no-misused-promises */
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
                  <div className="mt-4 p-4 bg-gray-700/50 border border-gray-600 rounded-lg shadow">
                    <h4 className="text-lg font-semibold mb-3 text-blue-300">
                      {t('practice.explanation')}
                    </h4>
                    <div className="space-y-3 text-sm">
                      {Object.entries(quizData.explanations).map(([key, explanation]) => (
                        <div
                          key={key}
                          className={`p-2 rounded ${key === quizData.correctAnswer ? 'bg-green-900/30 ring-1 ring-green-600/50' : ''} ${selectedAnswer === key && key !== quizData.correctAnswer ? 'bg-red-900/30 ring-1 ring-red-600/50' : ''}`}
                        >
                          <strong
                            className={`font-semibold ${key === quizData.correctAnswer ? 'text-green-300' : selectedAnswer === key ? 'text-red-300' : 'text-gray-300'}`}
                          >
                            {key}:
                          </strong>{' '}
                          <span className="text-gray-300">{explanation}</span>
                        </div>
                      ))}
                      {quizData.relevantText && (
                        <div className="mt-3 pt-3 border-t border-gray-600">
                          <p className="text-xs text-gray-400 italic">
                            {t('practice.supportingTextPrefix')}
                          </p>
                          <p
                            className="text-sm text-gray-300 font-mono bg-gray-800 p-2 rounded border border-gray-600/50"
                            dir={getTextDirection(generatedPassageLanguage || 'en')}
                          >
                            &quot;{quizData.relevantText}&quot;
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {(!quizData || isAnswered) && (
          <div className="mt-8">
            <button
              onClick={handleGenerateClick}
              disabled={loading}
              className={`w-full px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white ${loading ? 'bg-gray-600 cursor-not-allowed opacity-70' : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-green-500 hover:from-blue-600 hover:via-indigo-600 hover:to-green-600'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-cyan-500 transition duration-150 ease-in-out flex items-center justify-center`}
            >
              {loading ? (
                <div className="flex items-center">
                  <ArrowPathIcon
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    aria-hidden="true"
                  />
                  {t('common.generating')}
                </div>
              ) : (
                t('practice.generateNewText')
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
