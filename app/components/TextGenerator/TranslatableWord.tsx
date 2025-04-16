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
    const [isHovered, setIsHovered] = useState(false);
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

    const handleMouseEnter = useCallback(() => {
      setIsHovered(true);

      if (shouldTranslate && !translation && !isLoading) {
        if (hoverProgressionPhase === 'initial' || hoverCreditsAvailable > 0) {
          void (async () => {
            setIsLoading(true);
            try {
              const sourceLang = SPEECH_LANGUAGES[fromLang].split('-')[0];
              const targetLang = SPEECH_LANGUAGES[toLang].split('-')[0];
              const result = await getTranslation(word, sourceLang, targetLang);

              if (result) {
                setTranslation(result);
                if (hoverProgressionPhase === 'credits') {
                  decrementHoverCredit();
                }
              } else {
                console.log('Translation fetch returned no result.');
              }
            } catch (error) {
              console.error('Error fetching translation:', error);
            } finally {
              setIsLoading(false);
            }
          })();
        } else {
          console.log('Hover translation blocked: No credits left.');
        }
      }
    }, [
      word,
      fromLang,
      toLang,
      getTranslation,
      translation,
      isLoading,
      shouldTranslate,
      hoverProgressionPhase,
      decrementHoverCredit,
      hoverCreditsAvailable,
    ]);

    const handleMouseLeave = useCallback(() => {
      setIsHovered(false);
    }, []);

    const handleClick = useCallback(() => {
      speakText(word, fromLang);
    }, [word, fromLang, speakText]);

    let combinedClassName = 'cursor-pointer transition-all duration-300 px-1 -mx-1 relative group';
    if (isRelevant) {
      combinedClassName += ' bg-yellow-300 text-black rounded';
    } else if (isCurrentWord) {
      combinedClassName += ' bg-blue-500 text-white rounded';
    } else {
      combinedClassName += ' hover:text-blue-400';
    }

    const showTranslation = isHovered && shouldTranslate && !isLoading && translation !== null;

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
        {showTranslation && (
          <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-gray-900/95 border border-gray-600 text-white text-base rounded-lg shadow-xl z-10 whitespace-nowrap min-w-[100px] text-center backdrop-blur-sm">
            <span className="font-medium">{translation || word}</span>
          </div>
        )}
      </span>
    );
  }
);

TranslatableWord.displayName = 'TranslatableWord';

export default TranslatableWord;
