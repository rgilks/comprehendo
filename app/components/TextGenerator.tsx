'use client';

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';

import { z } from 'zod';
import {
  PlayIcon as HeroPlayIcon,
  PauseIcon as HeroPauseIcon,
  StopIcon as HeroStopIcon,
  SpeakerWaveIcon,
  InformationCircleIcon,
  GlobeAltIcon,
  BookOpenIcon,
  ArrowPathIcon,
  PlusCircleIcon,
} from '@heroicons/react/24/solid';

import {
  useLanguage,
  type Language,
  LANGUAGES,
  SPEECH_LANGUAGES,
  getTextDirection,
} from '../contexts/LanguageContext';

import { useTranslation } from 'react-i18next';

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
  isCurrentWord: boolean;
  onSpeak: () => void;
  onTranslate: (word: string, sourceLang: string, targetLang: string) => Promise<string>;
  t: (key: string) => string;
}

const TranslatableWord = memo(
  ({ word, fromLang, isCurrentWord, onSpeak, onTranslate, t }: TranslatableWordProps) => {
    const [isHovered, setIsHovered] = useState(false);
    const [translation, setTranslation] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleMouseEnter = useCallback(() => {
      setIsHovered(true);
      if (!translation && !isLoading) {
        void (async () => {
          setIsLoading(true);
          try {
            const sourceLang = SPEECH_LANGUAGES[fromLang].split('-')[0];
            const targetLang = SPEECH_LANGUAGES['en'].split('-')[0];
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

export default function TextGenerator() {
  const { t } = useTranslation();
  const [cefrLevel, setCefrLevel] = useState<CEFRLevel>('B1');
  const [passageLanguage, setPassageLanguage] = useState<Language>('en');
  const { language: questionLanguage } = useLanguage();
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
  const [volume, setVolume] = useState(0.5);

  const QUESTION_DELAY_MS = 20000;
  const [showQuestionSection, setShowQuestionSection] = useState<boolean>(false);
  const questionDelayTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setIsSpeechSupported(
      'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
    );
  }, []);

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

  const highlightRelevantText = useCallback(() => {
    if (quizData && showExplanation && quizData.relevantText) {
      try {
        const escapedText = quizData.relevantText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedText})`, 'gi');
        const highlighted = quizData.paragraph.replace(
          regex,
          '<mark class="bg-yellow-300 text-black px-1 rounded">$1</mark>'
        );
        setHighlightedParagraph(highlighted);
      } catch (e) {
        console.error('Error creating regex or highlighting text:', e);
        setHighlightedParagraph(quizData.paragraph);
      }
    } else {
      setHighlightedParagraph(quizData?.paragraph || null);
    }
  }, [quizData, showExplanation]);

  useEffect(() => {
    if (showExplanation) {
      highlightRelevantText();
    }
    if (!showExplanation && quizData) {
      setHighlightedParagraph(quizData.paragraph);
    }
  }, [showExplanation, highlightRelevantText, quizData]);

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

  const renderParagraphWithWordHover = useCallback(
    (paragraph: string, lang: Language) => {
      const words = paragraph.split(/(\s+)/); // Split by spaces, keeping spaces
      return words.map((segment, index) => {
        // Check if the segment is whitespace
        if (/^\s+$/.test(segment)) {
          return <span key={index}>{segment}</span>;
        }
        // Treat non-whitespace segments as words
        const wordIndex = words.slice(0, index + 1).filter((s) => !/^\s+$/.test(s)).length - 1;
        return (
          <TranslatableWord
            key={index}
            word={segment}
            fromLang={lang}
            isCurrentWord={currentWordIndex === wordIndex && isSpeakingPassage}
            onSpeak={() => speakText(segment, lang)}
            onTranslate={getTranslation}
            t={t}
          />
        );
      });
    },
    [speakText, getTranslation, currentWordIndex, t, isSpeakingPassage]
  );

  const generateText = async () => {
    stopPassageSpeech();
    setGeneratedPassageLanguage(null);
    setGeneratedQuestionLanguage(null);
    setLoading(true);
    setError(null);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setHighlightedParagraph(null);
    setShowExplanation(false);
    setQuizData(null);

    if (questionDelayTimeoutRef.current) clearTimeout(questionDelayTimeoutRef.current);
    setShowQuestionSection(false);

    const maxAttempts = 3;
    const retryDelayMs = 1000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        console.log(`Attempt ${attempt + 1} of ${maxAttempts} to generate text...`);
        const seed = Math.floor(Math.random() * 100);
        const responseResult: unknown = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: `Generate a reading comprehension paragraph in ${passageLanguage} and the corresponding multiple choice question, options, and explanations ONLY in ${questionLanguage} for CEFR level ${cefrLevel} language learners.`,
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
          setError(data.error || "You've reached the usage limit. Please try again later.");
          setGeneratedPassageLanguage(null);
          setGeneratedQuestionLanguage(null);
          return;
        }

        if (!response.ok || !data.result) {
          console.error('API Error Response:', data);
          throw new Error(data.error || `API request failed with status ${response.status}`);
        }

        try {
          const jsonString = data.result.replace(/```json|```/g, '').trim();
          const parsedQuizData = quizDataSchema.safeParse(JSON.parse(jsonString));

          if (!parsedQuizData.success) {
            console.error('Error parsing generated quiz JSON:', parsedQuizData.error);
            throw new Error('Failed to parse the structure of the generated quiz.');
          }

          setQuizData(parsedQuizData.data);
          setHighlightedParagraph(parsedQuizData.data.paragraph);
          setGeneratedPassageLanguage(passageLanguage);
          setGeneratedQuestionLanguage(questionLanguage);
          setError(null);

          if (questionDelayTimeoutRef.current) clearTimeout(questionDelayTimeoutRef.current);
          questionDelayTimeoutRef.current = setTimeout(() => {
            setShowQuestionSection(true);
          }, QUESTION_DELAY_MS);

          console.log(`Successfully generated text on attempt ${attempt + 1}`);
          break;
        } catch (parseErr) {
          console.error(`Attempt ${attempt + 1}: Error parsing inner JSON`, parseErr);
          if (parseErr instanceof Error) throw parseErr;
          else throw new Error('Failed to parse generated quiz content.');
        }
      } catch (err: unknown) {
        console.error(`Attempt ${attempt + 1} failed:`, err);

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
        } else {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        }
      }
    } // End of for loop

    setLoading(false);
  };

  const handleAnswerSelect = (answer: string) => {
    if (isAnswered) return;

    setSelectedAnswer(answer);
    setIsAnswered(true);
    setShowExplanation(true);
  };

  const generateNewQuiz = () => {
    if (loading || (quizData !== null && !isAnswered)) {
      console.log('Cannot generate new quiz while loading or previous question is unanswered.');
      return;
    }
    stopPassageSpeech();
    setShowQuestionSection(false);
    if (questionDelayTimeoutRef.current) {
      clearTimeout(questionDelayTimeoutRef.current);
    }
    setSelectedAnswer(null);
    setIsAnswered(false);
    setHighlightedParagraph(null);
    setShowExplanation(false);
    void generateText();
  };

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
    <>
      <div className="w-full max-w-3xl mx-auto my-8">
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700 shadow-lg mb-8">
          <h2 className="text-xl font-bold mb-4 text-white bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            {t('practice.cefr.title')}
          </h2>

          <div className="mb-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                <span className="flex items-center">
                  <InformationCircleIcon
                    className="h-5 w-5 mr-1 text-blue-400"
                    aria-hidden="true"
                  />
                  {t('practice.level')}:{' '}
                  <span className="text-xs text-blue-300 ml-2">
                    {t('practice.cefr.description')}
                  </span>
                </span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CEFR_LEVELS_LIST.map((level) => (
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
                      {level} - {t(`practice.cefr.levels.${level}.name`)}
                    </div>
                    <div className="text-xs opacity-80 mt-1 line-clamp-1">
                      {t(`practice.cefr.levels.${level}.description`)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                <span className="flex items-center">
                  <GlobeAltIcon className="h-5 w-5 mr-1 text-green-400" aria-hidden="true" />
                  {t('practice.passageLanguageLabel')}
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
          </div>
        </div>

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

        {quizData && generatedPassageLanguage && generatedQuestionLanguage && (
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
            <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white flex items-center">
                <BookOpenIcon className="h-5 w-5 mr-2 text-blue-400" aria-hidden="true" />
                {t('practice.passageTitle')}{' '}
                {passageLanguage !== 'en' && `(${LANGUAGES[passageLanguage]})`}
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
                  {t('practice.passageTitle')} ({LANGUAGES[passageLanguage]})
                </h3>
                {/* --- UPDATED Speech Controls --- */}
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
                    {isSpeakingPassage && ( // Show Stop button only when speaking/paused
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
                {/* --- End UPDATED Speech Controls --- */}
              </div>
              <div className="prose prose-invert max-w-none text-gray-300 leading-relaxed">
                {highlightedParagraph && highlightedParagraph !== quizData.paragraph ? (
                  <div dangerouslySetInnerHTML={{ __html: highlightedParagraph }} />
                ) : generatedPassageLanguage ? (
                  renderParagraphWithWordHover(quizData.paragraph, generatedPassageLanguage)
                ) : (
                  <div>{quizData.paragraph}</div>
                )}
              </div>
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
                    <h4 className="text-md font-semibold mb-3 text-white">
                      {t('practice.explanation')}
                    </h4>
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
                              {t('practice.supportingTextPrefix')}&quot;{quizData.relevantText}
                              &quot;
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

        <div className="mt-8">
          {' '}
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
                {t('common.generating')}
              </div>
            ) : quizData !== null && !isAnswered ? (
              showQuestionSection ? (
                t('practice.answerQuestionBelow')
              ) : (
                t('practice.readingTime')
              )
            ) : (
              <div className="flex items-center">
                <PlusCircleIcon className="h-5 w-5 mr-2" aria-hidden="true" />
                {t('practice.generateNewText')}
              </div>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
