'use client';

import React, { useRef, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSession } from 'next-auth/react';
import useTextGeneratorStore from '@/store/textGeneratorStore';
import AnimateTransition from '@/components/AnimateTransition';
import LanguageSelector from './LanguageSelector';
import LoginPrompt from './LoginPrompt';
import ErrorDisplay from './ErrorDisplay';
import QuizSkeleton from './QuizSkeleton';
import ReadingPassage from './ReadingPassage';
import QuizSection from './QuizSection';
import ProgressTracker from './ProgressTracker';
import Generator from './Generator';
import ReactQueryAdapter from '../../../components/TextGenerator/ReactQueryAdapter';

const TextGeneratorContainer = () => {
  const { language: contextLanguage } = useLanguage();
  const { status } = useSession();
  const { loading, quizData, showContent, fetchUserProgress } = useTextGeneratorStore();

  const contentContainerRef = useRef<HTMLDivElement>(null);

  // Effect to setup speech synthesis and fetch user progress
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check speech synthesis support
      const isSpeechSupported =
        'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
      useTextGeneratorStore.setState({ isSpeechSupported });
    }

    // Fetch user progress if authenticated
    if (status === 'authenticated') {
      void fetchUserProgress();
    }
  }, [status, fetchUserProgress]);

  // Update the store when question language changes, but only once on mount
  // and when the contextLanguage changes to prevent infinite updates
  useEffect(() => {
    useTextGeneratorStore.setState({ generatedQuestionLanguage: contextLanguage });
  }, [contextLanguage]);

  return (
    <div ref={contentContainerRef} className="w-full max-w-3xl mx-auto">
      {/* React Query Adapter - provides React Query capabilities to the store */}
      <ReactQueryAdapter />

      <div className="mx-auto px-4 sm:px-6 md:px-8 py-4 sm:py-6 md:py-8">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
          <LanguageSelector />
          <ProgressTracker />
        </div>

        {status === 'authenticated' ? null : <LoginPrompt />}

        <ErrorDisplay />

        <AnimateTransition show={showContent}>
          {loading ? (
            <QuizSkeleton />
          ) : (
            <>
              {quizData && <ReadingPassage />}
              {quizData && <QuizSection />}
            </>
          )}
        </AnimateTransition>

        <Generator />
      </div>
    </div>
  );
};

export default TextGeneratorContainer;
