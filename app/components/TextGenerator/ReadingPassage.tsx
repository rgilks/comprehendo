'use client';

import React, { useState, useEffect } from 'react';
import { BookOpenIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { getTextDirection } from 'app/domain/language';
import useTextGeneratorStore from 'app/store/textGeneratorStore';
import AudioControls from './AudioControls';
import { useLanguage } from 'app/hooks/useLanguage';
import useRenderParagraphWithWordHover from './useRenderParagraphWithWordHover';

const ReadingPassage = () => {
  const { t } = useTranslation('common');
  const { language: questionLanguage } = useLanguage();
  const [showCreditsInfo, setShowCreditsInfo] = useState(false);
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

  const handleCreditsClick = () => {
    setShowCreditsInfo(!showCreditsInfo);
  };

  // Close credits info when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showCreditsInfo) {
        const target = event.target as HTMLElement;
        if (!target.closest('[data-testid="hover-credits-display"]') && 
            !target.closest('.credits-info-panel')) {
          setShowCreditsInfo(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCreditsInfo]);

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
    <div data-testid="reading-passage" className="mb-6 lg:mb-0">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center text-blue-400">
            <BookOpenIcon className="w-5 h-5 mr-2 hidden sm:inline-flex" />
            <span className="text-lg font-medium hidden sm:inline" data-testid="passage-title">
              {t('practice.passageTitle')}
            </span>
          </div>
          <div className="flex items-center space-x-4">
            {hover.progressionPhase === 'credits' && (
              <div className="flex items-center space-x-2 relative">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium cursor-pointer transition-all duration-200 hover:scale-105 ${
                    hover.creditsAvailable <= 2 
                      ? 'text-orange-400 bg-orange-900/30 hover:bg-orange-900/50' 
                      : 'text-yellow-400 bg-gray-700/50 hover:bg-gray-700/70'
                  }`}
                  data-testid="hover-credits-display"
                  title={t('practice.hoverCreditsTooltip') || 'Translation Credits Info'}
                  onClick={handleCreditsClick}
                >
                  <span>{hover.creditsAvailable}</span>
                </div>
                {hover.creditsAvailable <= 2 && (
                  <span className="text-xs text-orange-300 hidden sm:inline">
                    {t('practice.lowCredits')}
                  </span>
                )}
                
                {showCreditsInfo && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="credits-info-panel absolute top-10 left-0 bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-xl z-50 min-w-[280px]"
                  >
                    <div className="text-sm text-gray-200">
                      <div className="font-medium text-yellow-400 mb-2">Translation Credits</div>
                      <div className="space-y-1 text-xs">
                        <div>• Hover or click words for translations</div>
                        <div>• Credits reset each question</div>
                        <div>• Underlined words show you've translated them</div>
                        <div>• Audio plays when you click words</div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
            <AudioControls />
          </div>
        </div>

        <motion.div
          className="mb-3 p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <p className="text-sm text-blue-200 flex items-center gap-2">
            <BookOpenIcon className="w-4 h-4" />
            {t('practice.readingInstruction')}
          </p>
        </motion.div>

        <div
          className="prose prose-lg md:prose-xl prose-invert max-w-none text-gray-200 leading-relaxed md:leading-loose tracking-wide"
          data-testid="passage-text"
        >
          <div dir={getTextDirection(generatedPassageLanguage)}>
            {renderParagraphWithWordHover(quizData.paragraph, generatedPassageLanguage)}
          </div>
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
