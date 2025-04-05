'use client';

import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getTextDirection } from '../../contexts/LanguageContext';
import useTextGeneratorStore from '../../store/textGeneratorStore';
import AnimateTransition from '../AnimateTransition';
import { useLanguage } from '../../contexts/LanguageContext';

const QuizSection = () => {
  const { t } = useTranslation('common');
  const { language: questionLanguage } = useLanguage();
  const {
    quizData,
    selectedAnswer,
    isAnswered,
    showExplanation,
    showQuestionSection,
    handleAnswerSelect,
  } = useTextGeneratorStore();

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
      <div className="mt-6">
        <h3
          dir={getTextDirection(questionLanguage)}
          className="text-lg font-semibold text-white mb-4"
        >
          {quizData.question}
        </h3>
        <div className="space-y-3">
          {Object.entries(quizData.options).map(([key, value], index) => (
            <AnimateTransition
              key={key}
              show={showQuestionSection}
              type="slide-right"
              duration={400}
              delay={100 * index} // Stagger the animations
              className="w-full"
            >
              <button
                onClick={handleAsyncClick(key)}
                disabled={isAnswered}
                dir={getTextDirection(questionLanguage)}
                className={`w-full text-left p-3 rounded transition-colors duration-200 ${
                  isAnswered
                    ? key === quizData.correctAnswer
                      ? 'bg-gradient-to-r from-green-700 to-green-800 border border-green-600 text-white'
                      : key === selectedAnswer
                        ? 'bg-gradient-to-r from-red-700 to-red-800 border border-red-600 text-white'
                        : 'bg-gray-700 border border-gray-600 text-gray-400'
                    : selectedAnswer === key
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 border border-blue-500 text-white'
                      : 'bg-gray-700 border border-gray-600 text-gray-200 hover:bg-gray-600 hover:border-gray-500'
                }`}
              >
                <span className="font-semibold">{key}:</span> {value}
              </button>
            </AnimateTransition>
          ))}
        </div>
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
