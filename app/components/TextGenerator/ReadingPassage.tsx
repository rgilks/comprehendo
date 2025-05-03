'use client';

import React, { useCallback } from 'react';
import { BookOpenIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { getTextDirection, type Language } from '@/contexts/LanguageContext';
import useTextGeneratorStore from '@/store/textGeneratorStore';
import TranslatableWord from './TranslatableWord';
import AudioControls from './AudioControls';
import { useLanguage } from '@/contexts/LanguageContext';

const ReadingPassage = () => {
  const { t } = useTranslation('common');
  const { language: questionLanguage } = useLanguage();
  const {
    quizData,
    showQuestionSection,
    currentWordIndex,
    isSpeakingPassage,
    relevantTextRange,
    generatedPassageLanguage,
    hoverProgressionPhase,
    hoverCreditsAvailable,
  } = useTextGeneratorStore();

  const actualQuestionLanguage = questionLanguage;

  const renderParagraphWithWordHover = useCallback(
    (paragraph: string, lang: Language) => {
      const words = paragraph.split(/(\s+)/);
      let currentPos = 0;
      return words.map((segment, index) => {
        const segmentStart = currentPos;
        const segmentEnd = currentPos + segment.length;
        currentPos = segmentEnd;

        if (/^\s+$/.test(segment)) {
          return <span key={index}>{segment}</span>;
        }

        const wordIndex = words.slice(0, index + 1).filter((s) => !/^\s+$/.test(s)).length - 1;
        const isCurrent = currentWordIndex === wordIndex && isSpeakingPassage;

        const isRelevant =
          relevantTextRange !== null &&
          segmentStart >= relevantTextRange.start &&
          segmentEnd <= relevantTextRange.end;

        return (
          <TranslatableWord
            key={index}
            word={segment}
            fromLang={lang}
            toLang={actualQuestionLanguage}
            isCurrentWord={isCurrent}
            isRelevant={isRelevant}
          />
        );
      });
    },
    [currentWordIndex, isSpeakingPassage, relevantTextRange, actualQuestionLanguage]
  );

  if (!quizData || !generatedPassageLanguage) {
    return null;
  }

  return (
    <div data-testid="reading-passage" className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center text-blue-400">
          <BookOpenIcon className="w-5 h-5 mr-2 hidden sm:inline-flex" />
          <span className="text-lg font-medium hidden sm:inline" data-testid="passage-title">
            {t('practice.passageTitle')}
          </span>
        </div>
        <div className="flex items-center space-x-4">
          {hoverProgressionPhase === 'credits' && (
            <div
              className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium text-yellow-400 bg-gray-700/50"
              data-testid="hover-credits-display"
              title={t('practice.hoverCreditsTooltip') || 'Hover Credits'}
            >
              <span>{hoverCreditsAvailable}</span>
            </div>
          )}
          <AudioControls />
        </div>
      </div>

      <div
        className="prose prose-xl prose-invert max-w-none text-gray-300 leading-relaxed"
        data-testid="passage-text"
      >
        <div dir={getTextDirection(generatedPassageLanguage)}>
          {renderParagraphWithWordHover(quizData.paragraph, generatedPassageLanguage)}
        </div>
      </div>

      {!showQuestionSection && (
        <div className="mt-4 text-center text-gray-400 text-sm animate-pulse">
          {t('practice.questionWillAppear')}
        </div>
      )}
    </div>
  );
};

export default ReadingPassage;
