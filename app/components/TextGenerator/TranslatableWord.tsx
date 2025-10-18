'use client';

import React, { useState, useCallback, memo, useEffect } from 'react';
import { type Language } from 'app/domain/language';
import useTextGeneratorStore from 'app/store/textGeneratorStore';
import { analyzeTranslation, canTranslate } from 'app/lib/utils/translation';

interface TranslatableWordProps {
  word: string;
  fromLang: Language;
  toLang: Language;
  isCurrentWord: boolean;
  isRelevant: boolean;
}

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

    const translationAnalysis = analyzeTranslation({
      word,
      fromLang,
      toLang,
      translationCache,
    });

    useEffect(() => {
      if (translationAnalysis.shouldTranslate) {
        if (translationAnalysis.cachedTranslation) {
          setTranslation(translationAnalysis.cachedTranslation);
        } else {
          setTranslation(null);
        }
      } else {
        setTranslation(null);
      }
    }, [translationAnalysis]);

    const handleTranslationFetch = useCallback(async () => {
      if (!canTranslate(hover.progressionPhase, hover.creditsAvailable, isLoading, translation)) {
        return;
      }

      if (!translationAnalysis.sourceLangIso || !translationAnalysis.targetLangIso) {
        console.error('Could not determine language codes for translation');
        return;
      }

      setIsLoading(true);
      try {
        const result = await getTranslation(
          word,
          translationAnalysis.sourceLangIso,
          translationAnalysis.targetLangIso
        );

        if (result) {
          setTranslation(result);
          if (hover.progressionPhase === 'credits') {
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
    }, [
      hover.progressionPhase,
      hover.creditsAvailable,
      isLoading,
      translation,
      translationAnalysis.sourceLangIso,
      translationAnalysis.targetLangIso,
      getTranslation,
      word,
      decrementHoverCredit,
    ]);

    const handleClick = useCallback(() => {
      speakText(word, fromLang);

      if (translationAnalysis.shouldTranslate && !translation) {
        const canAttemptTranslation =
          hover.progressionPhase === 'initial' || hover.creditsAvailable > 0;

        if (canAttemptTranslation) {
          // Only mark as translated if we actually attempt translation
          markWordAsTranslated(word);
          void handleTranslationFetch();
        }
      }
    }, [
      speakText,
      word,
      fromLang,
      translation,
      translationAnalysis.shouldTranslate,
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
      // Always underline words that have been translated (regardless of current credits)
      combinedClassName += ' border-b border-dotted border-blue-400';
    } else {
      if (hover.progressionPhase !== 'credits' || hover.creditsAvailable > 0) {
        combinedClassName += ' hover:underline';
      }
    }

    const showTranslationPopup =
      isHovering && translationAnalysis.shouldTranslate && !isLoading && translation !== null;

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
          <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-gray-900/95 border border-gray-600 text-white text-base rounded-lg shadow-xl z-50 whitespace-nowrap min-w-[100px] text-center backdrop-blur-sm">
            <span className="font-medium">{translation}</span>
          </div>
        )}
      </span>
    );
  }
);

TranslatableWord.displayName = 'TranslatableWord';

export default TranslatableWord;
