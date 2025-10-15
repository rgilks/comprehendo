'use client';

import React, { useCallback, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getTextDirection, useLanguage } from 'app/hooks/useLanguage';
import useTextGeneratorStore from 'app/store/textGeneratorStore';
import {
  InformationCircleIcon,
  QuestionMarkCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import type { QuizData } from 'app/domain/schemas';
import type { Language } from 'app/domain/language';
import { LanguageSchema } from 'app/domain/language';
import ProgressionFeedback from './ProgressionFeedback';

interface QuizOptionButtonProps {
  optionKey: keyof QuizData['options'];
  value: string;
  index: number;
  isAnswered: boolean;
  selectedAnswer: string | null;
  feedback: {
    isCorrect: boolean | null;
    correctAnswer: string | null;
    correctExplanation: string | null;
    chosenIncorrectExplanation: string | null;
    relevantText: string | null;
  };
  showExplanation: boolean;
  questionLanguage: string;
  isSubmittingAnswer: boolean;
  handleAsyncClick: (answer: string) => (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const QuizOptionButton: React.FC<QuizOptionButtonProps> = ({
  optionKey,
  value,
  index,
  isAnswered,
  selectedAnswer,
  feedback,
  showExplanation,
  questionLanguage,
  isSubmittingAnswer,
  handleAsyncClick,
}) => (
  <button
    key={optionKey}
    onClick={handleAsyncClick(optionKey)}
    disabled={isAnswered || isSubmittingAnswer}
    className={`w-full text-left min-h-[44px] p-4 md:p-5 rounded-lg border-2 transition-all duration-200 transform relative text-base md:text-lg touch-manipulation ${
      !isAnswered && !isSubmittingAnswer ? 'hover:scale-[1.02] hover:shadow-lg' : ''
    } ${
      isAnswered && feedback.correctAnswer
        ? optionKey === feedback.correctAnswer
          ? 'bg-green-900/50 border-green-700 text-green-100'
          : selectedAnswer === optionKey
            ? 'bg-red-900/50 border-red-700 text-red-100'
            : 'bg-gray-800/50 border-gray-700 text-gray-400'
        : selectedAnswer === optionKey
          ? 'bg-blue-900/50 border-blue-700 text-blue-100'
          : 'bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-700/50'
    } ${isSubmittingAnswer ? 'opacity-75 cursor-not-allowed' : ''}`}
    data-testid={`answer-option-${index}`}
  >
    {value}
    {isSubmittingAnswer && selectedAnswer === optionKey && (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 rounded-md">
        <div className="animate-spin h-4 w-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
      </div>
    )}
    {isAnswered &&
      showExplanation &&
      !feedback.isCorrect &&
      selectedAnswer === optionKey &&
      feedback.chosenIncorrectExplanation && (
        <div
          className="mt-2 p-2 text-sm bg-red-900/60 ring-1 ring-red-600/60 rounded text-red-100 flex items-start space-x-2"
          dir={getTextDirection(questionLanguage as Language)}
        >
          <InformationCircleIcon className="h-5 w-5 flex-shrink-0 text-red-300 mt-0.5" />
          <span>{feedback.chosenIncorrectExplanation}</span>
        </div>
      )}
  </button>
);

interface FeedbackExplanationProps {
  isAnswered: boolean;
  showExplanation: boolean;
  feedback: {
    isCorrect: boolean | null;
    correctAnswer: string | null;
    correctExplanation: string | null;
    chosenIncorrectExplanation: string | null;
    relevantText: string | null;
  };
  t: (key: string) => string;
  questionLanguage: string;
  generatedPassageLanguage: string | null | undefined;
}

const getValidLanguage = (lang: string | null | undefined): Language => {
  const parsed = LanguageSchema.safeParse(lang);
  return parsed.success ? parsed.data : 'en';
};

const FeedbackExplanation: React.FC<FeedbackExplanationProps> = ({
  isAnswered,
  showExplanation,
  feedback,
  t,
  questionLanguage,
  generatedPassageLanguage,
}) => {
  if (!(isAnswered && showExplanation)) return null;
  return (
    <div
      className="mt-6 p-4 bg-gray-700/50 border border-gray-600 rounded-lg shadow"
      data-testid="feedback-explanation"
    >
      <h4 className="text-lg font-semibold mb-3 text-blue-300">{t('practice.explanation')}</h4>
      {feedback.correctExplanation && (
        <div
          className="p-2 rounded bg-green-900/30 ring-1 ring-green-600/50 text-green-200 mb-4"
          data-testid="correct-explanation-text"
          dir={getTextDirection(questionLanguage as Language)}
        >
          {feedback.correctExplanation}
        </div>
      )}
      {feedback.isCorrect && feedback.relevantText && (
        <div
          className="p-2 rounded bg-blue-900/30 ring-1 ring-blue-600/50 text-blue-200 mb-4"
          data-testid="relevant-text"
        >
          <strong>{t('practice.relevantText')}:</strong>{' '}
          <span dir={getTextDirection(getValidLanguage(generatedPassageLanguage))}>
            {feedback.relevantText}
          </span>
        </div>
      )}
      {!feedback.isCorrect && feedback.chosenIncorrectExplanation && (
        <div
          className="p-2 rounded bg-red-900/30 ring-1 ring-red-600/50 text-red-200 mb-4"
          data-testid="chosen-incorrect-explanation-text"
          dir={getTextDirection(questionLanguage as Language)}
        >
          {feedback.chosenIncorrectExplanation}
        </div>
      )}
    </div>
  );
};

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
    feedback,
    generatedPassageLanguage,
    isSubmittingAnswer,
    isSubmittingFeedback,
  } = useTextGeneratorStore();
  const questionLanguage = contextQuestionLanguage;
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);

  useEffect(() => {
    if (isAnswered) {
      const timer = setTimeout(() => {
        setShowCorrectAnswer(true);
      }, 2000);
      return () => {
        clearTimeout(timer);
      };
    } else {
      setShowCorrectAnswer(false);
      return undefined;
    }
  }, [isAnswered]);
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
    <div
      className="pt-6 mt-6 border-t border-gray-700 lg:border-0 lg:pt-0 lg:mt-0 space-y-4"
      data-testid="quiz-section"
    >
      <div className="mb-4 p-3 bg-purple-900/20 border border-purple-700/50 rounded-lg">
        <p className="text-sm text-purple-200 flex items-center gap-2">
          <QuestionMarkCircleIcon className="w-4 h-4" />
          {t('practice.questionPrompt')}
        </p>
      </div>
      <h3
        className="text-lg md:text-xl lg:text-2xl font-semibold text-white"
        data-testid="question-text"
        dir={getTextDirection(questionLanguage)}
      >
        {quizData.question}
      </h3>
      <div className="space-y-2" data-testid="quiz-options">
        {Object.entries(quizData.options).map(([key, value], index) => (
          <QuizOptionButton
            key={key}
            optionKey={key as keyof QuizData['options']}
            value={value}
            index={index}
            isAnswered={isAnswered}
            selectedAnswer={selectedAnswer}
            feedback={feedback}
            showExplanation={showExplanation}
            questionLanguage={questionLanguage}
            isSubmittingAnswer={isSubmittingAnswer}
            handleAsyncClick={handleAsyncClick}
          />
        ))}
      </div>
      {isAnswered && (
        <div className="mt-6 space-y-4">
          {/* Immediate result indicator */}
          <div
            className={`p-4 rounded-lg border-2 ${feedback.isCorrect ? 'bg-green-900/30 border-green-600' : 'bg-red-900/30 border-red-600'}`}
          >
            <div className="flex items-center gap-3">
              {feedback.isCorrect ? (
                <CheckCircleIcon className="w-6 h-6 text-green-400" />
              ) : (
                <XCircleIcon className="w-6 h-6 text-red-400" />
              )}
              <span className="text-lg font-semibold text-white">
                {feedback.isCorrect ? t('practice.correct') : t('practice.incorrect')}
              </span>
            </div>
          </div>

          {/* Detailed explanation (shows after delay) */}
          {showCorrectAnswer && (
            <FeedbackExplanation
              isAnswered={isAnswered}
              showExplanation={showExplanation}
              feedback={feedback}
              t={t}
              questionLanguage={questionLanguage}
              generatedPassageLanguage={generatedPassageLanguage}
            />
          )}
        </div>
      )}
      <ProgressionFeedback />
      {isSubmittingFeedback && (
        <div className="mt-4 p-4 bg-gray-700/50 border border-gray-600 rounded-lg shadow">
          <div className="flex items-center justify-center space-x-3">
            <div className="animate-spin h-5 w-5 border-2 border-blue-400 border-t-transparent rounded-full"></div>
            <span className="text-gray-300">
              {t('practice.loadingNextQuestion') || 'Loading next question...'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizSection;
