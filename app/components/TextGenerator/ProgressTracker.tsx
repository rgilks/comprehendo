'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import useTextGeneratorStore from '@/store/textGeneratorStore';
import { useSession } from 'next-auth/react';
import type { CEFRLevel } from '@/config/language-guidance';
import AnimateTransition from '@/components/AnimateTransition';

const ProgressTracker = () => {
  const { t } = useTranslation('common');
  const { status } = useSession();
  const { userStreak, cefrLevel } = useTextGeneratorStore();

  if (status !== 'authenticated' || userStreak === null) {
    return null;
  }

  // Create a lookup for level indices
  const levelIndices = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 };

  return (
    <div className="mt-10 mb-4 p-3 bg-gradient-to-r from-gray-900/80 via-gray-800/90 to-gray-900/80 rounded-xl border border-indigo-500/30 shadow-lg hover:shadow-indigo-500/10 transition-all duration-300 backdrop-blur-sm">
      <h3 className="text-base font-semibold text-white mb-2 flex items-center">
        <span className="mr-2 text-indigo-400">⚡</span>
        {t('practice.yourProgress')}
      </h3>

      <AnimateTransition show={true} type="fade-in" duration={300} delay={100}>
        <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-300 font-medium">
              {t(`practice.cefr.levels.${cefrLevel}.name`)}
            </span>
          </div>

          {/* Single unified progress track */}
          <div className="relative py-6">
            {/* Background track */}
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-700/50 rounded-full transform -translate-y-1/2"></div>

            {/* Track with dots between level markers - removed scrolling wrapper and min-width */}
            <div className="relative flex justify-between items-center">
              {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as CEFRLevel[]).map((level, idx, levels) => (
                <React.Fragment key={level}>
                  {/* Level marker */}
                  <div className="relative z-20">
                    <div
                      className={`w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300
                        ${
                          level === cefrLevel
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white scale-110 shadow-lg shadow-blue-500/30'
                            : levelIndices[cefrLevel] > levelIndices[level]
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-800 text-gray-500'
                        }
                      `}
                    >
                      {level}
                    </div>
                  </div>

                  {/* Dots between this level and next level */}
                  {idx < levels.length - 1 && (
                    <div className="flex-1 flex justify-evenly items-center z-10 mx-0 md:mx-1">
                      {Array.from({ length: 4 }, (_, dotIdx) => {
                        // For completed levels
                        if (levelIndices[cefrLevel] > levelIndices[level]) {
                          return (
                            <div
                              key={dotIdx}
                              className="w-1.5 h-1.5 md:w-2.5 md:h-2.5 rounded-full bg-blue-500/80 shadow-sm shadow-blue-500/30"
                            />
                          );
                        }

                        // For current level - show streak
                        if (level === cefrLevel) {
                          return (
                            <div
                              key={dotIdx}
                              className={`w-1.5 h-1.5 md:w-2.5 md:h-2.5 rounded-full transition-all duration-300
                                ${
                                  dotIdx < userStreak
                                    ? 'bg-gradient-to-r from-yellow-400 to-orange-500 shadow-sm shadow-yellow-500/20'
                                    : dotIdx === userStreak
                                      ? 'bg-gradient-to-r from-orange-500 to-red-600 scale-110 shadow-sm shadow-red-500/30'
                                      : 'bg-gray-700'
                                }
                              `}
                            />
                          );
                        }

                        // For future levels
                        return (
                          <div
                            key={dotIdx}
                            className="w-1.5 h-1.5 md:w-2.5 md:h-2.5 rounded-full bg-gray-700"
                          />
                        );
                      })}
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Motivational message */}
          <div className="mt-2 text-center">
            <span className="text-xs text-gray-300">
              {userStreak === 0
                ? t('practice.startStreak')
                : userStreak === 4
                  ? t('practice.almostLevelUp')
                  : ''}
            </span>
          </div>
        </div>
      </AnimateTransition>
    </div>
  );
};

export default ProgressTracker;
