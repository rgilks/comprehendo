'use client';

import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getTextDirection, useLanguage } from 'app/hooks/useLanguage';
import useTextGeneratorStore from 'app/store/textGeneratorStore';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import type { QuizData } from 'app/domain/schemas';
import type { Language } from 'app/domain/language';
import { LanguageSchema } from 'app/domain/language';

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
  handleAsyncClick,
}) => (
  <button
    key={optionKey}
    onClick={handleAsyncClick(optionKey)}
    disabled={isAnswered}
    className={`w-full text-left p-3 rounded-md border transition-colors relative ${
      isAnswered && feedback.correctAnswer
        ? optionKey === feedback.correctAnswer
          ? 'bg-green-900/50 border-green-700 text-green-100'
          : selectedAnswer === optionKey
            ? 'bg-red-900/50 border-red-700 text-red-100'
            : 'bg-gray-800/50 border-gray-700 text-gray-400'
        : selectedAnswer === optionKey
          ? 'bg-blue-900/50 border-blue-700 text-blue-100'
          : 'bg-gray-800/50 border-gray-700 text-gray-300 hover:bg-gray-700/50'
    }`}
    data-testid={`answer-option-${index}`}
  >
    {value}
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
    <div className="mt-6 space-y-4" data-testid="quiz-section">
      <h3
        className="text-lg font-semibold text-white"
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
            handleAsyncClick={handleAsyncClick}
          />
        ))}
      </div>
      <FeedbackExplanation
        isAnswered={isAnswered}
        showExplanation={showExplanation}
        feedback={feedback}
        t={t}
        questionLanguage={questionLanguage}
        generatedPassageLanguage={generatedPassageLanguage}
      />
    </div>
  );
};

export default QuizSection;
