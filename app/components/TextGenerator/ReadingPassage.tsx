'use client';

import React, { useCallback } from 'react';
import { BookOpenIcon } from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';
import { getTextDirection, type Language } from '../../contexts/LanguageContext';
import useTextGeneratorStore from '../../store/textGeneratorStore';
import AnimateTransition from '../AnimateTransition';
import TranslatableWord from './TranslatableWord';
import AudioControls from './AudioControls';
import { useLanguage } from '../../contexts/LanguageContext';

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
            isRelevant={isRelevant}
          />
        );
      });
    },
    [currentWordIndex, isSpeakingPassage, relevantTextRange, questionLanguage]
  );

  if (!quizData || !generatedPassageLanguage) {
    return null;
  }

  return (
    <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg mb-6">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div className="flex items-center space-x-2 text-lg font-semibold">
          <BookOpenIcon className="w-5 h-5 text-blue-400" />
          <span>{t('practice.passageTitle')}</span>
        </div>

        <AudioControls />
      </div>

      <AnimateTransition
        show={true}
        type="fade-in"
        duration={600}
        className="prose prose-invert max-w-none text-gray-300 leading-relaxed"
      >
        <div dir={getTextDirection(generatedPassageLanguage)}>
          {renderParagraphWithWordHover(quizData.paragraph, generatedPassageLanguage)}
        </div>
      </AnimateTransition>

      {!showQuestionSection && (
        <AnimateTransition
          show={true}
          type="fade-in"
          duration={400}
          className="mt-4 text-center text-gray-400 text-sm animate-pulse"
        >
          {t('practice.questionWillAppear')}
        </AnimateTransition>
      )}
    </div>
  );
};

export default ReadingPassage;
