'use client';

import React from 'react';
import { BookOpenIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { getTextDirection } from 'app/domain/language';
import useTextGeneratorStore from 'app/store/textGeneratorStore';
import AudioControls from './AudioControls';
import { useLanguage } from 'app/hooks/useLanguage';
import useRenderParagraphWithWordHover from './useRenderParagraphWithWordHover';

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
    hover,
  } = useTextGeneratorStore();

  const actualQuestionLanguage = questionLanguage;

  const renderParagraphWithWordHover = useRenderParagraphWithWordHover({
    currentWordIndex,
    isSpeakingPassage,
    relevantTextRange,
    actualQuestionLanguage,
  });

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
          {hover.progressionPhase === 'credits' && (
            <div
              className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium text-yellow-400 bg-gray-700/50"
              data-testid="hover-credits-display"
              title={t('practice.hoverCreditsTooltip') || 'Hover Credits'}
            >
              <span>{hover.creditsAvailable}</span>
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
