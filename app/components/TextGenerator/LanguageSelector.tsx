'use client';

import React from 'react';
import { GlobeAltIcon, BookOpenIcon } from '@heroicons/react/24/solid';
import { LANGUAGES, type Language } from '../../contexts/LanguageContext';
import useTextGeneratorStore from '../../store/textGeneratorStore';
import { useTranslation } from 'react-i18next';

const LanguageSelector = () => {
  const { t } = useTranslation('common');
  const { passageLanguage, cefrLevel, setPassageLanguage, isProgressLoading } =
    useTextGeneratorStore();

  return (
    <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700 shadow-lg mb-8">
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
          value={passageLanguage}
          onChange={(e) => setPassageLanguage(e.target.value as Language)}
          className="w-full px-3 py-2 text-sm text-white bg-gray-700 border border-gray-600 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-green-500 transition-colors col-span-1"
        >
          {(Object.keys(LANGUAGES) as Language[]).map((lang) => (
            <option key={lang} value={lang}>
              {LANGUAGES[lang]}
            </option>
          ))}
        </select>
        <div
          id="cefr-level-display"
          className="relative w-full px-3 py-2 text-sm text-white bg-gray-800 border border-gray-700 rounded col-span-1 flex items-center justify-between cursor-default"
        >
          <span>
            {cefrLevel} - {t(`practice.cefr.levels.${cefrLevel}.name`)}
            {isProgressLoading && (
              <span className="ml-2 text-xs text-gray-400 animate-pulse">
                {t('common.loading')}
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
};

export default LanguageSelector;
