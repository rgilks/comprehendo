'use client';

import React from 'react';
import { GlobeAltIcon, BookOpenIcon } from '@heroicons/react/24/solid';
import { LEARNING_LANGUAGES, type LearningLanguage } from 'app/domain/language';
import useTextGeneratorStore from 'app/store/textGeneratorStore';
import { useTranslation } from 'react-i18next';

const LanguageSelector = () => {
  const { t } = useTranslation('common');
  const { passageLanguage, cefrLevel, setPassageLanguage, isProgressLoading } =
    useTextGeneratorStore();

  return (
    <div className="bg-gradient-to-r from-gray-800 via-gray-800 to-gray-900 rounded-2xl p-6 md:p-8 border border-gray-700 shadow-xl mb-6">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <label
          htmlFor="passage-language-select"
          className="block text-sm font-medium text-white col-span-1"
        >
          <span className="flex items-center">
            <GlobeAltIcon className="h-5 w-5 mr-1 text-green-400" aria-hidden="true" />
            {t('practice.passageLanguageLabel')}
          </span>
        </label>
        <label
          htmlFor="cefr-level-display"
          className="block text-sm font-medium text-white col-span-1"
        >
          <span className="flex items-center">
            <BookOpenIcon className="h-4 w-4 mr-1.5 text-blue-400" />
            {t('practice.level')}
          </span>
        </label>
        <select
          id="passage-language-select"
          data-testid="language-select"
          value={passageLanguage}
          onChange={(e) => {
            setPassageLanguage(e.target.value as LearningLanguage);
          }}
          className="w-full px-3 py-2 text-sm text-white bg-gray-700 border border-gray-600 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-green-500 transition-colors col-span-1"
        >
          {(Object.keys(LEARNING_LANGUAGES) as LearningLanguage[]).map((lang) => (
            <option key={lang} value={lang} className="bg-gray-800 text-white">
              {t(`languages.learning.${lang}`)}
            </option>
          ))}
        </select>
        <div
          id="cefr-level-display"
          data-testid="level-display"
          className="relative w-full px-3 py-2 text-sm text-white bg-gray-800 border border-gray-700 rounded col-span-1 flex items-center justify-between cursor-default"
        >
          <span>
            <span className="hidden sm:inline">{cefrLevel} - </span>
            {t(`practice.cefr.levels.${cefrLevel}.name`)}
            {isProgressLoading && (
              <span
                className="ml-2 text-xs text-gray-400 animate-pulse"
                data-testid="loading-indicator"
              >
                {t('loading')}
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
};

export default LanguageSelector;
