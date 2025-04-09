'use client';

import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getTextDirection } from '@/contexts/LanguageContext';
import useTextGeneratorStore from '@/store/textGeneratorStore';
import AnimateTransition from '@/components/AnimateTransition';
import { useLanguage } from '@/contexts/LanguageContext';

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
  } = useTextGeneratorStore();

  // Use the context language (user's selected language) instead of the generated question language
  // This ensures questions and answers appear in the user's interface language
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
    <AnimateTransition show={showQuestionSection} type="slide-up" duration={500} unmountOnExit>
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
              className={`w-full text-left p-3 rounded-md border transition-colors ${
                isAnswered
                  ? key === quizData.correctAnswer
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
            </button>
          ))}
        </div>
        {isAnswered && showExplanation && (
          <div
            className="mt-4 p-4 bg-gray-800/50 border border-gray-700 rounded-md"
            data-testid="quiz-explanation"
          >
            <p className="text-gray-300" dir={getTextDirection(questionLanguage)}>
              {quizData.explanations[quizData.correctAnswer as keyof typeof quizData.explanations]}
            </p>
          </div>
        )}
      </div>

      <AnimateTransition show={showExplanation} type="scale-up" duration={400} unmountOnExit>
        <div className="mt-4 p-4 bg-gray-700/50 border border-gray-600 rounded-lg shadow">
          <h4 className="text-lg font-semibold mb-3 text-blue-300">{t('practice.explanation')}</h4>
          <div className="space-y-3 text-sm">
            {Object.entries(quizData.explanations).map(([key, explanation], index) => (
              <AnimateTransition
                key={key}
                show={showExplanation}
                type="slide-left"
                duration={400}
                delay={100 * index} // Stagger the animations
                className="w-full"
              >
                <div
                  className={`p-2 rounded ${key === quizData.correctAnswer ? 'bg-green-900/30 ring-1 ring-green-600/50' : ''} ${selectedAnswer === key && key !== quizData.correctAnswer ? 'bg-red-900/30 ring-1 ring-red-600/50' : ''}`}
                >
                  <strong
                    className={`font-semibold ${key === quizData.correctAnswer ? 'text-green-300' : selectedAnswer === key ? 'text-red-300' : 'text-gray-300'}`}
                  >
                    {key}:
                  </strong>{' '}
                  <span className="text-gray-300">{explanation}</span>
                </div>
              </AnimateTransition>
            ))}
          </div>
        </div>
      </AnimateTransition>
    </AnimateTransition>
  );
};

export default QuizSection;
