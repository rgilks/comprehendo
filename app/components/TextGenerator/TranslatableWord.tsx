'use client';

import React, { useState, useCallback, memo } from 'react';
import { type Language, SPEECH_LANGUAGES } from '@/contexts/LanguageContext';
import useTextGeneratorStore from '@/store/textGeneratorStore';

interface TranslatableWordProps {
  word: string;
  fromLang: Language;
  toLang: Language;
  isCurrentWord: boolean;
  isRelevant: boolean;
}

const TranslatableWord = memo(
  ({ word, fromLang, toLang, isCurrentWord, isRelevant }: TranslatableWordProps) => {
    const [isClicked, setIsClicked] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const [translation, setTranslation] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const {
      speakText,
      getTranslation,
      useHoverCredit: decrementHoverCredit,
      hoverProgressionPhase,
      hoverCreditsAvailable,
    } = useTextGeneratorStore();

    const shouldTranslate = fromLang !== toLang;

    const handleTranslationFetch = useCallback(async () => {
      if (!shouldTranslate || translation || isLoading) return;

      if (hoverProgressionPhase === 'initial' || hoverCreditsAvailable > 0) {
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
                if (hoverProgressionPhase === 'credits') {
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
    }, [
      shouldTranslate,
      translation,
      isLoading,
      hoverProgressionPhase,
      hoverCreditsAvailable,
      fromLang,
      toLang,
      getTranslation,
      word,
      decrementHoverCredit,
    ]);

    const handleClick = useCallback(() => {
      speakText(word, fromLang);

      if (!isClicked && shouldTranslate) {
        const canAttemptTranslation =
          hoverProgressionPhase === 'initial' || hoverCreditsAvailable > 0;

        if (canAttemptTranslation) {
          setIsClicked(true);
          void handleTranslationFetch();
        } else {
          // Optional: Log that the state change was blocked due to credits - REMOVING
          // console.log(`[TranslatableWord: ${word}] Click interaction blocked (no state change): No credits left.`);
        }
      }
    }, [
      speakText,
      word,
      fromLang,
      isClicked,
      shouldTranslate,
      hoverProgressionPhase,
      hoverCreditsAvailable,
      handleTranslationFetch,
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
    } else if (isClicked) {
      combinedClassName += ' border-b border-dotted border-blue-400';
    } else {
      if (hoverProgressionPhase !== 'credits' || hoverCreditsAvailable > 0) {
        combinedClassName += ' hover:underline';
      }
    }

    const showTranslationPopup =
      isClicked && isHovering && shouldTranslate && !isLoading && translation !== null;

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
        {isClicked && isHovering && isLoading && (
          <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-gray-900/95 border border-gray-600 text-white text-base rounded-lg shadow-xl z-10 whitespace-nowrap min-w-[100px] text-center backdrop-blur-sm">
            <span className="italic text-sm">Translating...</span>
          </div>
        )}
      </span>
    );
  }
);

TranslatableWord.displayName = 'TranslatableWord';

export default TranslatableWord;
