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
    const [isTranslationVisible, setIsTranslationVisible] = useState(false);
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

    const handleClick = useCallback(() => {
      speakText(word, fromLang);

      const currentlyVisible = isTranslationVisible;
      setIsTranslationVisible(!currentlyVisible);

      if (!currentlyVisible && shouldTranslate && !translation && !isLoading) {
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
                setIsTranslationVisible(false);
              }
            } catch (error) {
              console.error('Error fetching translation:', error);
              setIsTranslationVisible(false);
            } finally {
              setIsLoading(false);
            }
          })();
        } else {
          console.log('Click translation blocked: No credits left.');
          setIsTranslationVisible(false);
        }
      }
    }, [
      isTranslationVisible,
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
      speakText,
    ]);

    let combinedClassName = 'cursor-pointer transition-all duration-300 px-1 -mx-1 relative group';
    if (isRelevant) {
      combinedClassName += ' bg-yellow-300 text-black rounded';
    } else if (isCurrentWord) {
      combinedClassName += ' bg-blue-500 text-white rounded';
    } else {
      combinedClassName += ' hover:underline';
    }

    const showTranslationPopup =
      isTranslationVisible && shouldTranslate && !isLoading && translation !== null;

    const dataTestIdProps = isRelevant ? { 'data-testid': 'feedback-highlight' } : {};

    return (
      <span className={combinedClassName} onClick={handleClick} {...dataTestIdProps}>
        {word}
        {showTranslationPopup && (
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
