'use client';

import React, { useState, useCallback, memo, useEffect } from 'react';
import { type Language, SPEECH_LANGUAGES } from 'app/domain/language';
import useTextGeneratorStore from 'app/store/textGeneratorStore';

interface TranslatableWordProps {
  word: string;
  fromLang: Language;
  toLang: Language;
  isCurrentWord: boolean;
  isRelevant: boolean;
}

const getCacheKey = (word: string, sourceLang: string, targetLang: string): string => {
  const cleaningRegex = /[^\p{L}\p{N}\s'-]/gu;
  const cleanedWord = word.replace(cleaningRegex, '').trim().toLowerCase();
  return `${sourceLang}:${targetLang}:${cleanedWord}`;
};

const TranslatableWord = memo(
  ({ word, fromLang, toLang, isCurrentWord, isRelevant }: TranslatableWordProps) => {
    const [isHovering, setIsHovering] = useState(false);
    const [translation, setTranslation] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const {
      speakText,
      getTranslation,
      useHoverCredit: decrementHoverCredit,
      hover,
      translationCache,
      markWordAsTranslated,
      isWordTranslated,
    } = useTextGeneratorStore();

    const shouldTranslate = fromLang !== toLang;

    useEffect(() => {
      if (shouldTranslate) {
        const fromLangSpeechCode = SPEECH_LANGUAGES[fromLang];
        const toLangSpeechCode = SPEECH_LANGUAGES[toLang];

        if (fromLangSpeechCode && toLangSpeechCode) {
          const sourceLangIso = fromLangSpeechCode.split('-')[0];
          const targetLangIso = toLangSpeechCode.split('-')[0];

          if (sourceLangIso && targetLangIso) {
            const cacheKey = getCacheKey(word, sourceLangIso, targetLangIso);
            if (translationCache.has(cacheKey)) {
              setTranslation(translationCache.get(cacheKey) ?? null);
            } else {
              setTranslation(null);
            }
          }
        }
      } else {
        setTranslation(null);
      }
    }, [word, fromLang, toLang, shouldTranslate, translationCache]);

    const handleTranslationFetch = useCallback(
      async () => {
        if (!shouldTranslate || translation || isLoading) return;

        if (hover.progressionPhase === 'initial' || hover.creditsAvailable > 0) {
          setIsLoading(true);
          try {
            const fromLangSpeechCode = SPEECH_LANGUAGES[fromLang];
            const toLangSpeechCode = SPEECH_LANGUAGES[toLang];

            if (fromLangSpeechCode && toLangSpeechCode) {
              const sourceLang = fromLangSpeechCode.split('-')[0];
              const targetLang = toLangSpeechCode.split('-')[0];

              if (sourceLang && targetLang) {
                const result = await getTranslation(word, sourceLang, targetLang);

                if (result) {
                  setTranslation(result);
                  if (hover.progressionPhase === 'credits') {
                    decrementHoverCredit();
                  }
                } else {
                  console.log('Translation fetch returned no result.');
                }
              } else {
                console.error('Error splitting language codes', {
                  fromLangSpeechCode,
                  toLangSpeechCode,
                });
              }
            } else {
              console.error('Could not find speech codes for languages', { fromLang, toLang });
            }
          } catch (error) {
            console.error('Error fetching translation:', error);
          } finally {
            setIsLoading(false);
          }
        } else {
          console.log('Click translation blocked: No credits left.');
        }
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [
        shouldTranslate,
        isLoading,
        hover.progressionPhase,
        hover.creditsAvailable,
        fromLang,
        toLang,
        getTranslation,
        word,
        decrementHoverCredit,
      ]
    );

    const handleClick = useCallback(() => {
      speakText(word, fromLang);

      // Mark as translated when clicked
      markWordAsTranslated(word);

      if (shouldTranslate && !translation) {
        const canAttemptTranslation =
          hover.progressionPhase === 'initial' || hover.creditsAvailable > 0;

        if (canAttemptTranslation) {
          void handleTranslationFetch();
        }
      }
    }, [
      speakText,
      word,
      fromLang,
      shouldTranslate,
      translation,
      hover.progressionPhase,
      hover.creditsAvailable,
      handleTranslationFetch,
      markWordAsTranslated,
    ]);

    const handleMouseEnter = useCallback(() => {
      setIsHovering(true);
    }, []);

    const handleMouseLeave = useCallback(() => {
      setIsHovering(false);
    }, []);

    let combinedClassName =
      'cursor-pointer transition-all duration-300 px-1 -mx-1 relative group rounded';

    if (isRelevant) {
      combinedClassName += ' bg-yellow-300 text-black';
    } else if (isCurrentWord) {
      combinedClassName += ' bg-blue-500 text-white';
    } else if (isWordTranslated(word)) {
      // Only underline if we still have credits or are in initial phase
      if (hover.progressionPhase !== 'credits' || hover.creditsAvailable > 0) {
        combinedClassName += ' border-b border-dotted border-blue-400';
      }
    } else {
      if (hover.progressionPhase !== 'credits' || hover.creditsAvailable > 0) {
        combinedClassName += ' hover:underline';
      }
    }

    const showTranslationPopup =
      isHovering && shouldTranslate && !isLoading && translation !== null;

    const dataTestIdProps = isRelevant ? { 'data-testid': 'feedback-highlight' } : {};

    return (
      <span
        className={combinedClassName}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...dataTestIdProps}
      >
        {word}
        {showTranslationPopup && (
          <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-gray-900/95 border border-gray-600 text-white text-base rounded-lg shadow-xl z-10 whitespace-nowrap min-w-[100px] text-center backdrop-blur-sm">
            <span className="font-medium">{translation}</span>
          </div>
        )}
      </span>
    );
  }
);

TranslatableWord.displayName = 'TranslatableWord';

export default TranslatableWord;
