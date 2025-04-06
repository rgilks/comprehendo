'use client';

import React, { useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import useTextGeneratorStore from '@/store/textGeneratorStore';
import AnimateTransition from '@/components/AnimateTransition';

const Generator = () => {
  const { t } = useTranslation('common');
  const { loading, quizData, isAnswered, generateText } = useTextGeneratorStore();
  const contentContainerRef = useRef<HTMLDivElement>(null);

  // Handle text generation with scroll
  const generateTextHandler = useCallback(() => {
    // First scroll to the content area
    if (contentContainerRef.current) {
      contentContainerRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }

    // Then generate the text
    void generateText();
  }, [generateText]);

  // Determine if generator button should be visible
  const showGeneratorButton = (isAnswered || !quizData) && !loading;

  return (
    <AnimateTransition
      show={showGeneratorButton}
      type="fade-in"
      duration={400}
      delay={200}
      unmountOnExit
    >
      <div className="mt-8">
        <button
          onClick={generateTextHandler}
          disabled={loading}
          className={`w-full px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white ${
            loading
              ? 'bg-gray-600 cursor-not-allowed opacity-70'
              : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-green-600 hover:from-blue-700 hover:via-indigo-700 hover:to-green-700'
          } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-cyan-500 transition duration-150 ease-in-out flex items-center justify-center`}
        >
          {loading ? (
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
      </div>
    </AnimateTransition>
  );
};

export default Generator;
