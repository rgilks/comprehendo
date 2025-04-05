'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from 'next-auth/react';
import { XMarkIcon } from '@heroicons/react/24/solid';
import useTextGeneratorStore from '@/store/textGeneratorStore';
import AuthButton from '@/components/AuthButton';

const LoginPrompt = () => {
  const { t } = useTranslation('common');
  const { status } = useSession();
  const { showLoginPrompt, setShowLoginPrompt } = useTextGeneratorStore();

  if (status !== 'unauthenticated' || !showLoginPrompt) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-blue-900/60 to-indigo-900/60 border border-blue-700/70 rounded-lg p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
      <p className="text-sm text-blue-100 flex-grow text-center sm:text-left order-2 sm:order-1">
        {t('practice.signInPrompt.message')}
      </p>
      <div className="flex-shrink-0 order-1 sm:order-2">
        <AuthButton />
      </div>
      <button
        onClick={() => setShowLoginPrompt(false)}
        className="p-1 text-blue-300 hover:text-white hover:bg-blue-800/50 rounded-full transition-colors flex-shrink-0 order-3"
        aria-label={t('practice.signInPrompt.dismiss')}
        title={t('practice.signInPrompt.dismiss')}
      >
        <XMarkIcon className="h-4 w-4" />
      </button>
    </div>
  );
};

export default LoginPrompt;
