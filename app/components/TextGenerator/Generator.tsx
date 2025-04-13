'use client';

import React, { useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import useTextGeneratorStore from '@/store/textGeneratorStore';
import { HandThumbUpIcon, HandThumbDownIcon } from '@heroicons/react/24/solid';
import { useSession } from 'next-auth/react';
import QuizSkeleton from './QuizSkeleton';

const Generator = () => {
  const { t } = useTranslation('common');
  const { status } = useSession();
  const { loading, quizData, isAnswered, generateText, feedbackSubmitted, submitFeedback } =
    useTextGeneratorStore();
  const contentContainerRef = useRef<HTMLDivElement>(null);

  const generateTextHandler = useCallback(() => {
    if (contentContainerRef.current) {
      contentContainerRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }

    void generateText();
  }, [generateText]);

  const showFeedbackPrompt =
    isAnswered && !feedbackSubmitted && !loading && status === 'authenticated';
  const showFeedbackLoading =
    isAnswered && !feedbackSubmitted && loading && status === 'authenticated';
  const showGeneratorButton =
    !loading && (!quizData || (isAnswered && (feedbackSubmitted || status !== 'authenticated')));

  return (
    <div className="mt-6 md:mt-8" ref={contentContainerRef}>
      {showFeedbackPrompt && (
        <div className="text-center p-4 bg-gray-800 rounded-lg border border-gray-700 shadow-md">
          <p className="text-md font-semibold text-gray-200 mb-4">Was this question helpful?</p>
          <div className="flex justify-center space-x-6">
            <button
              onClick={() => submitFeedback('good')}
              disabled={loading}
              className={`flex flex-col items-center p-3 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-green-500 text-gray-300 hover:text-green-400 hover:bg-green-900/30`}
              aria-label="Good question"
              data-testid="feedback-good-button"
            >
              <HandThumbUpIcon className="h-8 w-8 mb-1" />
              <span className="text-xs font-medium">Yes</span>
            </button>
            <button
              onClick={() => submitFeedback('bad')}
              disabled={loading}
              className={`flex flex-col items-center p-3 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-500 text-red-400 hover:text-red-400 hover:bg-red-900/30`}
              aria-label="Bad question"
              data-testid="feedback-bad-button"
            >
              <HandThumbDownIcon className="h-8 w-8 mb-1" />
              <span className="text-xs font-medium">No</span>
            </button>
          </div>
        </div>
      )}

      {showFeedbackLoading && (
        <div className="mt-6">
          <QuizSkeleton />
        </div>
      )}

      {showGeneratorButton && (
        <button
          onClick={generateTextHandler}
          disabled={loading}
          data-testid="generate-button"
          className={`w-full px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white ${
            loading
              ? 'bg-gray-600 cursor-not-allowed opacity-70'
              : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-green-600 hover:from-blue-700 hover:via-indigo-700 hover:to-green-700'
          } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-cyan-500 transition duration-150 ease-in-out flex items-center justify-center`}
        >
          {loading && !showFeedbackPrompt ? (
            <div className="flex items-center">
              <div className="animate-spin -ml-1 mr-3 h-5 w-5 text-white">
                <svg
                  className="h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              </div>
              {t('common.generating')}
            </div>
          ) : (
            t('practice.generateNewText')
          )}
        </button>
      )}
    </div>
  );
};

export default Generator;
