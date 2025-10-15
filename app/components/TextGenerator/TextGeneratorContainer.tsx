'use client';

import React, { useRef, useEffect } from 'react';
import { useLanguage } from 'app/hooks/useLanguage';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'motion/react';
import useTextGeneratorStore from 'app/store/textGeneratorStore';
import { type LearningLanguage } from 'app/domain/language';
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
  const { loading, quizData, showContent, isAnswered, fetchProgress, setPassageLanguage } =
    useTextGeneratorStore();

  const contentContainerRef = useRef<HTMLDivElement>(null);
  const generatedContentRef = useRef<HTMLDivElement>(null);
  const defaultLanguageAppliedRef = useRef(false);

  const isContentVisible = !!(quizData && !loading && showContent);

  const showProgressTracker = (isAnswered || !isContentVisible) && !loading;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isSpeechSupported =
        'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
      const store: Partial<ReturnType<typeof useTextGeneratorStore.getState>> =
        useTextGeneratorStore.getState();
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (store && typeof store.setIsSpeechSupported === 'function') {
        store.setIsSpeechSupported(isSpeechSupported);
      }
    }

    if (status === 'authenticated') {
      void fetchProgress();
    }

    if (!defaultLanguageAppliedRef.current) {
      const currentPassageLanguage = useTextGeneratorStore.getState().passageLanguage;
      if (contextLanguage === 'en') {
        if (currentPassageLanguage !== 'es') {
          setPassageLanguage('es' as LearningLanguage);
        }
      } else {
        if (currentPassageLanguage !== 'en') {
          setPassageLanguage('en' as LearningLanguage);
        }
      }
      defaultLanguageAppliedRef.current = true;
    }

    useTextGeneratorStore.setState({ generatedQuestionLanguage: contextLanguage });
  }, [status, fetchProgress, contextLanguage, setPassageLanguage]);

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

        <AnimatePresence>
          {isContentVisible && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-4 md:p-6 lg:p-8 border border-gray-700 shadow-2xl mt-6"
              data-testid="generated-content"
              ref={generatedContentRef}
            >
              <div className="flex flex-col lg:flex-row lg:gap-8 lg:items-start">
                <motion.div
                  className="lg:w-2/5 lg:sticky lg:top-4 lg:self-start lg:max-h-screen lg:overflow-y-auto"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                >
                  <ReadingPassage />
                </motion.div>
                <motion.div
                  className="lg:w-3/5 lg:pl-4 lg:min-h-0"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                >
                  <QuizSection />
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {showProgressTracker && <ProgressTracker />}

        <div className="mt-4">
          <Generator />
        </div>
      </div>
    </div>
  );
};

export default TextGeneratorContainer;
