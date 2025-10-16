'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from 'next-auth/react';
import { XMarkIcon } from '@heroicons/react/24/solid';
import useTextGeneratorStore from 'app/store/textGeneratorStore';
import AuthButton from 'app/components/AuthButton';

const LoginPrompt = () => {
  const { t } = useTranslation('common');
  const { status } = useSession();
  const { showLoginPrompt, setShowLoginPrompt } = useTextGeneratorStore();

  if (status !== 'unauthenticated' || !showLoginPrompt) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-blue-900/60 to-indigo-900/60 border border-blue-700/70 rounded-lg p-4 mb-6 flex flex-col items-center gap-4 shadow-md relative">
      <p className="text-sm text-blue-100 text-center w-full">
        {t('practice.signInPrompt.message')}
      </p>
      <div className="flex items-center justify-center w-full">
        <div className="flex md:hidden items-center justify-center">
          <AuthButton variant="icon-only" />
        </div>
        <div className="hidden md:flex items-center justify-center">
          <AuthButton variant="short" />
        </div>
      </div>
      <button
        onClick={() => {
          setShowLoginPrompt(false);
        }}
        className="absolute top-2 right-2 p-1 text-blue-300 hover:text-white hover:bg-blue-800/50 rounded-full transition-colors"
        aria-label={t('practice.signInPrompt.dismiss')}
        title={t('practice.signInPrompt.dismiss')}
      >
        <XMarkIcon className="h-4 w-4" />
      </button>
    </div>
  );
};

export default LoginPrompt;
