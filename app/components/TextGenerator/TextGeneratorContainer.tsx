'use client';

import React, { useRef, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSession } from 'next-auth/react';
import useTextGeneratorStore from '../../store/textGeneratorStore';
import AnimateTransition from '../AnimateTransition';
import LanguageSelector from './LanguageSelector';
import LoginPrompt from './LoginPrompt';
import ErrorDisplay from './ErrorDisplay';
import QuizSkeleton from './QuizSkeleton';
import ReadingPassage from './ReadingPassage';
import QuizSection from './QuizSection';
import ProgressTracker from './ProgressTracker';
import Generator from './Generator';

const TextGeneratorContainer = () => {
  const { language: questionLanguage } = useLanguage();
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

  // Update the store when question language changes
  useEffect(() => {
    useTextGeneratorStore.setState({ generatedQuestionLanguage: questionLanguage });
  }, [questionLanguage]);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 relative" ref={contentContainerRef}>
      <div className="w-full max-w-3xl mx-auto my-8">
        <LanguageSelector />
        <LoginPrompt />
        <ErrorDisplay />

        {loading && !quizData && <QuizSkeleton />}

        {quizData && !loading && (
          <AnimateTransition show={showContent} type="fade-in" duration={400} unmountOnExit>
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-lg">
              <ReadingPassage />
              <QuizSection />
            </div>
          </AnimateTransition>
        )}

        {(!quizData || !loading) && (
          <>
            <ProgressTracker />
            <Generator />
          </>
        )}
      </div>
    </div>
  );
};

export default TextGeneratorContainer;
