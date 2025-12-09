'use client';

import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useSession } from 'next-auth/react';
import useTextGeneratorStore from 'app/store/textGeneratorStore';
import AuthButton from 'app/components/AuthButton';
import { SparklesIcon, FireIcon, TrophyIcon } from '@heroicons/react/24/solid';

const ProgressionFeedback = () => {
  const { t } = useTranslation('common');
  const { status } = useSession();
  const { isAnswered, showExplanation, feedback, userStreak, cefrLevel } = useTextGeneratorStore();

  const isAuthenticated = status === 'authenticated';

  // Don't show if not answered or explanation not shown
  if (!isAnswered || !showExplanation) {
    return null;
  }

  const isCorrect = feedback.isCorrect === true;
  const isIncorrect = feedback.isCorrect === false;
  const currentStreak = userStreak ?? 0;
  const remainingToLevelUp = Math.max(0, 5 - currentStreak);

  // Unauthenticated user teaser
  if (!isAuthenticated) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="mt-4 p-4 bg-gradient-to-r from-blue-900/60 to-indigo-900/60 border border-blue-700/70 rounded-lg shadow-lg"
        >
          <div className="flex items-start gap-3">
            <SparklesIcon className="h-6 w-6 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="flex-grow">
              <p className="text-sm font-medium text-blue-100 mb-2">
                {t('practice.progressionFeedback.signInToTrack')}
              </p>
              <div className="flex items-center gap-3">
                <AuthButton variant="short" />
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Authenticated user - Level up celebration (streak is 0 after correct answer means level up occurred)
  if (isCorrect && currentStreak === 0) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="mt-4 p-5 bg-gradient-to-r from-yellow-900/70 to-orange-900/70 border-2 border-yellow-500/50 rounded-lg shadow-xl relative overflow-hidden"
        >
          {/* Animated background sparkle effect */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 bg-gradient-to-r from-yellow-400/10 to-orange-400/10"
          />

          <div className="relative flex items-start gap-3">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
            >
              <TrophyIcon className="h-8 w-8 text-yellow-400 flex-shrink-0" />
            </motion.div>
            <div className="flex-grow">
              <motion.h4
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-lg font-bold text-yellow-100 mb-1"
              >
                {t('practice.progressionFeedback.levelUp', { level: cefrLevel })}
              </motion.h4>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-sm text-yellow-200/90"
              >
                {t('practice.progressionFeedback.keepLearning')}
              </motion.p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Authenticated user - Correct answer with streak
  if (isCorrect) {
    const showFireEmoji = currentStreak >= 3;
    const almostThere = currentStreak === 4;

    return (
      <AnimatePresence mode="wait">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className={`mt-4 p-4 rounded-lg shadow-lg border-2 ${
            almostThere
              ? 'bg-gradient-to-r from-orange-900/70 to-yellow-900/70 border-orange-500/50'
              : 'bg-gradient-to-r from-green-900/60 to-emerald-900/60 border-green-700/70'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {showFireEmoji && (
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.3 }}>
                  <FireIcon className="h-6 w-6 text-orange-400" />
                </motion.div>
              )}
              <div>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className={`text-sm font-semibold ${
                    almostThere ? 'text-orange-100' : 'text-green-100'
                  }`}
                >
                  {almostThere
                    ? t('practice.progressionFeedback.almostThere', {
                        remaining: remainingToLevelUp,
                      })
                    : t('practice.progressionFeedback.correct', { streak: currentStreak })}
                </motion.p>
                {!almostThere && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-xs text-green-200/80 mt-1"
                  >
                    {remainingToLevelUp === 0
                      ? t('practice.progressionFeedback.levelUpNext')
                      : t('practice.progressionFeedback.remaining', {
                          remaining: remainingToLevelUp,
                        })}
                  </motion.p>
                )}
              </div>
            </div>

            {/* Visual progress indicator */}
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: i * 0.05, type: 'spring', stiffness: 300 }}
                  className={`w-2 h-2 rounded-full ${
                    i < currentStreak
                      ? almostThere
                        ? 'bg-orange-400 shadow-sm shadow-orange-400/50'
                        : 'bg-green-400 shadow-sm shadow-green-400/50'
                      : 'bg-gray-600'
                  }`}
                />
              ))}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // Authenticated user - Incorrect answer (streak reset)
  if (isIncorrect) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="mt-4 p-4 bg-gradient-to-r from-red-900/50 to-pink-900/50 border border-red-700/60 rounded-lg shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="text-sm font-medium text-red-100"
              >
                {t('practice.progressionFeedback.incorrect')}
              </motion.p>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-xs text-red-200/80 mt-1"
              >
                {t('practice.progressionFeedback.keepTrying')}
              </motion.p>
            </div>

            {/* Visual progress indicator showing reset */}
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 1 }}
                  animate={{ scale: [1, 0.8, 1] }}
                  transition={{ delay: i * 0.03 }}
                  className="w-2 h-2 rounded-full bg-gray-600"
                />
              ))}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return null;
};

export default ProgressionFeedback;
