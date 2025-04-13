'use client';

import React, { useCallback } from 'react';
import { BookOpenIcon } from '@heroicons/react/24/solid';
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
      <div className="flex flex-col items-start space-y-3 sm:flex-row sm:justify-between sm:items-center sm:space-y-0 mb-4">
        <div className="flex items-center text-blue-400">
          <BookOpenIcon className="w-5 h-5 mr-2" />
          <span className="text-lg font-medium" data-testid="passage-title">
            {t('practice.passageTitle')}
          </span>
        </div>
        <AudioControls />
      </div>

      <div
        className="prose prose-invert max-w-none text-gray-300 leading-relaxed"
        data-testid="passage-content"
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
