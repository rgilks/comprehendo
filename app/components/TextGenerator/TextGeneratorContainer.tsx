'use client';

import React, { useRef, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSession } from 'next-auth/react';
import useTextGeneratorStore from '@/store/textGeneratorStore';
import LanguageSelector from './LanguageSelector';
import LoginPrompt from './LoginPrompt';
import ErrorDisplay from './ErrorDisplay';
import QuizSkeleton from './QuizSkeleton';
import ReadingPassage from './ReadingPassage';
import QuizSection from './QuizSection';
import ProgressTracker from './ProgressTracker';
import Generator from './Generator';

const TextGeneratorContainer = () => {
  const { language: contextLanguage } = useLanguage();
  const { status } = useSession();
  const { loading, quizData, showContent, isAnswered, fetchUserProgress } = useTextGeneratorStore();

  const contentContainerRef = useRef<HTMLDivElement>(null);
  const generatedContentRef = useRef<HTMLDivElement>(null);

  const isContentVisible = !!(quizData && !loading && showContent);

  const showProgressTracker = (isAnswered || !isContentVisible) && !loading;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isSpeechSupported =
        'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
      useTextGeneratorStore.setState({ isSpeechSupported });
    }

    if (status === 'authenticated') {
      void fetchUserProgress();
    }

    useTextGeneratorStore.setState({ generatedQuestionLanguage: contextLanguage });
  }, [status, fetchUserProgress, contextLanguage]);

  useEffect(() => {
    useTextGeneratorStore.setState({ generatedQuestionLanguage: contextLanguage });
  }, [contextLanguage]);

  return (
    <div
      className="max-w-4xl mx-auto p-3 md:p-6 space-y-4 md:space-y-6 relative"
      ref={contentContainerRef}
      data-testid="text-generator-container"
    >
      <div className="w-full max-w-3xl mx-auto my-8">
        <LanguageSelector />
        <LoginPrompt />
        <ErrorDisplay />

        {loading && !quizData && <QuizSkeleton />}

        {isContentVisible && (
          <div
            className="bg-gray-800 rounded-xl p-4 md:p-6 border border-gray-700 shadow-lg mt-6"
            data-testid="generated-content"
            ref={generatedContentRef}
          >
            <ReadingPassage />
            <QuizSection />
          </div>
        )}

        {showProgressTracker && <ProgressTracker />}

        <Generator />
      </div>
    </div>
  );
};

export default TextGeneratorContainer;
