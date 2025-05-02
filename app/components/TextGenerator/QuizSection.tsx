'use client';

import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getTextDirection } from '@/contexts/LanguageContext';
import useTextGeneratorStore from '@/store/textGeneratorStore';
import { useLanguage } from '@/contexts/LanguageContext';
import { InformationCircleIcon } from '@heroicons/react/24/outline';

const QuizSection = () => {
  const { t } = useTranslation('common');
  const { language: contextQuestionLanguage } = useLanguage();
  const {
    quizData,
    selectedAnswer,
    isAnswered,
    showExplanation,
    showQuestionSection,
    handleAnswerSelect,
    feedbackIsCorrect,
    feedbackCorrectAnswer,
    feedbackCorrectExplanation,
    feedbackChosenIncorrectExplanation,
  } = useTextGeneratorStore();

  const questionLanguage = contextQuestionLanguage;

  const handleAsyncClick = useCallback(
    (answer: string) => (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      void handleAnswerSelect(answer);
    },
    [handleAnswerSelect]
  );

  if (!quizData || !showQuestionSection) {
    return null;
  }

  return (
    <>
      <div className="mt-6 space-y-4" data-testid="quiz-section">
        <h3
          className="text-lg font-semibold text-white"
          data-testid="quiz-question"
          dir={getTextDirection(questionLanguage)}
        >
          {quizData.question}
        </h3>
        <div className="space-y-2" data-testid="quiz-options">
          {Object.entries(quizData.options).map(([key, value]) => (
            <button
              key={key}
              onClick={handleAsyncClick(key)}
              disabled={isAnswered}
              className={`w-full text-left p-3 rounded-md border transition-colors relative ${
                isAnswered && feedbackCorrectAnswer
                  ? key === feedbackCorrectAnswer
                    ? 'bg-green-900/50 border-green-700 text-green-100'
                    : selectedAnswer === key
                      ? 'bg-red-900/50 border-red-700 text-red-100'
                      : 'bg-gray-800/50 border-gray-700 text-gray-400'
                  : selectedAnswer === key
                    ? 'bg-blue-900/50 border-blue-700 text-blue-100'
                    : 'bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-700/50'
              }`}
              data-testid={`quiz-option-${key}`}
            >
              {value}
              {isAnswered &&
                showExplanation &&
                !feedbackIsCorrect &&
                selectedAnswer === key &&
                feedbackChosenIncorrectExplanation && (
                  <div
                    className="mt-2 p-2 text-sm bg-red-900/60 ring-1 ring-red-600/60 rounded text-red-100 flex items-start space-x-2"
                    data-testid="chosen-incorrect-explanation-text"
                    dir={getTextDirection(questionLanguage)}
                  >
                    <InformationCircleIcon className="h-5 w-5 flex-shrink-0 text-red-300 mt-0.5" />
                    <span>{feedbackChosenIncorrectExplanation}</span>
                  </div>
                )}
            </button>
          ))}
        </div>

        {isAnswered && showExplanation && feedbackCorrectExplanation && (
          <div
            className="mt-6 p-4 bg-gray-700/50 border border-gray-600 rounded-lg shadow"
            data-testid="correct-explanation-section"
          >
            <h4 className="text-lg font-semibold mb-3 text-blue-300">
              {t('practice.explanation')}
            </h4>
            <div
              className="p-2 rounded bg-green-900/30 ring-1 ring-green-600/50 text-green-200"
              data-testid="correct-explanation-text"
              dir={getTextDirection(questionLanguage)}
            >
              {feedbackCorrectExplanation}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default QuizSection;
