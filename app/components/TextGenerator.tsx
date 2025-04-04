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
import AnimateTransition from './AnimateTransition';
import { getRandomTopicForLevel } from '../config/topics';
import {
  getVocabularyGuidance,
  getGrammarGuidance,
  type CEFRLevel,
} from '../config/language-guidance';

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

const CEFR_LEVELS_LIST: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const QuizSkeleton = () => (
  <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
    <AnimateTransition
      show={true}
      type="fade-in"
      duration={400}
      className="h-4 bg-gray-700 rounded w-3/4 mb-4 animate-pulse"
    >
      <div></div>
    </AnimateTransition>

    <div className="space-y-3 mb-6">
      {[1, 2, 3, 4].map((i) => (
        <AnimateTransition
          key={i}
          show={true}
          type="slide-right"
          duration={400}
          delay={i * 100}
          className={`h-3 bg-gray-700 rounded animate-pulse ${
            i === 3 ? 'w-5/6' : i === 4 ? 'w-4/6' : 'w-full'
          }`}
        >
          <div></div>
        </AnimateTransition>
      ))}
    </div>

    <AnimateTransition
      show={true}
      type="fade-in"
      duration={400}
      delay={600}
      className="h-4 bg-gray-700 rounded w-1/2 mb-4 animate-pulse"
    >
      <div></div>
    </AnimateTransition>

    <div className="space-y-2">
      {[1, 2, 3, 4].map((i) => (
        <AnimateTransition
          key={i}
          show={true}
          type="slide-left"
          duration={500}
          delay={600 + i * 150}
          className="h-10 bg-gray-700 rounded w-full animate-pulse"
        >
          <div></div>
        </AnimateTransition>
      ))}
    </div>
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

    let combinedClassName = 'cursor-pointer transition-all duration-300 px-1 -mx-1 relative group';
    if (isRelevant) {
      combinedClassName += ' bg-yellow-300 text-black rounded';
    } else if (isCurrentWord) {
      combinedClassName += ' bg-blue-500 text-white rounded';
    } else {
      combinedClassName += ' hover:text-blue-400';
    }

    // Only show translation popup when not loading and translation is available
    const showTranslation = isHovered && shouldTranslate && !isLoading && translation !== null;

    return (
      <span
        className={combinedClassName}
        onClick={onSpeak}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {word}
        <AnimateTransition
          show={showTranslation}
          type="scale-up"
          duration={200}
          unmountOnExit
          className="absolute -top-12 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-gray-900/95 border border-gray-600 text-white text-base rounded-lg shadow-xl z-10 whitespace-nowrap min-w-[100px] text-center backdrop-blur-sm"
        >
          <span className="font-medium">{translation || word}</span>
        </AnimateTransition>
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

  // Add a ref for the content container to scroll to
  const contentContainerRef = useRef<HTMLDivElement>(null);

  // Add a state to control content display transitions
  const [showContent, setShowContent] = useState<boolean>(true);

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
  }, [quizData, stopPassageSpeech]);

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
          />
        );
      });
    },
    [
      speakText,
      getTranslation,
      currentWordIndex,
      isSpeakingPassage,
      relevantTextRange,
      questionLanguage, // Add questionLanguage dependency
    ]
  );

  const generateText = useCallback(() => {
    // First hide the current content with animation
    setShowContent(false);

    // Wait for exit animation to complete before starting new content generation
    setTimeout(() => {
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

      // Get a random topic appropriate for the current CEFR level
      const randomTopic = getRandomTopicForLevel(levelToUse);

      // Get vocabulary and grammar guidance for the current level
      const vocabGuidance = getVocabularyGuidance(levelToUse);
      const grammarGuidance = getGrammarGuidance(levelToUse);

      const passageLanguageName = LANGUAGES[passageLanguage] || passageLanguage;
      const questionLanguageName = LANGUAGES[questionLanguage] || questionLanguage;

      // Add language guidance to the prompt for A1 and A2 levels
      let languageInstructions = '';
      if (['A1', 'A2'].includes(levelToUse)) {
        languageInstructions = `\n\nVocabulary guidance: ${vocabGuidance}\n\nGrammar guidance: ${grammarGuidance}`;
      }

      const prompt = `Generate a reading passage in ${passageLanguageName} suitable for CEFR level ${levelToUse} about the topic "${randomTopic}". The passage should be interesting and typical for language learners at this stage. After the passage, provide a multiple-choice comprehension question about it, four answer options (A, B, C, D), indicate the correct answer letter, provide a brief topic description (3-5 words in English) for image generation, provide explanations for each option being correct or incorrect, and include the relevant text snippet from the passage supporting the correct answer. Format the question, options, and explanations in ${questionLanguageName}. Respond ONLY with the JSON object.${languageInstructions}`;

      const seed = Math.floor(Math.random() * 100);

      console.log('[API] Sending request with prompt:', prompt.substring(0, 100) + '...');
      console.log(
        '[API] Passage Lang:',
        passageLanguage,
        'Question Lang:',
        questionLanguage,
        'Level:',
        levelToUse,
        'Topic:',
        randomTopic
      );

      const MAX_RETRIES = 2;
      let currentRetry = 0;
      let forceCache = false;

      async function attemptFetch() {
        try {
          const requestBody = {
            prompt,
            seed,
            passageLanguage,
            questionLanguage,
            forceCache, // Add this parameter to the request
          };

          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
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
          const WPM = 250; // Lower WPM for a quicker appearance
          const wordCount = validatedData.paragraph.split(/\s+/).filter(Boolean).length;
          const readingTimeMs = (wordCount / WPM) * 60 * 1000;
          const bufferMs = 1500; // Further reduce buffer for a more responsive feel
          const minDelayMs = 1500; // Shorter minimum delay
          const questionDelayMs = Math.max(minDelayMs, readingTimeMs + bufferMs);
          console.log(
            `[DelayCalc] Words: ${wordCount}, Est. Read Time: ${readingTimeMs.toFixed(0)}ms, Delay Set: ${questionDelayMs.toFixed(0)}ms`
          );
          // --- End Calculate Delay ---

          // Start timer to show question section using calculated delay, but with a cross-fade effect
          questionDelayTimeoutRef.current = setTimeout(() => {
            // When it's time to show the question, first make sure content is visible
            if (!showContent) setShowContent(true);

            // Short delay to ensure content is visible before showing question
            setTimeout(() => {
              setShowQuestionSection(true);
            }, 100);
          }, questionDelayMs);

          return true; // Indicate success
        } catch (err: unknown) {
          console.error(`Error during attempt ${currentRetry + 1}:`, err);
          if (currentRetry < MAX_RETRIES) {
            // If we have retries left, increment the counter and try again
            currentRetry++;
            console.log(`Retrying... Attempt ${currentRetry + 1} of ${MAX_RETRIES + 1}`);
            return false; // Indicate failure, triggering a retry
          } else if (!forceCache) {
            // We've exhausted our retries, try the cache as last resort
            console.log('Retries exhausted, trying to force cache retrieval');
            forceCache = true;
            currentRetry = 0; // Reset retry counter for the cache attempt
            return false; // Indicate failure, triggering the cache attempt
          } else {
            // We've tried retries and cache, now show error
            if (err instanceof Error) {
              setError(`${t('common.errorPrefix')} ${err.message}`);
            } else {
              setError(t('practice.error'));
            }
            throw err; // Re-throw to exit the retry loop
          }
        }
      }

      async function executeWithRetries() {
        try {
          let success = false;

          // Keep trying until we succeed or exhaust all options
          while (!success && (currentRetry <= MAX_RETRIES || !forceCache)) {
            success = await attemptFetch();

            // If not successful and still have retries, wait before next attempt
            if (!success && currentRetry <= MAX_RETRIES) {
              const delay = Math.pow(2, currentRetry) * 1000; // Exponential backoff
              console.log(`Waiting ${delay}ms before retry ${currentRetry + 1}...`);
              await new Promise((resolve) => setTimeout(resolve, delay));
            }
          }
        } catch (err) {
          // Final error handling is already done in attemptFetch
          console.error('All attempts failed:', err);
        } finally {
          setLoading(false);
          // Show the new content with animation after loading completes
          setShowContent(true);

          // Scroll to content after it becomes visible
          setTimeout(() => {
            if (contentContainerRef.current) {
              contentContainerRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              });
            }
          }, 100);
        }
      }

      // Add the void operator to handle the floating promise
      void executeWithRetries();
    }, 300); // Wait for exit animation to complete
  }, [
    passageLanguage,
    questionLanguage,
    cefrLevel,
    stopPassageSpeech,
    t,
    showContent,
    contentContainerRef,
  ]);

  // Now update the generateTextHandler function to scroll to the content container
  const generateTextHandler = useCallback(() => {
    // First scroll to the content area
    if (contentContainerRef.current) {
      contentContainerRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }

    // Then generate the text
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
          // Log the language being sent to ensure it's correct
          console.log(`[Progress] Sending update with language: ${generatedPassageLanguage}`);

          if (!generatedPassageLanguage) {
            throw new Error('Missing passage language');
          }

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

            // First check for level up
            if (progressData.leveledUp) {
              setCefrLevel(progressData.currentLevel);
            }

            // Then check for streak increase (handle separately)
            const streakIncreased = progressData.currentStreak > previousStreak;
            // Also show streak toast when user completes 5 correct answers and levels up (streak resets to 0)
            const completedStreakAndLeveledUp = progressData.leveledUp && previousStreak >= 4;

            if (streakIncreased) {
              // Remove toast call
            } else if (completedStreakAndLeveledUp) {
              // Remove toast call
            }
          }
        } catch (err) {
          console.error('[Progress] Error updating progress:', err);
        }
      }

      setTimeout(() => setShowExplanation(true), 100);
    },
    [isAnswered, quizData, stopPassageSpeech, status, generatedPassageLanguage, userStreak]
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

  // Add a helper function to handle async click events
  const handleAsyncClick = useCallback(
    (asyncFn: (key: string) => Promise<void>, key: string) =>
      (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        void asyncFn(key);
      },
    []
  );

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 relative" ref={contentContainerRef}>
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

              {/* Display Streak - Moved to progress section only */}
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
          <AnimateTransition show={showContent} type="fade-in" duration={400} unmountOnExit>
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

              <AnimateTransition
                show={true}
                type="fade-in"
                duration={600}
                className="prose prose-invert max-w-none text-gray-300 leading-relaxed"
              >
                <div dir={getTextDirection(generatedPassageLanguage)}>
                  {/* Always use renderParagraphWithWordHover */}
                  {quizData && generatedPassageLanguage ? (
                    renderParagraphWithWordHover(quizData.paragraph, generatedPassageLanguage)
                  ) : (
                    <div>{quizData?.paragraph}</div> // Fallback if needed
                  )}
                </div>
              </AnimateTransition>

              {quizData && !showQuestionSection && (
                <AnimateTransition
                  show={true}
                  type="fade-in"
                  duration={400}
                  className="mt-4 text-center text-gray-400 text-sm animate-pulse"
                >
                  {t('practice.questionWillAppear')}
                </AnimateTransition>
              )}

              <AnimateTransition
                show={showQuestionSection}
                type="slide-up"
                duration={500}
                unmountOnExit
              >
                <div className="mt-6">
                  <h3
                    dir={getTextDirection(questionLanguage)}
                    className="text-lg font-semibold text-white mb-4"
                  >
                    {quizData.question}
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(quizData.options).map(([key, value], index) => (
                      <AnimateTransition
                        key={key}
                        show={showQuestionSection}
                        type="slide-right"
                        duration={400}
                        delay={100 * index} // Stagger the animations
                        className="w-full"
                      >
                        <button
                          onClick={handleAsyncClick(handleAnswerSelect, key)}
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
                      </AnimateTransition>
                    ))}
                  </div>
                </div>

                <AnimateTransition
                  show={showExplanation}
                  type="scale-up"
                  duration={400}
                  unmountOnExit
                >
                  <div className="mt-4 p-4 bg-gray-700/50 border border-gray-600 rounded-lg shadow">
                    <h4 className="text-lg font-semibold mb-3 text-blue-300">
                      {t('practice.explanation')}
                    </h4>
                    <div className="space-y-3 text-sm">
                      {Object.entries(quizData.explanations).map(([key, explanation], index) => (
                        <AnimateTransition
                          key={key}
                          show={showExplanation}
                          type="slide-left"
                          duration={400}
                          delay={100 * index} // Stagger the animations
                          className="w-full"
                        >
                          <div
                            className={`p-2 rounded ${key === quizData.correctAnswer ? 'bg-green-900/30 ring-1 ring-green-600/50' : ''} ${selectedAnswer === key && key !== quizData.correctAnswer ? 'bg-red-900/30 ring-1 ring-red-600/50' : ''}`}
                          >
                            <strong
                              className={`font-semibold ${key === quizData.correctAnswer ? 'text-green-300' : selectedAnswer === key ? 'text-red-300' : 'text-gray-300'}`}
                            >
                              {key}:
                            </strong>{' '}
                            <span className="text-gray-300">{explanation}</span>
                          </div>
                        </AnimateTransition>
                      ))}
                    </div>
                  </div>
                </AnimateTransition>
              </AnimateTransition>
            </div>
          </AnimateTransition>
        )}

        {(!quizData || isAnswered) && (
          <AnimateTransition show={showContent} type="fade-in" duration={400} delay={400}>
            <div className="mt-8">
              {/* Add new progress section */}
              {status === 'authenticated' && userStreak !== null && (
                <div className="mb-6 p-4 bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl border border-gray-700 shadow-lg">
                  <h3 className="text-lg font-semibold text-white mb-3">
                    {t('practice.yourProgress')}
                  </h3>

                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <span className="text-sm text-gray-400">{t('practice.currentStreak')}</span>

                      {/* Progress bar for streak */}
                      <div className="mt-2 w-full bg-gray-700 rounded-full h-2.5">
                        <div
                          className="bg-gradient-to-r from-yellow-500 to-orange-500 h-2.5 rounded-full transition-all duration-300 ease-in-out"
                          style={{ width: `${Math.min(100, (userStreak / 5) * 100)}%` }}
                        ></div>
                      </div>

                      {/* Simple streak indicator without numbers */}
                      <div className="mt-3 flex justify-between items-center">
                        {[1, 2, 3, 4, 5].map((position) => (
                          <div key={position} className="flex flex-col items-center">
                            <div
                              className={`w-3 h-3 rounded-full
                                ${position <= userStreak ? 'bg-yellow-500' : 'bg-gray-600'}
                                transition-all duration-300`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Level progress section */}
                    <div className="mt-6 pt-4 border-t border-gray-700">
                      <span className="text-sm text-gray-400 block mb-2">
                        {t('practice.level')}
                      </span>
                      <div className="flex items-center mb-4">
                        <span className="text-xl font-bold text-white mr-2">{cefrLevel}</span>
                        <span className="text-sm text-gray-300">
                          - {t(`practice.cefr.levels.${cefrLevel}.name`)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-300 mb-4">
                        {t(`practice.cefr.levels.${cefrLevel}.description`)}
                      </div>

                      {/* Level labels above the progress indicators */}
                      <div className="flex justify-between items-center text-xs text-gray-400 mb-1">
                        <span>A1</span>
                        <span>A2</span>
                        <span>B1</span>
                        <span>B2</span>
                        <span>C1</span>
                        <span>C2</span>
                      </div>

                      <div className="flex justify-between items-center mb-1">
                        {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((level, index) => {
                          const achieved =
                            ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].indexOf(cefrLevel) >= index;
                          const isCurrent = level === cefrLevel;
                          return (
                            <div key={level} className="flex flex-col items-center">
                              <div
                                className={`w-3 h-3 rounded-full ${
                                  achieved ? 'bg-blue-500' : 'bg-gray-600'
                                } ${isCurrent ? 'ring-1 ring-white ring-opacity-60' : ''}`}
                                title={`${level}: ${t(`practice.cefr.levels.${level}.name`)}`}
                              />
                            </div>
                          );
                        })}
                      </div>

                      <div className="w-full bg-gray-700 rounded-full h-2.5 mt-1">
                        {/* Calculate progress based on CEFR level */}
                        {(() => {
                          const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
                          const levelIndex = levels.indexOf(cefrLevel);
                          const progress = ((levelIndex + 1) / 6) * 100;
                          return (
                            <div
                              className="bg-gradient-to-r from-blue-500 via-indigo-500 to-green-500 h-2.5 rounded-full transition-all duration-300 ease-in-out"
                              style={{ width: `${progress}%` }}
                            ></div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Only show the "Give me something to read" button when there's no content or user has answered */}
              <button
                onClick={generateTextHandler}
                disabled={loading}
                className={`w-full px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white ${loading ? 'bg-gray-600 cursor-not-allowed opacity-70' : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-green-500 hover:from-blue-600 hover:via-indigo-600 hover:to-green-600'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-cyan-500 transition duration-150 ease-in-out flex items-center justify-center`}
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin -ml-1 mr-3 h-5 w-5 text-white">
                      <svg
                        className="h-5 w-5"
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
                    </div>
                    {t('common.generating')}
                  </div>
                ) : (
                  t('practice.generateNewText')
                )}
              </button>
            </div>
          </AnimateTransition>
        )}
      </div>
    </div>
  );
}
