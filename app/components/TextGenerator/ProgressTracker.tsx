'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import useTextGeneratorStore from '@/store/textGeneratorStore';
import { useSession } from 'next-auth/react';
import type { CEFRLevel } from '@/config/language-guidance';

const ProgressTracker = () => {
  const { t } = useTranslation('common');
  const { status } = useSession();
  const { userStreak, cefrLevel } = useTextGeneratorStore();

  if (status !== 'authenticated' || userStreak === null) {
    return null;
  }

  return (
    <div className="mb-6 p-4 bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl border border-gray-700 shadow-lg">
      <h3 className="text-lg font-semibold text-white mb-3">{t('practice.yourProgress')}</h3>

      <div className="grid grid-cols-1 gap-4">
        <div>
          <span className="text-sm text-gray-400">{t('practice.currentStreak')}</span>

          {/* Progress bar for streak */}
          <div className="mt-2 w-full bg-gray-700 rounded-full h-2.5">
            <div
              className="bg-gradient-to-r from-yellow-500 to-orange-500 h-2.5 rounded-full transition-all duration-300 ease-in-out"
              style={{ width: `${Math.min(100, (userStreak / 5) * 100)}%` }}
            ></div>
          </div>

          {/* Simple streak indicator without numbers */}
          <div className="mt-3 flex justify-between items-center">
            {[1, 2, 3, 4, 5].map((position) => (
              <div key={position} className="flex flex-col items-center">
                <div
                  className={`w-3 h-3 rounded-full
                    ${position <= userStreak ? 'bg-yellow-500' : 'bg-gray-600'}
                    transition-all duration-300`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Level progress section */}
        <div className="mt-6 pt-4 border-t border-gray-700">
          <span className="text-sm text-gray-400 block mb-2">{t('practice.level')}</span>
          <div className="flex items-center mb-4">
            <span className="text-xl font-bold text-white mr-2">{cefrLevel}</span>
            <span className="text-sm text-gray-300">
              - {t(`practice.cefr.levels.${cefrLevel}.name`)}
            </span>
          </div>
          <div className="text-xs text-gray-300 mb-4">
            {t(`practice.cefr.levels.${cefrLevel}.description`)}
          </div>

          {/* Level labels above the progress indicators */}
          <div className="flex justify-between items-center text-xs text-gray-400 mb-1">
            <span>A1</span>
            <span>A2</span>
            <span>B1</span>
            <span>B2</span>
            <span>C1</span>
            <span>C2</span>
          </div>

          <div className="flex justify-between items-center mb-1">
            {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as CEFRLevel[]).map((level, index) => {
              const achieved = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].indexOf(cefrLevel) >= index;
              const isCurrent = level === cefrLevel;
              return (
                <div key={level} className="flex flex-col items-center">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      achieved ? 'bg-blue-500' : 'bg-gray-600'
                    } ${isCurrent ? 'ring-1 ring-white ring-opacity-60' : ''}`}
                    title={`${level}: ${t(`practice.cefr.levels.${level}.name`)}`}
                  />
                </div>
              );
            })}
          </div>

          <div className="w-full bg-gray-700 rounded-full h-2.5 mt-1">
            {/* Calculate progress based on CEFR level */}
            {(() => {
              const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
              const levelIndex = levels.indexOf(cefrLevel);
              const progress = ((levelIndex + 1) / 6) * 100;
              return (
                <div
                  className="bg-gradient-to-r from-blue-500 via-indigo-500 to-green-500 h-2.5 rounded-full transition-all duration-300 ease-in-out"
                  style={{ width: `${progress}%` }}
                ></div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressTracker;
