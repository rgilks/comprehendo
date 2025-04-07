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

const TextGeneratorContainer = () => {
  const { language: contextLanguage } = useLanguage();
  const { status } = useSession();
  const { loading, quizData, showContent, isAnswered, fetchUserProgress } = useTextGeneratorStore();

  const contentContainerRef = useRef<HTMLDivElement>(null);

  // Determine if content is visible
  const isContentVisible = !!(quizData && !loading && showContent);

  // Determine if progress tracker should be visible
  const showProgressTracker = (isAnswered || !isContentVisible) && !loading;

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

    // Always ensure the question language is set to the user's interface language
    useTextGeneratorStore.setState({ generatedQuestionLanguage: contextLanguage });
  }, [status, fetchUserProgress, contextLanguage]);

  // Set the question language based on the UI language context
  useEffect(() => {
    // Set the user's interface language as the question language
    useTextGeneratorStore.setState({ generatedQuestionLanguage: contextLanguage });
  }, [contextLanguage]);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 relative" ref={contentContainerRef}>
      <div className="w-full max-w-3xl mx-auto my-8">
        <LanguageSelector />
        <LoginPrompt />
        <ErrorDisplay />

        {/* Quiz skeleton with animation */}
        <AnimateTransition show={loading && !quizData} type="fade-in" duration={400} unmountOnExit>
          <QuizSkeleton />
        </AnimateTransition>

        {/* Content container with animation */}
        <AnimateTransition show={isContentVisible} type="fade-in" duration={400} unmountOnExit>
          {quizData && !loading && (
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
              <ReadingPassage />
              <QuizSection />
            </div>
          )}
        </AnimateTransition>

        {/* Progress tracker with animation */}
        <AnimateTransition show={showProgressTracker} type="fade-in" duration={400} unmountOnExit>
          <ProgressTracker />
        </AnimateTransition>

        {/* Generator appears with animation */}
        <Generator />
      </div>
    </div>
  );
};

export default TextGeneratorContainer;
